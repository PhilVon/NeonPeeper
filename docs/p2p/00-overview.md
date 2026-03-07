# P2P Chat System — Overview

> **Status:** Design & Planning
> **Target Platform:** Neon Peeper (Electron 28 + React 18 + TypeScript)

---

## Table of Contents

- [Vision](#vision)
- [Feature Matrix](#feature-matrix)
- [Technology Decisions](#technology-decisions)
- [Reading Order](#reading-order)
- [Glossary](#glossary)

---

## Vision

Neon Peeper's P2P chat system enables direct, encrypted communication between peers without reliance on centralized servers. Users connect through a lightweight signaling server for discovery, then communicate directly via WebRTC — text messages over DataChannels, audio/video over media streams.

The system supports:

- **1:1 and group text chat** with delivery receipts and message history
- **Camera and screen sharing** with adaptive quality
- **8+ participant video calls** via SFU topology
- **End-to-end security** with DTLS-SRTP and optional Ed25519 signing

All communication stays peer-to-peer after the initial handshake. The signaling server only brokers connections — it never sees message content.

---

## Feature Matrix

| Feature | Priority | Topology | Phase |
|---------|----------|----------|-------|
| 1:1 text chat | **P0** | Direct | 1–2 |
| Delivery receipts (delivered/read) | **P0** | Direct | 2 |
| Typing indicators | **P1** | Direct/Mesh | 2 |
| Group text chat (3–6 peers) | **P0** | Mesh | 6 |
| Camera video calls (1:1) | **P0** | Direct | 4 |
| Screen sharing | **P0** | Direct | 5 |
| Group video calls (3–6 peers) | **P1** | Mesh | 7 |
| Group video calls (7+ peers) | **P1** | SFU | 8 |
| Quality presets (Low → Ultra) | **P1** | All | 4 |
| Adaptive bitrate | **P2** | All | 10 |
| Message persistence (IndexedDB) | **P1** | Local | 2 |
| Ed25519 peer identity | **P2** | All | 9 |
| File transfer | **P2** | Direct | Future |
| Offline message sync | **P2** | Direct | 2 |

---

## Technology Decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| **Transport** | WebRTC DataChannels + MediaStreams | Built into Chromium 120 (Electron 28), NAT traversal included |
| **Signaling** | In-repo WebSocket server (`signaling-server/`) | Simple, self-hosted, ~200–300 lines |
| **Serverless Fallback** | Manual SDP exchange (copy/paste, QR code) | Works without any server infrastructure |
| **Small Groups (≤6)** | Full-mesh topology | Simple, no server needed, acceptable CPU/bandwidth |
| **Large Groups (7+)** | SFU (mediasoup) | Reduces per-client upload; enables simulcast |
| **Protocol Format** | JSON over DataChannels | Human-readable, easy to debug, sufficient performance |
| **Protocol Version** | `NEONP2P/1.0` | Versioned for forward compatibility |
| **Encryption** | DTLS-SRTP (mandatory in WebRTC) | Zero-config transport encryption |
| **Peer Identity** | Ed25519 keypairs | Fast signing, small keys, Web Crypto compatible |
| **State Management** | Zustand stores | Matches existing app pattern (`ui-store.ts`, `toast-store.ts`) |
| **Message Persistence** | IndexedDB | Large storage, async API, structured data |
| **Media Codecs** | VP9 (screen), H.264 (camera), AV1 (future) | VP9 for sharp text, H.264 for hardware encode |
| **UI Framework** | React components with neon design tokens | Matches existing component library |

---

## Reading Order

Start with this document, then follow the sequence:

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 00 | **Overview** (this file) | Vision, tech choices, glossary |
| 01 | [Protocol](./01-protocol.md) | Wire format, message types, sequencing |
| 02 | [Architecture](./02-architecture.md) | Electron integration, process boundaries |
| 03 | [Networking](./03-networking.md) | WebRTC, signaling, mesh vs SFU |
| 04 | [Signaling Server](./04-signaling-server.md) | In-repo signaling server design |
| 05 | [Chat](./05-chat.md) | Text messaging, groups, persistence |
| 06 | [Media](./06-media.md) | Camera, screen sharing, codecs, quality |
| 07 | [Security](./07-security.md) | Encryption, identity, threat model |
| 08 | [Performance](./08-performance.md) | Budgets, adaptive bitrate, monitoring |
| 09 | [State Management](./09-state-management.md) | Zustand stores for P2P state |
| 10 | [IPC API](./10-ipc-api.md) | New Electron IPC channels |
| 11 | [UI Components](./11-ui-components.md) | Chat, media, and peer React components |
| 12 | [Implementation Phases](./12-implementation-phases.md) | Phased build roadmap |

For targeted reading:

- **Building the protocol layer?** → 01, 03, 04
- **Working on chat features?** → 05, 09, 11
- **Working on media/video?** → 06, 08, 11
- **Security review?** → 07, 01 (signing section)
- **Planning sprints?** → 12

---

## Glossary

| Term | Definition |
|------|------------|
| **DataChannel** | WebRTC API for arbitrary data transfer between peers. Used for text messages, typing indicators, and control signals. |
| **DTLS** | Datagram Transport Layer Security. Encrypts WebRTC data channels. Negotiated automatically during connection setup. |
| **ICE** | Interactive Connectivity Establishment. Protocol for finding the best network path between peers through NATs and firewalls. |
| **ICE Candidate** | A potential network address/port combination a peer can be reached at. Exchanged during connection setup. |
| **Mesh Topology** | Every peer connects directly to every other peer. Simple but O(n²) connections. Used for groups ≤6. |
| **NAT** | Network Address Translation. Allows multiple devices to share one public IP. WebRTC uses ICE/STUN/TURN to traverse NATs. |
| **Offer/Answer** | WebRTC connection negotiation pattern. One peer creates an SDP offer, the other responds with an SDP answer. |
| **Peer ID** | Unique identifier for a peer, derived from their Ed25519 public key hash (truncated SHA-256). |
| **RTCPeerConnection** | Browser API that manages a WebRTC connection to a single remote peer, including ICE, DTLS, and media/data transport. |
| **SDP** | Session Description Protocol. Text format describing media capabilities, codecs, and connection parameters. Exchanged as offer/answer. |
| **SFU** | Selective Forwarding Unit. A server that receives media from each peer and forwards it selectively to others. Scales better than mesh for large groups. |
| **Signaling** | The process of exchanging connection metadata (SDP offers/answers, ICE candidates) to establish a WebRTC connection. Not part of WebRTC itself. |
| **Simulcast** | Sending the same video at multiple quality levels simultaneously. The SFU picks the best layer for each receiver. |
| **SRTP** | Secure Real-time Transport Protocol. Encrypts media (audio/video) streams in WebRTC. Always enabled. |
| **STUN** | Session Traversal Utilities for NAT. Server that helps peers discover their public IP address. Lightweight, no media relay. |
| **TOFU** | Trust On First Use. Accept a peer's identity on first connection, alert if it changes later. Similar to SSH host key verification. |
| **TURN** | Traversal Using Relays around NAT. Relay server for when direct connections fail (~10% of cases). Carries actual media traffic. |
| **WebRTC** | Web Real-Time Communication. Browser API suite for peer-to-peer audio, video, and data transfer with built-in encryption. |

---

*Next: [Protocol Specification →](./01-protocol.md)*
