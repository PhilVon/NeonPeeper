# Neon Peeper - Project Context & Guidelines

Neon Peeper is a peer-to-peer (P2P) chat and video calling desktop application with a cyberpunk/neon aesthetic. It is built using Electron, React, and TypeScript, leveraging WebRTC for direct communication.

## Project Overview

- **Version:** 0.0.2
- **Core Mission:** Provide a decentralized, secure, and visually immersive communication platform.
- **Main Technologies:**
    - **Frontend:** React 18, TypeScript, Zustand (State Management), Vanilla CSS (Custom Properties).
    - **Backend (Desktop Shell):** Electron 28 (Context Isolation, IPC).
    - **Communication:** WebRTC (DataChannels & MediaStreams), WebSocket (Signaling).
    - **Storage:** IndexedDB (via `idb`) for message persistence, LocalStorage for settings.
    - **Security:** Web Crypto API (Ed25519 signing, TOFU), DTLS-SRTP.
    - **Audio/Video:** Web Audio API (voice detection), `desktopCapturer` (screen sharing).
    - **Build Tool:** Vite.

## Architecture & Process Model

The application follows Electron's multi-process architecture:

1.  **Main Process (`src/main/`):** Manages window creation (`frame: false`), IPC handlers, and native APIs like `desktopCapturer`.
2.  **Preload Script (`src/preload/`):** Exposes `electronAPI` via `contextBridge` for secure IPC.
3.  **Renderer Process (`src/renderer/`):** The React application containing all UI and P2P logic.
4.  **Signaling Server (`signaling-server/`):** Standalone WebSocket server (port 8080) for peer discovery.

## Key Development Commands

### Main Application
- `npm run dev`: Start development server with HMR.
- `npm run build`: Build for production (tsc + vite).
- `npm run preview`: Preview production build.

### Signaling Server
- `cd signaling-server && npm run dev`: Start with tsx. Supports port flags (e.g., `--port 9000`).
- `cd signaling-server && npm run build`: Compile with tsc.
- `cd signaling-server && npm start`: Run from dist. Supports port flags (e.g., `--port 9000`).

## P2P Protocol (NEONP2P/1.0)

Messages are JSON-based `NeonP2PMessage<T>` objects, often signed with Ed25519.
- **Handshake & Updates:** `HELLO`, `HELLO_ACK`, and `PROFILE_UPDATE` messages now include an `audioBitrate` field for syncing quality settings between peers.

| Category | Message Types |
|----------|---------------|
| **Connection** | `HELLO`, `HELLO_ACK`, `PING`, `PONG`, `DISCONNECT` |
| **Text** | `TEXT`, `TEXT_ACK`, `TEXT_EDIT`, `TEXT_DELETE` |
| **Presence** | `TYPING_START`, `TYPING_STOP`, `STATUS_UPDATE`, `PROFILE_UPDATE` |
| **Chat** | `CHAT_CREATE`, `CHAT_INVITE`, `CHAT_JOIN`, `CHAT_LEAVE`, `CHAT_SYNC` |
| **Media** | `MEDIA_OFFER`, `MEDIA_ANSWER`, `MEDIA_ICE`, `MEDIA_START`, `MEDIA_STOP`, `MEDIA_QUALITY` |

## Core Services (Singletons)

- **ConnectionManager:** Manages WebRTC connections, DataChannels (`control` and `ephemeral`), and ICE/STUN/TURN. It handles `audioBitrate` synchronization during the `HELLO` handshake.
- **MessageRouter:** Validates, deduplicates, and dispatches protocol messages to handlers.
- **MediaManager:** Handles camera/mic/screen streams and `replaceTrack` for hot-swapping.
- **CryptoManager:** Handles Ed25519 signing, TOFU key pinning, and encrypted key storage.
- **PersistenceManager:** Manages IndexedDB (`neon-peeper-chat`) for message/chat history.
- **PerformanceMonitor:** Polls WebRTC stats for adaptive bitrate and quality grading.

## State Management (Zustand)

| Store | Responsibility | Persistence |
|-------|----------------|-------------|
| `chat-store` | Messages, chats, active chat ID | IndexedDB |
| `peer-store` | Local profile and discovered peers | Memory |
| `media-store` | Local/remote streams and mute states | Memory |
| `settings-store` | App settings, devices, network config | localStorage |
| `connection-store` | RTCPeerConnection states and RTT | Memory |

## UI & Aesthetics

- **Styling:** Vanilla CSS with co-located files (e.g., `Component.tsx` + `Component.css`).
- **Design Tokens:** `--neon-cyan`, `--neon-green`, `--neon-magenta`, `--neon-red` for glows and accents.
- **Animation Classes:** `.glitch`, `.pulse`, `.glow-pulse`, `.crt-effect` (scanlines).
- **Layout:** Wrap views in `<MainLayout>` to maintain the app shell (TitleBar, Sidebar, StatusBar).

## Security & IPC

- **Isolation:** `contextIsolation: true` and `nodeIntegration: false` are mandatory.
- **Trust:** TOFU (Trust On First Use) for peer identity verification.
- **IPC:** Fire-and-forget (`window-close`) vs Invoke/Promise (`get-desktop-sources`).
