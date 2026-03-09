import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Screen sharing
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Notifications — validate string types and lengths before forwarding
  showNotification: (title: string, body: string) => {
    if (typeof title !== 'string' || typeof body !== 'string') return
    ipcRenderer.send('show-notification', title.slice(0, 100), body.slice(0, 500))
  },

  // Media access — validate mediaType before forwarding
  getMediaAccess: (mediaType: string) => {
    if (typeof mediaType !== 'string' || !['camera', 'microphone'].includes(mediaType)) {
      return Promise.reject(new Error('Invalid media type'))
    }
    return ipcRenderer.invoke('get-media-access', mediaType)
  },

  // App path
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Focus change
  onFocusChange: (callback: (focused: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, focused: boolean) => callback(focused)
    ipcRenderer.on('focus-change', handler)
    return () => ipcRenderer.removeListener('focus-change', handler)
  },
})
