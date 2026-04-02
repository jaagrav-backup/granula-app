/**
 * Audio capture — acquires system audio and microphone streams,
 * and wraps them in MediaRecorder instances.
 *
 * This module knows nothing about Deepgram or the DOM.
 * It just produces streams and hands raw audio chunks to whoever asks.
 */

/**
 * Acquires the system audio stream (CoreAudio Tap via Electron's display
 * media handler) and the microphone stream.
 * @returns {{ desktopStream: MediaStream, micStream: MediaStream }}
 */
export async function acquireStreams() {
  const desktopStream = await navigator.mediaDevices.getDisplayMedia({
    video: false,
    audio: true,
  })

  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  })

  return { desktopStream, micStream }
}

/**
 * Wraps a MediaStream in a MediaRecorder that fires onChunk every 250ms.
 * Uses webm/opus natively — no AudioContext or PCM conversion needed.
 *
 * @param {MediaStream} stream
 * @param {(buffer: ArrayBuffer) => void} onChunk
 * @returns {MediaRecorder}
 */
export function createRecorder(stream, onChunk) {
  const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

  rec.ondataavailable = async ({ data }) => {
    if (data.size > 0) onChunk(await data.arrayBuffer())
  }

  rec.start(250)
  return rec
}

/**
 * Stops a MediaRecorder and all tracks on both streams.
 * @param {MediaRecorder|null} rec
 * @param {MediaStream|null} stream
 */
export function stopCapture(rec, stream) {
  rec?.stop()
  stream?.getTracks().forEach(t => t.stop())
}
