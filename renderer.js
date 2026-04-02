// ─── State ────────────────────────────────────────────────────────────────────
let mediaRecorder   = null
let recordedChunks  = []
let audioCtx        = null
let desktopStream   = null
let micStream       = null
let workletNode     = null
let finalTranscript = ''

// PCM batching — accumulate ~256ms of audio before sending over IPC
// (16000 Hz × 0.256s = 4096 samples)
let pcmBatch       = []
let pcmBatchLength = 0
const BATCH_SIZE   = 4096

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const startBtn     = document.getElementById('startBtn')
const stopBtn      = document.getElementById('stopBtn')
const statusEl     = document.getElementById('status')
const savedEl      = document.getElementById('saved')
const timerEl      = document.getElementById('timer')
const transcriptEl = document.getElementById('transcript')
const interimEl    = document.getElementById('interim')
const apiKeyInput  = document.getElementById('apiKey')
const clearBtn     = document.getElementById('clearBtn')

// ─── Persist API key ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'deepgram_api_key'
apiKeyInput.value = localStorage.getItem(STORAGE_KEY) ?? ''
apiKeyInput.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim())
})

// ─── Timer ────────────────────────────────────────────────────────────────────
let timerInterval  = null
let secondsElapsed = 0

function startTimer() {
  secondsElapsed = 0
  timerEl.textContent = '00:00'
  timerInterval = setInterval(() => {
    secondsElapsed++
    const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0')
    const s = String(secondsElapsed % 60).padStart(2, '0')
    timerEl.textContent = `${m}:${s}`
  }, 1000)
}

function stopTimer() {
  clearInterval(timerInterval)
  timerInterval = null
}

// ─── Status ───────────────────────────────────────────────────────────────────
function setStatus(msg, type = 'idle') {
  statusEl.textContent = msg
  statusEl.className = `status ${type}`
}

// ─── Transcript display ───────────────────────────────────────────────────────
function appendFinal(text) {
  if (!text.trim()) return
  finalTranscript += (finalTranscript ? ' ' : '') + text.trim()
  // Rebuild text content before the interim span
  transcriptEl.childNodes.forEach(n => { if (n !== interimEl) n.remove() })
  transcriptEl.insertBefore(document.createTextNode(finalTranscript + ' '), interimEl)
  scrollTranscript()
}

function setInterim(text) {
  interimEl.textContent = text
  scrollTranscript()
}

function scrollTranscript() {
  const box = document.getElementById('transcriptBox')
  box.scrollTop = box.scrollHeight
}

// ─── Float32 → Int16 PCM conversion ──────────────────────────────────────────
function float32ToInt16(float32) {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// ─── Flush batched PCM to main process ───────────────────────────────────────
function flushPCMBatch() {
  if (!pcmBatchLength) return
  const merged = new Int16Array(pcmBatchLength)
  let offset = 0
  for (const chunk of pcmBatch) { merged.set(chunk, offset); offset += chunk.length }
  window.electronAPI.sendAudioChunk(merged.buffer)
  pcmBatch = []
  pcmBatchLength = 0
}

// ─── Best mime type for MediaRecorder ────────────────────────────────────────
function getBestMimeType() {
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m)) ?? ''
  )
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  workletNode?.disconnect()
  workletNode = null
  pcmBatch = []
  pcmBatchLength = 0
  desktopStream?.getTracks().forEach(t => t.stop())
  micStream?.getTracks().forEach(t => t.stop())
  desktopStream = micStream = null
  if (audioCtx) {
    try { await audioCtx.close() } catch {}
    audioCtx = null
  }
  window.electronAPI.removeTranscriptListeners()
}

