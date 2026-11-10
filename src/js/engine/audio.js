// Audio: effect chains (shared by live preview and export), decoding, mixdown, WAV encoding,
// loudness normalisation and background-noise removal.
import { rng, clamp } from '../util.js';

export const AUDIO_PRESETS = [
  { id: 'none', name: 'None' },
  { id: 'voice', name: 'Voice Enhance' },
  { id: 'podcast', name: 'Podcast Voice' },
  { id: 'phone', name: 'Telephone' },
  { id: 'radio', name: 'Old Radio' },
  { id: 'megaphone', name: 'Megaphone' },
  { id: 'echo', name: 'Echo' },
  { id: 'room', name: 'Small Room' },
  { id: 'hall', name: 'Concert Hall' },
  { id: 'church', name: 'Cathedral' },
  { id: 'underwater', name: 'Underwater' },
  { id: 'muffled', name: 'Next Room' },
  { id: 'bass', name: 'Bass Boost' },
  { id: 'robot', name: 'Robot' },
  { id: 'lofi', name: 'Lo-Fi' },
];

export const defaultAudioFx = () => ({ preset: 'none', mix: 1, low: 0, mid: 0, high: 0, lowCut: false, compress: false, denoise: 0, denoisePath: null });

const impulseCache = new Map();
function impulse(ctx, seconds, decay) {
  const key = `${ctx.sampleRate}|${seconds}|${decay}`;
  if (impulseCache.has(key) && impulseCache.get(key).ctx === ctx) return impulseCache.get(key).buf;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng(17 + c * 101);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  impulseCache.set(key, { ctx, buf });
  return buf;
}
function curve(fn, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
}
const filt = (ctx, type, f, q = 0.7, g = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; };

// Builds input -> ... -> output for a clip's audio settings. Returns { input, output, dispose }.
export function buildChain(ctx, fx) {
  fx = { ...defaultAudioFx(), ...(fx || {}) };
  const input = ctx.createGain();
  const nodes = [input];
  let last = input;
  const link = (n) => { last.connect(n); last = n; nodes.push(n); return n; };
  if (fx.lowCut) link(filt(ctx, 'highpass', 85, 0.7));
  if (fx.low) link(filt(ctx, 'lowshelf', 220, 0.7, fx.low));
  if (fx.mid) link(filt(ctx, 'peaking', 1200, 0.9, fx.mid));
  if (fx.high) link(filt(ctx, 'highshelf', 4500, 0.7, fx.high));

  const output = ctx.createGain();
  const sources = [];
  if (fx.preset && fx.preset !== 'none') {
    const dry = ctx.createGain(), wet = ctx.createGain();
    dry.gain.value = 1 - clamp(fx.mix ?? 1);
    wet.gain.value = clamp(fx.mix ?? 1);
    last.connect(dry); dry.connect(output);
    let w = last;
    const chain = (n) => { w.connect(n); w = n; nodes.push(n); return n; };
    const shaper = (amt) => { const s = ctx.createWaveShaper(); s.curve = curve((x) => Math.tanh(x * amt) / Math.tanh(amt)); return s; };
    switch (fx.preset) {
      case 'voice': chain(filt(ctx, 'highpass', 90)); chain(filt(ctx, 'lowshelf', 200, 0.7, -2)); chain(filt(ctx, 'peaking', 3200, 1, 4)); chain(filt(ctx, 'highshelf', 9000, 0.7, 2)); chain(comp(ctx, -22, 4)); chain(gain(ctx, 1.4)); break;
      case 'podcast': chain(filt(ctx, 'highpass', 80)); chain(filt(ctx, 'peaking', 150, 1, 3)); chain(filt(ctx, 'peaking', 400, 1.2, -3)); chain(filt(ctx, 'peaking', 4000, 1, 3)); chain(comp(ctx, -26, 6)); chain(gain(ctx, 1.8)); break;
      case 'phone': chain(filt(ctx, 'highpass', 400, 1)); chain(filt(ctx, 'lowpass', 3000, 1)); chain(shaper(2)); chain(gain(ctx, 1.3)); break;
      case 'radio': chain(filt(ctx, 'highpass', 500, 1)); chain(filt(ctx, 'lowpass', 4000, 1)); chain(filt(ctx, 'peaking', 1500, 1, 6)); chain(shaper(3)); chain(gain(ctx, 0.8)); break;
      case 'megaphone': chain(filt(ctx, 'highpass', 800, 1.5)); chain(filt(ctx, 'lowpass', 3000, 1.5)); chain(shaper(9)); chain(gain(ctx, 0.6)); break;
      case 'underwater': chain(filt(ctx, 'lowpass', 450, 2)); chain(gain(ctx, 1.4)); break;
      case 'muffled': chain(filt(ctx, 'lowpass', 900, 0.7)); chain(filt(ctx, 'lowshelf', 150, 0.7, 4)); break;
      case 'bass': chain(filt(ctx, 'lowshelf', 120, 0.7, 10)); chain(comp(ctx, -12, 3)); break;
      case 'lofi': chain(filt(ctx, 'highpass', 200)); chain(filt(ctx, 'lowpass', 3500)); { const s = ctx.createWaveShaper(); s.curve = curve((x) => Math.round(x * 24) / 24); chain(s); } chain(gain(ctx, 0.9)); break;
      case 'robot': {
        const ring = ctx.createGain(); ring.gain.value = 0;
        const osc = ctx.createOscillator(); osc.frequency.value = 55; osc.type = 'sine';
        osc.connect(ring.gain); osc.start(); sources.push(osc);
        chain(ring); chain(filt(ctx, 'highpass', 150)); chain(gain(ctx, 1.8));
        break;
      }
      case 'echo': {
        const sum = ctx.createGain();
        const d = ctx.createDelay(2); d.delayTime.value = 0.32;
        const fb = ctx.createGain(); fb.gain.value = 0.42;
        const tone = filt(ctx, 'lowpass', 3500);
        w.connect(sum); w.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(sum);
        nodes.push(sum, d, fb, tone); w = sum;
        break;
      }
      case 'room': case 'hall': case 'church': {
        const [sec, dec, wetAmt] = { room: [0.7, 3, 0.35], hall: [2.4, 2.2, 0.45], church: [4.8, 1.6, 0.55] }[fx.preset];
        const sum = ctx.createGain();
        const cv = ctx.createConvolver(); cv.buffer = impulse(ctx, sec, dec);
        const wg = gain(ctx, wetAmt);
        w.connect(sum); w.connect(cv); cv.connect(wg); wg.connect(sum);
        nodes.push(sum, cv, wg); w = sum;
        break;
      }
      default: break;
    }
    w.connect(wet); wet.connect(output);
    nodes.push(dry, wet);
  } else {
    last.connect(output);
  }
  let out = output;
  if (fx.compress) {
    const c = comp(ctx, -20, 4);
    const mk = gain(ctx, 1.5);
    output.connect(c); c.connect(mk);
    nodes.push(c, mk);
    out = mk;
  }
  nodes.push(output);
  return {
    input,
    output: out,
    dispose() { sources.forEach((s) => { try { s.stop(); } catch { /* */ } }); nodes.forEach((n) => { try { n.disconnect(); } catch { /* */ } }); },
  };
}
function comp(ctx, thr, ratio) { const c = ctx.createDynamicsCompressor(); c.threshold.value = thr; c.ratio.value = ratio; c.attack.value = 0.005; c.release.value = 0.15; c.knee.value = 6; return c; }
function gain(ctx, v) { const g = ctx.createGain(); g.gain.value = v; return g; }

