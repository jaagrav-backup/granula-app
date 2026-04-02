const { app, BrowserWindow, session, ipcMain } = require('electron')
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk')
const path = require('path')
const fs   = require('fs')

// ─── macOS 14.2+ CoreAudio Tap ────────────────────────────────────────────────
// Electron v41+ uses Apple's CoreAudio Tap API by default for system audio.
// NSAudioCaptureUsageDescription is in Info.plist via extendInfo in package.json.
// No video source is passed to the display media handler, so macOS never
// triggers the Screen Recording TCC — only the system audio permission fires.
//
// If you hit a silent/dead audio stream during development, uncomment:
// app.commandLine.appendSwitch('disable-features', 'MacCatapLoopbackAudioForScreenShare')
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow     = null
let deepgramLive   = null // active Deepgram live connection

// ─── App bootstrap ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 580,
    resizable: true,
    minWidth: 420,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Audio-only display media handler.
  // Passing { audio: 'loopback' } with no video source routes system audio
  // through Chromium's CoreAudio Tap without capturing screen content.
  // macOS only asks for NSAudioCaptureUsageDescription — not Screen Recording.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({ audio: 'loopback' })
  })

  mainWindow.loadFile('index.html')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: start Deepgram live transcription ───────────────────────────────────
ipcMain.handle('start-transcription', (_event, apiKey) => {
  // Clean up any previous session
  if (deepgramLive) {
    try { deepgramLive.requestClose() } catch {}
    deepgramLive = null
  }

  const dg = createClient(apiKey)

  deepgramLive = dg.listen.live({
    model:            'nova-2',
    language:         'en',
    smart_format:     true,
    interim_results:  true,
    encoding:         'linear16',
    sample_rate:      16000,
    channels:         1,
    endpointing:      300,
  })

  deepgramLive.on(LiveTranscriptionEvents.Open, () => {
    console.log('[deepgram] Connection open')
    mainWindow?.webContents.send('deepgram-ready')
  })

  deepgramLive.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data?.channel?.alternatives?.[0]
    if (!alt?.transcript) return
    mainWindow?.webContents.send('transcript', {
      text:    alt.transcript,
      isFinal: data.is_final ?? false,
    })
  })

  deepgramLive.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('[deepgram] Error:', err)
    mainWindow?.webContents.send('deepgram-error', String(err))
  })

  deepgramLive.on(LiveTranscriptionEvents.Close, () => {
    console.log('[deepgram] Connection closed')
  })
})

// ─── IPC: stream PCM audio chunk to Deepgram ─────────────────────────────────
// Renderer batches ~256ms of Int16 PCM before sending to keep IPC calls low.
ipcMain.on('audio-chunk', (_event, arrayBuffer) => {
  if (deepgramLive?.getReadyState() === 1 /* OPEN */) {
    deepgramLive.send(arrayBuffer)
  }
})

// ─── IPC: stop Deepgram connection ────────────────────────────────────────────
ipcMain.handle('stop-transcription', () => {
  if (deepgramLive) {
    try { deepgramLive.requestClose() } catch {}
    deepgramLive = null
  }
})

// ─── IPC: save recording buffer to ~/Downloads ────────────────────────────────
ipcMain.handle('save-recording', (_event, arrayBuffer) => {
  const filePath = path.join(
    app.getPath('downloads'),
    `recording-${Date.now()}.webm`
  )
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer))
  console.log(`[main] Recording saved → ${filePath}`)
  return filePath
})