// ─── Start recording ──────────────────────────────────────────────────────────
async function startRecording() {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    setStatus('Enter a Deepgram API key first', 'idle')
    apiKeyInput.focus()
    return
  }

  savedEl.textContent = ''
  recordedChunks = []
  finalTranscript = ''
  transcriptEl.childNodes.forEach(n => { if (n !== interimEl) n.remove() })
  setInterim('')

  try {
    // 1. System audio via CoreAudio Tap (no Screen Recording permission)
    setStatus('Requesting system audio…', 'working')
    desktopStream = await navigator.mediaDevices.getDisplayMedia({
      video: false,
      audio: true,
    })

    // 2. Microphone
    setStatus('Requesting microphone…', 'working')
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    })

    // 3. AudioContext at 16 kHz — matches Deepgram's expected sample rate
    audioCtx = new AudioContext({ sampleRate: 16000 })

    const desktopSource = audioCtx.createMediaStreamSource(new MediaStream(desktopStream.getAudioTracks()))
    const micSource     = audioCtx.createMediaStreamSource(new MediaStream(micStream.getAudioTracks()))

    console.log('[renderer] System audio:', desktopStream.getAudioTracks().map(t => t.label))
    console.log('[renderer] Mic:', micStream.getAudioTracks().map(t => t.label))

    // 4. Merge both sources → MediaRecorder (saves .webm)
    const recDest = audioCtx.createMediaStreamDestination()
    desktopSource.connect(recDest)
    micSource.connect(recDest)

    // 5. Load the AudioWorklet from a real file (Blob URLs are blocked in Electron)
    await audioCtx.audioWorklet.addModule('./pcm-worklet.js')
    workletNode = new AudioWorkletNode(audioCtx, 'pcm-worklet')
    desktopSource.connect(workletNode)
    micSource.connect(workletNode)

    // Worklet must connect to *something* to avoid GC; use a silent gain node
    const silence = audioCtx.createGain()
    silence.gain.value = 0
    workletNode.connect(silence)
    silence.connect(audioCtx.destination)

    // 6. Register transcript listeners before starting Deepgram
    window.electronAPI.onTranscript(({ text, isFinal }) => {
      if (isFinal) { setInterim(''); appendFinal(text) }
      else          { setInterim(text) }
    })

    window.electronAPI.onDeepgramReady(() => {
      setStatus('Recording…', 'recording')
    })

    window.electronAPI.onDeepgramError((msg) => {
      setStatus(`Deepgram error: ${msg}`, 'idle')
    })

    // 7. Start Deepgram live session in main process
    setStatus('Connecting to Deepgram…', 'working')
    await window.electronAPI.startTranscription(apiKey)

    // 8. Route batched PCM from worklet → main process → Deepgram
    workletNode.port.onmessage = (e) => {
      const chunk = float32ToInt16(e.data)
      pcmBatch.push(chunk)
      pcmBatchLength += chunk.length
      if (pcmBatchLength >= BATCH_SIZE) flushPCMBatch()
    }

    // 9. MediaRecorder for local .webm file
    const mimeType = getBestMimeType()
    mediaRecorder = new MediaRecorder(recDest.stream, mimeType ? { mimeType } : {})
    mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunks.push(e.data) }
    mediaRecorder.onstop = async () => {
      const blob     = new Blob(recordedChunks, { type: mimeType || 'audio/webm' })
      const filePath = await window.electronAPI.saveRecording(await blob.arrayBuffer())
      savedEl.textContent = `Saved → ${filePath}`
    }
    mediaRecorder.start(1000)

    startBtn.disabled = true
    stopBtn.disabled  = false
    startTimer()

  } catch (err) {
    console.error('[renderer] Start failed:', err)
    setStatus(`Error: ${err.message}`, 'idle')
    await cleanup()
  }
}

// ─── Stop recording ───────────────────────────────────────────────────────────
async function stopRecording() {
  stopTimer()
  setInterim('')

  // Flush any remaining buffered PCM
  flushPCMBatch()

  if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop()

  // Give Deepgram 1.5s to flush its final transcript before closing
  await window.electronAPI.stopTranscription()
  setTimeout(() => cleanup(), 1500)

  startBtn.disabled = false
  stopBtn.disabled  = true
  setStatus('Stopped', 'idle')
}

// ─── Clear transcript ─────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  finalTranscript = ''
  transcriptEl.childNodes.forEach(n => { if (n !== interimEl) n.remove() })
  setInterim('')
  savedEl.textContent = ''
})

startBtn.addEventListener('click', startRecording)
stopBtn.addEventListener('click', stopRecording)
