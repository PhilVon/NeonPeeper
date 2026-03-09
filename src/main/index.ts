import { app, BrowserWindow, ipcMain, desktopCapturer, Notification, systemPreferences, session } from 'electron'
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
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    if (process.env.NODE_ENV !== 'production') {
      mainWindow.webContents.openDevTools()
    }
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

app.whenReady().then(() => {
  // Enforce Content Security Policy via session headers
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' ws: wss: http: https:; media-src 'self' mediastream: blob:; img-src 'self' data: blob: https://*.giphy.com;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' wss: ws://localhost:*; media-src 'self' mediastream: blob:; img-src 'self' data: blob: https://*.giphy.com;"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  createWindow()
})

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

// Notifications — rate limited to 5 per 10 seconds
const notificationTimestamps: number[] = []
const NOTIFICATION_RATE_LIMIT = 5
const NOTIFICATION_RATE_WINDOW_MS = 10_000

ipcMain.on('show-notification', (_event, title: unknown, body: unknown) => {
  // Validate inputs
  if (typeof title !== 'string' || typeof body !== 'string') return
  const sanitizedTitle = title.slice(0, 100)
  const sanitizedBody = body.slice(0, 500)

  // Rate limit
  const now = Date.now()
  while (notificationTimestamps.length > 0 && now - notificationTimestamps[0] > NOTIFICATION_RATE_WINDOW_MS) {
    notificationTimestamps.shift()
  }
  if (notificationTimestamps.length >= NOTIFICATION_RATE_LIMIT) return
  notificationTimestamps.push(now)

  new Notification({ title: sanitizedTitle, body: sanitizedBody }).show()
})

// Media access
const VALID_MEDIA_TYPES = ['camera', 'microphone'] as const
type ValidMediaType = typeof VALID_MEDIA_TYPES[number]

ipcMain.handle('get-media-access', async (_event, mediaType: unknown) => {
  if (typeof mediaType !== 'string' || !VALID_MEDIA_TYPES.includes(mediaType as ValidMediaType)) {
    throw new Error(`Invalid media type: ${String(mediaType)}. Must be 'camera' or 'microphone'.`)
  }
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus(mediaType as ValidMediaType)
    if (status !== 'granted') {
      return systemPreferences.askForMediaAccess(mediaType as ValidMediaType)
    }
    return true
  }
  return true
})

// App path
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

