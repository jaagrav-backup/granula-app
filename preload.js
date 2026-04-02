const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Audio recording ──────────────────────────────────────────────────────
  saveRecording: (arrayBuffer) =>
    ipcRenderer.invoke('save-recording', arrayBuffer),

  // ── Deepgram transcription ───────────────────────────────────────────────
  startTranscription: (apiKey) =>
    ipcRenderer.invoke('start-transcription', apiKey),

  stopTranscription: () =>
    ipcRenderer.invoke('stop-transcription'),

  // Fire-and-forget: send a batched Int16 PCM ArrayBuffer to Deepgram
  sendAudioChunk: (arrayBuffer) =>
    ipcRenderer.send('audio-chunk', arrayBuffer),

  // ── Events from main → renderer ──────────────────────────────────────────
  onDeepgramReady: (cb) =>
    ipcRenderer.on('deepgram-ready', () => cb()),

  onTranscript: (cb) =>
    ipcRenderer.on('transcript', (_e, data) => cb(data)),

  onDeepgramError: (cb) =>
    ipcRenderer.on('deepgram-error', (_e, msg) => cb(msg)),

  // Call this on stop to remove all listeners and avoid leaks
  removeTranscriptListeners: () => {
    ipcRenderer.removeAllListeners('deepgram-ready')
    ipcRenderer.removeAllListeners('transcript')
    ipcRenderer.removeAllListeners('deepgram-error')
  },
})
