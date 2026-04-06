const { app, BrowserWindow, session, ipcMain, safeStorage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const NoteTaker = require('notetaker-sdk/main')

const isDev = !app.isPackaged

// ~/Documents/Granula — user-visible meetings + transcripts
const GRANULA_DIR = path.join(os.homedir(), 'Documents', 'Granula')
const MEETINGS_DIR = path.join(GRANULA_DIR, 'meetings')
const KEYS_FILE = path.join(GRANULA_DIR, 'keys.enc')

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

// --- Encrypted API key storage via Electron safeStorage ---
function loadKeys() {
  try {
    if (!fs.existsSync(KEYS_FILE)) return { deepgram: '', gemini: '' }
    const buf = fs.readFileSync(KEYS_FILE)
    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(buf.toString('utf8'))
    }
    return JSON.parse(safeStorage.decryptString(buf))
  } catch (err) {
    console.error('loadKeys failed:', err)
    return { deepgram: '', gemini: '' }
  }
}

function saveKeys(keys) {
  ensureDirs()
  const json = JSON.stringify(keys)
  if (!safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(KEYS_FILE, json, 'utf8')
    return
  }
  fs.writeFileSync(KEYS_FILE, safeStorage.encryptString(json))
}

app.whenReady().then(() => {
  ensureDirs()
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
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
