# P2P Chat System — Performance

> Performance budgets, monitoring, adaptive bitrate, and resource management.

---

## Table of Contents

- [Performance Budgets](#performance-budgets)
- [PerformanceMonitor](#performancemonitor)
- [Adaptive Bitrate Algorithm](#adaptive-bitrate-algorithm)
- [Memory Management](#memory-management)
- [CPU Optimization](#cpu-optimization)
- [Connection Pooling](#connection-pooling)

---

## Performance Budgets

Target metrics for each usage scenario. Measured on a mid-range system (4-core CPU, 8 GB RAM, integrated GPU).

### Idle (Connected, No Active Call)

| Metric | Budget | Notes |
|--------|--------|-------|
| CPU | < 2% | Keepalive PINGs only |
| RAM | < 150 MB | Electron baseline + loaded messages |
| Network (up) | < 1 Kbps | PING/PONG every 15s per peer |
| Network (down) | < 1 Kbps | PING/PONG responses |
| GPU | 0% | No video decoding |

### 1:1 Video Call (High Quality)

| Metric | Budget | Notes |
|--------|--------|-------|
| CPU | < 25% | 1 encode + 1 decode (720p/30fps) |
| RAM | < 300 MB | +video buffers |
| Network (up) | < 2 Mbps | 1.5 Mbps video + 128 Kbps audio + data |
| Network (down) | < 2 Mbps | Mirror of upload |
| GPU | < 30% | Hardware encode/decode |

### 6-Person Group Call (Mesh, Low Quality)

| Metric | Budget | Notes |
|--------|--------|-------|
| CPU | < 50% | 1 encode + 5 decodes (360p/15fps) |
| RAM | < 500 MB | +5 remote video buffers |
| Network (up) | < 3 Mbps | 5 × 400 Kbps + audio + data |
| Network (down) | < 3 Mbps | 5 × 400 Kbps + audio + data |
| GPU | < 50% | Hardware decode for all streams |

### 8+ Person Group Call (SFU)

| Metric | Budget | Notes |
|--------|--------|-------|
| CPU | < 30% | 1 encode + N decodes (SFU selects quality) |
| RAM | < 400 MB | SFU manages stream count |
| Network (up) | < 2.5 Mbps | 1 simulcast stream (3 layers) |
| Network (down) | < 4 Mbps | SFU forwards appropriate layers |
| GPU | < 40% | Hardware decode |

---

## PerformanceMonitor

Polls WebRTC statistics and system metrics.

```typescript
class PerformanceMonitor {
  private pollInterval: number = 2000  // 2 seconds
  private intervalId: ReturnType<typeof setInterval> | null = null

  /** Start monitoring all active peer connections */
  start(connections: Map<string, RTCPeerConnection>): void {
    this.intervalId = setInterval(() => {
      this.collectStats(connections)
    }, this.pollInterval)
  }

  /** Stop monitoring */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /** Collect stats from all connections */
  private async collectStats(
    connections: Map<string, RTCPeerConnection>
  ): Promise<void> {
    for (const [peerId, pc] of connections) {
      const stats = await pc.getStats()
      const parsed = this.parseStats(stats)
      performanceStore.getState().updatePeerStats(peerId, parsed)
    }

    // Update aggregate stats
    this.updateAggregateStats()
  }

  /** Parse RTCStatsReport into usable metrics */
  private parseStats(stats: RTCStatsReport): PeerConnectionStats {
    let totalBytesSent = 0
    let totalBytesReceived = 0
    let packetLoss = 0
    let roundTripTime = 0
    let jitter = 0

    stats.forEach((report) => {
      switch (report.type) {
        case 'outbound-rtp':
          totalBytesSent += report.bytesSent || 0
          break

        case 'inbound-rtp':
          totalBytesReceived += report.bytesReceived || 0
          packetLoss = report.packetsLost || 0
          jitter = report.jitter || 0
          break

        case 'candidate-pair':
          if (report.state === 'succeeded') {
            roundTripTime = report.currentRoundTripTime || 0
          }
          break
      }
    })

    return {
      bytesSent: totalBytesSent,
      bytesReceived: totalBytesReceived,
      packetLoss,
      roundTripTime,
      jitter,
      timestamp: Date.now()
    }
  }

  /** Calculate aggregate bandwidth and quality */
  private updateAggregateStats(): void {
    const state = performanceStore.getState()
    const allStats = state.peerStats

    let totalUpload = 0
    let totalDownload = 0
    let worstRTT = 0
    let worstPacketLoss = 0

    for (const stats of allStats.values()) {
      totalUpload += stats.bytesSent
      totalDownload += stats.bytesReceived
      worstRTT = Math.max(worstRTT, stats.roundTripTime)
      worstPacketLoss = Math.max(worstPacketLoss, stats.packetLoss)
    }

    state.setAggregateStats({
      totalUploadBps: totalUpload * 8 / (this.pollInterval / 1000),
      totalDownloadBps: totalDownload * 8 / (this.pollInterval / 1000),
      worstRTT,
      worstPacketLoss,
      connectionQuality: this.calculateQuality(worstRTT, worstPacketLoss)
    })
  }

  /** Map metrics to a quality level */
  private calculateQuality(rtt: number, packetLoss: number): ConnectionQuality {
    if (rtt < 0.05 && packetLoss < 0.01) return 'excellent'
    if (rtt < 0.15 && packetLoss < 0.03) return 'good'
    if (rtt < 0.3 && packetLoss < 0.08) return 'fair'
    return 'poor'
  }
}

interface PeerConnectionStats {
  bytesSent: number
  bytesReceived: number
  packetLoss: number
  roundTripTime: number      // seconds
  jitter: number             // seconds
  timestamp: number
}

type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor'
```

### Performance Store

```typescript
import { create } from 'zustand'

interface AggregateStats {
  totalUploadBps: number
  totalDownloadBps: number
  worstRTT: number
  worstPacketLoss: number
  connectionQuality: ConnectionQuality
}

interface PerformanceState {
  /** Per-peer connection stats */
  peerStats: Map<string, PeerConnectionStats>

  /** Aggregate stats across all connections */
  aggregate: AggregateStats

  /** Current adaptive quality level */
  adaptiveQuality: string

  // --- Actions ---
  updatePeerStats: (peerId: string, stats: PeerConnectionStats) => void
  removePeerStats: (peerId: string) => void
  setAggregateStats: (stats: AggregateStats) => void
  setAdaptiveQuality: (quality: string) => void
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  peerStats: new Map(),
  aggregate: {
    totalUploadBps: 0,
    totalDownloadBps: 0,
    worstRTT: 0,
    worstPacketLoss: 0,
    connectionQuality: 'good'
  },
  adaptiveQuality: 'high',

  updatePeerStats: (peerId, stats) => set((state) => {
    const peerStats = new Map(state.peerStats)
    peerStats.set(peerId, stats)
    return { peerStats }
  }),

  removePeerStats: (peerId) => set((state) => {
    const peerStats = new Map(state.peerStats)
    peerStats.delete(peerId)
    return { peerStats }
  }),

  setAggregateStats: (aggregate) => set({ aggregate }),
  setAdaptiveQuality: (adaptiveQuality) => set({ adaptiveQuality }),
}))
```

---

## Adaptive Bitrate Algorithm

Dynamically adjusts video quality based on network conditions.

### Input Signals

| Signal | Source | Weight |
|--------|--------|--------|
| Packet loss rate | `inbound-rtp.packetsLost` / `packetsReceived` | High |
| Round-trip time | `candidate-pair.currentRoundTripTime` | High |
| Available bandwidth | `candidate-pair.availableOutgoingBitrate` | Medium |
| Jitter | `inbound-rtp.jitter` | Low |
| Frame drop rate | `inbound-rtp.framesDropped` / `framesReceived` | Medium |

### Quality Levels

```
  Ultra ──┐
          │ 4 Mbps, 1080p/30fps
  High ───┤
          │ 1.5 Mbps, 720p/30fps
  Medium ─┤
          │ 800 Kbps, 480p/24fps
  Low ────┘
            200 Kbps, 240p/15fps
```

### Adaptation Rules with Hysteresis

```typescript
interface AdaptiveState {
  currentLevel: 'low' | 'medium' | 'high' | 'ultra'
  lastChangeTime: number
  consecutiveBadSamples: number
  consecutiveGoodSamples: number
}

const DOWNGRADE_THRESHOLD = 3   // Bad samples before downgrade
const UPGRADE_THRESHOLD = 10    // Good samples before upgrade
const MIN_CHANGE_INTERVAL = 10_000  // 10 seconds between changes

function evaluateQuality(
  stats: PeerConnectionStats,
  state: AdaptiveState
): AdaptiveState {
  const now = Date.now()
  const timeSinceChange = now - state.lastChangeTime

  // Don't change too frequently
  if (timeSinceChange < MIN_CHANGE_INTERVAL) return state

  const isBad = stats.packetLoss > 0.05 || stats.roundTripTime > 0.3
  const isGood = stats.packetLoss < 0.01 && stats.roundTripTime < 0.1

  let newState = { ...state }

  if (isBad) {
    newState.consecutiveBadSamples++
    newState.consecutiveGoodSamples = 0

    if (newState.consecutiveBadSamples >= DOWNGRADE_THRESHOLD) {
      newState.currentLevel = downgradeLevel(state.currentLevel)
      newState.lastChangeTime = now
      newState.consecutiveBadSamples = 0
    }
  } else if (isGood) {
    newState.consecutiveGoodSamples++
    newState.consecutiveBadSamples = 0

    if (newState.consecutiveGoodSamples >= UPGRADE_THRESHOLD) {
      newState.currentLevel = upgradeLevel(state.currentLevel)
      newState.lastChangeTime = now
      newState.consecutiveGoodSamples = 0
    }
  } else {
    // Neutral — reset counters
    newState.consecutiveBadSamples = Math.max(0, newState.consecutiveBadSamples - 1)
    newState.consecutiveGoodSamples = 0
  }

  return newState
}

function downgradeLevel(current: string): string {
  const order = ['ultra', 'high', 'medium', 'low']
  const idx = order.indexOf(current)
  return order[Math.min(idx + 1, order.length - 1)]
}

function upgradeLevel(current: string): string {
  const order = ['ultra', 'high', 'medium', 'low']
  const idx = order.indexOf(current)
  return order[Math.max(idx - 1, 0)]
}
```

### Hysteresis Rationale

- **Downgrade fast** (3 samples = 6 seconds): Users notice quality problems immediately
- **Upgrade slow** (10 samples = 20 seconds): Avoid oscillation; verify conditions are stable
- **Minimum interval** (10 seconds): Prevent rapid quality flickering

---

## Memory Management

### Track Cleanup

Always stop and release media tracks when done:

```typescript
function cleanupStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()                    // Release hardware
    stream.removeTrack(track)       // Remove from stream
  }
}

// When a peer disconnects
function cleanupPeerMedia(peerId: string): void {
  const streams = mediaStore.getState().remoteStreams
  for (const [key, remote] of streams) {
    if (key.startsWith(`${peerId}:`)) {
      cleanupStream(remote.stream)
    }
  }
  mediaStore.getState().removeAllRemoteStreams(peerId)
}
```

### Message Pagination

Don't load all messages into memory at once:

```typescript
const MESSAGES_PER_PAGE = 50
const MAX_MESSAGES_IN_MEMORY = 200

// Load initial page when opening a chat
async function openChat(chatId: string): Promise<void> {
  const messages = await persistenceManager.getMessages(chatId, MESSAGES_PER_PAGE)
  chatStore.getState().loadOlderMessages(chatId, messages)
}

// Lazy-load older messages when scrolling up
async function loadMoreMessages(chatId: string): Promise<void> {
  const existing = chatStore.getState().messages.get(chatId) || []
  const oldest = existing[0]
  if (!oldest) return

  const older = await persistenceManager.getMessages(chatId, MESSAGES_PER_PAGE, oldest.timestamp)
  chatStore.getState().loadOlderMessages(chatId, older)

  // Trim if too many in memory
  const total = (chatStore.getState().messages.get(chatId) || []).length
  if (total > MAX_MESSAGES_IN_MEMORY) {
    trimOldestMessages(chatId, total - MAX_MESSAGES_IN_MEMORY)
  }
}
```

### WeakRef for Optional Stream References

Use `WeakRef` for caches that should not prevent garbage collection:

```typescript
// Cache video elements for reuse, but allow GC
const videoElementCache = new Map<string, WeakRef<HTMLVideoElement>>()

function getOrCreateVideoElement(peerId: string): HTMLVideoElement {
  const cached = videoElementCache.get(peerId)?.deref()
  if (cached) return cached

  const element = document.createElement('video')
  element.autoplay = true
  element.playsInline = true
  videoElementCache.set(peerId, new WeakRef(element))
  return element
}
```

---

## CPU Optimization

### Prefer Hardware Codecs

```typescript
async function configureHardwareCodec(sender: RTCRtpSender): Promise<void> {
  const params = sender.getParameters()
  if (params.encodings.length > 0) {
    // Setting scalabilityMode hints at hardware usage
    params.encodings[0].scalabilityMode = 'L1T2'  // Temporal scalability
  }
  await sender.setParameters(params)
}
```

### Reduce Frame Rate Before Resolution

When CPU is high, reduce frame rate first (cheaper), then resolution:

```typescript
async function reduceCPULoad(sender: RTCRtpSender, level: number): Promise<void> {
  const params = sender.getParameters()

  if (level === 1) {
    // First: reduce frame rate
    params.encodings[0].maxFramerate = 15
  } else if (level === 2) {
    // Then: reduce resolution
    params.encodings[0].maxFramerate = 15
    params.encodings[0].scaleResolutionDownBy = 2
  } else if (level === 3) {
    // Severe: minimal quality
    params.encodings[0].maxFramerate = 10
    params.encodings[0].scaleResolutionDownBy = 4
  }

  await sender.setParameters(params)
}
```

### Off-Screen Video Pause

Pause decoding for videos not currently visible:

```typescript
function setupVisibilityTracking(
  videoElement: HTMLVideoElement,
  consumer: { pause: () => void; resume: () => void }
): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          consumer.resume()
          videoElement.play()
        } else {
          consumer.pause()
          videoElement.pause()
        }
      }
    },
    { threshold: 0.1 }
  )

  observer.observe(videoElement)
  return observer  // Caller must call observer.disconnect() on cleanup
}
```

### requestVideoFrameCallback

Use for efficient frame processing instead of requestAnimationFrame:

```typescript
function onVideoFrame(
  video: HTMLVideoElement,
  callback: (metadata: VideoFrameMetadata) => void
): void {
  function step(_now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
    callback(metadata)
    video.requestVideoFrameCallback(step)
  }
  video.requestVideoFrameCallback(step)
}
```

---

## Connection Pooling

### Single RTCPeerConnection Per Peer

Use **one** `RTCPeerConnection` per peer for both data and media:

```
  ┌─────────────────────────────────────────────┐
  │  RTCPeerConnection (Peer A ↔ Peer B)        │
  │                                             │
  │  ├── DataChannel "control" (reliable)       │
  │  ├── DataChannel "ephemeral" (unreliable)   │
  │  ├── Audio Track (Opus)                     │
  │  ├── Video Track - Camera (H.264/VP9)       │
  │  └── Video Track - Screen (VP9)             │
  └─────────────────────────────────────────────┘
```

**Why not separate connections?**

| Approach | ICE Negotiations | DTLS Handshakes | Candidate Pairs |
|----------|-----------------|-----------------|-----------------|
| Single connection | 1 | 1 | 1 set |
| Separate data + media | 2 | 2 | 2 sets |
| Separate per track | N | N | N sets |

Single connection = fewer resources, simpler state management, and ICE bundle negotiation handles multiplexing.

### Adding/Removing Media Tracks

```typescript
// Add camera track to existing connection
function addCameraTrack(pc: RTCPeerConnection, stream: MediaStream): RTCRtpSender {
  const videoTrack = stream.getVideoTracks()[0]
  return pc.addTrack(videoTrack, stream)
  // This triggers 'negotiationneeded' → renegotiate SDP
}

// Remove camera track
function removeCameraTrack(pc: RTCPeerConnection, sender: RTCRtpSender): void {
  pc.removeTrack(sender)
  // This also triggers 'negotiationneeded'
}
```

Renegotiation is automatic via the `negotiationneeded` event:

```typescript
pc.onnegotiationneeded = async () => {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  // Send offer to peer via DataChannel (MEDIA_OFFER message)
  sendMediaOffer(peerId, offer)
}
```

---

*Previous: [Security ←](./07-security.md) · Next: [State Management →](./09-state-management.md)*
