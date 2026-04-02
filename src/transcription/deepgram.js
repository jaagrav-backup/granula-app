/**
 * Deepgram streaming transcription.
 *
 * This module knows nothing about audio capture or the DOM.
 * It opens a WebSocket to Deepgram and fires a callback with transcript results.
 */

const DG_URL =
  "wss://api.deepgram.com/v1/listen" +
  "?model=nova-3" +
  "&language=multi" +
  "&smart_format=true" +
  "&interim_results=true" +
  "&encoding=opus" +
  "&endpointing=300";

/**
 * Opens a Deepgram live transcription WebSocket.
 * Returns a Promise that resolves with the WebSocket once connected —
 * callers must await this before sending any audio so the WebM header
 * (first MediaRecorder chunk) is never dropped on a slow handshake.
 *
 * @param {string} apiKey
 * @param {(text: string, isFinal: boolean) => void} onTranscript
 * @returns {Promise<WebSocket>}
 */
export function connect(apiKey, onTranscript) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DG_URL, ["token", apiKey]);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => {
      console.error("[deepgram] error", e);
      reject(e);
    };
    ws.onclose = (e) => console.log(`[deepgram] closed (${e.code})`);

    ws.onmessage = ({ data }) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      const text = msg?.channel?.alternatives?.[0]?.transcript;
      if (text != null) onTranscript(text, msg.is_final ?? false);
    };
  });
}

/**
 * Gracefully closes a Deepgram WebSocket by sending CloseStream first,
 * giving Deepgram time to flush any buffered transcript before disconnecting.
 * @param {WebSocket|null} ws
 */
export function disconnect(ws) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "CloseStream" }));
    setTimeout(() => ws.close(), 1500);
  }
}

/**
 * Sends a raw audio buffer to an open Deepgram WebSocket.
 * No-ops silently if the socket isn't ready.
 * @param {WebSocket|null} ws
 * @param {ArrayBuffer} buffer
 */
export function sendAudio(ws, buffer) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(buffer);
}
