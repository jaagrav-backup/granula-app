const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const NoteTaker = require('notetaker-sdk/main')

const isDev = !app.isPackaged

app.whenReady().then(() => {
  // Unlock system audio loopback capture for all renderers on this session.
  NoteTaker.registerHandler(session.defaultSession)

  const win = new BrowserWindow({
    width: 560,
    height: 580,
    resizable: true,
    minWidth: 420,
    minHeight: 400,
    webPreferences: {
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
