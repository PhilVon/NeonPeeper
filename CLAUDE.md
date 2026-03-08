# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Main app
npm run dev      # Start development server with HMR
npm run build    # Build for production (runs tsc then vite build)
npm run preview  # Preview production build locally

# Signaling server (from signaling-server/)
npm run dev      # tsx src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
```

**Prerequisites:** Node.js v18+, npm v9+

## Architecture

This is an **Electron + React + TypeScript** P2P chat and video calling desktop application with a cyberpunk/neon aesthetic. It uses WebRTC for direct peer-to-peer communication with an optional WebSocket signaling server for peer discovery.

### Multi-Process Structure

```
src/
├── main/              # Electron main process (Node.js context)
│   └── index.ts       # Window creation, IPC handlers, desktopCapturer
├── preload/           # Preload scripts (isolated context bridge)
│   └── index.ts       # Exposes electronAPI via contextBridge
├── renderer/          # React application (Chromium context)
│   ├── components/
│   │   ├── chat/      # ChatView, ChatList, ChatInput, ChatMessage, ChatHeader, TypingIndicator, GroupMemberList, CustomEmojiPicker
│   │   ├── media/     # ChatVideoPanel, VideoGrid, VideoTile, MediaControls, DeviceSelector, ScreenShareView, ScreenSourcePicker, QualityIndicator
│   │   ├── peers/     # PeerList, PeerCard, PeerInvite, ConnectionDialog
│   │   ├── settings/  # MediaSettings, NetworkSettings, QualitySettings, EmojiManager, PrivacySettings
│   │   ├── layout/    # MainLayout, TitleBar, Sidebar, StatusBar, SplitPane, ResizablePanel, Collapsible
│   │   ├── ui/        # NeonButton, NeonCard, NeonInput, Modal, Toast, Tabs, Avatar, Badge, DataTable, ImageEditor, etc.
│   │   ├── demo/      # DemoSuite with pages for component showcase
│   │   └── utils/     # Portal
│   ├── hooks/         # useClickOutside, useEscapeKey, useFocusTrap, useMediaStream, useSpeakingDetection, useTypingEffect, useTextScramble, useCountUp, useReplayAnimation
│   ├── services/      # ConnectionManager, MessageRouter, MediaManager, CryptoManager, SignalingClient, PersistenceManager, PerformanceMonitor, SFUClient, EphemeralMessageManager
│   ├── store/         # Zustand stores (chat, connection, emoji, media, peer, performance, settings, toast, ui)
│   ├── styles/        # CSS variables, globals, animations
│   ├── types/         # protocol.ts, peer.ts, chat.ts, media.ts
│   ├── App.tsx
│   └── index.tsx
├── types/
│   └── electron.d.ts  # TypeScript definitions for electronAPI
signaling-server/      # Standalone WebSocket signaling server (ws library, port 8080)
```

**Build output:** `dist/main/`, `dist/preload/`, `dist/renderer/`

### App Structure (App.tsx)

Sidebar tabs: **Peers** (default), **Chats**, **Demo**, **Settings**

- **Peers** — `PeerList` with connect/chat/manual-connect actions
- **Chats** — `ChatList` in sidebar, `ChatView` in main content area
- **Demo** — `DemoSuite` component showcase (buttons, forms, effects, layout, etc.)
- **Settings** — Profile (display name, peer ID, signaling URL), Media, Network sub-tabs

Per-chat video panels (`ChatVideoPanel` via `SplitPane`) render inline when video/audio is active in a chat. Modals: `PeerInvite` (manual SDP), `ScreenSourcePicker` (per-chat). App.tsx wires adaptive bitrate (PerformanceMonitor) and auto-reconnection (exponential backoff).

### Security Model

- `contextIsolation: true` — Preload runs in isolated context
- `nodeIntegration: false` — No Node.js APIs in renderer
- `CryptoManager` — Ed25519 signing (P-256 fallback), TOFU key pinning, safety numbers, encrypted key storage (PBKDF2 + AES-GCM)

### Protocol (NEONP2P/1.0)

Defined in `src/renderer/types/protocol.ts`. 25 message types in 6 categories:

| Category | Types |
|----------|-------|
| Connection | `HELLO`, `HELLO_ACK`, `PING`, `PONG`, `DISCONNECT` |
| Text | `TEXT`, `TEXT_ACK`, `TEXT_EDIT`, `TEXT_DELETE` |
| Presence | `TYPING_START`, `TYPING_STOP`, `STATUS_UPDATE`, `PROFILE_UPDATE` |
| Chat session | `CHAT_CREATE`, `CHAT_INVITE`, `CHAT_JOIN`, `CHAT_LEAVE`, `CHAT_SYNC` |
| Media | `MEDIA_OFFER`, `MEDIA_ANSWER`, `MEDIA_ICE`, `MEDIA_START`, `MEDIA_STOP`, `MEDIA_QUALITY` |
| Error | `ERROR` |

Envelope: `NeonP2PMessage<T>` with `version`, `type`, `id`, `from`, `to`, `chatId`, `timestamp`, `payload`, optional `signature`. Discriminated unions via `PayloadMap`. Helper: `createMessage<T>()`.

`TextPayload` includes optional `ttl?: number` (ms) for ephemeral messages — 0 or absent means no auto-delete.

Types also defined in `src/renderer/types/emoji.ts`: `CustomEmoji` (own emoji with id, shortcode, dataUrl) and `EmbeddedEmoji` (shortcode + dataUrl sent inline with TEXT messages).

### Services

All services are singletons accessed via `getXxxManager()` / `getXxxClient()`.

- **ConnectionManager** — WebRTC peer connections with two modes: manual SDP exchange and signaling-assisted trickle ICE. Two data channels per peer: `control` (reliable) and `ephemeral` (unreliable). PING/PONG keepalive (15s interval). Configurable ICE servers (STUN/TURN from settings). Message signing via CryptoManager. User-initiated close tracking for auto-reconnection.
- **MessageRouter** — Parses DataChannel messages, validates protocol version, deduplicates by message ID (capped at 10K), dispatches to typed handlers. Auto-creates chats, sends `TEXT_ACK`, handles media negotiation. Signature verification with TOFU key pinning. Structured error responses with error codes.
- **MediaManager** — Camera/mic/screen capture via `navigator.mediaDevices`. Mic-only mode for audio calls. Hot-swaps tracks on active connections via `replaceTrack`. Adaptive bitrate via `RTCRtpSender.setParameters`. Codec preference application via `setCodecPreferences`.
- **SignalingClient** — WebSocket client for peer discovery. Auto-reconnects with exponential backoff (max 10 attempts). Registers, discovers peers, relays offers/answers/ICE candidates.
- **PersistenceManager** — IndexedDB via `idb` library (database: `neon-peeper-chat`). Stores: `messages` and `chats` with indexes for pagination and filtering.
- **CryptoManager** — Web Crypto API for Ed25519/P-256 signing, TOFU trust, safety numbers, passphrase-encrypted key storage.
- **PerformanceMonitor** — Polls `RTCPeerConnection.getStats()` every 2s. Computes bandwidth, RTT, packet loss, jitter, quality grade. Adaptive bitrate hysteresis.
- **EphemeralMessageManager** — Interval-based sweep (5s) that auto-deletes messages with expired TTL from both chat store and IndexedDB. Reschedules on app startup from persisted messages.
- **SFUClient** — Stub for mediasoup SFU integration (7+ peers). Exports topology selection and simulcast config.

### State Management (Zustand)

| Store | Key State | Persistence |
|-------|-----------|-------------|
| `chat-store` | `chats`, `messages`, `activeChatId`, `typing` | IndexedDB (via PersistenceManager) |
| `connection-store` | `connections` (state, ICE, RTT, reconnects) | Memory only |
| `emoji-store` | `emojis` (own custom emojis), `peerEmojiCache` | IndexedDB (`customEmojis`, `emojiCache` stores) |
| `media-store` | Local/remote streams, mute state, per-chat video sharing, quality | Memory only |
| `peer-store` | `localProfile`, `peers` | Memory only |
| `performance-store` | Per-peer stats, aggregate quality | Memory only |
| `settings-store` | Display name, signaling URL, quality, devices, TURN/STUN, `messageAutoDeleteTtl` | localStorage (`neon-peeper-settings`) |
| `toast-store` | Toast notifications queue | Memory only |
| `ui-store` | `crtEnabled` | Memory only |

Access patterns:
- In components: `const value = useStore((s) => s.value)`
- Imperative (callbacks/services): `useStore.getState().action()`

### IPC Communication

**Fire-and-forget:** `window-minimize`, `window-maximize`, `window-close`, `show-notification`

**Invoke/Promise:** `window-is-maximized`, `get-desktop-sources`, `get-media-access`, `get-app-path`

**Main→Renderer push:** `focus-change`

Exposed via `window.electronAPI` (see `src/types/electron.d.ts` for full API surface).

Adding new IPC: implement handler in main process → expose in preload → add types in `electron.d.ts` → use in renderer

### Design Tokens

CSS variables defined in `src/renderer/styles/theme.css`:
- Colors: `--neon-cyan`, `--neon-green`, `--neon-magenta`, `--neon-red`
- Backgrounds: `--bg-darkest` to `--bg-light`
- Glows: `--glow-cyan`, `--glow-green`, `--glow-magenta`, `--glow-red`

### Animation Classes

Available in `src/renderer/styles/effects.css`:
- `.glitch`, `.glitch-hover` — RGB split + shake effects
- `.pulse`, `.pulse-fast` — Opacity breathing
- `.glow-pulse` — Box shadow pulse
- `.flicker` — Screen flicker
- `.cursor-blink` — Terminal cursor
- `.crt-effect` — CRT scanlines + vignette overlay

## Key Patterns

- Frameless window with custom title bar (`frame: false` in main process)
- Components use TypeScript interfaces for props, extending HTML element attributes
- UI components support `variant` (`'primary'|'secondary'|'danger'`), `size` (`'small'|'medium'|'large'`), `glow` (boolean) props
- Each component co-locates its CSS file (e.g., `NeonButton.tsx` + `NeonButton.css`)
- CSS class construction: `[...].filter(Boolean).join(' ')`
- BEM-like naming: `.component-name`, `.component-name-variant`, `.component-name-size`
- Wrap content in `<MainLayout>` for consistent app shell
- Types defined in `src/renderer/types/` — pure TypeScript interfaces with no runtime dependencies
