// AudioWorklet processor — runs on the dedicated audio thread.
// Receives the mixed audio render quantum (128 samples by default),
// copies it, and posts it to the main thread via the MessagePort.
class PCMWorklet extends AudioWorkletProcessor {
  process (inputs) {
    const channel = inputs[0]?.[0]
    if (channel?.length) {
      // slice() copies the underlying Float32Array so it can be transferred
      this.port.postMessage(channel.slice())
    }
    return true // keep processor alive
  }
}

registerProcessor('pcm-worklet', PCMWorklet)
