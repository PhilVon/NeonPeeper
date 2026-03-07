# Neon Template Documentation

Welcome to the Neon Template documentation. This Electron + React + TypeScript template features a cyberpunk-inspired neon aesthetic with glowing UI components and retro CRT effects.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Usage Guide](./guide.md) | Getting started, installation, and common use cases |
| [Architecture](./architecture.md) | System design, data flow, and extension points |
| [API Reference](./api.md) | Complete API documentation for all components and systems |

---

## Document Summaries

### [Usage Guide](./guide.md)

Start here if you're new to the project. Covers:

- **Prerequisites** - Node.js v18+, npm, and recommended tools
- **Installation** - Clone, install, and run in 3 commands
- **Basic Usage** - Layout components, UI components, and props
- **Common Use Cases** - CRT toggle, window controls, glitch effects, custom themes
- **Troubleshooting** - Solutions for startup issues, blank screens, IPC problems

### [Architecture](./architecture.md)

Understand how the system is designed. Covers:

- **High-Level Overview** - Multi-process architecture diagram
- **Project Structure** - Directory layout and file purposes
- **Component Descriptions** - Main process, preload, renderer roles
- **Data Flow Diagrams** - Window controls, React tree, state management
- **Design Decisions** - Rationale for frameless windows, Zustand, CSS tokens
- **Extension Points** - How to add IPC channels, components, stores, pages

### [API Reference](./api.md)

Complete technical reference. Covers:

- **Electron API** - Window control methods with signatures and examples
- **IPC Channels** - All inter-process communication with handler code
- **State Management** - Zustand store interface and usage patterns
- **React Components** - 8 components with TypeScript interfaces and props tables
- **CSS Design System** - All design tokens (colors, typography, spacing, glows)
- **Animation Classes** - Effect classes with CSS snippets and examples
- **Configuration** - Window and build configuration options

---

### [P2P Chat System](./p2p/00-overview.md)

Design documentation for the peer-to-peer chat system. Covers:

- **[Overview](./p2p/00-overview.md)** - Vision, technology decisions, glossary
- **[Protocol](./p2p/01-protocol.md)** - Wire protocol spec (message types, envelope format)
- **[Architecture](./p2p/02-architecture.md)** - Electron integration, process boundaries
- **[Networking](./p2p/03-networking.md)** - WebRTC, signaling, mesh vs SFU topology
- **[Signaling Server](./p2p/04-signaling-server.md)** - In-repo WebSocket signaling server
- **[Chat](./p2p/05-chat.md)** - Text messaging, groups, persistence
- **[Media](./p2p/06-media.md)** - Camera, screen sharing, codecs, quality presets
- **[Security](./p2p/07-security.md)** - Encryption, identity, threat model
- **[Performance](./p2p/08-performance.md)** - Budgets, adaptive bitrate, monitoring
- **[State Management](./p2p/09-state-management.md)** - Zustand stores for P2P state
- **[IPC API](./p2p/10-ipc-api.md)** - New Electron IPC channels
- **[UI Components](./p2p/11-ui-components.md)** - Chat, media, peer React components
- **[Implementation Phases](./p2p/12-implementation-phases.md)** - 10-phase build roadmap

---

## Recommended Reading Order

1. **[Usage Guide](./guide.md)** - Get the app running and understand the basics
2. **[Architecture](./architecture.md)** - Learn how the pieces fit together
3. **[API Reference](./api.md)** - Deep dive when building features
4. **[P2P Overview](./p2p/00-overview.md)** - Then follow the P2P docs in sequence

---

## Quick Links

### By Topic

| Topic | Location |
|-------|----------|
| Installation | [guide.md#installation](./guide.md#installation) |
| Project Structure | [architecture.md#project-structure](./architecture.md#project-structure) |
| Window Controls | [api.md#window-control-api](./api.md#window-control-api) |
| UI Components | [api.md#react-components](./api.md#react-components) |
| Design Tokens | [api.md#design-tokens](./api.md#design-tokens) |
| Animations | [api.md#animation-classes](./api.md#animation-classes) |
| Troubleshooting | [guide.md#troubleshooting](./guide.md#troubleshooting) |
| Extension Points | [architecture.md#extension-points](./architecture.md#extension-points) |
| P2P Protocol | [p2p/01-protocol.md](./p2p/01-protocol.md) |
| P2P Networking | [p2p/03-networking.md](./p2p/03-networking.md) |
| P2P Chat System | [p2p/05-chat.md](./p2p/05-chat.md) |
| P2P Media/Video | [p2p/06-media.md](./p2p/06-media.md) |
| P2P Implementation | [p2p/12-implementation-phases.md](./p2p/12-implementation-phases.md) |

### By Component

| Component | Documentation |
|-----------|---------------|
| MainLayout | [api.md#mainlayout](./api.md#mainlayout) |
| TitleBar | [api.md#titlebar](./api.md#titlebar) |
| Sidebar | [api.md#sidebar](./api.md#sidebar) |
| StatusBar | [api.md#statusbar](./api.md#statusbar) |
| NeonButton | [api.md#neonbutton](./api.md#neonbutton) |
| NeonCard | [api.md#neoncard](./api.md#neoncard) |
| NeonInput | [api.md#neoninput](./api.md#neoninput) |
| StatusIndicator | [api.md#statusindicator](./api.md#statusindicator) |

---

## Search Tips

Each document includes a Table of Contents with anchor links. To find specific topics:

1. **Use browser search** (`Ctrl+F` / `Cmd+F`) within any document
2. **Check the TOC** at the top of each document for section links
3. **Search by keyword**:
   - Components: Look in [API Reference](./api.md#react-components)
   - CSS variables: Look in [API Reference](./api.md#design-tokens)
   - Troubleshooting: Look in [Usage Guide](./guide.md#troubleshooting)
   - Architecture questions: Look in [Architecture](./architecture.md)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main process |
| `src/preload/index.ts` | IPC context bridge |
| `src/renderer/App.tsx` | React root component |
| `src/renderer/styles/theme.css` | Design tokens |
| `src/renderer/styles/effects.css` | Animation classes |
| `src/renderer/store/ui-store.ts` | Zustand state store |
