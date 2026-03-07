# P2P Chat System — Networking

> WebRTC stack, signaling, NAT traversal, and mesh vs SFU topology.

---

## Table of Contents

- [WebRTC in Electron 28](#webrtc-in-electron-28)
- [STUN/TURN Configuration](#stunturn-configuration)
- [Connection Lifecycle](#connection-lifecycle)
- [Reconnection Strategy](#reconnection-strategy)
- [DataChannel Configuration](#datachannel-configuration)
- [Mesh Topology](#mesh-topology)
- [SFU Topology](#sfu-topology)
- [Topology Decision Table](#topology-decision-table)
- [ConnectionManager API](#connectionmanager-api)

---

## WebRTC in Electron 28

Electron 28 ships **Chromium 120**, which includes:

| Feature | Support |
|---------|---------|
| RTCPeerConnection | Full |
| RTCDataChannel | Full (reliable + unreliable) |
| getUserMedia | Full (camera, microphone) |
| getDisplayMedia | Full (screen capture) |
| desktopCapturer | Electron API (custom source picker) |
| VP8 / VP9 | Encode + Decode |
| H.264 | Encode + Decode (hardware when available) |
| AV1 | Decode only (encode support varies) |
| Opus (audio) | Full |
| Simulcast | Full |
| Insertable Streams | Full (for E2E encryption) |
| DTLS 1.2 / SRTP | Always enabled |

No polyfills or adapters needed. Use `window.RTCPeerConnection` directly.

---

## STUN/TURN Configuration

```typescript
const iceConfig: RTCConfiguration = {
  iceServers: [
    // Public STUN servers (free, no auth)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },

    // TURN server (required for ~10% of connections behind symmetric NAT)
    // Self-hosted or use a service like Metered/Xirsys
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ],

  // Use all available candidates
  iceTransportPolicy: 'all',

  // Gather all candidates before resolving
  iceCandidatePoolSize: 2
}
```

### ICE Candidate Types

| Type | Description | Latency | Reliability |
|------|-------------|---------|-------------|
| `host` | Direct LAN connection | Lowest | Same network only |
| `srflx` | Server-reflexive (via STUN) | Low | Works through most NATs |
| `relay` | TURN relay | Higher | Always works (fallback) |

**Connection priority:** host → srflx → relay. WebRTC handles this automatically.

### STUN/TURN Recommendations

- **Development:** Google's public STUN servers are sufficient. No TURN needed on LAN.
- **Production:** Self-host a TURN server (coturn) or use a managed service. Budget ~500 Kbps per relayed video stream.

---

## Connection Lifecycle

```
                    +----------+
                    |   NEW    |
                    +----+-----+
                         |
                    create offer/answer
                         |
                    +----v-----+
                    | CONNECTING|
                    +----+-----+
                         |
              ICE + DTLS complete
                         |
                    +----v-----+
            +------>| CONNECTED |<------+
            |       +----+-----+       |
            |            |             |
        reconnect   ICE restart    brief disconnect
            |            |             |
            |       +----v-----+       |
            +-------| RECONNECTING|----+
                    +----+-----+
                         |
              timeout / fatal error
                         |
                    +----v-----+
                    |  CLOSED  |
                    +----------+
```

### State Transitions

```typescript
type ConnectionState =
  | 'new'           // RTCPeerConnection created, no offer/answer yet
  | 'connecting'    // Offer/answer exchanged, ICE gathering in progress
  | 'connected'     // ICE connected, DTLS complete, DataChannel open
  | 'reconnecting'  // Connection lost, attempting ICE restart
  | 'closed'        // Connection terminated (graceful or timeout)
```

### ICE Connection Monitoring

```typescript
peerConnection.oniceconnectionstatechange = () => {
  switch (peerConnection.iceConnectionState) {
    case 'connected':
    case 'completed':
      // Connection established
      updateConnectionState(peerId, 'connected')
      break

    case 'disconnected':
      // Temporary disruption — wait before acting
      startReconnectionTimer(peerId)
      break

    case 'failed':
      // ICE failed — attempt ICE restart
      attemptIceRestart(peerId)
      break

    case 'closed':
      // Terminal state
      updateConnectionState(peerId, 'closed')
      break
  }
}
```

---

## Reconnection Strategy

Uses exponential backoff with jitter:

```typescript
interface ReconnectionConfig {
  /** Initial delay before first retry */
  baseDelay: 1000        // 1 second

  /** Maximum delay between retries */
  maxDelay: 30000        // 30 seconds

  /** Backoff multiplier */
  multiplier: 2

  /** Maximum retry attempts before giving up */
  maxAttempts: 10

  /** Random jitter factor (0–1) */
  jitter: 0.3
}
```

### Reconnection Flow

```
1. ICE disconnected
   └─> Wait 2 seconds (brief disconnects self-heal)

2. Still disconnected after 2s
   └─> ICE restart (renegotiate within existing RTCPeerConnection)
       └─> Success? → Back to connected
       └─> Fail? → Continue to step 3

3. Create new RTCPeerConnection
   └─> Exchange offer/answer via signaling server
       └─> Success? → Re-establish DataChannels, resume
       └─> Fail? → Retry with backoff

4. After maxAttempts (10):
   └─> Mark peer as offline
   └─> Stop retrying
   └─> Notify user
```

### Delay Calculation

```typescript
function getReconnectionDelay(attempt: number, config: ReconnectionConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.multiplier, attempt),
    config.maxDelay
  )
  const jitter = delay * config.jitter * (Math.random() * 2 - 1)
  return Math.max(0, delay + jitter)
}
```

---

## DataChannel Configuration

Each peer connection uses **two DataChannels**:

### Control Channel (Reliable)

```typescript
const controlChannel = peerConnection.createDataChannel('control', {
  ordered: true,        // Maintain message order
  // No maxRetransmits — unlimited retries (TCP-like)
})
```

Used for: all protocol messages (HELLO, TEXT, CHAT_*, MEDIA_*, PING/PONG, etc.)

### Ephemeral Channel (Unreliable)

```typescript
const ephemeralChannel = peerConnection.createDataChannel('ephemeral', {
  ordered: false,       // No ordering guarantees
  maxRetransmits: 0     // Fire-and-forget (UDP-like)
})
```

Used for: typing indicators, cursor positions, real-time presence updates — data where losing a message is acceptable and low latency matters.

### Channel Events

```typescript
controlChannel.onopen = () => {
  // Send HELLO message
  sendHello(controlChannel)
}

controlChannel.onmessage = (event) => {
  const msg: NeonP2PMessage = JSON.parse(event.data)
  messageRouter.dispatch(msg)
}

controlChannel.onclose = () => {
  // Trigger reconnection
  handleChannelClose(peerId)
}

controlChannel.onerror = (error) => {
  console.error(`DataChannel error with ${peerId}:`, error)
}
```

---

## Mesh Topology

**Default topology for groups ≤ 6 peers.**

In a full mesh, every peer connects directly to every other peer:

```
     A ─────── B
    / \       / \
   /   \     /   \
  /     \   /     \
 F ──────\ / ────── C
  \      / \      /
   \    /   \    /
    \  /     \  /
     E ─────── D

  6 peers = 15 connections
```

### Connection Math

| Peers | Connections | Upload Streams (video) | Per-Peer Upload BW |
|-------|-------------|------------------------|--------------------|
| 2 | 1 | 1 | 1x bitrate |
| 3 | 3 | 2 | 2x bitrate |
| 4 | 6 | 3 | 3x bitrate |
| 5 | 10 | 4 | 4x bitrate |
| 6 | 15 | 5 | 5x bitrate |

**Formula:** connections = n × (n - 1) / 2

### Mesh Pros & Cons

| Pros | Cons |
|------|------|
| No server needed after signaling | O(n²) connections |
| Lowest latency (direct paths) | Upload bandwidth scales linearly per peer |
| Simple implementation | CPU: encode once, but manage n-1 connections |
| Fully decentralized | Impractical beyond ~6 peers for video |

### Mesh Performance Budget (Video)

| Group Size | Quality | Per-Peer Upload | Per-Peer Download | CPU (encode) |
|------------|---------|-----------------|-------------------|--------------|
| 2 (1:1) | High (720p/30) | 1.5 Mbps | 1.5 Mbps | 1 encode |
| 3 | Medium (480p/24) | 2 × 800 Kbps = 1.6 Mbps | 2 × 800 Kbps | 1 encode |
| 4 | Medium (480p/24) | 3 × 800 Kbps = 2.4 Mbps | 3 × 800 Kbps | 1 encode |
| 6 | Low (360p/15) | 5 × 400 Kbps = 2.0 Mbps | 5 × 400 Kbps | 1 encode |

---

## SFU Topology

**Required for groups of 7+ peers.** Each peer sends media once to the SFU, which forwards selectively to others.

```
  A ──┐          ┌── D
  B ──┤          ├── E
  C ──┤ ── SFU ──┤── F
  D ──┤          ├── G
  E ──┘          └── H
      1 upload      N-1 downloads
      per peer      from SFU
```

### SFU Architecture

```
+---------------------------------------------------+
|  SFU Server (mediasoup)                           |
|                                                   |
|  +-----------+    +-----------+    +------------+ |
|  | Router    |    | Transport |    | Simulcast  | |
|  | - rooms   |    | - WebRTC  |    | Layer Mgr  | |
|  | - routing |    | - per peer|    | - spatial  | |
|  +-----------+    +-----------+    | - temporal | |
|                                    +------------+ |
+---------------------------------------------------+
```

### SFU Integration Points

| Component | Technology | Purpose |
|-----------|------------|---------|
| SFU Server | mediasoup (Node.js) | Media routing, simulcast management |
| Client SDK | mediasoup-client | Connect to SFU, manage producers/consumers |
| Signaling | Existing signaling server | Exchange SFU transport parameters |
| DataChannels | Still direct mesh | Text chat remains peer-to-peer |

**Important:** Even with SFU for media, text messages still flow over direct DataChannels (mesh). The SFU only handles audio/video forwarding.

### Simulcast with SFU

Each client sends video at multiple quality layers:

```typescript
const sendTransport = device.createSendTransport(/* ... */)

const producer = await sendTransport.produce({
  track: videoTrack,
  encodings: [
    { rid: 'low',  maxBitrate: 200_000,  scaleResolutionDownBy: 4 },
    { rid: 'mid',  maxBitrate: 800_000,  scaleResolutionDownBy: 2 },
    { rid: 'high', maxBitrate: 2_000_000, scaleResolutionDownBy: 1 }
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
})
```

The SFU selects which layer to forward to each consumer based on:

- Receiver's available bandwidth
- Video tile size on receiver's screen
- Whether the video is the dominant/active speaker

### SFU Pros & Cons

| Pros | Cons |
|------|------|
| Upload bandwidth: 1 stream regardless of group size | Requires server infrastructure |
| Scales to 50+ participants | Added latency (one extra hop) |
| Server can optimize per-receiver quality | More complex implementation |
| Simulcast reduces total bandwidth | Server costs (CPU + bandwidth) |

---

## Topology Decision Table

| Group Size | Topology | Video Quality | Max CPU (per peer) | Max Upload BW |
|------------|----------|---------------|--------------------|---------------|
| 2 | Direct | High (720p/30fps) | 15% | 1.5 Mbps |
| 3–4 | Mesh | Medium (480p/24fps) | 25% | 2.4 Mbps |
| 5–6 | Mesh | Low (360p/15fps) | 35% | 2.0 Mbps |
| 7–8 | SFU | Medium (480p/24fps) | 20% | 1.5 Mbps |
| 9–12 | SFU | Low–Medium | 20% | 1.5 Mbps |
| 13+ | SFU | Low (adaptive) | 15% | 1.0 Mbps |

### Automatic Topology Selection

```typescript
function selectTopology(memberCount: number): 'direct' | 'mesh' | 'sfu' {
  if (memberCount <= 2) return 'direct'
  if (memberCount <= 6) return 'mesh'
  return 'sfu'
}
```

The transition from mesh to SFU when a 7th peer joins requires:

1. Each peer creates a transport to the SFU
2. Each peer starts producing to the SFU
3. Each peer creates consumers for every other peer's SFU streams
4. Direct media tracks are removed (DataChannels stay)

This transition is disruptive (brief video interruption) — notify the user.

---

## ConnectionManager API

The `ConnectionManager` service orchestrates all WebRTC connections.

```typescript
class ConnectionManager {
  /** Create a new peer connection and initiate offer */
  connect(peerId: string, signalingClient: SignalingClient): Promise<void>

  /** Accept an incoming connection offer */
  acceptOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>

  /** Handle an incoming answer to our offer */
  handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void>

  /** Add an ICE candidate for a peer */
  addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void>

  /** Get the DataChannel for a connected peer */
  getDataChannel(peerId: string): RTCDataChannel | null

  /** Get the RTCPeerConnection for a peer (for adding media tracks) */
  getPeerConnection(peerId: string): RTCPeerConnection | null

  /** Disconnect from a peer gracefully */
  disconnect(peerId: string): void

  /** Disconnect from all peers */
  disconnectAll(): void

  /** Attempt ICE restart for a peer */
  restartIce(peerId: string): Promise<void>

  /** Get connection state for a peer */
  getState(peerId: string): ConnectionState

  /** Register callback for connection events */
  on(event: ConnectionEvent, handler: ConnectionEventHandler): void
  off(event: ConnectionEvent, handler: ConnectionEventHandler): void
}

type ConnectionEvent =
  | 'peer-connected'
  | 'peer-disconnected'
  | 'peer-reconnecting'
  | 'data-channel-open'
  | 'data-channel-message'
  | 'data-channel-close'
  | 'ice-state-change'
  | 'connection-error'

interface ConnectionEventHandler {
  (peerId: string, data?: unknown): void
}
```

### Usage Example

```typescript
const connectionManager = new ConnectionManager(iceConfig)
const signalingClient = new SignalingClient('ws://localhost:8080')

// Connect to a discovered peer
await connectionManager.connect(remotePeerId, signalingClient)

// Listen for messages
connectionManager.on('data-channel-message', (peerId, data) => {
  const msg: NeonP2PMessage = JSON.parse(data as string)
  messageRouter.dispatch(msg)
})

// Send a message
const channel = connectionManager.getDataChannel(remotePeerId)
channel?.send(JSON.stringify(textMessage))
```

---

*Previous: [Architecture ←](./02-architecture.md) · Next: [Signaling Server →](./04-signaling-server.md)*
