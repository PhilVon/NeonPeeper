# P2P Chat System — Implementation Phases

> Phased roadmap from zero to full P2P chat with video and SFU support.

---

## Table of Contents

- [Phase Overview](#phase-overview)
- [Phase 1: Foundation](#phase-1-foundation)
- [Phase 2: Chat System](#phase-2-chat-system)
- [Phase 3: Signaling Server](#phase-3-signaling-server)
- [Phase 4: Camera Video Calls](#phase-4-camera-video-calls)
- [Phase 5: Screen Sharing](#phase-5-screen-sharing)
- [Phase 6: Group Text Chat](#phase-6-group-text-chat)
- [Phase 7: Group Video](#phase-7-group-video)
- [Phase 8: SFU Integration](#phase-8-sfu-integration)
- [Phase 9: Security](#phase-9-security)
- [Phase 10: Performance & Polish](#phase-10-performance--polish)
- [Dependency Graph](#dependency-graph)

---

## Phase Overview

| Phase | Name | Dependencies | Complexity |
|-------|------|--------------|------------|
| 1 | Foundation | None | Medium |
| 2 | Chat System | Phase 1 | Medium |
| 3 | Signaling Server | Phase 1 | Low |
| 4 | Camera Video Calls | Phase 1, 3 | High |
| 5 | Screen Sharing | Phase 4 | Medium |
| 6 | Group Text Chat | Phase 2, 3 | Medium |
| 7 | Group Video | Phase 4, 6 | High |
| 8 | SFU Integration | Phase 7 | High |
| 9 | Security | Phase 2 | Medium |
| 10 | Performance & Polish | Phase 7 | Medium |

---

## Phase 1: Foundation

> Protocol types, manual SDP connection, and basic DataChannel text.

### Goal

Two peers can connect via manual SDP exchange and send text over a DataChannel.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/types/protocol.ts` | `NeonP2PMessage` envelope, all `MessageType`s, payload interfaces |
| `src/renderer/types/peer.ts` | `PeerProfile`, `LocalProfile` interfaces |
| `src/renderer/services/ConnectionManager.ts` | WebRTC connection lifecycle, DataChannel management |
| `src/renderer/services/MessageRouter.ts` | Dispatch incoming messages by type |
| `src/renderer/store/peer-store.ts` | Known peers, online status |
| `src/renderer/store/connection-store.ts` | Connection states, ICE states |
| `src/renderer/components/peers/PeerInvite.tsx` | Manual SDP exchange UI (copy/paste) |
| `src/renderer/components/peers/PeerInvite.css` | Styles |
| `src/renderer/components/peers/ConnectionDialog.tsx` | Connection progress modal |
| `src/renderer/components/peers/ConnectionDialog.css` | Styles |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Add basic routing or conditional rendering for peer connection |

### Acceptance Criteria

- [ ] `NeonP2PMessage` interface with version, type, id, from, to, chatId, timestamp, payload, signature fields
- [ ] All message types defined as TypeScript discriminated union
- [ ] `ConnectionManager` can create RTCPeerConnection with ICE config
- [ ] Manual SDP copy/paste flow works: Peer A generates offer → Peer B accepts → Peer B generates answer → Peer A accepts
- [ ] DataChannel opens and HELLO/HELLO_ACK exchange completes
- [ ] Text strings can be sent and received over DataChannel
- [ ] Connection state tracked in `connection-store`
- [ ] Peer appears in `peer-store` after successful handshake
- [ ] PING/PONG keepalive running at 15-second intervals

---

## Phase 2: Chat System

> Full chat UI with message persistence, delivery receipts, and typing indicators.

### Goal

Full 1:1 text chat experience with history that persists across app restarts.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/types/chat.ts` | `Chat`, `ChatMessage`, `StoredMessage`, `StoredChat` interfaces |
| `src/renderer/services/PersistenceManager.ts` | IndexedDB setup, message CRUD, chat CRUD |
| `src/renderer/store/chat-store.ts` | Chat sessions, messages, typing, active chat |
| `src/renderer/components/chat/ChatList.tsx` | Chat session list |
| `src/renderer/components/chat/ChatList.css` | Styles |
| `src/renderer/components/chat/ChatView.tsx` | Active chat area (messages + input) |
| `src/renderer/components/chat/ChatView.css` | Styles |
| `src/renderer/components/chat/ChatMessage.tsx` | Individual message bubble |
| `src/renderer/components/chat/ChatMessage.css` | Styles |
| `src/renderer/components/chat/ChatInput.tsx` | Message composition area |
| `src/renderer/components/chat/ChatInput.css` | Styles |
| `src/renderer/components/chat/ChatHeader.tsx` | Chat title bar |
| `src/renderer/components/chat/ChatHeader.css` | Styles |
| `src/renderer/components/chat/TypingIndicator.tsx` | "X is typing..." display |
| `src/renderer/components/chat/TypingIndicator.css` | Styles |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Add ChatList in sidebar, ChatView in main area |
| `src/renderer/services/MessageRouter.ts` | Handle TEXT, TEXT_ACK, TEXT_EDIT, TEXT_DELETE, TYPING_* |

### Acceptance Criteria

- [ ] Chat sessions created automatically on first message to a peer
- [ ] Messages displayed in chronological order with sender identification
- [ ] Messages persisted to IndexedDB and survive app restart
- [ ] Delivery receipts: `delivered` sent on receive, `read` sent when chat is active
- [ ] Receipt status shown: no mark → ✓ (delivered) → ✓✓ (read)
- [ ] Typing indicator appears when remote peer is typing (3s debounce, 5s auto-expire)
- [ ] Message editing works (own messages only)
- [ ] Message deletion shows "Message deleted" tombstone
- [ ] Unread message count shown in ChatList
- [ ] Chat list sorted by last activity
- [ ] Message pagination: load 50 at a time, older messages on scroll-up

---

## Phase 3: Signaling Server

> In-repo WebSocket signaling server with auto-discovery and auto-connect.

### Goal

Peers discover each other automatically via signaling server instead of manual SDP exchange.

### Files to Create

| File | Purpose |
|------|---------|
| `signaling-server/package.json` | Server dependencies |
| `signaling-server/tsconfig.json` | TypeScript config |
| `signaling-server/src/index.ts` | Complete WebSocket signaling server (~200-300 lines) |
| `signaling-server/README.md` | Setup and usage instructions |
| `src/renderer/services/SignalingClient.ts` | WebSocket client for signaling |
| `src/renderer/store/settings-store.ts` | User preferences (signaling URL, auto-connect, display name) |
| `src/renderer/components/peers/PeerList.tsx` | Online peer directory |
| `src/renderer/components/peers/PeerList.css` | Styles |
| `src/renderer/components/peers/PeerCard.tsx` | Peer info card |
| `src/renderer/components/peers/PeerCard.css` | Styles |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/ConnectionManager.ts` | Integrate with SignalingClient for offer/answer/ICE relay |
| `src/renderer/store/connection-store.ts` | Add signaling state tracking |
| `src/renderer/App.tsx` | Auto-connect to signaling on startup |

### Acceptance Criteria

- [ ] Signaling server starts with `npm run dev` in `signaling-server/`
- [ ] Server handles: register, discover, offer relay, answer relay, ICE relay
- [ ] Client connects to signaling server on app start (configurable URL)
- [ ] Peer list populated automatically from server discovery
- [ ] Clicking a peer initiates WebRTC connection via signaling
- [ ] Connection succeeds without any manual SDP exchange
- [ ] Signaling server handles peer disconnect (cleanup, notify room members)
- [ ] Settings UI for signaling server URL
- [ ] Reconnect to signaling server on disconnect (with backoff)

---

## Phase 4: Camera Video Calls

> 1:1 video/audio calls with quality presets.

### Goal

Users can start video calls with connected peers, with configurable quality.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/types/media.ts` | Stream, quality, codec interfaces |
| `src/renderer/services/MediaManager.ts` | Camera/mic capture, track management |
| `src/renderer/store/media-store.ts` | Local/remote streams, mute state, quality |
| `src/renderer/components/media/VideoGrid.tsx` | Responsive video tile layout |
| `src/renderer/components/media/VideoGrid.css` | Styles |
| `src/renderer/components/media/VideoTile.tsx` | Single video with overlays |
| `src/renderer/components/media/VideoTile.css` | Styles |
| `src/renderer/components/media/MediaControls.tsx` | Mute/camera/end call toolbar |
| `src/renderer/components/media/MediaControls.css` | Styles |
| `src/renderer/components/media/DeviceSelector.tsx` | Camera/mic dropdown |
| `src/renderer/components/media/DeviceSelector.css` | Styles |
| `src/renderer/components/media/QualityIndicator.tsx` | Connection quality badge |
| `src/renderer/components/media/QualityIndicator.css` | Styles |
| `src/renderer/components/settings/MediaSettings.tsx` | Device selection + preview |
| `src/renderer/components/settings/MediaSettings.css` | Styles |
| `src/renderer/components/settings/QualitySettings.tsx` | Quality preset selection |
| `src/renderer/components/settings/QualitySettings.css` | Styles |
| `src/renderer/hooks/useMediaStream.ts` | Media capture React hook |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/ConnectionManager.ts` | Add/remove media tracks, SDP renegotiation |
| `src/renderer/services/MessageRouter.ts` | Handle MEDIA_OFFER, MEDIA_ANSWER, MEDIA_ICE, MEDIA_START, MEDIA_STOP |
| `src/renderer/App.tsx` | Video call overlay when in call |
| `src/renderer/components/chat/ChatHeader.tsx` | Add call buttons |

### Acceptance Criteria

- [ ] Camera and microphone capture working via getUserMedia
- [ ] Local video preview before/during call
- [ ] Remote video displayed in VideoTile
- [ ] Audio/video mute toggles (keeps stream alive, disables tracks)
- [ ] End call properly stops tracks and removes from peer connection
- [ ] Quality presets: Low, Medium, High, Ultra
- [ ] Codec preference: H.264, VP9, VP8, Auto
- [ ] Device switching mid-call (camera, microphone)
- [ ] Incoming call notification (toast)
- [ ] MediaControls toolbar with mute, camera, end call buttons
- [ ] QualityIndicator shows connection quality (based on RTT/packet loss)
- [ ] Media settings page with device selection and live preview

---

## Phase 5: Screen Sharing

> Desktop/window capture with source picker.

### Goal

Users can share their screen or specific windows with connected peers.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/components/media/ScreenSourcePicker.tsx` | Source selection modal |
| `src/renderer/components/media/ScreenSourcePicker.css` | Styles |
| `src/renderer/components/media/ScreenShareView.tsx` | Full-width screen share display |
| `src/renderer/components/media/ScreenShareView.css` | Styles |

### Files to Modify

| File | Change |
|------|--------|
| `src/main/index.ts` | Add `get-desktop-sources` IPC handler |
| `src/preload/index.ts` | Expose `getDesktopSources()` |
| `src/types/electron.d.ts` | Add `DesktopSource` interface, `getDesktopSources` method |
| `src/renderer/services/MediaManager.ts` | Add screen capture methods |
| `src/renderer/store/media-store.ts` | Add screen share state |
| `src/renderer/components/media/VideoGrid.tsx` | Screen share layout (full-width + thumbnails) |
| `src/renderer/components/media/MediaControls.tsx` | Add screen share button |

### Acceptance Criteria

- [ ] `getDesktopSources()` IPC returns available screens and windows with thumbnails
- [ ] ScreenSourcePicker modal shows available sources in a grid
- [ ] Selecting a source starts screen capture
- [ ] Screen share displayed full-width in VideoGrid with camera thumbnails below
- [ ] VP9 codec preferred for screen sharing (sharp text)
- [ ] "Stop sharing" button visible to the sharer
- [ ] Screen share + camera simultaneously supported
- [ ] Remote peer sees screen share automatically when track is added
- [ ] Stopping screen share properly removes tracks and updates UI

---

## Phase 6: Group Text Chat

> Multi-peer text chat with mesh fan-out and member management.

### Goal

Group text chats with 3+ peers, member management, and mesh message routing.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/components/chat/GroupMemberList.tsx` | Group member sidebar |
| `src/renderer/components/chat/GroupMemberList.css` | Styles |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/MessageRouter.ts` | Handle CHAT_CREATE, CHAT_INVITE, CHAT_JOIN, CHAT_LEAVE, CHAT_SYNC |
| `src/renderer/services/ConnectionManager.ts` | Multi-peer connection management |
| `src/renderer/store/chat-store.ts` | Group chat state, member tracking |
| `src/renderer/components/chat/ChatList.tsx` | Show group chats with member count |
| `src/renderer/components/chat/ChatHeader.tsx` | Group name, member count, invite button |
| `src/renderer/components/chat/ChatMessage.tsx` | Show sender name/avatar in group context |
| `src/renderer/components/peers/PeerList.tsx` | "Create Group" button |

### Acceptance Criteria

- [ ] Create group chat with selected peers
- [ ] Group chat name displayed in ChatList and ChatHeader
- [ ] Messages fan-out to all group members via mesh
- [ ] Sender name and avatar shown on each message in group context
- [ ] Invite new members to existing group
- [ ] Leave group (stop receiving messages, notified to others)
- [ ] Member list sidebar showing online/offline status
- [ ] Chat sync (CHAT_SYNC) works when a peer reconnects
- [ ] Message deduplication by message ID
- [ ] Typing indicators show per-peer in groups ("Alice and Bob are typing...")
- [ ] Delivery receipts work per-peer in groups

---

## Phase 7: Group Video

> Multi-peer video calls in mesh topology with auto-quality reduction.

### Goal

Video calls with 3-6 peers using mesh topology, with automatic quality reduction as peers join.

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/ConnectionManager.ts` | Multi-peer media management, auto quality |
| `src/renderer/services/MediaManager.ts` | Multi-stream management, quality scaling |
| `src/renderer/services/PerformanceMonitor.ts` | Create: RTCStats polling, quality metrics |
| `src/renderer/store/performance-store.ts` | Create: stats data, connection quality |
| `src/renderer/store/media-store.ts` | Multiple remote streams |
| `src/renderer/components/media/VideoGrid.tsx` | 3-6 peer grid layouts |
| `src/renderer/components/media/VideoTile.tsx` | Active speaker highlight |
| `src/renderer/components/media/MediaControls.tsx` | Group call controls |
| `src/renderer/components/chat/GroupMemberList.tsx` | Show in-call status per member |

### Acceptance Criteria

- [ ] Video grid correctly displays 3-6 peer tiles in responsive layout
- [ ] Quality automatically reduces as peers join: High (2) → Medium (3-4) → Low (5-6)
- [ ] Active speaker detection and visual highlight (green glow border)
- [ ] PerformanceMonitor polls RTCStatsReport every 2 seconds
- [ ] Connection quality indicator per peer (excellent/good/fair/poor)
- [ ] Adding/removing video tracks triggers SDP renegotiation
- [ ] Audio mixing works correctly (hear all peers)
- [ ] Individual peer mute state tracked
- [ ] Frame rate reduced before resolution when CPU is high
- [ ] Off-screen video tiles pause decoding (IntersectionObserver)

---

## Phase 8: SFU Integration

> mediasoup SFU for 7+ peer video calls with simulcast.

### Goal

Large group video calls via SFU, with simulcast for bandwidth efficiency.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/services/SFUClient.ts` | mediasoup-client integration |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/ConnectionManager.ts` | Topology switching (mesh → SFU at 7 peers) |
| `src/renderer/services/MediaManager.ts` | Simulcast encoding, consumer management |
| `src/renderer/store/media-store.ts` | SFU stream management |
| `src/renderer/components/media/VideoGrid.tsx` | 7+ peer layouts (4-column grid) |
| `src/renderer/components/media/VideoTile.tsx` | Layer quality indicator |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `mediasoup-client` | SFU client library for WebRTC |

### Acceptance Criteria

- [ ] SFUClient connects to a mediasoup server
- [ ] Simulcast: client sends 3 quality layers (low/mid/high)
- [ ] SFU selects appropriate layer per consumer
- [ ] Topology auto-switches from mesh to SFU at 7 peers
- [ ] Topology switch notification shown to users
- [ ] DataChannels remain direct (mesh) even with SFU media
- [ ] 8+ peer grid layout works (4-column)
- [ ] Bandwidth reduced vs mesh: single upload regardless of group size
- [ ] Active speaker gets high quality layer, others get lower
- [ ] Off-screen consumers paused via SFU consumer.pause()

---

## Phase 9: Security

> Ed25519 keypair generation, message signing, and peer verification UI.

### Goal

Peer identity backed by cryptographic keys, with message signing and verification.

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/services/CryptoManager.ts` | Key generation, signing, verification |

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/MessageRouter.ts` | Sign outgoing TEXT messages, verify incoming |
| `src/renderer/store/peer-store.ts` | Store peer public keys, verification status |
| `src/renderer/store/settings-store.ts` | Message signing toggle |
| `src/renderer/components/peers/PeerCard.tsx` | Verification badge and "Verify" button |
| `src/renderer/components/peers/PeerList.tsx` | Show verified/unverified status |

### Acceptance Criteria

- [ ] Ed25519 keypair generated on first app launch
- [ ] Private key encrypted with user passphrase and stored in IndexedDB
- [ ] Peer ID derived from SHA-256 hash of public key (32 hex chars)
- [ ] Public key exchanged in HELLO/HELLO_ACK messages
- [ ] TOFU: first-seen key stored, subsequent connections verified
- [ ] Key mismatch alert shown to user (possible impersonation)
- [ ] Safety number generation for manual verification
- [ ] TEXT messages signed with Ed25519 when signing is enabled
- [ ] Invalid signatures flagged to user
- [ ] Verification badge shown on verified peers

---

## Phase 10: Performance & Polish

> Adaptive bitrate, robust reconnection, and accessibility.

### Goal

Production-quality polish: adaptive quality, reliable reconnection, and accessible UI.

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/services/PerformanceMonitor.ts` | Adaptive bitrate algorithm |
| `src/renderer/services/ConnectionManager.ts` | Robust reconnection with exponential backoff |
| `src/renderer/services/MediaManager.ts` | Adaptive quality application |
| `src/main/index.ts` | Add `show-notification`, `get-media-access`, `get-app-path`, `on-focus-change` IPC |
| `src/preload/index.ts` | Expose remaining new APIs |
| `src/types/electron.d.ts` | Complete ElectronAPI interface |
| `src/renderer/components/settings/NetworkSettings.tsx` | Create: STUN/TURN configuration |
| `src/renderer/components/settings/NetworkSettings.css` | Styles |

### Acceptance Criteria

- [ ] Adaptive bitrate: downgrade quality on packet loss > 5% (3 consecutive bad samples)
- [ ] Adaptive bitrate: upgrade quality after 10 consecutive good samples
- [ ] Hysteresis: minimum 10 seconds between quality changes
- [ ] Reconnection: exponential backoff (1s base, 30s max, 10 attempts)
- [ ] ICE restart attempted before full reconnection
- [ ] Queued messages delivered on reconnect
- [ ] Native OS notifications for messages when window is unfocused
- [ ] Focus-change events trigger read receipt sending
- [ ] All interactive elements keyboard-accessible
- [ ] ARIA labels on video tiles, media controls, chat elements
- [ ] Focus trap in modals (ScreenSourcePicker, ConnectionDialog, PeerInvite)
- [ ] Memory cleanup: streams stopped on disconnect, message pagination enforced
- [ ] Performance stays within budget tables from [Performance doc](./08-performance.md)

---

## Dependency Graph

```
  Phase 1 (Foundation)
    │
    ├──────────────────────┬──────────────────┐
    │                      │                  │
    v                      v                  v
  Phase 2 (Chat)      Phase 3 (Signaling)   Phase 9 (Security)
    │                      │
    │                      │
    │    ┌─────────────────┤
    │    │                 │
    v    v                 v
  Phase 6 (Group Text)  Phase 4 (Camera Video)
    │                      │
    │                      v
    │                   Phase 5 (Screen Share)
    │                      │
    ├──────────────────────┘
    │
    v
  Phase 7 (Group Video)
    │
    ├───────────────────────────────────────┐
    │                                       │
    v                                       v
  Phase 8 (SFU)                    Phase 10 (Polish)
```

### Parallel Work Opportunities

These phases can be developed concurrently by different developers:

| Track A | Track B |
|---------|---------|
| Phase 2 (Chat UI) | Phase 3 (Signaling Server) |
| Phase 5 (Screen Share) | Phase 6 (Group Text) |
| Phase 9 (Security) | Phase 4 (Camera Video) |

---

*Previous: [UI Components ←](./11-ui-components.md) · Back to [Overview →](./00-overview.md)*
