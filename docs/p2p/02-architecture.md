# P2P Chat System — Architecture

> Electron integration, process boundaries, and project structure for the P2P chat system.

---

## Table of Contents

- [Process Boundary Decisions](#process-boundary-decisions)
- [Architecture Diagram](#architecture-diagram)
- [New Directory Structure](#new-directory-structure)
- [Data Flow Diagrams](#data-flow-diagrams)
  - [Peer Connection Flow](#peer-connection-flow)
  - [Text Message Flow](#text-message-flow)
  - [Screen Share Flow](#screen-share-flow)
  - [Group Message Routing](#group-message-routing)
- [Integration with Existing Architecture](#integration-with-existing-architecture)

---

## Process Boundary Decisions

Electron's multi-process model constrains where P2P functionality lives:

| Concern | Process | Rationale |
|---------|---------|-----------|
| WebRTC (RTCPeerConnection, DataChannel) | **Renderer** | Browser APIs only available in Chromium context |
| MediaStream (getUserMedia, getDisplayMedia) | **Renderer** | Browser media APIs |
| desktopCapturer (source picker) | **Main** → Preload | Requires Electron API, results sent to renderer via IPC |
| System notifications | **Main** | Native OS notifications via Electron `Notification` API |
| IndexedDB persistence | **Renderer** | Browser storage API, renderer-local |
| Crypto (Ed25519, AES-GCM) | **Renderer** | Web Crypto API available in Chromium |
| Network status monitoring | **Renderer** | `navigator.onLine`, `RTCPeerConnection` events |
| Media device enumeration | **Renderer** | `navigator.mediaDevices.enumerateDevices()` |
| App lifecycle (focus, blur, quit) | **Main** → Preload | Window events forwarded to renderer |
| File save dialogs | **Main** | Electron `dialog.showSaveDialog()` |

**Guiding principle:** Keep as much as possible in the renderer. Use main process only for Electron-specific APIs that have no browser equivalent.

---

## Architecture Diagram

```
+------------------------------------------------------------------+
|  MAIN PROCESS (Node.js)                                          |
|                                                                  |
|  +------------------+  +--------------------+  +---------------+ |
|  | Window Manager   |  | IPC Handlers       |  | System APIs   | |
|  | - BrowserWindow  |  | - desktop-sources  |  | - Notification| |
|  | - frame: false   |  | - show-notification|  | - dialog      | |
|  | - window controls|  | - media-access     |  | - app events  | |
|  +------------------+  | - app-path         |  +---------------+ |
|                         | - focus-change     |                    |
|                         +--------------------+                    |
+-------------------------------|-----------------------------------+
                                | IPC (contextBridge)
+-------------------------------|-----------------------------------+
|  PRELOAD (Isolated Context)   |                                  |
|                               v                                  |
|  +-----------------------------------------------------------+  |
|  | electronAPI                                                |  |
|  | - windowMinimize/Maximize/Close/IsMaximized  (existing)    |  |
|  | - getDesktopSources()                        (new)         |  |
|  | - showNotification(title, body)              (new)         |  |
|  | - getMediaAccess(mediaType)                  (new)         |  |
|  | - getAppPath()                               (new)         |  |
|  | - onFocusChange(callback)                    (new)         |  |
|  +-----------------------------------------------------------+  |
+-------------------------------|-----------------------------------+
                                | window.electronAPI
+-------------------------------|-----------------------------------+
|  RENDERER (Chromium / React)  v                                  |
|                                                                  |
|  +-------------------+  +--------------------+  +--------------+ |
|  | SERVICE LAYER     |  | ZUSTAND STORES     |  | REACT UI     | |
|  |                   |  |                    |  |              | |
|  | ConnectionManager |  | peer-store         |  | ChatList     | |
|  | SignalingClient   |  | chat-store         |  | ChatView     | |
|  | MediaManager      |  | media-store        |  | VideoGrid    | |
|  | MessageRouter     |  | connection-store   |  | MediaControls| |
|  | PersistenceManager|  | settings-store     |  | PeerList     | |
|  | CryptoManager     |  | performance-store  |  | Settings     | |
|  +--------+----------+  +--------+-----------+  +------+-------+ |
|           |                       |                      |        |
|  +--------v-----------------------v----------------------v-----+  |
|  | WEBRTC LAYER                                                |  |
|  |                                                             |  |
|  | RTCPeerConnection ──── DataChannel (JSON protocol)          |  |
|  |                   └─── MediaStream (audio/video RTP)        |  |
|  +-------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## New Directory Structure

Files to add to the existing project structure:

```
src/
├── main/
│   └── index.ts                    # UPDATE: add new IPC handlers
│
├── preload/
│   └── index.ts                    # UPDATE: expose new APIs
│
├── renderer/
│   ├── services/                   # NEW: P2P service layer
│   │   ├── ConnectionManager.ts    # WebRTC connection lifecycle
│   │   ├── SignalingClient.ts      # WebSocket signaling client
│   │   ├── MediaManager.ts         # Camera/screen capture & streams
│   │   ├── MessageRouter.ts        # Protocol message dispatch
│   │   ├── PersistenceManager.ts   # IndexedDB read/write
│   │   ├── CryptoManager.ts        # Ed25519 keys, signing, verification
│   │   └── PerformanceMonitor.ts   # RTCStats polling, quality metrics
│   │
│   ├── store/
│   │   ├── ui-store.ts             # EXISTING
│   │   ├── toast-store.ts          # EXISTING
│   │   ├── peer-store.ts           # NEW: peer list, online status
│   │   ├── chat-store.ts           # NEW: chat sessions, messages
│   │   ├── media-store.ts          # NEW: streams, mute, quality
│   │   ├── connection-store.ts     # NEW: connection/ICE states
│   │   ├── settings-store.ts       # NEW: user prefs (persisted)
│   │   └── performance-store.ts    # NEW: CPU, bandwidth, quality
│   │
│   ├── components/
│   │   ├── layout/                 # EXISTING layout components
│   │   ├── ui/                     # EXISTING neon UI primitives
│   │   ├── demo/                   # EXISTING demo pages
│   │   ├── chat/                   # NEW
│   │   │   ├── ChatList.tsx        # Chat session list
│   │   │   ├── ChatView.tsx        # Active chat (messages + input)
│   │   │   ├── ChatMessage.tsx     # Individual message bubble
│   │   │   ├── ChatInput.tsx       # Message composition
│   │   │   ├── ChatHeader.tsx      # Chat title bar + actions
│   │   │   ├── TypingIndicator.tsx # "Peer is typing..." display
│   │   │   └── GroupMemberList.tsx  # Group chat member sidebar
│   │   ├── media/                  # NEW
│   │   │   ├── VideoGrid.tsx       # Responsive video tile layout
│   │   │   ├── VideoTile.tsx       # Single video + name overlay
│   │   │   ├── ScreenShareView.tsx # Full-width screen share display
│   │   │   ├── MediaControls.tsx   # Mute/camera/screen/hang-up bar
│   │   │   ├── ScreenSourcePicker.tsx # Desktop source selection modal
│   │   │   ├── DeviceSelector.tsx  # Camera/mic dropdown
│   │   │   └── QualityIndicator.tsx# Connection quality badge
│   │   ├── peers/                  # NEW
│   │   │   ├── PeerList.tsx        # Online peer directory
│   │   │   ├── PeerCard.tsx        # Peer info card
│   │   │   ├── PeerInvite.tsx      # Manual connection dialog
│   │   │   └── ConnectionDialog.tsx# Connection status modal
│   │   └── settings/               # NEW
│   │       ├── MediaSettings.tsx   # Device selection, preview
│   │       ├── QualitySettings.tsx # Quality presets, codec pref
│   │       └── NetworkSettings.tsx # STUN/TURN config, signaling URL
│   │
│   ├── hooks/                      # EXISTING + NEW
│   │   ├── useEscapeKey.ts         # EXISTING
│   │   ├── useFocusTrap.ts         # EXISTING
│   │   ├── useClickOutside.ts      # EXISTING
│   │   ├── useWebRTC.ts            # NEW: WebRTC connection hook
│   │   ├── useMediaStream.ts       # NEW: media capture hook
│   │   └── usePeerConnection.ts    # NEW: per-peer connection hook
│   │
│   ├── types/                      # NEW: P2P type definitions
│   │   ├── protocol.ts             # Message envelope, payloads
│   │   ├── peer.ts                 # Peer, PeerProfile interfaces
│   │   ├── chat.ts                 # Chat, Message interfaces
│   │   └── media.ts                # Stream, Quality interfaces
│   │
│   ├── App.tsx                     # UPDATE: add routing, chat layout
│   └── index.tsx                   # EXISTING
│
├── types/
│   └── electron.d.ts               # UPDATE: add new ElectronAPI methods
│
signaling-server/                   # NEW: in-repo signaling server
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts                    # WebSocket signaling server
└── README.md
```

---

## Data Flow Diagrams

### Peer Connection Flow

```
  Peer A (Initiator)              Signaling Server             Peer B (Responder)
       |                               |                            |
       |--- register(peerIdA) -------->|                            |
       |                               |<--- register(peerIdB) ----|
       |                               |                            |
       |--- discover() -------------->|                            |
       |<-- peer-list [B] ------------|                            |
       |                               |                            |
       | [Create RTCPeerConnection]    |                            |
       | [Create DataChannel]          |                            |
       | [Create SDP Offer]            |                            |
       |                               |                            |
       |--- offer(sdp, to:B) -------->|                            |
       |                               |--- offer(sdp, from:A) --->|
       |                               |                            |
       |                               |    [Create RTCPeerConnection]
       |                               |    [Set Remote Description]
       |                               |    [Create SDP Answer]
       |                               |                            |
       |                               |<--- answer(sdp, to:A) ----|
       |<-- answer(sdp, from:B) ------|                            |
       |                               |                            |
       | [ICE Candidate Exchange - bidirectional via signaling]     |
       |--- ice(candidate) ---------->|--- ice(candidate) -------->|
       |<-- ice(candidate) -----------|<-- ice(candidate) ---------|
       |                               |                            |
       | [ICE Complete, DTLS Handshake, DataChannel Opens]         |
       |                               |                            |
       |====== HELLO ================>|  (direct, no signaling)    |
       |<===== HELLO_ACK =============|                            |
       |                               |                            |
       | [Connection Established - signaling no longer needed]     |
```

### Text Message Flow

```
  Sender                         Receiver
    |                               |
    | User types message            |
    |                               |
    | [TYPING_START] =============>|
    |                               | Show typing indicator
    |                               |
    | [TEXT] =====================>|
    |                               | Store in IndexedDB
    |                               | Display in chat
    |                 [TEXT_ACK     |
    |<============ delivered] ======|
    |                               |
    | Show "delivered" checkmark    |
    |                               | User scrolls to message
    |                 [TEXT_ACK     |
    |<============== read] ========|
    |                               |
    | Show "read" checkmark         |
```

### Screen Share Flow

```
  Sharer                          Viewer
    |                               |
    | User clicks "Share Screen"    |
    |                               |
    | [IPC: getDesktopSources()] -->| Main Process
    | <-- source list --------------|
    |                               |
    | User picks source             |
    |                               |
    | [desktopCapturer.getUserMedia] |
    | => MediaStream                |
    |                               |
    | [addTrack to RTCPeerConnection]|
    | [MEDIA_OFFER (SDP renegotiation)]
    |================================>|
    |                               |
    |<====== [MEDIA_ANSWER] ========|
    |                               |
    | [ICE candidates if needed]    |
    |                               |
    | [MEDIA_START (screen)] =====>|
    |                               | Display in ScreenShareView
    | [RTP media stream] =========>|
    |                               |
    | User clicks "Stop Sharing"    |
    |                               |
    | [removeTrack]                 |
    | [MEDIA_STOP (screen)] ======>|
    |                               | Remove ScreenShareView
```

### Group Message Routing

In mesh topology, the sender fans out messages to all group members:

```
  Sender (A)        Peer B         Peer C         Peer D
    |                 |              |              |
    | TEXT (to:*)     |              |              |
    |================>|              |              |
    |================================>|              |
    |================================================>|
    |                 |              |              |
    |   TEXT_ACK      |              |              |
    |<================|              |              |
    |<================================|              |
    |<================================================|
```

- The `to` field is set to `'*'` (broadcast)
- The sender's `MessageRouter` iterates all DataChannels for that `chatId`
- Each peer independently acknowledges with `TEXT_ACK`
- Group membership is tracked in `chat-store` — only send to peers who are members

---

## Integration with Existing Architecture

### What Changes in Existing Files

| File | Change |
|------|--------|
| `src/main/index.ts` | Add IPC handlers for `get-desktop-sources`, `show-notification`, `get-media-access`, `get-app-path`, `on-focus-change` |
| `src/preload/index.ts` | Expose new methods on `electronAPI` via `contextBridge` |
| `src/types/electron.d.ts` | Add new method signatures to `ElectronAPI` interface |
| `src/renderer/App.tsx` | Add routing/layout for chat view alongside existing demo content |
| `src/renderer/styles/theme.css` | No changes needed — existing tokens cover P2P UI needs |

### What Stays the Same

- **Window management** — frameless window, custom title bar, existing IPC channels
- **UI component library** — NeonButton, NeonCard, NeonInput, etc. used as-is
- **CRT effect** — `useUIStore` and `crt-effect` class unchanged
- **Toast system** — `toast-store.ts` and `Toast` component reused for P2P notifications
- **Build system** — Vite config, TypeScript config unchanged
- **Design tokens** — CSS variables in `theme.css` used by new components

### New Dependencies

| Package | Purpose | Process |
|---------|---------|---------|
| `uuid` | Generate message/chat/transfer IDs | Renderer |
| `idb` | IndexedDB wrapper (typed, Promise-based) | Renderer |
| `mediasoup-client` | SFU client (Phase 8 only) | Renderer |
| `ws` | WebSocket server | Signaling server |

No new dependencies required for WebRTC itself — it's built into Electron/Chromium.

---

*Previous: [Protocol ←](./01-protocol.md) · Next: [Networking →](./03-networking.md)*
