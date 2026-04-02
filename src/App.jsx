import { useState, useRef, useCallback, useEffect } from 'react'
import { acquireStreams, acquireMicStream, createRecorder, stopCapture, onTrackEnded } from './audio/capture'
import { connect, disconnect, sendAudio } from './transcription/deepgram'
import TranscriptPanel from './components/TranscriptPanel'

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function App() {
  const [status, setStatus] = useState({ text: 'Ready', type: 'idle' })
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dg_key') ?? '')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const [desktopFinal, setDesktopFinal] = useState('')
  const [desktopInterim, setDesktopInterim] = useState('')
  const [micFinal, setMicFinal] = useState('')
  const [micInterim, setMicInterim] = useState('')

  const dgDesktopRef = useRef(null)
  const dgMicRef = useRef(null)
  const desktopRecRef = useRef(null)
  const micRecRef = useRef(null)
  const desktopStreamRef = useRef(null)
  const micStreamRef = useRef(null)
  const timerRef = useRef(null)
  const reconnectingMicRef = useRef(false)
  const recordingRef = useRef(false)

  useEffect(() => {
    localStorage.setItem('dg_key', apiKey.trim())
  }, [apiKey])

  const startTimer = useCallback(() => {
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  /**
   * Re-acquires the mic stream and hooks it up to the existing Deepgram
   * WebSocket. Called when the mic device changes or the mic track ends.
   */
  const reconnectMic = useCallback(async () => {
    if (reconnectingMicRef.current || !recordingRef.current) return
    reconnectingMicRef.current = true

    console.log('[app] mic changed — reconnecting…')

    try {
      // Tear down old mic recorder + stream (but keep the Deepgram socket alive)
      stopCapture(micRecRef.current, micStreamRef.current)
      micRecRef.current = null
      micStreamRef.current = null

      // Close the old Deepgram mic socket and open a fresh one so the new
      // recorder's WebM header is the first thing Deepgram sees.
      disconnect(dgMicRef.current)
      dgMicRef.current = null

      const key = apiKey.trim()
      const newDgMic = await connect(key, (text, isFinal) => {
        if (isFinal) {
          setMicInterim('')
          setMicFinal(prev => {
            if (!text.trim()) return prev
            return prev + (prev ? ' ' : '') + text.trim()
          })
        } else {
          setMicInterim(text)
        }
      })
      dgMicRef.current = newDgMic

      // Grab the new mic stream
      const newMicStream = await acquireMicStream()
      micStreamRef.current = newMicStream

      // Create a new recorder wired to the new Deepgram socket
      micRecRef.current = createRecorder(
        new MediaStream(newMicStream.getAudioTracks()),
        buf => sendAudio(dgMicRef.current, buf),
      )

      // Watch the new stream's tracks for future disconnects
      onTrackEnded(newMicStream, reconnectMic)

      console.log('[app] mic reconnected successfully')
    } catch (err) {
      console.error('[app] mic reconnect failed:', err)
    } finally {
      reconnectingMicRef.current = false
    }
  }, [apiKey])

  // Listen for OS-level audio device changes (e.g. Bluetooth headset connects)
  useEffect(() => {
    const handleDeviceChange = () => {
      if (recordingRef.current) reconnectMic()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [reconnectMic])

  const startRecording = useCallback(async () => {
    const key = apiKey.trim()
    if (!key) {
      setStatus({ text: 'Enter a Deepgram API key first', type: 'idle' })
      return
    }

    setDesktopFinal('')
    setDesktopInterim('')
    setMicFinal('')
    setMicInterim('')

    try {
      setStatus({ text: 'Requesting system audio…', type: 'working' })
      const { desktopStream, micStream } = await acquireStreams()
      desktopStreamRef.current = desktopStream
      micStreamRef.current = micStream

      setStatus({ text: 'Connecting to Deepgram…', type: 'working' })

      const [dgDesktop, dgMic] = await Promise.all([
        connect(key, (text, isFinal) => {
          if (isFinal) {
            setDesktopInterim('')
            setDesktopFinal(prev => {
              if (!text.trim()) return prev
              return prev + (prev ? ' ' : '') + text.trim()
            })
          } else {
            setDesktopInterim(text)
          }
        }),
        connect(key, (text, isFinal) => {
          if (isFinal) {
            setMicInterim('')
            setMicFinal(prev => {
              if (!text.trim()) return prev
              return prev + (prev ? ' ' : '') + text.trim()
            })
          } else {
            setMicInterim(text)
          }
        }),
      ])

      dgDesktopRef.current = dgDesktop
      dgMicRef.current = dgMic

      setStatus({ text: 'Recording…', type: 'recording' })

      desktopRecRef.current = createRecorder(
        new MediaStream(desktopStream.getAudioTracks()),
        buf => sendAudio(dgDesktop, buf),
      )
      micRecRef.current = createRecorder(
        new MediaStream(micStream.getAudioTracks()),
        buf => sendAudio(dgMic, buf),
      )

      // Watch for mic track ending (device unplugged, Bluetooth disconnect, etc.)
      onTrackEnded(micStream, reconnectMic)

      setRecording(true)
      recordingRef.current = true
      startTimer()
    } catch (err) {
      console.error('[app] start failed:', err)
      setStatus({ text: `Error: ${err.message}`, type: 'idle' })
      stopCapture(desktopRecRef.current, desktopStreamRef.current)
      stopCapture(micRecRef.current, micStreamRef.current)
    }
  }, [apiKey, startTimer, reconnectMic])

  const stopRecording = useCallback(() => {
    stopTimer()
    setDesktopInterim('')
    setMicInterim('')

    disconnect(dgDesktopRef.current)
    dgDesktopRef.current = null
    disconnect(dgMicRef.current)
    dgMicRef.current = null

    stopCapture(desktopRecRef.current, desktopStreamRef.current)
    desktopRecRef.current = desktopStreamRef.current = null
    stopCapture(micRecRef.current, micStreamRef.current)
    micRecRef.current = micStreamRef.current = null

    setRecording(false)
    recordingRef.current = false
    setStatus({ text: 'Stopped', type: 'idle' })
  }, [stopTimer])

  const clearTranscripts = useCallback(() => {
    setDesktopFinal('')
    setDesktopInterim('')
    setMicFinal('')
    setMicInterim('')
  }, [])

  const statusColor = {
    idle: 'text-[#555]',
    recording: 'text-red-500',
    working: 'text-amber-500',
  }[status.type]

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-[#e8e8e8] overflow-hidden select-none">
      <div className="flex items-center justify-between px-[18px] pt-3.5 pb-2.5 shrink-0">
        <div
          className="text-[32px] font-extralight tracking-wider text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatTime(seconds)}
        </div>
        <div className="flex gap-2 no-drag">
          <button
            onClick={clearTranscripts}
            className="bg-transparent text-[#555] border border-[#2a2a2a] px-3 py-2 rounded-lg text-xs font-medium cursor-pointer hover:text-[#888] hover:border-[#444] active:scale-[0.96] transition-all"
          >
            Clear
          </button>
          <button
            onClick={startRecording}
            disabled={recording}
            className="bg-red-600 text-white px-5 py-2 rounded-lg text-[13px] font-medium cursor-pointer active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ● Record
          </button>
          <button
            onClick={stopRecording}
            disabled={!recording}
            className="bg-[#222] text-[#ccc] border border-[#333] px-5 py-2 rounded-lg text-[13px] font-medium cursor-pointer active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ■ Stop
          </button>
        </div>
      </div>

      <div className="px-[18px] pb-2 shrink-0">
        <p className={`text-xs min-h-[16px] ${statusColor}`}>{status.text}</p>
      </div>

      <div className="flex-1 flex gap-2 px-3 min-h-0 pb-1">
        <TranscriptPanel label="System Audio" finalText={desktopFinal} interimText={desktopInterim} />
        <TranscriptPanel label="Microphone" finalText={micFinal} interimText={micInterim} />
      </div>

      <div className="flex items-center gap-2 px-[18px] py-2.5 shrink-0 no-drag">
        <span className="text-[11px] text-[#444] whitespace-nowrap shrink-0">Deepgram key</span>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="dg_…"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md text-[#666] text-[11px] font-mono py-1.5 px-2 outline-none focus:border-[#444] focus:text-[#999] placeholder:text-[#333] select-text"
        />
      </div>
    </div>
  )
}
