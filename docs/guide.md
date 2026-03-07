# Neon Template - Usage Guide

A cyberpunk-inspired Electron + React + TypeScript template featuring neon aesthetics, glowing UI components, and retro CRT effects.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Common Use Cases](#common-use-cases)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher (or yarn/pnpm)
- A code editor (VS Code recommended)

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | ^28.1.0 | Desktop application framework |
| React | ^18.2.0 | UI library |
| TypeScript | ^5.3.3 | Type safety |
| Vite | ^5.0.12 | Build tool and dev server |
| Zustand | ^4.5.0 | State management |

---

## Installation

### 1. Clone or Use Template

```bash
# Clone the repository
git clone <repository-url> my-neon-app
cd my-neon-app

# Or if using as a template
npx degit username/neon-template my-neon-app
cd my-neon-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

This launches the Electron app with hot reload enabled.

### 4. Build for Production

```bash
npm run build
```

Output files are generated in the `dist/` directory:
- `dist/main/` - Electron main process
- `dist/preload/` - Preload scripts
- `dist/renderer/` - React application

---

## Basic Usage

### Project Structure

```
src/
├── main/
│   └── index.ts          # Electron main process
├── preload/
│   └── index.ts          # Context bridge (IPC)
├── renderer/
│   ├── components/
│   │   ├── layout/       # Layout components
│   │   └── ui/           # Reusable UI components
│   ├── store/            # Zustand stores
│   ├── styles/           # Global CSS & theme
│   ├── App.tsx           # Root component
│   └── index.tsx         # Entry point
└── types/
    └── electron.d.ts     # TypeScript definitions
```

### Using Layout Components

The `MainLayout` component provides the complete app structure:

```tsx
import { MainLayout } from './components/layout/MainLayout'

function App() {
  return (
    <MainLayout title="My App" showSidebar={true}>
      <YourContent />
    </MainLayout>
  )
}
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'Neon App'` | Window title displayed in title bar |
| `showSidebar` | `boolean` | `true` | Toggle sidebar visibility |
| `children` | `ReactNode` | required | Main content area |

### Using UI Components

#### NeonButton

```tsx
import { NeonButton } from './components/ui/NeonButton'

// Primary button with glow
<NeonButton variant="primary" size="medium" glow>
  Click Me
</NeonButton>

// Danger button without glow
<NeonButton variant="danger" size="small" glow={false}>
  Delete
</NeonButton>
```

**Props:**
| Prop | Type | Default | Options |
|------|------|---------|---------|
| `variant` | `string` | `'primary'` | `'primary'`, `'secondary'`, `'danger'` |
| `size` | `string` | `'medium'` | `'small'`, `'medium'`, `'large'` |
| `glow` | `boolean` | `true` | Enable neon glow effect |

#### NeonCard

```tsx
import { NeonCard } from './components/ui/NeonCard'

<NeonCard title="Status" glow glowColor="cyan">
  <p>System operational</p>
</NeonCard>
```

**Props:**
| Prop | Type | Default | Options |
|------|------|---------|---------|
| `title` | `string` | - | Card header text |
| `glow` | `boolean` | `false` | Enable glow effect |
| `glowColor` | `string` | `'cyan'` | `'cyan'`, `'green'`, `'magenta'` |

#### NeonInput

```tsx
import { NeonInput } from './components/ui/NeonInput'

<NeonInput
  label="Username"
  placeholder="Enter username"
  error={errors.username}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Input label |
| `error` | `string` | - | Error message (shows error state) |

#### StatusIndicator

```tsx
import { StatusIndicator } from './components/ui/StatusIndicator'

<StatusIndicator status="online" size="small" pulse label="Server" />
```

**Props:**
| Prop | Type | Default | Options |
|------|------|---------|---------|
| `status` | `string` | required | `'online'`, `'offline'`, `'busy'`, `'idle'` |
| `size` | `string` | `'small'` | `'small'`, `'medium'`, `'large'` |
| `pulse` | `boolean` | `true` | Animate with pulse effect |
| `label` | `string` | - | Text label beside indicator |

---

## Common Use Cases

### 1. Toggle CRT Effect

The template includes a retro CRT monitor effect (scanlines + vignette):

```tsx
import { useUIStore } from './store/ui-store'

function Settings() {
  const { crtEnabled, toggleCRT, setCRTEnabled } = useUIStore()

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={crtEnabled}
          onChange={toggleCRT}
        />
        Enable CRT Effect
      </label>
    </div>
  )
}
```

### 2. Window Controls (Frameless Window)

Access window controls via the preload API:

```tsx
// Minimize window
window.electronAPI.windowMinimize()

// Toggle maximize
window.electronAPI.windowMaximize()

// Close window
window.electronAPI.windowClose()

// Check if maximized
const isMax = await window.electronAPI.windowIsMaximized()
```

### 3. Adding Glitch Effects

Apply animation classes to any element:

```tsx
// Continuous glitch
<h1 className="glitch">NEON FUTURE</h1>

// Glitch on hover
<span className="glitch-hover">Hover me</span>

// Neon border glow
<div className="neon-border">Glowing container</div>

// Pulsing element
<div className="pulse">Breathing effect</div>
```

### 4. Custom Glow Colors

Use CSS variables for consistent theming:

```css
.my-custom-element {
  color: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}

/* Available glow presets */
box-shadow: var(--glow-cyan);
box-shadow: var(--glow-green);
box-shadow: var(--glow-magenta);
box-shadow: var(--glow-red);
```

### 5. Building a Dashboard

```tsx
import { MainLayout } from './components/layout/MainLayout'
import { NeonCard } from './components/ui/NeonCard'
import { StatusIndicator } from './components/ui/StatusIndicator'

function Dashboard() {
  return (
    <MainLayout title="Dashboard">
      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <NeonCard title="Server Status" glow glowColor="green">
          <StatusIndicator status="online" label="API Server" />
          <StatusIndicator status="online" label="Database" />
        </NeonCard>

        <NeonCard title="Metrics" glow glowColor="cyan">
          <p>Active Users: 1,234</p>
          <p>Requests/min: 5,678</p>
        </NeonCard>
      </div>
    </MainLayout>
  )
}
```

---

## Configuration

### Window Options

Edit `src/main/index.ts` to customize the Electron window:

```typescript
const mainWindow = new BrowserWindow({
  width: 1200,           // Initial width
  height: 800,           // Initial height
  minWidth: 800,         // Minimum width
  minHeight: 600,        // Minimum height
  frame: false,          // Frameless window (custom title bar)
  contextIsolation: true // Security: isolate preload context
})
```

### Design Tokens

All colors, spacing, and effects are defined in `src/renderer/styles/theme.css`:

```css
:root {
  /* Neon Colors */
  --neon-cyan: #00ffff;
  --neon-green: #00ff88;
  --neon-magenta: #ff00ff;
  --neon-red: #ff0044;

  /* Background Scale */
  --bg-darkest: #0a0a0f;
  --bg-dark: #12121a;
  --bg-medium: #1a1a25;
  --bg-light: #22222f;

  /* Typography */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

### Available Animation Classes

| Class | Effect | Duration |
|-------|--------|----------|
| `.glitch` | RGB split + shake | 0.5s |
| `.glitch-hover` | Glitch on hover | 0.3s |
| `.pulse` | Opacity breathing | 2s loop |
| `.pulse-fast` | Fast opacity pulse | 1s loop |
| `.glow-pulse` | Box shadow pulse | 2s loop |
| `.fade-in` | Fade in from below | 0.3s |
| `.flicker` | Screen flicker | 4s loop |
| `.cursor-blink` | Terminal cursor | 1s loop |
| `.neon-border` | Glowing border | on hover |
| `.crt-effect` | CRT scanlines + vignette | persistent |

### Vite Configuration

The build is configured in `vite.config.ts`:

```typescript
// Build output directories
{
  main: 'dist/main',
  preload: 'dist/preload',
  renderer: 'dist/renderer'
}
```

---

## Troubleshooting

### App Won't Start

**Symptoms:** `npm run dev` fails or window doesn't appear.

**Solutions:**
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Clear Vite cache:
   ```bash
   rm -rf node_modules/.vite
   ```
3. Check Node.js version (requires v18+):
   ```bash
   node --version
   ```

### White Screen on Launch

**Symptoms:** Window opens but shows blank white screen.

**Solutions:**
1. Open DevTools (`Ctrl+Shift+I`) and check console for errors
2. Ensure renderer entry point exists at `src/renderer/index.tsx`
3. Verify `index.html` references the correct entry file

### IPC Not Working

**Symptoms:** Window controls don't respond, `electronAPI` is undefined.

**Solutions:**
1. Check preload script is loading (no errors in main process console)
2. Verify `contextIsolation: true` in window options
3. Ensure TypeScript definitions exist in `src/types/electron.d.ts`

### CRT Effect Not Showing

**Symptoms:** Toggle works but no visual effect.

**Solutions:**
1. Ensure the root element has the class applied:
   ```tsx
   <div className={crtEnabled ? 'crt-effect' : ''}>
   ```
2. Check that `effects.css` is imported in your styles
3. Verify no CSS is setting `z-index` above 9999

### Fonts Not Loading

**Symptoms:** Default system font instead of monospace.

**Solutions:**
1. Install fonts locally (JetBrains Mono, Fira Code)
2. Or add web font import:
   ```css
   @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap');
   ```

### Build Fails

**Symptoms:** `npm run build` errors out.

**Solutions:**
1. Check TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```
2. Clear dist folder:
   ```bash
   rm -rf dist
   ```
3. Update dependencies:
   ```bash
   npm update
   ```

### Hot Reload Not Working

**Symptoms:** Changes don't reflect without manual restart.

**Solutions:**
1. Ensure Vite dev server is running (not just Electron)
2. Check for syntax errors in modified files
3. Restart with:
   ```bash
   npm run dev
   ```

---

## Quick Reference

### NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start development server with HMR |
| `build` | `npm run build` | Build for production |
| `preview` | `npm run preview` | Preview production build |

### Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main process & window setup |
| `src/preload/index.ts` | IPC bridge between main and renderer |
| `src/renderer/App.tsx` | React application root |
| `src/renderer/styles/theme.css` | Design tokens & CSS variables |
| `src/renderer/styles/effects.css` | Animation keyframes & utility classes |

### CSS Variable Categories

| Category | Prefix | Example |
|----------|--------|---------|
| Backgrounds | `--bg-*` | `--bg-dark` |
| Neon Colors | `--neon-*` | `--neon-cyan` |
| Text | `--text-*` | `--text-primary` |
| Spacing | `--spacing-*` | `--spacing-md` |
| Glows | `--glow-*` | `--glow-cyan` |
| Fonts | `--font-*` | `--font-mono` |
| Transitions | `--transition-*` | `--transition-fast` |
