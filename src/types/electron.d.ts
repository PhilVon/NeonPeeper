export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  display_id: string
}

export interface ElectronAPI {
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>
  getDesktopSources: () => Promise<DesktopSource[]>
  showNotification: (title: string, body: string) => void
  getMediaAccess: (mediaType: 'camera' | 'microphone') => Promise<boolean>
  getAppPath: () => Promise<string>
  onFocusChange: (callback: (focused: boolean) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
