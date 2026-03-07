# Neon Peeper

> **Work in Progress** — This project is under active development. Features may be incomplete, unstable, or subject to change.

A peer-to-peer chat and video calling desktop application with a cyberpunk/neon aesthetic. Built with Electron, React, and TypeScript, Neon Peeper uses WebRTC for direct P2P communication — no central server stores your messages.

![License](https://img.shields.io/badge/license-GPLv3-blue)
![Status](https://img.shields.io/badge/status-in%20development-orange)

## Features

- **P2P Messaging** — Direct, encrypted text chat over WebRTC data channels
- **Video & Audio Calls** — Peer-to-peer video calling with screen sharing support
- **Group Chat** — Multi-peer group conversations
- **Emoji & GIF Support** — Emoji picker and Giphy integration
- **Cyberpunk UI** — Neon glow effects, CRT scanlines, glitch animations, and a dark theme throughout
- **Peer Discovery** — Optional WebSocket signaling server for finding peers, or manual SDP exchange for fully serverless connections
- **Identity & Security** — Ed25519 key signing, TOFU key pinning, and safety number verification

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

- **Electron 28** — Desktop shell
- **React 18** — UI framework
- **TypeScript** — Type safety throughout
- **WebRTC** — Peer-to-peer audio, video, and data channels
- **Zustand** — State management
- **IndexedDB** — Local message persistence
- **Web Crypto API** — End-to-end identity verification

## Project Structure

```
src/
├── main/          # Electron main process
├── preload/       # Context bridge (IPC)
├── renderer/      # React application
│   ├── components/  # UI components (chat, media, peers, settings, layout, ui)
│   ├── services/    # ConnectionManager, MessageRouter, MediaManager, etc.
│   ├── store/       # Zustand state stores
│   ├── styles/      # CSS variables, animations, effects
│   └── types/       # TypeScript type definitions
signaling-server/  # Standalone WebSocket signaling server
```

## Current Status

This is an early-stage project. Here's what's working and what's planned:

- [x] Core P2P text messaging
- [x] WebRTC connection management
- [x] Signaling server for peer discovery
- [x] Manual SDP exchange (serverless mode)
- [x] Video and audio calls
- [x] Screen sharing
- [x] Emoji picker
- [x] GIF support (Giphy)
- [x] Group chat
- [x] Message persistence (IndexedDB)
- [x] Identity key management
- [ ] File sharing
- [ ] Message encryption (E2E)
- [ ] SFU support for large group calls
- [ ] Notification system improvements
- [ ] Packaged desktop builds (Windows, macOS, Linux)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
