const { app, BrowserWindow, Menu, session, ipcMain, shell, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const path = require('path')
const fs = require('fs')
const os = require('os')
const NoteTaker = require('notetaker-sdk/main')

const isDev = !app.isPackaged

// ~/Documents/Granula — user-visible meetings + transcripts
const GRANULA_DIR = path.join(os.homedir(), 'Documents', 'Granula')
const MEETINGS_DIR = path.join(GRANULA_DIR, 'meetings')
// Plain JSON so the user can open/edit everything in one place. If a legacy
// encrypted keys.enc exists from an older build we ignore it — user should
// re-enter keys once.
const KEYS_FILE = path.join(GRANULA_DIR, 'keys.json')
const LEGACY_KEYS_FILE = path.join(GRANULA_DIR, 'keys.enc')

function ensureDirs() {
  fs.mkdirSync(MEETINGS_DIR, { recursive: true })
}

function listMeetings() {
  ensureDirs()
  const entries = fs.readdirSync(MEETINGS_DIR, { withFileTypes: true })
  const out = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const metaPath = path.join(MEETINGS_DIR, e.name, 'meeting.json')
    if (fs.existsSync(metaPath)) {
      try {
        out.push(JSON.parse(fs.readFileSync(metaPath, 'utf8')))
      } catch (err) {
        console.error('Failed to read meeting', e.name, err)
      }
    }
  }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

function getMeeting(id) {
  const metaPath = path.join(MEETINGS_DIR, id, 'meeting.json')
  if (!fs.existsSync(metaPath)) return null
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
}

function saveMeeting(meeting) {
  ensureDirs()
  const dir = path.join(MEETINGS_DIR, meeting.id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'meeting.json'), JSON.stringify(meeting, null, 2), 'utf8')
  return meeting
}

function deleteMeeting(id) {
  const dir = path.join(MEETINGS_DIR, id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

// --- Plain-JSON API key storage ---
// Stored alongside meetings so the user has a single human-readable folder
// with all of their Granula data. Drop in a text editor, edit, save, done.
function loadKeys() {
  try {
    if (!fs.existsSync(KEYS_FILE)) return { deepgram: '', gemini: '' }
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'))
  } catch (err) {
    console.error('loadKeys failed:', err)
    return { deepgram: '', gemini: '' }
  }
}

function saveKeys(keys) {
  ensureDirs()
  fs.writeFileSync(
    KEYS_FILE,
    JSON.stringify({ deepgram: '', gemini: '', ...keys }, null, 2),
    'utf8',
  )
  // Clean up legacy encrypted file if present — we're the source of truth now.
  if (fs.existsSync(LEGACY_KEYS_FILE)) {
    try { fs.unlinkSync(LEGACY_KEYS_FILE) } catch (_e) {}
  }
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin'
  const openFolderItem = {
    label: 'Open Granula Folder',
    accelerator: 'CmdOrCtrl+Shift+O',
    click: () => shell.openPath(GRANULA_DIR),
  }
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            openFolderItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        openFolderItem,
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Debounced broadcast so one save doesn't fire ten events.
const pendingBroadcasts = new Map() // kind -> timeout id
function broadcast(kind, extra = {}) {
  clearTimeout(pendingBroadcasts.get(kind))
  pendingBroadcasts.set(
    kind,
    setTimeout(() => {
      pendingBroadcasts.delete(kind)
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('granula:changed', { kind, ...extra })
      }
    }, 120),
  )
}

let meetingsWatcher = null
let keysWatcher = null
function startWatchers() {
  ensureDirs()
  try {
    meetingsWatcher = fs.watch(MEETINGS_DIR, { recursive: true }, (_evt, filename) => {
      if (!filename) return broadcast('meetings')
      // Only care about meeting.json changes or directory add/remove.
      if (filename.endsWith('meeting.json') || !filename.includes(path.sep + 'meeting.json') === false || !filename.includes('.')) {
        // Extract id from first path segment
        const id = filename.split(path.sep)[0]
        broadcast('meetings', { id })
      }
    })
  } catch (err) {
    console.warn('meetings watcher failed:', err.message)
  }
  try {
    keysWatcher = fs.watch(GRANULA_DIR, (_evt, filename) => {
      if (filename === 'keys.json') broadcast('keys')
    })
  } catch (err) {
    console.warn('keys watcher failed:', err.message)
  }
}

// --- Auto updates via electron-updater + GitHub Releases ---
// Publishes and downloads from the `publish` block in package.json.
// Flow: on app start we check for updates; if one is found it downloads in
// the background and the renderer shows a prompt via the `updater:*` events.
autoUpdater.logger = log
log.transports.file.level = 'info'
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function sendToAll(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

autoUpdater.on('checking-for-update', () => sendToAll('updater:checking'))
autoUpdater.on('update-available', (info) =>
  sendToAll('updater:available', { version: info.version, notes: info.releaseNotes }),
)
autoUpdater.on('update-not-available', () => sendToAll('updater:none'))
autoUpdater.on('error', (err) =>
  sendToAll('updater:error', { message: err?.message || String(err) }),
)
autoUpdater.on('download-progress', (p) =>
  sendToAll('updater:progress', {
    percent: p.percent,
    transferred: p.transferred,
    total: p.total,
    bytesPerSecond: p.bytesPerSecond,
  }),
)
autoUpdater.on('update-downloaded', (info) =>
  sendToAll('updater:downloaded', { version: info.version }),
)

ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates())
ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())
ipcMain.handle('updater:version', () => app.getVersion())

app.on('will-quit', () => {
  try { meetingsWatcher?.close() } catch (_e) {}
  try { keysWatcher?.close() } catch (_e) {}
})

app.whenReady().then(() => {
  ensureDirs()
  buildAppMenu()
  startWatchers()
  NoteTaker.registerHandler(session.defaultSession)

  // IPC — meetings
  ipcMain.handle('meetings:list', () => listMeetings())
  ipcMain.handle('meetings:get', (_e, id) => getMeeting(id))
  ipcMain.handle('meetings:save', (_e, meeting) => saveMeeting(meeting))
  ipcMain.handle('meetings:delete', (_e, id) => deleteMeeting(id))
  ipcMain.handle('meetings:openFolder', () => shell.openPath(GRANULA_DIR))

  // IPC — keys
  ipcMain.handle('keys:get', () => loadKeys())
  ipcMain.handle('keys:set', (_e, keys) => { saveKeys(keys); return true })

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'Granula',
    // Custom title bar: hide native chrome but keep macOS traffic lights.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    frame: process.platform === 'darwin', // mac keeps hiddenInset; win/linux fully frameless
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, 'dist-renderer', 'index.html'))
    // Kick off an update check a couple seconds after launch so the UI has
    // time to mount. Dev builds are skipped automatically by electron-updater.
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => log.warn('update check failed', err))
    }, 3000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
