# P2P Chat System — Signaling Server

> In-repo WebSocket signaling server for peer discovery and connection brokering.

---

## Table of Contents

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Server Architecture](#server-architecture)
- [Message Protocol](#message-protocol)
- [Room Management](#room-management)
- [Directory Structure](#directory-structure)
- [Implementation Spec](#implementation-spec)
- [Deployment Options](#deployment-options)
- [Serverless Fallback](#serverless-fallback)

---

## Purpose

The signaling server does **one thing**: broker WebRTC connections between peers. It:

1. Lets peers register and discover each other
2. Relays SDP offers, answers, and ICE candidates
3. Manages room-based grouping for group chats

It **never** sees message content, media streams, or chat history. Once two peers establish a WebRTC connection, the signaling server is no longer involved in their communication.

---

## Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Minimal** | ~200–300 lines of TypeScript |
| **Stateless** | All peer state in memory (Map). Restart = peers reconnect |
| **No auth** | Peers self-identify. Security is at the WebRTC layer |
| **No persistence** | No database. Peers are transient |
| **Room-based** | Peers join rooms for group discovery |
| **Horizontally scalable** | Stateless design allows multiple instances behind a load balancer |

---

## Server Architecture

```
+-------------------------------------------------------+
|  Signaling Server (Node.js + ws)                      |
|                                                       |
|  +------------------+  +---------------------------+  |
|  | WebSocket Server |  | Connection Registry       |  |
|  | - port 8080      |  | - Map<peerId, WebSocket>  |  |
|  | - /ws endpoint   |  | - heartbeat tracking      |  |
|  +--------+---------+  +---------------------------+  |
|           |                                           |
|  +--------v-----------------------------------------+ |
|  | Message Router                                   | |
|  | - register    → add to registry                  | |
|  | - discover    → return peer list                 | |
|  | - offer       → relay to target peer             | |
|  | - answer      → relay to target peer             | |
|  | - ice-candidate → relay to target peer           | |
|  | - join-room   → add to room, notify members      | |
|  | - leave-room  → remove from room, notify members | |
|  +--------------------------------------------------+ |
|                                                       |
|  +--------------------------------------------------+ |
|  | Room Manager                                     | |
|  | - Map<roomId, Set<peerId>>                       | |
|  | - auto-cleanup on disconnect                     | |
|  +--------------------------------------------------+ |
+-------------------------------------------------------+
```

---

## Message Protocol

All signaling messages are JSON over WebSocket.

### Client → Server Messages

#### register

```typescript
interface RegisterMessage {
  type: 'register'
  peerId: string
  displayName: string
}
```

Register a peer with the server. The server maps `peerId` to the WebSocket connection.

#### discover

```typescript
interface DiscoverMessage {
  type: 'discover'
  roomId?: string  // If provided, discover peers in this room only
}
```

Request a list of connected peers.

#### offer

```typescript
interface OfferMessage {
  type: 'offer'
  to: string       // Target peer ID
  sdp: string      // SDP offer string
}
```

Relay an SDP offer to a specific peer.

#### answer

```typescript
interface AnswerMessage {
  type: 'answer'
  to: string       // Target peer ID
  sdp: string      // SDP answer string
}
```

Relay an SDP answer to a specific peer.

#### ice-candidate

```typescript
interface IceCandidateMessage {
  type: 'ice-candidate'
  to: string
  candidate: RTCIceCandidateInit
}
```

Relay an ICE candidate to a specific peer.

#### join-room

```typescript
interface JoinRoomMessage {
  type: 'join-room'
  roomId: string
}
```

Join a room for group peer discovery.

#### leave-room

```typescript
interface LeaveRoomMessage {
  type: 'leave-room'
  roomId: string
}
```

Leave a room.

### Server → Client Messages

#### registered

```typescript
interface RegisteredResponse {
  type: 'registered'
  peerId: string
}
```

Confirmation of successful registration.

#### peer-list

```typescript
interface PeerListResponse {
  type: 'peer-list'
  peers: Array<{
    peerId: string
    displayName: string
  }>
}
```

Response to `discover`.

#### offer (relayed)

```typescript
interface RelayedOffer {
  type: 'offer'
  from: string     // Sender's peer ID
  sdp: string
}
```

#### answer (relayed)

```typescript
interface RelayedAnswer {
  type: 'answer'
  from: string     // Sender's peer ID
  sdp: string
}
```

#### ice-candidate (relayed)

```typescript
interface RelayedIceCandidate {
  type: 'ice-candidate'
  from: string
  candidate: RTCIceCandidateInit
}
```

#### peer-joined

```typescript
interface PeerJoinedNotification {
  type: 'peer-joined'
  roomId: string
  peerId: string
  displayName: string
}
```

Broadcast to room members when a peer joins.

#### peer-left

```typescript
interface PeerLeftNotification {
  type: 'peer-left'
  roomId: string
  peerId: string
}
```

Broadcast to room members when a peer leaves or disconnects.

#### error

```typescript
interface SignalingError {
  type: 'error'
  code: string
  message: string
}
```

Error codes: `'PEER_NOT_FOUND'`, `'ALREADY_REGISTERED'`, `'INVALID_MESSAGE'`, `'ROOM_NOT_FOUND'`

---

## Room Management

Rooms are lightweight groupings for peer discovery in group chats.

```typescript
// Server-side room state
const rooms = new Map<string, Set<string>>()  // roomId -> Set<peerId>

// When a peer joins a room:
function joinRoom(peerId: string, roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set())
  }
  rooms.get(roomId)!.add(peerId)

  // Notify existing room members
  broadcastToRoom(roomId, {
    type: 'peer-joined',
    roomId,
    peerId,
    displayName: getPeerDisplayName(peerId)
  }, peerId /* exclude sender */)
}

// When a peer disconnects, remove from all rooms:
function handleDisconnect(peerId: string) {
  for (const [roomId, members] of rooms) {
    if (members.delete(peerId)) {
      broadcastToRoom(roomId, {
        type: 'peer-left',
        roomId,
        peerId
      })
      if (members.size === 0) {
        rooms.delete(roomId)  // Auto-cleanup empty rooms
      }
    }
  }
}
```

### Room Lifecycle

```
1. First peer creates room by joining  →  Room created in Map
2. Other peers join                     →  peer-joined notifications
3. Peers leave or disconnect            →  peer-left notifications
4. Last peer leaves                     →  Room auto-deleted
```

---

## Directory Structure

```
signaling-server/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts          # Complete server implementation
└── README.md             # Setup and usage instructions
```

### package.json

```json
{
  "name": "neon-peeper-signaling",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

## Implementation Spec

### Core Server Structure

```typescript
import { WebSocketServer, WebSocket } from 'ws'

interface PeerInfo {
  peerId: string
  displayName: string
  ws: WebSocket
  rooms: Set<string>
  lastPing: number
}

const PORT = parseInt(process.env.PORT || '8080')
const HEARTBEAT_INTERVAL = 30_000  // 30 seconds
const HEARTBEAT_TIMEOUT = 10_000   // 10 seconds

const peers = new Map<string, PeerInfo>()
const rooms = new Map<string, Set<string>>()

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws) => {
  let peerId: string | null = null

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    // Route based on msg.type
    switch (msg.type) {
      case 'register':    handleRegister(ws, msg); break
      case 'discover':    handleDiscover(ws, msg); break
      case 'offer':       handleRelay(ws, msg); break
      case 'answer':      handleRelay(ws, msg); break
      case 'ice-candidate': handleRelay(ws, msg); break
      case 'join-room':   handleJoinRoom(ws, msg); break
      case 'leave-room':  handleLeaveRoom(ws, msg); break
      default:
        ws.send(JSON.stringify({
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: `Unknown message type: ${msg.type}`
        }))
    }
  })

  ws.on('close', () => {
    if (peerId) handleDisconnect(peerId)
  })
})
```

### Heartbeat

```typescript
// Server sends ping, expects pong
const heartbeatInterval = setInterval(() => {
  for (const [peerId, info] of peers) {
    if (Date.now() - info.lastPing > HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT) {
      // Peer unresponsive, disconnect
      info.ws.terminate()
      handleDisconnect(peerId)
      continue
    }
    info.ws.ping()
  }
}, HEARTBEAT_INTERVAL)

// Track pong responses
ws.on('pong', () => {
  const info = findPeerBySocket(ws)
  if (info) info.lastPing = Date.now()
})
```

### Relay Handler

```typescript
function handleRelay(senderWs: WebSocket, msg: { type: string; to: string; [key: string]: unknown }) {
  const sender = findPeerBySocket(senderWs)
  if (!sender) return

  const target = peers.get(msg.to)
  if (!target) {
    senderWs.send(JSON.stringify({
      type: 'error',
      code: 'PEER_NOT_FOUND',
      message: `Peer ${msg.to} not found`
    }))
    return
  }

  // Forward the message, replacing 'to' with 'from'
  const relayed = { ...msg, from: sender.peerId }
  delete relayed.to
  target.ws.send(JSON.stringify(relayed))
}
```

---

## Deployment Options

| Environment | Setup | URL |
|-------------|-------|-----|
| **Local dev** | Run alongside Electron app | `ws://localhost:8080` |
| **LAN** | Same machine, connect via IP | `ws://192.168.x.x:8080` |
| **VPS** | Deploy to any Node.js host | `wss://signal.example.com` |
| **Cloudflare Workers** | Durable Objects for WebSocket | `wss://signal.workers.dev` |

### Local Development

```bash
# Terminal 1: Start signaling server
cd signaling-server
npm run dev

# Terminal 2: Start Electron app
npm run dev
```

### Production Considerations

- Use `wss://` (WebSocket over TLS) in production
- Add rate limiting: max 10 messages/second per peer
- Add connection limits: max 100 concurrent peers per server instance
- Consider Redis pub/sub for multi-instance coordination
- Log connections and errors for debugging

---

## Serverless Fallback

When no signaling server is available, peers can connect via manual SDP exchange.

### Copy/Paste Method

```
1. Peer A creates offer → serialized to base64 string
2. Peer A shares string with Peer B (email, chat, etc.)
3. Peer B pastes string → creates answer → serialized to base64
4. Peer B shares answer string with Peer A
5. Peer A pastes answer → connection established
```

### QR Code Method

```
1. Peer A creates offer → encoded as QR code
2. Peer B scans QR code with camera
3. Peer B creates answer → encoded as QR code
4. Peer A scans answer QR code → connection established
```

### UI Component

The `PeerInvite` component (see [UI Components](./11-ui-components.md)) provides both methods:

```typescript
interface ManualConnectionData {
  /** Base64-encoded SDP + ICE candidates */
  connectionString: string

  /** Type of SDP */
  type: 'offer' | 'answer'

  /** Peer ID of the creator */
  peerId: string

  /** Display name */
  displayName: string
}
```

### Encoding

```typescript
function encodeConnectionData(data: ManualConnectionData): string {
  return btoa(JSON.stringify(data))
}

function decodeConnectionData(encoded: string): ManualConnectionData {
  return JSON.parse(atob(encoded))
}
```

The encoded string is typically 2–4 KB, which fits comfortably in a QR code (QR version 25+ supports up to ~3 KB of binary data).

---

*Previous: [Networking ←](./03-networking.md) · Next: [Chat →](./05-chat.md)*
