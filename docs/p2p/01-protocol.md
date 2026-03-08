# P2P Chat System — Protocol Specification

> Wire protocol for all peer-to-peer communication over WebRTC DataChannels.

---

## Table of Contents

- [Protocol Version](#protocol-version)
- [Message Envelope](#message-envelope)
- [Message Types](#message-types)
  - [Connection Messages](#connection-messages)
  - [Text Messages](#text-messages)
  - [Presence Messages](#presence-messages)
  - [Chat Session Messages](#chat-session-messages)
  - [Media Control Messages](#media-control-messages)
  - [File Transfer Messages](#file-transfer-messages)
  - [Error Messages](#error-messages)
- [Sequencing Rules](#sequencing-rules)
- [Serialization](#serialization)
- [Keepalive](#keepalive)

---

## Protocol Version

All messages include a `version` field set to `NEONP2P/1.0`.

Peers **MUST** check the version on the first received message (HELLO). If the major version differs, the peer should respond with an ERROR (code `1001`, "Unsupported protocol version") and close the DataChannel.

Minor version bumps (e.g., `NEONP2P/1.1`) are backwards-compatible. Peers should ignore unknown message types gracefully.

---

## Message Envelope

Every message sent over a DataChannel uses this envelope:

```typescript
interface NeonP2PMessage<T = unknown> {
  /** Protocol version identifier */
  version: 'NEONP2P/1.0'

  /** Message type discriminator */
  type: MessageType

  /** Unique message ID (UUIDv4) */
  id: string

  /** Sender's peer ID */
  from: string

  /** Recipient peer ID (or '*' for broadcast in group context) */
  to: string

  /** Chat session ID this message belongs to (null for connection-level messages) */
  chatId: string | null

  /** Unix timestamp in milliseconds */
  timestamp: number

  /** Type-specific payload */
  payload: T

  /** Optional Ed25519 signature over the canonical JSON of all fields except 'signature' */
  signature?: string
}
```

### Field Rules

| Field | Required | Notes |
|-------|----------|-------|
| `version` | Yes | Always `'NEONP2P/1.0'` |
| `type` | Yes | One of the defined `MessageType` values |
| `id` | Yes | UUIDv4, unique per message. Used for ACKs and deduplication |
| `from` | Yes | Sender's peer ID (hex-encoded Ed25519 public key hash) |
| `to` | Yes | Recipient peer ID, or `'*'` for group broadcast |
| `chatId` | Conditional | Required for TEXT, PRESENCE, CHAT, MEDIA messages. Null for CONNECTION messages |
| `timestamp` | Yes | `Date.now()` at send time |
| `payload` | Yes | Type-specific object (see below) |
| `signature` | No | Ed25519 signature, hex-encoded. Required when security phase is implemented |

---

## Message Types

```typescript
type MessageType =
  // Connection
  | 'HELLO' | 'HELLO_ACK' | 'PING' | 'PONG' | 'DISCONNECT'
  // Text
  | 'TEXT' | 'TEXT_ACK' | 'TEXT_EDIT' | 'TEXT_DELETE'
  // Presence
  | 'TYPING_START' | 'TYPING_STOP' | 'STATUS_UPDATE'
  // Chat Session
  | 'CHAT_CREATE' | 'CHAT_INVITE' | 'CHAT_JOIN' | 'CHAT_LEAVE' | 'CHAT_SYNC'
  // Media Control
  | 'MEDIA_OFFER' | 'MEDIA_ANSWER' | 'MEDIA_ICE'
  | 'MEDIA_START' | 'MEDIA_STOP' | 'MEDIA_QUALITY'
  // File Transfer
  | 'FILE_OFFER' | 'FILE_ACCEPT' | 'FILE_CHUNK' | 'FILE_COMPLETE'
  // Error
  | 'ERROR'
```

---

### Connection Messages

Exchanged immediately after a DataChannel opens.

#### HELLO

Sent by the peer that initiated the connection (the one who created the RTCPeerConnection offer).

```typescript
interface HelloPayload {
  /** Human-readable display name */
  displayName: string

  /** Ed25519 public key, hex-encoded */
  publicKey: string

  /** Supported protocol features */
  capabilities: string[]
}
```

**Example capabilities:** `['text', 'media', 'screen-share', 'file-transfer']`

#### HELLO_ACK

Sent by the receiving peer in response to HELLO.

```typescript
interface HelloAckPayload {
  /** Responder's display name */
  displayName: string

  /** Responder's Ed25519 public key, hex-encoded */
  publicKey: string

  /** Capabilities this peer supports */
  capabilities: string[]

  /** Peer ID of the HELLO sender (confirmation) */
  ackedPeerId: string
}
```

**Connection is considered established** when both peers have exchanged HELLO/HELLO_ACK.

#### PING / PONG

Keepalive messages. See [Keepalive](#keepalive) section.

```typescript
interface PingPayload {
  /** Sequence number for RTT calculation */
  seq: number
}

interface PongPayload {
  /** Echo back the seq from PING */
  seq: number
}
```

#### DISCONNECT

Graceful disconnection notification.

```typescript
interface DisconnectPayload {
  /** Human-readable reason */
  reason: string

  /** Disconnect code */
  code: DisconnectCode
}

type DisconnectCode =
  | 'USER_INITIATED'    // User chose to disconnect
  | 'APP_CLOSING'       // Application is shutting down
  | 'PROTOCOL_ERROR'    // Unrecoverable protocol violation
  | 'TIMEOUT'           // Peer became unresponsive
```

---

### Text Messages

#### TEXT

A chat text message.

```typescript
interface TextPayload {
  /** Message body (UTF-8 plaintext) */
  content: string

  /** Optional: ID of message being replied to */
  replyTo?: string

  /** Optional: auto-delete TTL in ms from timestamp; 0 or absent = no auto-delete */
  ttl?: number
}
```

- Maximum `content` length: **16,384 characters** (16 KB)
- Messages exceeding the limit should be rejected with ERROR code `2001`

#### TEXT_ACK

Delivery/read receipt for a text message.

```typescript
interface TextAckPayload {
  /** ID of the TEXT message being acknowledged */
  messageId: string

  /** Acknowledgement type */
  status: 'delivered' | 'read'
}
```

- `delivered`: message was received and stored by the peer
- `read`: message was displayed in the active chat view

#### TEXT_EDIT

Edit a previously sent message.

```typescript
interface TextEditPayload {
  /** ID of the original TEXT message */
  messageId: string

  /** New content */
  content: string

  /** Edit timestamp */
  editedAt: number
}
```

- Only the original sender can edit a message
- Peers should validate `from` matches the original message's sender

#### TEXT_DELETE

Delete a previously sent message.

```typescript
interface TextDeletePayload {
  /** ID of the TEXT message to delete */
  messageId: string
}
```

- Only the original sender can delete a message
- Receivers should mark the message as deleted (tombstone), not remove from storage

---

### Presence Messages

#### TYPING_START / TYPING_STOP

```typescript
interface TypingPayload {
  /** No additional fields needed — chatId in envelope identifies the conversation */
}
```

- Send `TYPING_START` when the user begins typing
- Send `TYPING_STOP` when the user stops typing (debounce: 3 seconds of inactivity)
- Auto-expire typing indicators after **5 seconds** without a new `TYPING_START`

#### STATUS_UPDATE

Peer status change notification.

```typescript
interface StatusUpdatePayload {
  status: 'online' | 'busy' | 'idle'
}
```

---

### Chat Session Messages

#### CHAT_CREATE

Create a new chat session (1:1 or group).

```typescript
interface ChatCreatePayload {
  /** Unique chat session ID (UUIDv4) */
  chatId: string

  /** Chat type */
  type: 'direct' | 'group'

  /** Human-readable name (for groups) */
  name?: string

  /** Initial member peer IDs (including creator) */
  members: string[]
}
```

#### CHAT_INVITE

Invite a peer to an existing group chat.

```typescript
interface ChatInvitePayload {
  /** Chat session ID */
  chatId: string

  /** Invited peer ID */
  invitedPeerId: string

  /** Current chat metadata for the invitee */
  chatName?: string

  /** Current member list */
  members: string[]
}
```

#### CHAT_JOIN

Confirmation that a peer has joined a chat.

```typescript
interface ChatJoinPayload {
  /** Chat session ID */
  chatId: string

  /** Peer who joined */
  peerId: string

  /** Display name of the joining peer */
  displayName: string
}
```

#### CHAT_LEAVE

Notification that a peer is leaving a chat.

```typescript
interface ChatLeavePayload {
  /** Chat session ID */
  chatId: string

  /** Peer who is leaving */
  peerId: string
}
```

#### CHAT_SYNC

Request or respond with chat history for reconnection.

```typescript
interface ChatSyncPayload {
  /** Chat session ID */
  chatId: string

  /** Direction: 'request' to ask for history, 'response' to provide it */
  direction: 'request' | 'response'

  /** Last known message ID (for request) */
  lastMessageId?: string

  /** Messages after the last known ID (for response) */
  messages?: Array<{
    id: string
    from: string
    content: string
    timestamp: number
  }>
}
```

---

### Media Control Messages

These messages coordinate WebRTC media streams. Actual media data flows over RTP (separate from the DataChannel).

#### MEDIA_OFFER

SDP offer for media negotiation (or renegotiation).

```typescript
interface MediaOfferPayload {
  /** SDP offer string */
  sdp: string

  /** What media is being offered */
  mediaType: 'camera' | 'screen' | 'camera+screen'
}
```

#### MEDIA_ANSWER

SDP answer in response to a media offer.

```typescript
interface MediaAnswerPayload {
  /** SDP answer string */
  sdp: string
}
```

#### MEDIA_ICE

ICE candidate for media connection.

```typescript
interface MediaIcePayload {
  /** ICE candidate object */
  candidate: RTCIceCandidateInit
}
```

#### MEDIA_START

Notification that a peer has started sharing media.

```typescript
interface MediaStartPayload {
  /** Type of media started */
  mediaType: 'camera' | 'screen' | 'audio'

  /** Track ID for correlation */
  trackId: string

  /** Initial quality settings */
  quality?: QualityPreset
}

type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'adaptive'
```

#### MEDIA_STOP

Notification that a peer has stopped sharing media.

```typescript
interface MediaStopPayload {
  /** Type of media stopped */
  mediaType: 'camera' | 'screen' | 'audio'

  /** Track ID being stopped */
  trackId: string
}
```

#### MEDIA_QUALITY

Request or notification for quality adjustment.

```typescript
interface MediaQualityPayload {
  /** Direction of the request */
  direction: 'request' | 'notify'

  /** Requested or current quality level */
  quality: QualityPreset

  /** Optional: specific constraints */
  constraints?: {
    maxBitrate?: number
    maxFramerate?: number
    maxWidth?: number
    maxHeight?: number
  }
}
```

---

### File Transfer Messages

#### FILE_OFFER

Propose a file transfer.

```typescript
interface FileOfferPayload {
  /** Unique transfer ID */
  transferId: string

  /** File name */
  fileName: string

  /** File size in bytes */
  fileSize: number

  /** MIME type */
  mimeType: string

  /** SHA-256 hash of the complete file (hex-encoded) */
  fileHash: string
}
```

#### FILE_ACCEPT

Accept or reject a file offer.

```typescript
interface FileAcceptPayload {
  /** Transfer ID from the offer */
  transferId: string

  /** Whether the file is accepted */
  accepted: boolean
}
```

#### FILE_CHUNK

A chunk of file data.

```typescript
interface FileChunkPayload {
  /** Transfer ID */
  transferId: string

  /** Chunk sequence number (0-indexed) */
  chunkIndex: number

  /** Base64-encoded chunk data */
  data: string

  /** Total number of chunks */
  totalChunks: number
}
```

- Chunk size: **16 KB** (16,384 bytes before base64 encoding)
- Send chunks sequentially; wait for DataChannel bufferedAmount to drain

#### FILE_COMPLETE

File transfer completion notification.

```typescript
interface FileCompletePayload {
  /** Transfer ID */
  transferId: string

  /** Whether the transfer completed successfully */
  success: boolean

  /** SHA-256 hash of received data for verification */
  receivedHash?: string
}
```

---

### Error Messages

```typescript
interface ErrorPayload {
  /** Error code */
  code: number

  /** Human-readable error message */
  message: string

  /** ID of the message that caused the error (if applicable) */
  relatedMessageId?: string
}
```

#### Error Code Ranges

| Range | Category | Codes |
|-------|----------|-------|
| 1000–1099 | **Connection** | `1000` Generic, `1001` Unsupported version, `1002` Invalid peer ID, `1003` Connection refused |
| 2000–2099 | **Message** | `2000` Generic, `2001` Message too large, `2002` Invalid format, `2003` Unknown type |
| 3000–3099 | **Chat** | `3000` Generic, `3001` Chat not found, `3002` Not a member, `3003` Chat full |
| 4000–4099 | **Media** | `4000` Generic, `4001` Media not supported, `4002` Quality not available, `4003` Too many streams |
| 5000–5099 | **Security** | `5000` Generic, `5001` Invalid signature, `5002` Key mismatch, `5003` Decryption failed |

---

## Sequencing Rules

1. **Connection Setup**: `HELLO` must be the first message sent after DataChannel opens. `HELLO_ACK` must be the first response. No other messages before handshake completes.

2. **Message Ordering**: Messages within a single DataChannel are delivered in order (TCP-like reliability). No application-level reordering needed.

3. **Acknowledgments**: `TEXT_ACK` should be sent within **500ms** of receiving a `TEXT` message. If processing takes longer, send `delivered` immediately and `read` when displayed.

4. **Idempotency**: Receivers must deduplicate by `id`. If a message with a known `id` arrives again, ignore it silently.

5. **Timestamps**: Timestamps are sender's local time. Do not rely on cross-peer timestamp ordering — use message `id` and DataChannel delivery order instead.

6. **Graceful Shutdown**: Send `DISCONNECT` before closing a DataChannel. If a DataChannel closes without `DISCONNECT`, treat it as an unexpected disconnection and attempt reconnection.

---

## Serialization

- All messages are serialized as **JSON strings** via `JSON.stringify()`
- Maximum serialized message size: **64 KB** (65,536 bytes)
- Messages exceeding this limit must be rejected (file data uses chunking)
- Encoding: **UTF-8**

```typescript
// Sending
const msg: NeonP2PMessage<TextPayload> = { /* ... */ }
dataChannel.send(JSON.stringify(msg))

// Receiving
dataChannel.onmessage = (event) => {
  const msg: NeonP2PMessage = JSON.parse(event.data)
  handleMessage(msg)
}
```

---

## Keepalive

| Parameter | Value |
|-----------|-------|
| PING interval | **15 seconds** |
| PONG timeout | **5 seconds** |
| Max missed PONGs before disconnect | **3** (= 45 seconds total) |

```
Peer A                    Peer B
  |                         |
  |--- PING (seq: 1) ----->|
  |<--- PONG (seq: 1) -----|
  |                         |
  |  ... 15 seconds ...     |
  |                         |
  |--- PING (seq: 2) ----->|
  |<--- PONG (seq: 2) -----|
```

If 3 consecutive PINGs go unanswered:

1. Close the DataChannel
2. Mark the peer as `offline`
3. Begin reconnection attempts (see [Networking](./03-networking.md#reconnection))

---

*Previous: [Overview ←](./00-overview.md) · Next: [Architecture →](./02-architecture.md)*
