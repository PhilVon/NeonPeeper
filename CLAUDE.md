# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # Build for production (runs tsc then vite build)
npm run preview  # Preview production build locally
```

**Prerequisites:** Node.js v18+, npm v9+

## Architecture

This is an **Electron + React + TypeScript** desktop application template with a cyberpunk/neon aesthetic.

### Multi-Process Structure

```
src/
├── main/           # Electron main process (Node.js context)
│   └── index.ts    # Window creation, IPC handlers
├── preload/        # Preload scripts (isolated context bridge)
│   └── index.ts    # Exposes electronAPI via contextBridge
├── renderer/       # React application (Chromium context)
│   ├── components/
│   │   ├── layout/ # MainLayout, TitleBar, Sidebar, StatusBar
│   │   ├── ui/     # NeonButton, NeonCard, NeonInput, StatusIndicator
│   │   └── demo/   # DemoPage component showcase
│   ├── store/      # Zustand state management
│   ├── styles/     # CSS variables, globals, animations
│   ├── App.tsx
│   └── index.tsx
└── types/
    └── electron.d.ts   # TypeScript definitions for electronAPI
```

**Build output:** `dist/main/`, `dist/preload/`, `dist/renderer/`

### Security Model

- `contextIsolation: true` - Preload runs in isolated context
- `nodeIntegration: false` - No Node.js APIs in renderer
- Window API exposed via `window.electronAPI` (minimize, maximize, close, isMaximized)

### State Management

Uses Zustand with hooks-based access. Store at `src/renderer/store/ui-store.ts` manages UI state (CRT effect toggle). Access via `useUIStore((state) => state.property)`.

### IPC Communication

Window control channels: `window-minimize`, `window-maximize`, `window-close`, `window-is-maximized`

Adding new IPC: implement handler in main process -> expose in preload -> add types in `electron.d.ts` -> use in renderer

### Design Tokens

CSS variables defined in `src/renderer/styles/theme.css`:
- Colors: `--neon-cyan`, `--neon-green`, `--neon-magenta`, `--neon-red`
- Backgrounds: `--bg-darkest` to `--bg-light`
- Glows: `--glow-cyan`, `--glow-green`, `--glow-magenta`, `--glow-red`

### Animation Classes

Available in `src/renderer/styles/effects.css`:
- `.glitch`, `.glitch-hover` - RGB split + shake effects
- `.pulse`, `.pulse-fast` - Opacity breathing
- `.glow-pulse` - Box shadow pulse
- `.flicker` - Screen flicker
- `.cursor-blink` - Terminal cursor
- `.crt-effect` - CRT scanlines + vignette overlay

## Key Patterns

- Frameless window with custom title bar (`frame: false` in main process)
- Components use TypeScript interfaces for props
- UI components support `variant`, `size`, `glow`, `glowColor` props
- Wrap content in `<MainLayout>` for consistent app shell
