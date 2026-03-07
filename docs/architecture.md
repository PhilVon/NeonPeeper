# Neon Template Architecture

## High-Level Overview

Neon Template is a desktop application built on the **Electron + React + TypeScript** stack with a distinctive cyberpunk/neon aesthetic. The architecture follows Electron's multi-process model with clear separation between the main process (Node.js), preload scripts (bridge), and renderer process (React UI).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Shell                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    IPC    ┌────────────────────────────┐  │
│  │   Main Process  │◄─────────►│      Renderer Process      │  │
│  │   (Node.js)     │           │         (Chromium)         │  │
│  │                 │           │                            │  │
│  │  - Window Mgmt  │  Context  │  ┌──────────────────────┐  │  │
│  │  - IPC Handlers │  Bridge   │  │    React Application │  │  │
│  │  - Native APIs  │◄─────────►│  │                      │  │  │
│  │                 │           │  │  ┌────────────────┐  │  │  │
│  └─────────────────┘           │  │  │  Zustand Store │  │  │  │
│                                │  │  └────────────────┘  │  │  │
│  ┌─────────────────┐           │  │                      │  │  │
│  │ Preload Script  │           │  │  ┌────────────────┐  │  │  │
│  │ (Context Bridge)│───────────┼──┼──│   Components   │  │  │  │
│  └─────────────────┘           │  │  └────────────────┘  │  │  │
│                                │  └──────────────────────┘  │  │
│                                └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Process Communication | Context Bridge + IPC | Security via `contextIsolation: true` |
| State Management | Zustand | Lightweight, TypeScript-friendly, no boilerplate |
| Build System | Vite + vite-plugin-electron | Fast HMR, optimized production builds |
| Window Frame | Frameless (`frame: false`) | Custom title bar for aesthetic consistency |
| Styling | CSS Custom Properties | Design tokens for theming, CSS animations |

---

## Project Structure

```
neon-template/
├── src/
│   ├── main/                    # Electron main process
│   │   └── index.ts             # Window creation, IPC handlers
│   │
│   ├── preload/                 # Preload scripts (context bridge)
│   │   └── index.ts             # Exposes electronAPI to renderer
│   │
│   ├── renderer/                # React application
│   │   ├── components/
│   │   │   ├── layout/          # Structural components
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   ├── TitleBar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   ├── ui/              # Reusable UI primitives
│   │   │   │   ├── NeonButton.tsx
│   │   │   │   ├── NeonCard.tsx
│   │   │   │   ├── NeonInput.tsx
│   │   │   │   └── StatusIndicator.tsx
│   │   │   └── demo/            # Demo/example components
│   │   │       └── DemoPage.tsx
│   │   ├── store/               # Zustand state stores
│   │   │   └── ui-store.ts
│   │   ├── styles/              # Global CSS
│   │   │   ├── theme.css        # Design tokens
│   │   │   ├── globals.css      # Base styles
│   │   │   └── effects.css      # Animations & effects
│   │   ├── App.tsx              # Root component
│   │   └── index.tsx            # React entry point
│   │
│   └── types/                   # TypeScript declarations
│       └── electron.d.ts        # ElectronAPI interface
│
├── dist/                        # Build output
│   ├── main/
│   ├── preload/
│   └── renderer/
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Component Descriptions

### Main Process (`src/main/index.ts`)

The main process is the entry point for the Electron application:

- **Window Management**: Creates and configures the `BrowserWindow` with frameless design
- **IPC Handlers**: Responds to renderer requests for window controls
- **Lifecycle Events**: Handles app ready, window close, and macOS activation

```typescript
// Window configuration
BrowserWindow({
  width: 1200, height: 800,
  minWidth: 800, minHeight: 600,
  frame: false,                    // Frameless for custom title bar
  backgroundColor: '#0a0a0f',      // Prevents white flash
  webPreferences: {
    contextIsolation: true,        // Security: isolate preload
    nodeIntegration: false         // Security: no Node in renderer
  }
})
```

### Preload Script (`src/preload/index.ts`)

The preload script acts as a secure bridge between main and renderer processes:

- Uses `contextBridge.exposeInMainWorld()` to safely expose APIs
- Wraps IPC calls in a type-safe interface
- Runs with Node.js access but exposes only whitelisted functions

### Renderer Process (`src/renderer/`)

The React application runs in the Chromium renderer:

#### Layout Components

| Component | Responsibility |
|-----------|----------------|
| `MainLayout` | Page shell with title bar, sidebar, content area, status bar |
| `TitleBar` | Custom window controls (min/max/close), application title |
| `Sidebar` | Navigation tabs, collapsible panel |
| `StatusBar` | Application status, version info |

#### UI Components

| Component | Purpose |
|-----------|---------|
| `NeonButton` | Styled button with glow effects, variants (primary/secondary/danger) |
| `NeonCard` | Container with neon border glow, optional title |
| `NeonInput` | Form input with label, error state, neon styling |
| `StatusIndicator` | Status dot with pulse animation (online/offline/warning/error) |

#### State Store (`ui-store.ts`)

Zustand store managing UI state:

```typescript
interface UIState {
  crtEnabled: boolean          // CRT monitor effect toggle
  toggleCRT: () => void        // Toggle action
  setCRTEnabled: (enabled: boolean) => void
}
```

---

## Data Flow Diagrams

### Window Control Flow

```
┌──────────────┐     click      ┌──────────────┐
│   TitleBar   │───────────────►│ electronAPI  │
│  Component   │                │.windowClose()│
└──────────────┘                └──────┬───────┘
                                       │
                                       │ ipcRenderer.send()
                                       ▼
                                ┌──────────────┐
                                │   Preload    │
                                │   Script     │
                                └──────┬───────┘
                                       │
                                       │ IPC Channel: 'window-close'
                                       ▼
                                ┌──────────────┐
                                │ Main Process │
                                │  ipcMain.on  │
                                └──────┬───────┘
                                       │
                                       │ mainWindow.close()
                                       ▼
                                ┌──────────────┐
                                │   Window     │
                                │   Closes     │
                                └──────────────┘