// ---------- decoding ----------
const decodeCache = new Map(); // path -> Promise<AudioBuffer|null>
let decodeCtx = null;
export function decodeFile(path) {
  if (!decodeCache.has(path)) {
    decodeCache.set(path, (async () => {
      try {
        decodeCtx ||= new OfflineAudioContext(2, 1, 48000);
        const data = await window.native.readBinary(path);
        return await decodeCtx.decodeAudioData(data);
      } catch { return null; }
    })());
  }
  return decodeCache.get(path);
}
export const forgetDecoded = (path) => decodeCache.delete(path);

export function peaksFrom(buf, perSec = 50) {
  const n = Math.max(1, Math.ceil(buf.duration * perSec));
  const out = new Float32Array(n);
  const step = buf.sampleRate / perSec;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      let m = 0;
      const s0 = Math.floor(i * step), s1 = Math.min(d.length, Math.floor((i + 1) * step));
      for (let s = s0; s < s1; s += 4) { const v = Math.abs(d[s]); if (v > m) m = v; }
      if (m > out[i]) out[i] = m;
    }
  }
  return out;
}

// Gain that brings the loudest sample in [from, to) seconds of the buffer to -1 dBFS.
export function normalizeGain(buf, from = 0, to = Infinity) {
  let peak = 0;
  const s0 = Math.max(0, Math.floor(from * buf.sampleRate)), s1 = Math.min(buf.length, Math.floor(to * buf.sampleRate));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = s0; i < s1; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  }
  if (peak < 1e-4) return 1;
  return Math.min(8, 0.891 / peak);
}

// ---------- WAV ----------
export function encodeWav(buf) {
  const ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, len = buf.length;
  const out = new ArrayBuffer(44 + len * ch * 2);
  const v = new DataView(out);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return out;
}

// ---------- noise removal ----------
// Spectral gating in a worker; writes a cleaned WAV of the whole source file into the cache.
export async function denoiseSource(path, level, onProgress) {
  const buf = await decodeFile(path);
  if (!buf) throw new Error('This clip has no audio that can be read.');
  const name = `denoise-${btoa(unescape(encodeURIComponent(path))).replace(/[^a-z0-9]/gi, '').slice(-40)}-${level}.wav`;
  const cached = await window.native.cachePath(name);
  if (await window.native.exists(cached)) return cached;
  const chans = [...Array(Math.min(2, buf.numberOfChannels))].map((_, c) => buf.getChannelData(c).slice());
  const worker = new Worker(new URL('./denoise-worker.js', import.meta.url));
  const cleaned = await new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.progress != null) onProgress?.(e.data.progress);
      else if (e.data.channels) resolve(e.data.channels);
      else reject(new Error(e.data.error || 'Noise removal failed.'));
    };
    worker.onerror = (e) => reject(new Error(e.message));
    worker.postMessage({ channels: chans, sampleRate: buf.sampleRate, level }, chans.map((c) => c.buffer));
  }).finally(() => worker.terminate());
  const out = new AudioBuffer({ numberOfChannels: cleaned.length, length: cleaned[0].length, sampleRate: buf.sampleRate });
  cleaned.forEach((d, c) => out.copyToChannel(d, c));
  return window.native.cacheWrite(name, encodeWav(out));
}
