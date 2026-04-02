const { app, BrowserWindow, session } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

app.whenReady().then(() => {
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

  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    callback({ audio: 'loopback' })
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
