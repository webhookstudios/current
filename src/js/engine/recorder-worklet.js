// Voiceover capture: copies microphone samples off the audio thread in blocks, each tagged with the
// audio-clock frame it started at, so the recording can be cut to start exactly at the playhead.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(4096);
    this.n = 0;
    this.first = 0;
    this.on = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }

  flush() {
    if (!this.n) return;
    this.port.postMessage({ frame: this.first, data: this.buf.slice(0, this.n) });
    this.n = 0;
  }

  process(inputs) {
    if (!this.on) return false;
    const ch = inputs[0]?.[0]; // mono: the stream is opened with one channel
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        if (this.n === 0) this.first = currentFrame + i;
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.flush();
      }
    }
    return true;
  }
}

registerProcessor('current-capture', Capture);