```

### React Component Tree

```
App
├── CRT Effect Wrapper (conditional)
└── MainLayout
    ├── TitleBar
    │   ├── App Title
    │   └── Window Controls (min/max/close)
    ├── Layout Body
    │   ├── Sidebar
    │   │   └── Tab Navigation
    │   └── Content Area
    │       └── {children} (DemoPage, etc.)
    └── StatusBar
        ├── Status Indicator
        └── Version Info
```

### State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Zustand Store                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UIState                                              │  │
│  │  ├── crtEnabled: boolean                              │  │
│  │  ├── toggleCRT: () => void                            │  │
│  │  └── setCRTEnabled: (enabled: boolean) => void        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                                    │
         │ Action                             │ State
         │                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│  Toggle Button  │                  │   App.tsx       │
│  in Settings    │                  │  crt-effect     │
│                 │                  │  class toggle   │
└─────────────────┘                  └─────────────────┘
```

---

## Module Dependencies

### Build-Time Dependencies

```
vite.config.ts
├── vite-plugin-electron
│   └── Builds main + preload processes
├── vite-plugin-electron-renderer
│   └── Enables Electron APIs in renderer
└── @vitejs/plugin-react
    └── React JSX transform, Fast Refresh
```

### Runtime Dependencies

```
Main Process
└── electron (app, BrowserWindow, ipcMain)

Preload Script
└── electron (contextBridge, ipcRenderer)

Renderer Process
├── react
├── react-dom
└── zustand
```

### Internal Module Graph

```
src/renderer/index.tsx
└── App.tsx
    ├── MainLayout
    │   ├── TitleBar (uses window.electronAPI)
    │   ├── Sidebar
    │   └── StatusBar
    ├── DemoPage
    │   ├── NeonButton
    │   ├── NeonCard
    │   ├── NeonInput
    │   └── StatusIndicator
    └── ui-store (Zustand)
```

---

## Design Decisions

### 1. Frameless Window with Custom Title Bar

**Why**: Full control over the application's visual design, consistent neon aesthetic across all UI elements including window chrome.

**Trade-off**: Requires manual implementation of window dragging, resize handles (if needed), and accessibility considerations.

### 2. Context Isolation Security Model

**Why**: Electron best practice to prevent renderer-side code from accessing Node.js APIs directly, reducing attack surface.

