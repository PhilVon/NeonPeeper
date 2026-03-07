import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Screen sharing
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.send('show-notification', title, body),

  // Media access
  getMediaAccess: (mediaType: string) => ipcRenderer.invoke('get-media-access', mediaType),

  // App path
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Focus change
  onFocusChange: (callback: (focused: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, focused: boolean) => callback(focused)
    ipcRenderer.on('focus-change', handler)
    return () => ipcRenderer.removeListener('focus-change', handler)
  },
})
