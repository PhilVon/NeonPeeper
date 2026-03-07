# Neon Template API Documentation

A comprehensive API reference for the Neon Template Electron application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Electron API](#electron-api)
   - [Window Control API](#window-control-api)
   - [IPC Channels](#ipc-channels)
3. [State Management](#state-management)
   - [UI Store](#ui-store)
4. [React Components](#react-components)
   - [Layout Components](#layout-components)
   - [UI Components](#ui-components)
5. [CSS Design System](#css-design-system)
   - [Design Tokens](#design-tokens)
   - [Animation Classes](#animation-classes)
6. [Configuration](#configuration)

---

## Architecture Overview

Neon Template follows Electron's multi-process architecture with strict context isolation for security.

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                            │
│  src/main/index.ts                                          │
│  - Window management                                        │
│  - IPC handlers                                             │
│  - Native OS integration                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ IPC
┌────────────────────────┴────────────────────────────────────┐
│                    Preload Script                           │
│  src/preload/index.ts                                       │
│  - Context bridge                                           │
│  - Secure API exposure                                      │
└────────────────────────┬────────────────────────────────────┘
                         │ window.electronAPI
┌────────────────────────┴────────────────────────────────────┐
│                   Renderer Process                          │
│  src/renderer/                                              │
│  - React application                                        │
│  - UI components                                            │
│  - State management                                         │
└─────────────────────────────────────────────────────────────┘
```

### Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Main Process | `src/main/index.ts` | Electron main process, window creation, IPC handlers |
| Preload Script | `src/preload/index.ts` | Context bridge for secure renderer-main communication |
| Renderer | `src/renderer/index.tsx` | React application root |

---

## Electron API

### Window Control API

The window control API is exposed to the renderer process via the context bridge as `window.electronAPI`.

**Location:** `src/preload/index.ts`
**Type Definition:** `src/types/electron.d.ts`

#### Interface

```typescript
interface ElectronAPI {
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>
}

// Global augmentation
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

#### Methods

##### `windowMinimize()`

Minimizes the application window to the taskbar.

```typescript
window.electronAPI.windowMinimize(): void
```

**Parameters:** None
**Returns:** `void`

**Example:**
```typescript
// Minimize the window
window.electronAPI.windowMinimize()
```

---

##### `windowMaximize()`

Toggles the window between maximized and restored state.

```typescript
window.electronAPI.windowMaximize(): void
```

**Parameters:** None
**Returns:** `void`

**Example:**
```typescript
// Toggle maximize state
window.electronAPI.windowMaximize()
```

---

##### `windowClose()`

Closes the application window.

```typescript
window.electronAPI.windowClose(): void
```

**Parameters:** None
**Returns:** `void`

**Example:**
```typescript
// Close the window
window.electronAPI.windowClose()
```

---

##### `windowIsMaximized()`

Checks if the window is currently maximized.

```typescript
window.electronAPI.windowIsMaximized(): Promise<boolean>
```

**Parameters:** None
**Returns:** `Promise<boolean>` - Resolves to `true` if maximized, `false` otherwise

**Example:**
```typescript
// Check maximize state
const isMaximized = await window.electronAPI.windowIsMaximized()
if (isMaximized) {
  console.log('Window is maximized')
}
```

---

### IPC Channels

Communication between the main and renderer processes uses these IPC channels.

**Location:** `src/main/index.ts`

| Channel | Type | Direction | Description |
|---------|------|-----------|-------------|
| `window-minimize` | `send` | Renderer → Main | Minimizes the window |
| `window-maximize` | `send` | Renderer → Main | Toggles maximize state |
| `window-close` | `send` | Renderer → Main | Closes the window |
| `window-is-maximized` | `invoke` | Renderer ↔ Main | Returns current maximize state |

#### Handler Implementations

```typescript
// One-way messages (send)
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

// Two-way messages (invoke/handle)
ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
})
```

---

## State Management

### UI Store

Global UI state managed with Zustand.

**Location:** `src/renderer/store/ui-store.ts`

#### Interface

```typescript
interface UIState {
  crtEnabled: boolean
  toggleCRT: () => void
  setCRTEnabled: (enabled: boolean) => void
}
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `crtEnabled` | `boolean` | `false` | Whether CRT visual effect is active |

#### Methods

##### `toggleCRT()`

Toggles the CRT effect on/off.

```typescript
toggleCRT(): void
```

**Example:**
```typescript
import { useUIStore } from '@/store/ui-store'

function SettingsPanel() {
  const { crtEnabled, toggleCRT } = useUIStore()

  return (
    <button onClick={toggleCRT}>
      CRT Effect: {crtEnabled ? 'ON' : 'OFF'}
    </button>
  )
}
```

---

##### `setCRTEnabled()`

Explicitly sets the CRT effect state.

```typescript
setCRTEnabled(enabled: boolean): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `boolean` | Whether to enable the CRT effect |

**Example:**
```typescript
import { useUIStore } from '@/store/ui-store'

// Enable CRT effect
useUIStore.getState().setCRTEnabled(true)

// Or in a component
function Component() {
  const setCRTEnabled = useUIStore((state) => state.setCRTEnabled)

  useEffect(() => {
    // Enable on mount
    setCRTEnabled(true)
    // Disable on unmount
    return () => setCRTEnabled(false)
  }, [])
}
```

---

## React Components

### Layout Components

#### `MainLayout`

Primary application layout container with title bar, optional sidebar, and status bar.

**Location:** `src/renderer/components/layout/MainLayout.tsx`

```typescript
interface MainLayoutProps {
  title?: string
  showSidebar?: boolean
  children: React.ReactNode
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `title` | `string` | `'Neon App'` | No | Application title in title bar |
| `showSidebar` | `boolean` | `true` | No | Whether to render the sidebar |
| `children` | `React.ReactNode` | - | Yes | Main content area |

**Example:**
```tsx
import { MainLayout } from '@/components/layout/MainLayout'

function App() {
  return (
    <MainLayout title="My Neon App" showSidebar={true}>
      <div>Main content goes here</div>
    </MainLayout>
  )
}
```

---

#### `TitleBar`

Custom frameless window title bar with window controls.

**Location:** `src/renderer/components/layout/TitleBar.tsx`

```typescript
interface TitleBarProps {
  title?: string
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `title` | `string` | `'Neon App'` | No | Title displayed in the title bar |

**Example:**
```tsx
import { TitleBar } from '@/components/layout/TitleBar'

<TitleBar title="Custom Title" />
```

**Features:**
- Draggable area for window movement
- Minimize, maximize, and close buttons
- Integrates with `window.electronAPI` for window control

---

#### `Sidebar`

Navigation sidebar with tab support. Supports both controlled and uncontrolled modes.

**Location:** `src/renderer/components/layout/Sidebar.tsx`

```typescript
interface SidebarTab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface SidebarProps {
  tabs?: SidebarTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  children?: React.ReactNode
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `tabs` | `SidebarTab[]` | `[{id:'home'}, {id:'settings'}]` | No | Tab configuration array |
| `activeTab` | `string` | - | No | Controlled active tab ID |
| `onTabChange` | `(tabId: string) => void` | - | No | Callback when tab changes |
| `children` | `React.ReactNode` | - | No | Additional sidebar content |

**SidebarTab Interface:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique tab identifier |
| `label` | `string` | Yes | Display text |
| `icon` | `React.ReactNode` | No | Optional icon element |

**Example (Uncontrolled):**
```tsx
import { Sidebar } from '@/components/layout/Sidebar'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'files', label: 'Files', icon: <FilesIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
]

<Sidebar tabs={tabs} />
```

**Example (Controlled):**
```tsx
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <Sidebar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  )
}
```

---

#### `StatusBar`

Application status bar displaying connection status and version.

**Location:** `src/renderer/components/layout/StatusBar.tsx`

```typescript
interface StatusBarProps {
  status?: 'online' | 'offline' | 'busy'
  statusText?: string
  version?: string
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `status` | `'online' \| 'offline' \| 'busy'` | `'online'` | No | Status indicator state |
| `statusText` | `string` | `'Ready'` | No | Status message text |
| `version` | `string` | `'1.0.0'` | No | Version number to display |

**Example:**
```tsx
import { StatusBar } from '@/components/layout/StatusBar'

<StatusBar
  status="online"
  statusText="Connected to server"
  version="2.1.0"
/>
```

---

### UI Components

#### `NeonButton`

Styled button with neon glow effects.

**Location:** `src/renderer/components/ui/NeonButton.tsx`

```typescript
interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  glow?: boolean
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger'` | `'primary'` | No | Button color variant |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | No | Button size |
| `glow` | `boolean` | `true` | No | Whether to show glow effect |
| `...props` | `ButtonHTMLAttributes` | - | No | Standard button attributes |

**Variants:**
- `primary` - Cyan neon color (default)
- `secondary` - Muted/neutral color
- `danger` - Red neon color for destructive actions

**Example:**
```tsx
import { NeonButton } from '@/components/ui/NeonButton'

// Primary button with glow
<NeonButton onClick={handleClick}>
  Click Me
</NeonButton>

// Danger button without glow
<NeonButton variant="danger" glow={false} onClick={handleDelete}>
  Delete
</NeonButton>

// Small secondary button
<NeonButton variant="secondary" size="small">
  Cancel
</NeonButton>

// With standard button props
<NeonButton type="submit" disabled={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</NeonButton>
```

---

#### `NeonCard`

Container card with optional neon glow border.

**Location:** `src/renderer/components/ui/NeonCard.tsx`

```typescript
interface NeonCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  glow?: boolean
  glowColor?: 'cyan' | 'green' | 'magenta'
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `title` | `string` | - | No | Card header title |
| `glow` | `boolean` | `false` | No | Whether to show glow effect |
| `glowColor` | `'cyan' \| 'green' \| 'magenta'` | `'cyan'` | No | Glow color variant |
| `...props` | `HTMLAttributes` | - | No | Standard div attributes |

**Example:**
```tsx
import { NeonCard } from '@/components/ui/NeonCard'

// Basic card
<NeonCard>
  <p>Card content</p>
</NeonCard>

// Card with title
<NeonCard title="System Status">
  <p>All systems operational</p>
</NeonCard>

// Card with glow effect
<NeonCard title="Alert" glow glowColor="magenta">
  <p>Important notification</p>
</NeonCard>

// With custom className
<NeonCard className="my-custom-card" onClick={handleClick}>
  <p>Clickable card</p>
</NeonCard>
```

---

#### `NeonInput`

Styled text input with label and error support. Uses `forwardRef` for ref forwarding.

**Location:** `src/renderer/components/ui/NeonInput.tsx`

```typescript
interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | No | Input label text |
| `error` | `string` | - | No | Error message to display |
| `ref` | `Ref<HTMLInputElement>` | - | No | Forwarded ref |
| `...props` | `InputHTMLAttributes` | - | No | Standard input attributes |

**Example:**
```tsx
import { NeonInput } from '@/components/ui/NeonInput'
import { useForm } from 'react-hook-form'

// Basic usage
<NeonInput
  label="Username"
  placeholder="Enter username"
/>

// With error state
<NeonInput
  label="Email"
  type="email"
  error="Invalid email address"
/>

// With ref (e.g., react-hook-form)
function Form() {
  const { register, handleSubmit, formState: { errors } } = useForm()

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <NeonInput
        label="Password"
        type="password"
        error={errors.password?.message}
        {...register('password', { required: 'Password is required' })}
      />
    </form>
  )
}

// Controlled input
function ControlledInput() {
  const [value, setValue] = useState('')

  return (
    <NeonInput
      label="Search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
```

---

#### `StatusIndicator`

Visual status indicator with optional pulse animation.

**Location:** `src/renderer/components/ui/StatusIndicator.tsx`

```typescript
interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'idle'
  size?: 'small' | 'medium' | 'large'
  pulse?: boolean
  label?: string
}
```

**Props:**

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `status` | `'online' \| 'offline' \| 'busy' \| 'idle'` | - | Yes | Current status state |
| `size` | `'small' \| 'medium' \| 'large'` | `'small'` | No | Indicator size |
| `pulse` | `boolean` | `true` | No | Whether to show pulse animation |
| `label` | `string` | - | No | Text label beside indicator |

**Status Colors:**
- `online` - Green (with pulse by default)
- `offline` - Gray (no pulse)
- `busy` - Red (with pulse by default)
- `idle` - Yellow (with pulse by default)

**Example:**
```tsx
import { StatusIndicator } from '@/components/ui/StatusIndicator'

// Basic usage
<StatusIndicator status="online" />

// With label
<StatusIndicator status="busy" label="Processing..." />

// Large size without pulse
<StatusIndicator status="offline" size="large" pulse={false} />

// In a list
function UserList({ users }) {
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          <StatusIndicator status={user.status} size="small" />
          {user.name}
        </li>
      ))}
    </ul>
  )
}
```

---

## CSS Design System

### Design Tokens

CSS custom properties (variables) for consistent theming.

**Location:** `src/renderer/styles/theme.css`

#### Colors

##### Background Colors

```css
--bg-darkest: #0a0a0f;   /* Deepest background */
--bg-dark: #12121a;       /* Primary background */
--bg-medium: #1a1a25;     /* Elevated surfaces */
--bg-light: #22222f;      /* Highest elevation */
```

##### Neon Accent Colors

```css
--neon-cyan: #00ffff;     /* Primary accent */
--neon-green: #00ff88;    /* Success states */
--neon-magenta: #ff00ff;  /* Highlights */
--neon-yellow: #ffff00;   /* Warnings */
--neon-orange: #ff8800;   /* Caution */
--neon-red: #ff0044;      /* Errors/Danger */
```

##### Text Colors

```css
--text-primary: #e0e0e0;    /* Primary text */
--text-secondary: #a0a0a0;  /* Secondary text */
--text-muted: #606060;      /* Muted/disabled text */
```

##### Semantic Colors

```css
--color-success: var(--neon-green);
--color-warning: var(--neon-orange);
--color-error: var(--neon-red);
--color-info: var(--neon-cyan);
```

#### Typography

```css
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-md: 14px;
--font-size-lg: 16px;
--font-size-xl: 20px;
```

#### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

#### Border Radius

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

#### Glow Effects

```css
--glow-cyan: 0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3);
--glow-green: 0 0 10px rgba(0, 255, 136, 0.5), 0 0 20px rgba(0, 255, 136, 0.3);
--glow-magenta: 0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.3);
--glow-red: 0 0 10px rgba(255, 0, 68, 0.5), 0 0 20px rgba(255, 0, 68, 0.3);
```

#### Transitions

```css
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 400ms ease;
```

#### Z-Index Layers

```css
--z-base: 0;
--z-dropdown: 100;
--z-modal: 200;
--z-tooltip: 300;
--z-titlebar: 400;
```

---

### Animation Classes

Utility classes for visual effects.

**Location:** `src/renderer/styles/effects.css`

#### `.glitch`

Applies a glitch text effect animation.

```css
.glitch {
  animation: glitch 0.5s ease-in-out;
}
```

**Example:**
```tsx
<h1 className="glitch">SYSTEM ERROR</h1>
```

---

#### `.glitch-hover`

Applies glitch effect on hover.

```css
.glitch-hover:hover {
  animation: glitch 0.3s ease-in-out;
}
```

**Example:**
```tsx
<button className="glitch-hover">Hover Me</button>
```

---

#### `.pulse` / `.pulse-fast`

Opacity pulse animation.

```css
.pulse {
  animation: pulse 2s ease-in-out infinite;
}

.pulse-fast {
  animation: pulse 1s ease-in-out infinite;
}
```

**Example:**
```tsx
<span className="pulse">Loading...</span>
<div className="pulse-fast">Urgent!</div>
```

---

#### `.glow-pulse`

Pulsing glow box-shadow effect.

```css
.glow-pulse {
  animation: glow-pulse 2s ease-in-out infinite;
}
```

**Example:**
```tsx
<div className="glow-pulse">Highlighted content</div>
```

---

#### `.fade-in`

Fade in from below animation.

```css
.fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
```

**Example:**
```tsx
<div className="fade-in">Newly loaded content</div>
```

---

#### `.crt-effect`

CRT monitor scanlines and vignette overlay. Apply to a container element.

```css
.crt-effect::before { /* Scanlines */ }
.crt-effect::after { /* Vignette */ }
```

**Example:**
```tsx
function App() {
  const { crtEnabled } = useUIStore()

  return (
    <div className={crtEnabled ? 'crt-effect' : ''}>
      <MainLayout>...</MainLayout>
    </div>
  )
}
```

---

#### `.flicker`

Random screen flicker effect.

```css
.flicker {
  animation: flicker 4s linear infinite;
}
```

**Example:**
```tsx
<div className="flicker">Unstable connection...</div>
```

---

#### `.cursor-blink`

Terminal-style blinking cursor appended via `::after`.

```css
.cursor-blink::after {
  content: '█';
  animation: blink-cursor 1s step-end infinite;
  color: var(--neon-cyan);
}
```

**Example:**
```tsx
<span className="cursor-blink">Enter command</span>
```

---

#### `.neon-border`

Glowing border with enhanced hover effect.

```css
.neon-border {
  border: 1px solid var(--neon-cyan);
  box-shadow: 0 0 5px rgba(0, 255, 255, 0.3),
              inset 0 0 5px rgba(0, 255, 255, 0.1);
}

.neon-border:hover {
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5),
              0 0 20px rgba(0, 255, 255, 0.3),
              inset 0 0 10px rgba(0, 255, 255, 0.2);
}
```

**Example:**
```tsx
<div className="neon-border">Highlighted panel</div>
```

---

## Configuration

### Window Configuration

Default window settings defined in `src/main/index.ts`:

| Option | Value | Description |
|--------|-------|-------------|
| `width` | `1200` | Initial window width in pixels |
| `height` | `800` | Initial window height in pixels |
| `minWidth` | `800` | Minimum window width |
| `minHeight` | `600` | Minimum window height |
| `frame` | `false` | Frameless window (custom title bar) |
| `backgroundColor` | `#0a0a0f` | Background color before content loads |
| `contextIsolation` | `true` | Security: isolate preload from renderer |
| `nodeIntegration` | `false` | Security: disable Node.js in renderer |

### Build Configuration

Output directories configured in `vite.config.ts`:

| Target | Output Directory |
|--------|------------------|
| Main Process | `dist/main` |
| Preload Script | `dist/preload` |
| Renderer | `dist/renderer` |

---

## Error Handling

### IPC Error Handling

The window control API methods are fire-and-forget for `send` operations. The `invoke` method returns a Promise that can be caught:

```typescript
try {
  const isMaximized = await window.electronAPI.windowIsMaximized()
} catch (error) {
  console.error('Failed to check maximize state:', error)
}
```

### Component Error States

Components like `NeonInput` support error display:

```tsx
<NeonInput
  label="Email"
  error={validationError ? validationError.message : undefined}
/>
```

For application-wide error boundaries, wrap your app in a React Error Boundary component.

---

## License

See [LICENSE](../LICENSE) for details.
