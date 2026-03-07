# P2P Chat System — State Management

> Zustand store architecture for all P2P state.

---

## Table of Contents

- [Store Architecture](#store-architecture)
- [Store Relationships](#store-relationships)
- [Peer Store](#peer-store)
- [Chat Store](#chat-store)
- [Media Store](#media-store)
- [Connection Store](#connection-store)
- [Settings Store](#settings-store)
- [Performance Store](#performance-store)
- [Usage Patterns](#usage-patterns)

---

## Store Architecture

Six new Zustand stores manage P2P state, alongside the two existing stores:

```
+------------------------------------------------------------------+
|  ZUSTAND STORES                                                  |
|                                                                  |
|  EXISTING                        NEW                             |
|  +---------------+              +--------------------+           |
|  | ui-store      |              | peer-store         |           |
|  | - crtEnabled  |              | - known peers      |           |
|  +---------------+              | - online status    |           |
|  +---------------+              | - local profile    |           |
|  | toast-store   |              +--------------------+           |
|  | - toasts[]    |              +--------------------+           |
|  +---------------+              | chat-store         |           |
|                                 | - chat sessions    |           |
|                                 | - messages         |           |
|                                 | - typing state     |           |
|                                 +--------------------+           |
|                                 +--------------------+           |
|                                 | media-store        |           |
|                                 | - local streams    |           |
|                                 | - remote streams   |           |
|                                 | - mute state       |           |
|                                 +--------------------+           |
|                                 +--------------------+           |
|                                 | connection-store   |           |
|                                 | - connection states|           |
|                                 | - ICE states       |           |
|                                 | - DataChannel state|           |
|                                 +--------------------+           |
|                                 +--------------------+           |
|                                 | settings-store     |           |
|                                 | - user preferences |           |
|                                 | - persisted to     |           |
|                                 |   localStorage     |           |
|                                 +--------------------+           |
|                                 +--------------------+           |
|                                 | performance-store  |           |
|                                 | - RTCStats data    |           |
|                                 | - bandwidth usage  |           |
|                                 | - quality metrics  |           |
|                                 +--------------------+           |
+------------------------------------------------------------------+
```

---

## Store Relationships

```
  settings-store ─────────────────────────────────┐
  (quality preset, STUN/TURN config)              │ reads config
                                                  ▼
  peer-store ──────────► connection-store ──────► media-store
  (who exists)           (connection state)       (streams)
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
  chat-store              performance-store       ui-store
  (messages)              (quality metrics)       (CRT effect)
       │                                             │
       ▼                                             ▼
  toast-store ◄──────────────────────────────────────┘
  (notifications)
```

### Data Flow

1. **Peer connects** → `connection-store` updates state → `peer-store` marks online
2. **Message received** → `chat-store` adds message → `toast-store` shows notification
3. **Video started** → `media-store` adds stream → reads quality from `settings-store`
4. **Quality degrades** → `performance-store` updates → triggers adaptive quality in `media-store`

---

## Peer Store

Tracks known peers and their online status.

```typescript
import { create } from 'zustand'

interface PeerProfile {
  /** Peer ID (hex-encoded public key hash) */
  peerId: string

  /** Display name */
  displayName: string

  /** Ed25519 public key (hex-encoded) */
  publicKey: string

  /** Online status */
  status: 'online' | 'offline' | 'busy' | 'idle'

  /** First connection timestamp */
  firstSeen: number

  /** Last activity timestamp */
  lastSeen: number

  /** Whether identity has been manually verified */
  verified: boolean

  /** Avatar color (derived from peer ID) */
  avatarColor: string
}

interface LocalProfile {
  peerId: string
  displayName: string
  publicKey: string
  status: 'online' | 'busy' | 'idle'
}

interface PeerState {
  /** All known peers */
  peers: Map<string, PeerProfile>

  /** Local user profile */
  localProfile: LocalProfile | null

  // --- Actions ---

  /** Set the local user's profile */
  setLocalProfile: (profile: LocalProfile) => void

  /** Update local user's status */
  setLocalStatus: (status: 'online' | 'busy' | 'idle') => void

  /** Add or update a peer */
  upsertPeer: (peer: PeerProfile) => void

  /** Update a peer's online status */
  setPeerStatus: (peerId: string, status: PeerProfile['status']) => void

  /** Update a peer's display name */
  setPeerDisplayName: (peerId: string, displayName: string) => void

  /** Mark a peer as verified */
  setPeerVerified: (peerId: string, verified: boolean) => void

  /** Remove a peer from known peers */
  removePeer: (peerId: string) => void

  /** Get online peers only */
  getOnlinePeers: () => PeerProfile[]
}

export const usePeerStore = create<PeerState>((set, get) => ({
  peers: new Map(),
  localProfile: null,

  setLocalProfile: (profile) => set({ localProfile: profile }),

  setLocalStatus: (status) => set((state) => ({
    localProfile: state.localProfile
      ? { ...state.localProfile, status }
      : null
  })),

  upsertPeer: (peer) => set((state) => {
    const peers = new Map(state.peers)
    peers.set(peer.peerId, peer)
    return { peers }
  }),

  setPeerStatus: (peerId, status) => set((state) => {
    const peers = new Map(state.peers)
    const peer = peers.get(peerId)
    if (peer) {
      peers.set(peerId, { ...peer, status, lastSeen: Date.now() })
    }
    return { peers }
  }),

  setPeerDisplayName: (peerId, displayName) => set((state) => {
    const peers = new Map(state.peers)
    const peer = peers.get(peerId)
    if (peer) {
      peers.set(peerId, { ...peer, displayName })
    }
    return { peers }
  }),

  setPeerVerified: (peerId, verified) => set((state) => {
    const peers = new Map(state.peers)
    const peer = peers.get(peerId)
    if (peer) {
      peers.set(peerId, { ...peer, verified })
    }
    return { peers }
  }),

  removePeer: (peerId) => set((state) => {
    const peers = new Map(state.peers)
    peers.delete(peerId)
    return { peers }
  }),

  getOnlinePeers: () => {
    return Array.from(get().peers.values()).filter(p => p.status !== 'offline')
  },
}))
```

---

## Chat Store

See [Chat — Chat Store](./05-chat.md#chat-store) for the full implementation.

Summary of the interface:

```typescript
interface ChatState {
  chats: Map<string, Chat>
  messages: Map<string, ChatMessage[]>
  activeChatId: string | null
  typing: Map<string, Set<string>>

  setActiveChat: (chatId: string | null) => void
  upsertChat: (chat: Chat) => void
  addMessage: (message: ChatMessage) => void
  updateMessageStatus: (messageId: string, chatId: string, status: 'delivered' | 'read') => void
  editMessage: (messageId: string, chatId: string, newContent: string) => void
  deleteMessage: (messageId: string, chatId: string) => void
  setTyping: (chatId: string, peerId: string, isTyping: boolean) => void
  markAsRead: (chatId: string) => void
  loadOlderMessages: (chatId: string, messages: ChatMessage[]) => void
  archiveChat: (chatId: string) => void
  leaveChat: (chatId: string) => void
}
```

---

## Media Store

See [Media — Media Store](./06-media.md#media-store) for the full implementation.

Summary:

```typescript
interface MediaState {
  localCamera: MediaStream | null
  localScreen: MediaStream | null
  audioMuted: boolean
  videoEnabled: boolean
  remoteStreams: Map<string, RemoteStream>
  currentQuality: string
  bandwidth: { upload: number; download: number }
  sourcePickerOpen: boolean

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
```

---

## Connection Store

Tracks the state of each WebRTC connection.

```typescript
import { create } from 'zustand'

type ConnectionState = 'new' | 'connecting' | 'connected' | 'reconnecting' | 'closed'
type ICEState = 'new' | 'checking' | 'connected' | 'completed' | 'disconnected' | 'failed' | 'closed'
type DataChannelState = 'connecting' | 'open' | 'closing' | 'closed'

interface PeerConnectionInfo {
  /** Peer ID */
  peerId: string

  /** High-level connection state */
  connectionState: ConnectionState

  /** ICE connection state (from RTCPeerConnection) */
  iceState: ICEState

  /** Control DataChannel state */
  dataChannelState: DataChannelState

  /** Connection start timestamp */
  connectedAt: number | null

  /** Number of reconnection attempts */
  reconnectAttempts: number

  /** Last error message */
  lastError: string | null

  /** Local ICE candidate type (host, srflx, relay) */
  localCandidateType: string | null

  /** Remote ICE candidate type */
  remoteCandidateType: string | null
}

interface ConnectionStoreState {
  /** All peer connection states */
  connections: Map<string, PeerConnectionInfo>

  /** Signaling server connection status */
  signalingState: 'disconnected' | 'connecting' | 'connected' | 'error'

  /** Signaling server URL */
  signalingUrl: string | null

  // --- Actions ---

  /** Initialize a new connection entry */
  initConnection: (peerId: string) => void

  /** Update connection state */
  setConnectionState: (peerId: string, state: ConnectionState) => void

  /** Update ICE state */
  setIceState: (peerId: string, state: ICEState) => void

  /** Update DataChannel state */
  setDataChannelState: (peerId: string, state: DataChannelState) => void

  /** Record connection error */
  setConnectionError: (peerId: string, error: string) => void

  /** Increment reconnection attempts */
  incrementReconnectAttempts: (peerId: string) => void

  /** Reset reconnection attempts (on successful reconnect) */
  resetReconnectAttempts: (peerId: string) => void

  /** Set candidate types (after ICE completes) */
  setCandidateTypes: (peerId: string, local: string, remote: string) => void

  /** Remove a connection */
  removeConnection: (peerId: string) => void

  /** Set signaling server state */
  setSignalingState: (state: ConnectionStoreState['signalingState']) => void

  /** Set signaling server URL */
  setSignalingUrl: (url: string | null) => void
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  connections: new Map(),
  signalingState: 'disconnected',
  signalingUrl: null,

  initConnection: (peerId) => set((state) => {
    const connections = new Map(state.connections)
    connections.set(peerId, {
      peerId,
      connectionState: 'new',
      iceState: 'new',
      dataChannelState: 'connecting',
      connectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
      localCandidateType: null,
      remoteCandidateType: null
    })
    return { connections }
  }),

  setConnectionState: (peerId, connectionState) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, {
        ...info,
        connectionState,
        connectedAt: connectionState === 'connected' ? Date.now() : info.connectedAt
      })
    }
    return { connections }
  }),

  setIceState: (peerId, iceState) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, iceState })
    }
    return { connections }
  }),

  setDataChannelState: (peerId, dataChannelState) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, dataChannelState })
    }
    return { connections }
  }),

  setConnectionError: (peerId, error) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, lastError: error })
    }
    return { connections }
  }),

  incrementReconnectAttempts: (peerId) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, reconnectAttempts: info.reconnectAttempts + 1 })
    }
    return { connections }
  }),

  resetReconnectAttempts: (peerId) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, reconnectAttempts: 0 })
    }
    return { connections }
  }),

  setCandidateTypes: (peerId, local, remote) => set((state) => {
    const connections = new Map(state.connections)
    const info = connections.get(peerId)
    if (info) {
      connections.set(peerId, { ...info, localCandidateType: local, remoteCandidateType: remote })
    }
    return { connections }
  }),

  removeConnection: (peerId) => set((state) => {
    const connections = new Map(state.connections)
    connections.delete(peerId)
    return { connections }
  }),

  setSignalingState: (signalingState) => set({ signalingState }),
  setSignalingUrl: (signalingUrl) => set({ signalingUrl }),
}))
```

---

## Settings Store

Persisted user preferences using Zustand's `persist` middleware.

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  /** User's display name */
  displayName: string

  /** Preferred video quality preset */
  qualityPreset: 'low' | 'medium' | 'high' | 'ultra' | 'adaptive'

  /** Preferred video codec */
  preferredCodec: 'VP9' | 'H264' | 'VP8' | 'auto'

  /** Selected camera device ID */
  cameraDeviceId: string | null

  /** Selected microphone device ID */
  microphoneDeviceId: string | null

  /** Selected speaker device ID */
  speakerDeviceId: string | null

  /** STUN server URLs */
  stunServers: string[]

  /** TURN server configuration */
  turnServer: {
    url: string
    username: string
    credential: string
  } | null

  /** Signaling server URL */
  signalingUrl: string

  /** Whether to auto-connect to signaling on startup */
  autoConnect: boolean

  /** Whether to show desktop notifications */
  desktopNotifications: boolean

  /** Whether to enable message signing */
  messageSigning: boolean

  // --- Actions ---

  setDisplayName: (name: string) => void
  setQualityPreset: (preset: SettingsState['qualityPreset']) => void
  setPreferredCodec: (codec: SettingsState['preferredCodec']) => void
  setCameraDeviceId: (id: string | null) => void
  setMicrophoneDeviceId: (id: string | null) => void
  setSpeakerDeviceId: (id: string | null) => void
  setStunServers: (urls: string[]) => void
  setTurnServer: (config: SettingsState['turnServer']) => void
  setSignalingUrl: (url: string) => void
  setAutoConnect: (enabled: boolean) => void
  setDesktopNotifications: (enabled: boolean) => void
  setMessageSigning: (enabled: boolean) => void
  resetToDefaults: () => void
}

const DEFAULT_SETTINGS = {
  displayName: 'Anonymous',
  qualityPreset: 'high' as const,
  preferredCodec: 'auto' as const,
  cameraDeviceId: null,
  microphoneDeviceId: null,
  speakerDeviceId: null,
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302'
  ],
  turnServer: null,
  signalingUrl: 'ws://localhost:8080',
  autoConnect: true,
  desktopNotifications: true,
  messageSigning: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setDisplayName: (displayName) => set({ displayName }),
      setQualityPreset: (qualityPreset) => set({ qualityPreset }),
      setPreferredCodec: (preferredCodec) => set({ preferredCodec }),
      setCameraDeviceId: (cameraDeviceId) => set({ cameraDeviceId }),
      setMicrophoneDeviceId: (microphoneDeviceId) => set({ microphoneDeviceId }),
      setSpeakerDeviceId: (speakerDeviceId) => set({ speakerDeviceId }),
      setStunServers: (stunServers) => set({ stunServers }),
      setTurnServer: (turnServer) => set({ turnServer }),
      setSignalingUrl: (signalingUrl) => set({ signalingUrl }),
      setAutoConnect: (autoConnect) => set({ autoConnect }),
      setDesktopNotifications: (desktopNotifications) => set({ desktopNotifications }),
      setMessageSigning: (messageSigning) => set({ messageSigning }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'neon-peeper-settings',  // localStorage key
      partialize: (state) => ({
        // Only persist these fields (exclude functions)
        displayName: state.displayName,
        qualityPreset: state.qualityPreset,
        preferredCodec: state.preferredCodec,
        cameraDeviceId: state.cameraDeviceId,
        microphoneDeviceId: state.microphoneDeviceId,
        speakerDeviceId: state.speakerDeviceId,
        stunServers: state.stunServers,
        turnServer: state.turnServer,
        signalingUrl: state.signalingUrl,
        autoConnect: state.autoConnect,
        desktopNotifications: state.desktopNotifications,
        messageSigning: state.messageSigning,
      })
    }
  )
)
```

---

## Performance Store

See [Performance — Performance Store](./08-performance.md#performance-store) for the full implementation.

Summary:

```typescript
interface PerformanceState {
  peerStats: Map<string, PeerConnectionStats>
  aggregate: AggregateStats
  adaptiveQuality: string

  updatePeerStats: (peerId: string, stats: PeerConnectionStats) => void
  removePeerStats: (peerId: string) => void
  setAggregateStats: (stats: AggregateStats) => void
  setAdaptiveQuality: (quality: string) => void
}
```

---

## Usage Patterns

### Selector Pattern (Prevent Unnecessary Re-renders)

```typescript
// GOOD: Select only what you need
const displayName = usePeerStore((state) => state.localProfile?.displayName)
const onlinePeers = usePeerStore((state) =>
  Array.from(state.peers.values()).filter(p => p.status !== 'offline')
)

// BAD: Selecting the entire store causes re-render on any change
const peerState = usePeerStore()  // Don't do this
```

### Accessing Store Outside React Components

```typescript
// In services (ConnectionManager, MediaManager, etc.)
import { usePeerStore } from '../store/peer-store'
import { useChatStore } from '../store/chat-store'

// Read current state
const peer = usePeerStore.getState().peers.get(peerId)

// Update state
useChatStore.getState().addMessage(newMessage)

// Subscribe to changes
const unsubscribe = useConnectionStore.subscribe(
  (state) => state.connections,
  (connections) => {
    // React to connection changes
  }
)
```

### Combining Stores in Components

```typescript
function ChatHeader({ chatId }: { chatId: string }) {
  const chat = useChatStore((state) => state.chats.get(chatId))
  const peers = usePeerStore((state) => state.peers)
  const connection = useConnectionStore((state) =>
    chat?.type === 'direct'
      ? state.connections.get(chat.members.find(id => id !== localPeerId) || '')
      : null
  )

  // Render using data from multiple stores
  return (
    <div className="chat-header">
      <span>{chat?.name || peers.get(chat?.members[0] || '')?.displayName}</span>
      {connection && (
        <StatusIndicator status={connection.connectionState === 'connected' ? 'online' : 'offline'} />
      )}
    </div>
  )
}
```

---

*Previous: [Performance ←](./08-performance.md) · Next: [IPC API →](./10-ipc-api.md)*
