<p align="center">
  <img src="src/renderer/assets/logo.png" alt="Neon Peeper" width="128" />
</p>

# Neon Peeper

> **Work in Progress** — This project is under active development. Features may be incomplete, unstable, or subject to change.

A peer-to-peer chat and video calling desktop application with a cyberpunk/neon aesthetic. Built with Electron, React, and TypeScript, Neon Peeper uses WebRTC for direct P2P communication — no central server stores your messages.

![License](https://img.shields.io/badge/license-GPLv3-blue)
![Status](https://img.shields.io/badge/status-in%20development-orange)

## Features

### Communication
- **P2P Messaging** — Direct text chat over WebRTC data channels with message editing, deletion, and reply threading
- **Per-Chat Video Calls** — Video and audio sharing scoped to individual chats, with support for multiple simultaneous sessions
- **Audio-Only Mode** — Join calls with mic only; toggle camera on/off mid-call
- **Screen Sharing** — Share your screen via Electron's desktopCapturer with per-chat context
- **Group Chat** — Multi-peer group conversations with member management and chat sync
- **File Transfer** — Send files peer-to-peer with chunked transfer, progress tracking, accept/reject flow, and SHA-256 integrity verification
- **Message Queuing** — Messages sent while a peer is disconnected are queued and automatically delivered on reconnection

### Media
- **Speaking Detection** — Real-time voice activity detection using Web Audio API with VU meter bars, glow rings, and ripple animations
- **Adaptive Bitrate** — Automatic quality adjustment based on packet loss and RTT, stepping through low/medium/high/ultra presets
- **Codec Preferences** — Configurable video codec selection (auto, H.264, VP8, VP9)
- **Quality Presets** — Low (320p), Medium (480p), High (720p), Ultra (1080p), or Adaptive
- **Off-Screen Video Pause** — Video tiles automatically pause when scrolled out of view, reducing CPU usage

### Networking
- **Peer Discovery** — Optional WebSocket signaling server for finding peers, or manual SDP exchange for fully serverless connections
- **SFU Mode** — Automatic mesh-to-SFU topology switch at 7+ peers via mediasoup, with simulcast (3 quality layers), active speaker detection, and off-screen consumer pause; graceful fallback to mesh if SFU is unavailable
- **Auto-Reconnection** — Exponential backoff reconnection (up to 5 attempts) when peers disconnect unexpectedly
- **Configurable ICE** — Custom STUN/TURN server configuration with credential support
- **Signaling Room Bridge** — Signaling rooms linked to chat sessions for group discovery and crash recovery

### Security
- **Ed25519 Signing** — Automatic keypair generation with message signing and verification
- **TOFU Key Pinning** — Trust-on-first-use identity verification with change alerts
- **Safety Numbers** — Verify peer identity out-of-band with a visual verification dialog and verified badge
- **End-to-End Encryption** — Optional E2E encryption using ECDH P-256 key exchange and AES-256-GCM, with a per-message lock icon indicator
- **Context Isolation** — Electron security best practices with `contextIsolation: true` and `nodeIntegration: false`

### Personalization
- **User Avatars** — Set a profile image via an interactive image editor with crop, zoom, and brightness/contrast controls; avatars are shared with peers via the HELLO handshake and live `PROFILE_UPDATE` broadcasts
- **Custom Emojis** — Create personal emoji images (up to 50), assign shortcodes, and embed them inline in messages; emojis are sent with each message so recipients always see them

### UI
- **Cyberpunk Aesthetic** — Neon glow effects, CRT scanlines, glitch animations, and a dark theme throughout
- **Emoji & GIF Support** — Emoji picker, Giphy integration, and custom emoji picker in chat
- **Message Status** — Visual delivery indicators (sending, sent, delivered, read) with distinct icons
- **Split-Pane Video** — Resizable chat/video split when media is active, with focused tile and filmstrip layouts
- **Desktop Notifications** — Native OS notifications for incoming messages when the window is unfocused
- **Auto Read Receipts** — Messages are automatically marked as read when scrolled into view
- **Accessibility** — ARIA roles and attributes, keyboard navigation with arrow keys across peer list, chat list, sidebar, and media controls

## Prerequisites

- Node.js v18+
- npm v9+

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Signaling Server (optional)

The signaling server helps peers discover each other. It does not relay messages — all communication is direct P2P.

```bash
cd signaling-server
npm install
npm run dev
```

The signaling server runs on port 8080 by default.

## Building

```bash
npm run build     # Build for production
npm run preview   # Preview the production build
```

## Tech Stack

- **Electron 28** — Desktop shell with frameless window and custom title bar
- **React 18** — UI framework
- **TypeScript** — Type safety throughout
- **WebRTC** — Peer-to-peer audio, video, and data channels
- **mediasoup / mediasoup-client** — SFU media routing for 7+ peer video with simulcast and active speaker detection
- **Zustand** — State management (8 stores with localStorage and IndexedDB persistence)
- **IndexedDB** — Local message and chat persistence via `idb`
- **Web Crypto API** — Ed25519 signing, ECDH key exchange, AES-256-GCM encryption, TOFU key pinning, PBKDF2 encrypted key storage
- **Web Audio API** — Real-time voice activity detection and audio level metering

## Project Structure

```
src/
├── main/            # Electron main process
├── preload/         # Context bridge (IPC)
├── renderer/        # React application
│   ├── components/
│   │   ├── chat/      # ChatView, ChatList, ChatInput, ChatMessage, ChatHeader, TypingIndicator, FileTransferProgress, CustomEmojiPicker
│   │   ├── media/     # ChatVideoPanel, VideoGrid, VideoTile, MediaControls, ScreenSourcePicker
│   │   ├── peers/     # PeerList, PeerCard, PeerInvite, PeerVerifyDialog, ConnectionDialog
│   │   ├── settings/  # MediaSettings, NetworkSettings, QualitySettings, EmojiManager
│   │   ├── layout/    # MainLayout, TitleBar, Sidebar, StatusBar, SplitPane
│   │   ├── ui/        # NeonButton, NeonCard, NeonInput, Modal, Toast, Avatar, ImageEditor, etc.
│   │   └── demo/      # Component showcase
│   ├── hooks/         # useSpeakingDetection, useMediaStream, useClickOutside, useArrowNavigation, etc.
│   ├── services/      # ConnectionManager, MessageRouter, MediaManager, CryptoManager,
│   │                  # SignalingClient, PersistenceManager, PerformanceMonitor, FileTransferManager, SFUClient
│   ├── store/         # Zustand stores (chat, connection, emoji, file-transfer, media, peer, performance, settings, toast, ui)
│   ├── styles/        # CSS variables, animations, effects
│   └── types/         # Protocol definitions, peer/chat/media types
signaling-server/    # Standalone WebSocket signaling server
```

## Protocol

Neon Peeper uses the **NEONP2P/1.0** protocol with 29 message types across 7 categories:

| Category | Types |
|----------|-------|
| Connection | `HELLO`, `HELLO_ACK`, `PING`, `PONG`, `DISCONNECT` |
| Text | `TEXT`, `TEXT_ACK`, `TEXT_EDIT`, `TEXT_DELETE` |
| Presence | `TYPING_START`, `TYPING_STOP`, `STATUS_UPDATE`, `PROFILE_UPDATE` |
| Chat | `CHAT_CREATE`, `CHAT_INVITE`, `CHAT_JOIN`, `CHAT_LEAVE`, `CHAT_SYNC` |
| Media | `MEDIA_OFFER`, `MEDIA_ANSWER`, `MEDIA_ICE`, `MEDIA_START`, `MEDIA_STOP`, `MEDIA_QUALITY` |
| File Transfer | `FILE_OFFER`, `FILE_ACCEPT`, `FILE_CHUNK`, `FILE_COMPLETE` |
| Error | `ERROR` |

Messages are signed with Ed25519 when signing is enabled. Text messages support optional E2E encryption via ECDH key exchange and AES-256-GCM. Error responses use structured codes (1000-6099) covering connection, message, chat, media, security, and file transfer categories.

## Current Status

- [x] Core P2P text messaging with edit/delete/reply
- [x] WebRTC connection management with dual data channels
- [x] Signaling server for peer discovery with room bridging
- [x] Manual SDP exchange (serverless mode)
- [x] Per-chat video and audio calls
- [x] Audio-only call mode
- [x] Screen sharing with per-chat context
- [x] Speaking detection with visual feedback
- [x] Adaptive bitrate control
- [x] Configurable video codec preferences
- [x] Emoji picker and GIF support (Giphy)
- [x] Group chat with member sync
- [x] Message persistence (IndexedDB)
- [x] Ed25519 identity keys with message signing
- [x] TOFU key pinning with change alerts
- [x] Auto-reconnection with exponential backoff
- [x] Configurable STUN/TURN servers
- [x] Protocol error handling with structured error codes
- [x] User avatars with interactive image editor
- [x] Custom emojis with inline rendering
- [x] File transfer with chunked delivery and progress tracking
- [x] End-to-end message encryption (ECDH + AES-256-GCM)
- [x] Message queuing for offline peers
- [x] Native desktop notifications
- [x] Auto read receipts via scroll visibility
- [x] Off-screen video pause
- [x] Safety number verification UI
- [x] Accessibility (ARIA, keyboard navigation)
- [x] SFU support for large group calls (mediasoup, auto topology switch at 7+ peers)
- [ ] Packaged desktop builds (Windows, macOS, Linux)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