**Implementation**:
- `contextIsolation: true` - Preload runs in isolated context
- `nodeIntegration: false` - No `require()` in renderer
- Explicit API exposure via `contextBridge`

### 3. Zustand over Redux/Context

**Why**: Minimal boilerplate, TypeScript inference out of the box, no providers needed, simple for small-to-medium state.

**When to reconsider**: If state becomes deeply nested, requires middleware (persist, devtools), or involves complex async flows.

### 4. CSS Custom Properties for Theming

**Why**: Native browser support, runtime switchable, no JS overhead, works with CSS animations.

**Design Tokens**:
- Colors: `--neon-cyan`, `--neon-green`, `--neon-magenta`, `--neon-red`
- Backgrounds: `--bg-darkest` to `--bg-light`
- Spacing: `--spacing-xs` to `--spacing-xl`
- Effects: `--glow-*` for box-shadow values

### 5. CSS-Based Animations

**Why**: GPU-accelerated, declarative, no React re-renders, easy to apply/remove via class toggles.

**Available Effects**: glitch, pulse, glow-pulse, fade-in, crt-effect, flicker, cursor-blink, neon-border

---

## Extension Points

### Adding New IPC Channels

1. **Main Process** (`src/main/index.ts`):
   ```typescript
   ipcMain.handle('my-channel', async (event, arg) => {
     return result
   })
   ```

2. **Preload Script** (`src/preload/index.ts`):
   ```typescript
   myMethod: (arg: string) => ipcRenderer.invoke('my-channel', arg)
   ```

3. **Type Declaration** (`src/types/electron.d.ts`):
   ```typescript
   interface ElectronAPI {
     myMethod: (arg: string) => Promise<Result>
   }
   ```

### Adding New UI Components

1. Create component in `src/renderer/components/ui/`
2. Follow the pattern: props interface, forwardRef if needed, CSS module
3. Export from a components index if using barrel exports

### Adding New State Slices

```typescript
// src/renderer/store/my-store.ts
import { create } from 'zustand'

interface MyState {
  value: string
  setValue: (v: string) => void
}

export const useMyStore = create<MyState>((set) => ({
  value: '',
  setValue: (v) => set({ value: v })
}))
```

### Adding New Pages/Views

1. Create component in `src/renderer/components/` (e.g., `pages/SettingsPage.tsx`)
2. Add to routing if implemented, or conditionally render in `App.tsx`
3. Use `MainLayout` as wrapper for consistent chrome

### Theming Customization

Modify CSS custom properties in `src/renderer/styles/theme.css`:

```css
:root {
  /* Add new color */
  --neon-purple: #bf00ff;
  --glow-purple: 0 0 20px rgba(191, 0, 255, 0.5);
}
```

### Adding Electron Features

Common extensions:
- **System Tray**: Add `Tray` setup in main process
- **Menus**: Add `Menu.buildFromTemplate()` for app/context menus
- **File Dialogs**: Expose `dialog.showOpenDialog()` via IPC
- **Notifications**: Use `Notification` API from main or web API in renderer
- **Auto-Update**: Integrate `electron-updater`

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| XSS Attacks | `contextIsolation` prevents access to Node APIs |
| Arbitrary Code Execution | `nodeIntegration: false` blocks `require()` |
| IPC Abuse | Validate all IPC inputs in main process |
| Remote Content | Avoid `loadURL()` with untrusted URLs |
| Prototype Pollution | Use `Object.freeze()` on exposed APIs if paranoid |

---

## Performance Notes

- **Startup**: Frameless window with `backgroundColor` prevents white flash
- **Bundle Size**: Vite tree-shakes unused code; keep dependencies minimal
- **Animations**: CSS transforms/opacity use GPU; avoid animating layout properties
- **State Updates**: Zustand's selector pattern prevents unnecessary re-renders

---

## Future Considerations

1. **Routing**: Add `react-router` if multi-page navigation needed
2. **Persistence**: Add Zustand `persist` middleware for settings
3. **Testing**: Add Vitest for unit tests, Playwright for E2E
4. **Packaging**: Configure `electron-builder` for distribution
5. **Hot Reload Main Process**: Currently requires restart; consider `electron-reload`
