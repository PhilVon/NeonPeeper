import { app, BrowserWindow, ipcMain, desktopCapturer, Notification, systemPreferences } from 'electron'
import { join } from 'path'

// Allow multiple instances with separate user data dirs
const instanceLock = app.requestSingleInstanceLock()
if (!instanceLock) {
  // Second instance — use a unique user data path to avoid cache conflicts
  app.setPath('userData', join(app.getPath('userData'), `instance-${process.pid}`))
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('focus-change', true)
  })
  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('focus-change', false)
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// Window control IPC handlers
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

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
})

// Screen sharing: get desktop sources
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  })
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    appIcon: source.appIcon?.toDataURL() ?? null,
    display_id: source.display_id,
  }))
})

// Notifications
ipcMain.on('show-notification', (_event, title: string, body: string) => {
  new Notification({ title, body }).show()
})

// Media access
ipcMain.handle('get-media-access', async (_event, mediaType: string) => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus(mediaType as 'camera' | 'microphone')
    if (status !== 'granted') {
      return systemPreferences.askForMediaAccess(mediaType as 'camera' | 'microphone')
    }
    return true
  }
  return true
})

// App path
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

