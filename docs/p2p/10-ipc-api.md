# P2P Chat System — IPC API

> New Electron IPC channels and preload API extensions for P2P functionality.

---

## Table of Contents

- [New IPC Channels](#new-ipc-channels)
- [Main Process Handlers](#main-process-handlers)
- [Updated Preload Script](#updated-preload-script)
- [Updated ElectronAPI Interface](#updated-electronapi-interface)
- [Usage Examples](#usage-examples)

---

## New IPC Channels

| Channel | Direction | Pattern | Purpose |
|---------|-----------|---------|---------|
| `get-desktop-sources` | Renderer → Main | `invoke` | Get available screen/window sources for sharing |
| `show-notification` | Renderer → Main | `send` | Show a native OS notification |
| `get-media-access` | Renderer → Main | `invoke` | Check/request camera/microphone permissions |
| `get-app-path` | Renderer → Main | `invoke` | Get app data directory path |
| `on-focus-change` | Main → Renderer | `on` (listener) | Window focus/blur events |

### Existing Channels (Unchanged)

| Channel | Direction | Pattern | Purpose |
|---------|-----------|---------|---------|
| `window-minimize` | Renderer → Main | `send` | Minimize window |
| `window-maximize` | Renderer → Main | `send` | Toggle maximize/restore |
| `window-close` | Renderer → Main | `send` | Close window |
| `window-is-maximized` | Renderer → Main | `invoke` | Check if window is maximized |

---

## Main Process Handlers

Add these to `src/main/index.ts` alongside existing window control handlers.

### get-desktop-sources

Returns available screen and window sources for the screen share picker.

```typescript
import { desktopCapturer, ipcMain } from 'electron'

interface DesktopSource {
  id: string
  name: string
  thumbnail: string      // Base64 data URL
  appIcon: string | null // Base64 data URL
  displayId: string
}

ipcMain.handle('get-desktop-sources', async (): Promise<DesktopSource[]> => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  })

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon?.toDataURL() || null,
    displayId: source.display_id
  }))
})
```

### show-notification

Shows a native OS notification (used for incoming messages when window is unfocused).

```typescript
import { Notification, ipcMain } from 'electron'

ipcMain.on('show-notification', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      silent: false
    })
    notification.show()

    // Click notification to focus the app window
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  }
})
```

### get-media-access

Check and request camera/microphone permissions (macOS specific, no-op on Windows/Linux).

```typescript
import { systemPreferences, ipcMain } from 'electron'

ipcMain.handle('get-media-access', async (_event, mediaType: 'camera' | 'microphone'): Promise<boolean> => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus(mediaType)
    if (status === 'granted') return true
    if (status === 'not-determined') {
      return systemPreferences.askForMediaAccess(mediaType)
    }
    return false  // 'denied' or 'restricted'
  }
  // Windows/Linux: permissions handled by the OS at the browser level
  return true
})
```

### get-app-path

Returns the app's user data directory (for storing config, databases, etc.).

```typescript
import { app, ipcMain } from 'electron'

ipcMain.handle('get-app-path', (): string => {
  return app.getPath('userData')
})
```

### on-focus-change

Notifies the renderer when the window gains or loses focus.

```typescript
// In the window creation section of main/index.ts, after mainWindow is created:

mainWindow.on('focus', () => {
  mainWindow?.webContents.send('focus-change', true)
})

mainWindow.on('blur', () => {
  mainWindow?.webContents.send('focus-change', false)
})
```

---

## Updated Preload Script

The updated `src/preload/index.ts` with new methods added to the existing API:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ========================================
  // EXISTING — Window Controls
  // ========================================
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // ========================================
  // NEW — P2P Features
  // ========================================

  /** Get available screen/window sources for screen sharing */
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  /** Show a native OS notification */
  showNotification: (title: string, body: string) =>
    ipcRenderer.send('show-notification', title, body),

  /** Check/request media access permissions (macOS) */
  getMediaAccess: (mediaType: 'camera' | 'microphone') =>
    ipcRenderer.invoke('get-media-access', mediaType),

  /** Get app user data path */
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  /** Subscribe to window focus changes */
  onFocusChange: (callback: (focused: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, focused: boolean) => {
      callback(focused)
    }
    ipcRenderer.on('focus-change', handler)

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('focus-change', handler)
    }
  }
})
```

---

## Updated ElectronAPI Interface

The updated `src/types/electron.d.ts`:

```typescript
export interface DesktopSource {
  /** Source ID for desktopCapturer */
  id: string

  /** Display name of the window or screen */
  name: string

  /** Base64-encoded thumbnail image (320x180) */
  thumbnail: string

  /** Base64-encoded application icon (may be null) */
  appIcon: string | null

  /** Display ID (for screens) */
  displayId: string
}

export interface ElectronAPI {
  // ========================================
  // Window Controls (existing)
  // ========================================
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>

  // ========================================
  // P2P Features (new)
  // ========================================

  /** Get available desktop sources for screen sharing */
  getDesktopSources: () => Promise<DesktopSource[]>

  /** Show a native OS notification */
  showNotification: (title: string, body: string) => void

  /** Check/request camera or microphone access */
  getMediaAccess: (mediaType: 'camera' | 'microphone') => Promise<boolean>

  /** Get the app's user data directory path */
  getAppPath: () => Promise<string>

  /** Subscribe to window focus/blur events. Returns cleanup function. */
  onFocusChange: (callback: (focused: boolean) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

---

## Usage Examples

### Screen Sharing with Source Picker

```typescript
// In a React component
async function handleScreenShare() {
  // 1. Get available sources via IPC
  const sources = await window.electronAPI.getDesktopSources()

  // 2. Show source picker UI (ScreenSourcePicker component)
  mediaStore.getState().setSourcePickerOpen(true)
  // ... user selects a source ...

  // 3. Capture the selected source
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource.id,
      }
    } as MediaTrackConstraints
  })

  // 4. Add to peer connection
  mediaManager.addTracksToConnection(peerConnection)
}
```

### Notifications for Incoming Messages

```typescript
// In the MessageRouter service
function handleIncomingText(msg: NeonP2PMessage<TextPayload>) {
  // Store the message
  chatStore.getState().addMessage(/* ... */)

  // Show notification if window is not focused
  if (!windowFocused) {
    const sender = peerStore.getState().peers.get(msg.from)
    window.electronAPI.showNotification(
      sender?.displayName || 'New Message',
      msg.payload.content.slice(0, 100)  // Truncate for notification
    )
  }
}
```

### Focus-Based Read Receipts

```typescript
// In App.tsx or a top-level hook
import { useEffect } from 'react'

function useFocusTracking() {
  useEffect(() => {
    const cleanup = window.electronAPI.onFocusChange((focused) => {
      if (focused) {
        // Window regained focus — send read receipts for visible messages
        const activeChatId = chatStore.getState().activeChatId
        if (activeChatId) {
          sendReadReceipts(activeChatId)
        }
      }
    })

    return cleanup
  }, [])
}
```

### Media Permission Check

```typescript
async function ensureMediaAccess(): Promise<boolean> {
  const cameraAccess = await window.electronAPI.getMediaAccess('camera')
  const micAccess = await window.electronAPI.getMediaAccess('microphone')

  if (!cameraAccess || !micAccess) {
    toast.warning('Camera or microphone access denied. Check system settings.')
    return false
  }

  return true
}
```

---

*Previous: [State Management ←](./09-state-management.md) · Next: [UI Components →](./11-ui-components.md)*
