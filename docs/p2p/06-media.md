# P2P Chat System — Media

> Screen sharing, camera capture, codecs, quality presets, and adaptive bitrate.

---

## Table of Contents

- [Media Capture](#media-capture)
  - [Camera & Microphone](#camera--microphone)
  - [Screen Sharing](#screen-sharing)
- [Quality Presets](#quality-presets)
- [Codec Selection](#codec-selection)
- [Simulcast](#simulcast)
- [MediaManager API](#mediamanager-api)
- [Media Store](#media-store)
- [Performance Limits](#performance-limits)

---

## Media Capture

### Camera & Microphone

Use standard `getUserMedia` API (available in Electron's Chromium context):

```typescript
async function startCamera(constraints?: MediaTrackConstraints): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: constraints || {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })
  return stream
}
```

### Device Enumeration

```typescript
async function getMediaDevices(): Promise<{
  cameras: MediaDeviceInfo[]
  microphones: MediaDeviceInfo[]
  speakers: MediaDeviceInfo[]
}> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    cameras: devices.filter(d => d.kind === 'videoinput'),
    microphones: devices.filter(d => d.kind === 'audioinput'),
    speakers: devices.filter(d => d.kind === 'audiooutput')
  }
}
```

### Screen Sharing

Electron provides two approaches for screen capture:

#### Option A: desktopCapturer (Custom Source Picker)

Preferred — gives full control over the source selection UI.

```typescript
// 1. Request sources from main process via IPC
const sources = await window.electronAPI.getDesktopSources()

// 2. User selects a source in ScreenSourcePicker component

// 3. Capture the selected source
async function startScreenShare(sourceId: string): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30
      }
    } as MediaTrackConstraints
  })
  return stream
}
```

#### Option B: getDisplayMedia (Browser Picker)

Simpler but uses Chrome's built-in picker (less control over UI).

```typescript
async function startScreenShareSimple(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    },
    audio: false  // Screen audio capture (platform-dependent)
  })
  return stream
}
```

#### Main Process IPC for desktopCapturer

```typescript
// In main process (src/main/index.ts)
import { desktopCapturer } from 'electron'

ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  })
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon?.toDataURL() || null,
    display_id: source.display_id
  }))
})
```

---

## Quality Presets

| Preset | Resolution | Frame Rate | Video Bitrate | Audio Bitrate | Use Case |
|--------|-----------|------------|---------------|---------------|----------|
| **Low** | 320×240 | 15 fps | 200 Kbps | 32 Kbps | Low bandwidth, many participants |
| **Medium** | 640×480 | 24 fps | 800 Kbps | 64 Kbps | Default for group calls |
| **High** | 1280×720 | 30 fps | 1.5 Mbps | 128 Kbps | Default for 1:1 calls |
| **Ultra** | 1920×1080 | 30 fps | 4 Mbps | 128 Kbps | High-bandwidth 1:1 sharing |
| **Adaptive** | Varies | Varies | Varies | 64 Kbps | Automatic based on conditions |

### Preset Definitions

```typescript
interface QualityPresetConfig {
  width: number
  height: number
  frameRate: number
  videoBitrate: number    // bps
  audioBitrate: number    // bps
}

const QUALITY_PRESETS: Record<string, QualityPresetConfig> = {
  low: {
    width: 320,  height: 240,  frameRate: 15,
    videoBitrate: 200_000,    audioBitrate: 32_000
  },
  medium: {
    width: 640,  height: 480,  frameRate: 24,
    videoBitrate: 800_000,    audioBitrate: 64_000
  },
  high: {
    width: 1280, height: 720,  frameRate: 30,
    videoBitrate: 1_500_000,  audioBitrate: 128_000
  },
  ultra: {
    width: 1920, height: 1080, frameRate: 30,
    videoBitrate: 4_000_000,  audioBitrate: 128_000
  }
}
```

### Applying Quality Constraints

```typescript
async function applyQualityPreset(
  sender: RTCRtpSender,
  preset: QualityPresetConfig
): Promise<void> {
  const params = sender.getParameters()

  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}]
  }

  params.encodings[0].maxBitrate = preset.videoBitrate
  params.encodings[0].maxFramerate = preset.frameRate
  // scaleResolutionDownBy is relative to the capture resolution
  // If capturing at 1080p and want 480p: scaleResolutionDownBy = 2.25

  await sender.setParameters(params)
}
```

---

## Codec Selection

### Recommended Codecs

| Media Type | Primary Codec | Fallback | Rationale |
|------------|---------------|----------|-----------|
| **Screen sharing** | VP9 | VP8 | VP9 excels at sharp text and static content |
| **Camera** | H.264 | VP8 | H.264 has best hardware encode/decode support |
| **Camera (future)** | AV1 | H.264 | AV1 offers ~30% better compression when HW available |
| **Audio** | Opus | — | Opus is the only required audio codec in WebRTC |

### Setting Codec Preferences

```typescript
function setCodecPreferences(
  transceiver: RTCRtpTransceiver,
  preferredCodec: 'VP9' | 'H264' | 'VP8' | 'AV1'
): void {
  const capabilities = RTCRtpReceiver.getCapabilities('video')
  if (!capabilities) return

  const preferred = capabilities.codecs.filter(
    codec => codec.mimeType.toLowerCase() === `video/${preferredCodec.toLowerCase()}`
  )
  const others = capabilities.codecs.filter(
    codec => codec.mimeType.toLowerCase() !== `video/${preferredCodec.toLowerCase()}`
  )

  transceiver.setCodecPreferences([...preferred, ...others])
}
```

### Codec Detection

```typescript
function getAvailableCodecs(): string[] {
  const capabilities = RTCRtpReceiver.getCapabilities('video')
  if (!capabilities) return []

  return [...new Set(
    capabilities.codecs.map(c => c.mimeType.split('/')[1].toUpperCase())
  )]
}

// Check for hardware acceleration
async function hasHardwareCodec(codec: string): Promise<boolean> {
  // Use VideoEncoder.isConfigSupported (if available in Chromium 120)
  if ('VideoEncoder' in window) {
    const support = await VideoEncoder.isConfigSupported({
      codec: codec === 'H264' ? 'avc1.42001f' : 'vp09.00.10.08',
      width: 1280,
      height: 720,
      hardwareAcceleration: 'prefer-hardware'
    })
    return support.supported === true
  }
  return false
}
```

---

## Simulcast

Used with SFU topology (Phase 8). Each client sends video at multiple quality layers simultaneously.

### Simulcast Configuration

```typescript
const simulcastEncodings: RTCRtpEncodingParameters[] = [
  {
    rid: 'low',
    maxBitrate: 200_000,
    maxFramerate: 15,
    scaleResolutionDownBy: 4
  },
  {
    rid: 'mid',
    maxBitrate: 800_000,
    maxFramerate: 24,
    scaleResolutionDownBy: 2
  },
  {
    rid: 'high',
    maxBitrate: 2_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1
  }
]
```

### How Simulcast Works

```
  Sender captures at 1080p/30fps
    |
    |── Encode "high": 1080p/30fps @ 2 Mbps ──┐
    |── Encode "mid":   540p/24fps @ 800 Kbps ─┤── SFU
    |── Encode "low":   270p/15fps @ 200 Kbps ─┘
                                                |
                                  SFU selects per consumer:
                                     |
                           Viewer A (large tile) ← "high"
                           Viewer B (small tile) ← "low"
                           Viewer C (off-screen) ← paused
```

### Layer Selection by SFU

The SFU picks the layer based on:

| Factor | Selection |
|--------|-----------|
| Video tile size > 640px wide | `high` layer |
| Video tile size 320–640px | `mid` layer |
| Video tile size < 320px | `low` layer |
| Video tile not visible | Pause consumer |
| Receiver bandwidth constrained | Downgrade layer |
| Dominant/active speaker | Prefer `high` layer |

---

## MediaManager API

```typescript
class MediaManager {
  /** Start camera capture with optional constraints */
  startCamera(deviceId?: string, quality?: QualityPresetConfig): Promise<MediaStream>

  /** Stop camera capture and release tracks */
  stopCamera(): void

  /** Start screen sharing (opens source picker) */
  startScreenShare(): Promise<MediaStream>

  /** Stop screen sharing */
  stopScreenShare(): void

  /** Start audio-only capture */
  startMicrophone(deviceId?: string): Promise<MediaStream>

  /** Stop microphone */
  stopMicrophone(): void

  /** Mute/unmute audio (keeps stream alive) */
  setAudioMuted(muted: boolean): void

  /** Enable/disable video (keeps stream alive) */
  setVideoEnabled(enabled: boolean): void

  /** Switch camera device */
  switchCamera(deviceId: string): Promise<void>

  /** Switch microphone device */
  switchMicrophone(deviceId: string): Promise<void>

  /** Apply quality preset to all outgoing video tracks */
  setQuality(preset: QualityPresetConfig): Promise<void>

  /** Get current local streams */
  getLocalStreams(): {
    camera: MediaStream | null
    screen: MediaStream | null
    audio: MediaStream | null
  }

  /** Add local tracks to a peer connection */
  addTracksToConnection(peerConnection: RTCPeerConnection): RTCRtpSender[]

  /** Remove local tracks from a peer connection */
  removeTracksFromConnection(peerConnection: RTCPeerConnection): void

  /** Get available media devices */
  getDevices(): Promise<{
    cameras: MediaDeviceInfo[]
    microphones: MediaDeviceInfo[]
    speakers: MediaDeviceInfo[]
  }>

  /** Release all resources */
  dispose(): void

  /** Event emitter */
  on(event: MediaEvent, handler: MediaEventHandler): void
  off(event: MediaEvent, handler: MediaEventHandler): void
}

type MediaEvent =
  | 'camera-started'
  | 'camera-stopped'
  | 'screen-started'
  | 'screen-stopped'
  | 'audio-started'
  | 'audio-stopped'
  | 'device-changed'
  | 'track-ended'       // Browser/OS stopped the track
  | 'quality-changed'

interface MediaEventHandler {
  (data?: unknown): void
}
```

---

## Media Store

```typescript
import { create } from 'zustand'

interface RemoteStream {
  peerId: string
  stream: MediaStream
  mediaType: 'camera' | 'screen'
  audioMuted: boolean
  videoEnabled: boolean
}

interface MediaState {
  /** Local camera stream */
  localCamera: MediaStream | null

  /** Local screen share stream */
  localScreen: MediaStream | null

  /** Whether local audio is muted */
  audioMuted: boolean

  /** Whether local video is enabled */
  videoEnabled: boolean

  /** Remote streams from peers */
  remoteStreams: Map<string, RemoteStream>

  /** Current quality preset name */
  currentQuality: string

  /** Current bandwidth usage (Kbps) */
  bandwidth: { upload: number; download: number }

  /** Whether screen share source picker is open */
  sourcePickerOpen: boolean

  // --- Actions ---

  setLocalCamera: (stream: MediaStream | null) => void
  setLocalScreen: (stream: MediaStream | null) => void
  setAudioMuted: (muted: boolean) => void
  setVideoEnabled: (enabled: boolean) => void
  addRemoteStream: (peerId: string, stream: MediaStream, mediaType: 'camera' | 'screen') => void
  removeRemoteStream: (peerId: string, mediaType: 'camera' | 'screen') => void
  removeAllRemoteStreams: (peerId: string) => void
  setCurrentQuality: (quality: string) => void
  setBandwidth: (upload: number, download: number) => void
  setSourcePickerOpen: (open: boolean) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  localCamera: null,
  localScreen: null,
  audioMuted: false,
  videoEnabled: true,
  remoteStreams: new Map(),
  currentQuality: 'high',
  bandwidth: { upload: 0, download: 0 },
  sourcePickerOpen: false,

  setLocalCamera: (stream) => set({ localCamera: stream }),
  setLocalScreen: (stream) => set({ localScreen: stream }),
  setAudioMuted: (muted) => set({ audioMuted: muted }),
  setVideoEnabled: (enabled) => set({ videoEnabled: enabled }),

  addRemoteStream: (peerId, stream, mediaType) => set((state) => {
    const remoteStreams = new Map(state.remoteStreams)
    const key = `${peerId}:${mediaType}`
    remoteStreams.set(key, {
      peerId, stream, mediaType,
      audioMuted: false, videoEnabled: true
    })
    return { remoteStreams }
  }),

  removeRemoteStream: (peerId, mediaType) => set((state) => {
    const remoteStreams = new Map(state.remoteStreams)
    remoteStreams.delete(`${peerId}:${mediaType}`)
    return { remoteStreams }
  }),

  removeAllRemoteStreams: (peerId) => set((state) => {
    const remoteStreams = new Map(state.remoteStreams)
    for (const key of remoteStreams.keys()) {
      if (key.startsWith(`${peerId}:`)) {
        remoteStreams.delete(key)
      }
    }
    return { remoteStreams }
  }),

  setCurrentQuality: (quality) => set({ currentQuality: quality }),
  setBandwidth: (upload, download) => set({ bandwidth: { upload, download } }),
  setSourcePickerOpen: (open) => set({ sourcePickerOpen: open }),
}))
```

---

## Performance Limits

### Maximum Concurrent Streams

| Scenario | Max Video Decodes | Recommended |
|----------|-------------------|-------------|
| 1:1 call | 1 remote | 1 |
| Small group (mesh) | 5 remote | 4–5 |
| Large group (SFU) | 8 visible + paused | 8 visible |
| Screen share + camera | 1 screen + N cameras | 1 + 5 |

### CPU Budget Per Video Decode

| Resolution | Approximate CPU | Hardware Decode |
|------------|-----------------|-----------------|
| 240p | ~2% | Unnecessary |
| 480p | ~5% | Optional |
| 720p | ~10% | Recommended |
| 1080p | ~15% | Strongly recommended |

### Dominant Speaker Detection

In group calls, prioritize quality for the active speaker:

```typescript
function detectDominantSpeaker(
  audioLevels: Map<string, number>
): string | null {
  let maxLevel = 0.01  // Minimum threshold
  let dominant: string | null = null

  for (const [peerId, level] of audioLevels) {
    if (level > maxLevel) {
      maxLevel = level
      dominant = peerId
    }
  }

  return dominant
}
```

- Active speaker gets `high` quality layer
- Other peers get `low` or `mid` based on tile size
- Debounce speaker changes (hold for 2 seconds before switching)

### Off-Screen Video Pause

When a video tile scrolls out of view or is covered by another window:

```typescript
// Use IntersectionObserver to detect visibility
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const peerId = entry.target.getAttribute('data-peer-id')
    if (!peerId) continue

    if (entry.isIntersecting) {
      resumeVideoConsumer(peerId)
    } else {
      pauseVideoConsumer(peerId)
    }
  }
}, { threshold: 0.1 })
```

---

*Previous: [Chat ←](./05-chat.md) · Next: [Security →](./07-security.md)*
