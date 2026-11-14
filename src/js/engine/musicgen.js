// Current's music engine. Each library track is a short description (form, chords, instruments,
// groove, intro); this file turns it into a stereo recording entirely in JavaScript, so a track
// sounds the same on every computer and every time it is made.
//
// Pieces: instrument voices (plucked strings, pianos, organ, winds, bells, brass, strings, synths,
// basses), drum kits, a song planner (intro, verses, choruses, a break and an ending), a melody
// writer, voice-led chord parts, reverb, and a final level and limiter stage.
import { rng as xorshift } from '../util.js';

// xorshift's first values are poorly mixed for small seeds, so scramble the seed and skip ahead.
const rng = (seed) => { const g = xorshift((Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0) || 1); for (let i = 0; i < 12; i++) g(); return g; };

export const SR = 44100;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- filters and oscillators ----------
function biquad(type, f, q = 0.707) {
  const s = { x1: 0, x2: 0, y1: 0, y2: 0 };
  s.set = (fr, qq = q) => {
    const w = (TAU * clamp(fr, 20, SR * 0.45)) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * qq);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass
    const a0 = 1 + a;
    s.b0 = b0 / a0; s.b1 = b1 / a0; s.b2 = b2 / a0; s.a1 = (-2 * c) / a0; s.a2 = (1 - a) / a0;
  };
  s.run = (x) => { const y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2; s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y; return y; };
  s.set(f, q);
  return s;
}
// polyBLEP keeps saw and pulse waves from sounding harsh (aliasing) at higher notes
const blep = (t, dt) => (t < dt ? ((t /= dt), t + t - t * t - 1) : t > 1 - dt ? ((t = (t - 1) / dt), t * t + t + t + 1) : 0);

// Note length in samples, with room for the release.
const nlen = (len, rel) => Math.max(1, Math.floor((len + rel) * SR));
// Linear attack, then hold, then a release after the note's length.
function arEnv(i, att, offAt, rel) {
  const a = att > 0 ? Math.min(1, i / att) : 1;
  return i < offAt ? a : a * Math.max(0, 1 - (i - offAt) / rel);
}

// Plucked string (Karplus-Strong): guitar, harp, plucked bass.
function pluck(f, len, r, { bright = 0.5, decay = 3, rel = 0.08, body = 0 } = {}) {
  const ring = Math.min(decay, 4), n = nlen(Math.min(len, ring), rel), N = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(N), out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < N; i++) { const x = r() * 2 - 1; lp += (x - lp) * (0.15 + bright * 0.85); buf[i] = lp; }
  const g = Math.pow(0.001, N / (SR * decay)), w = 0.5 + bright * 0.25;
  const off = Math.floor(Math.min(len, ring) * SR), relS = Math.max(1, rel * SR);
  let p = 0, prev = buf[N - 1], b1 = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[p], y = g * (cur * w + prev * (1 - w));
    prev = cur; buf[p] = y; p = p + 1 === N ? 0 : p + 1;
    let v = cur;
    if (body) { b1 += (v - b1) * body; v = v * 0.6 + b1 * 0.8; } // a little wooden body warmth
    out[i] = v * (i < off ? 1 : Math.max(0, 1 - (i - off) / relS));
  }
  return out;
}

// Two-operator FM: electric piano, bells, glockenspiel, kalimba.
function fm(f, len, { ratio = 1, index = 2, idxDecay = 0.3, decay = 1.5, att = 0.002, rel = 0.15, ratio2 = 0, index2 = 0, idx2Decay = 0.05, sustain = 0 } = {}) {
  const n = nlen(len, rel), out = new Float32Array(n), off = Math.floor(len * SR), relS = rel * SR, attS = att * SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const I = index * Math.exp(-t / idxDecay), m = Math.sin(TAU * f * ratio * t);
    const m2 = ratio2 ? index2 * Math.exp(-t / idx2Decay) * Math.sin(TAU * f * ratio2 * t) : 0;
    const amp = sustain + (1 - sustain) * Math.exp(-t / decay);
    out[i] = Math.sin(TAU * f * t + I * m + m2) * amp * arEnv(i, attS, off, relS);
  }
  return out;
}

// Additive voice: a list of partials [ratio, level, decay seconds (0 = held)].
function additive(f, len, partials, { att = 0.005, rel = 0.12, vib = 0, vibRate = 5.5, vibDelay = 0.2, trem = 0, breath = 0, r = null, inharm = 0 } = {}) {
  const n = nlen(len, rel), out = new Float32Array(n), off = Math.floor(len * SR), relS = rel * SR, attS = att * SR;
  const ph = new Float64Array(partials.length);
  const nf = breath && r ? biquad('bp', f * 2, 1.5) : null;
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = vib ? 1 + vib * Math.min(1, Math.max(0, t - vibDelay) / 0.3) * Math.sin(TAU * vibRate * t) : 1;
    let s = 0;
    for (let k = 0; k < partials.length; k++) {
      const [ra, lv, dc] = partials[k], fr = f * ra * (1 + inharm * ra * ra) * v;
      if (fr > SR * 0.45) continue;
      ph[k] += (TAU * fr) / SR;
      s += Math.sin(ph[k]) * lv * (dc ? Math.exp(-t / dc) : 1);
    }
    if (nf) s += nf.run(r() * 2 - 1) * breath;
    if (trem) s *= 1 - trem * (0.5 + 0.5 * Math.sin(TAU * 5 * t));
    out[i] = s * arEnv(i, attS, off, relS);
  }
  return out;
}

// Subtractive synth: detuned saw or pulse oscillators through a resonant low-pass with its own envelope.
function synth(f, len, { wave = 'saw', duty = 0.5, detune = [0], cutoff = 2000, envAmt = 0, envDecay = 0.2, q = 0.8, att = 0.005, dec = 0, sus = 1, rel = 0.15, vib = 0, vibRate = 5.5, vibDelay = 0.25, glide = 0, drive = 0 } = {}) {
  const n = nlen(len, rel), out = new Float32Array(n), off = Math.floor(len * SR), relS = rel * SR, attS = att * SR;
  const ph = detune.map((_, k) => (k * 0.37) % 1), mul = detune.map((c) => Math.pow(2, c / 1200));
  const lp = biquad('lp', cutoff, q), norm = 1 / Math.sqrt(detune.length);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) lp.set(cutoff + envAmt * Math.exp(-t / envDecay), q);
    const v = (vib ? 1 + vib * Math.min(1, Math.max(0, t - vibDelay) / 0.3) * Math.sin(TAU * vibRate * t) : 1) * (glide ? 1 + glide * Math.exp(-t / 0.05) : 1);
    let s = 0;
    for (let k = 0; k < ph.length; k++) {
      const dt = (f * mul[k] * v) / SR;
      ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1;
      const p = ph[k];
      if (wave === 'saw') s += 2 * p - 1 - blep(p, dt);
      else if (wave === 'tri') s += 1 - 4 * Math.abs(p - 0.5);
      else s += (p < duty ? 1 : -1) + blep(p, dt) - blep((p + 1 - duty) % 1, dt);
    }
    let y = lp.run(s * norm);
    if (drive) y = Math.tanh(y * (1 + drive));
    const amp = dec ? sus + (1 - sus) * Math.exp(-t / dec) : 1;
    out[i] = y * amp * arEnv(i, attS, off, relS);
  }
  return out;
}

// Vowel-shaped harmonics for a soft choir.
function choir(f, len, vowel, r) {
  const F = vowel === 'ah' ? [[730, 1], [1090, 0.5], [2440, 0.2]] : vowel === 'ee' ? [[270, 1], [2290, 0.4], [3010, 0.2]] : [[300, 1], [870, 0.45], [2240, 0.15]];
  const parts = [];
  for (let k = 1; k * f < 5000; k++) {
    let lv = 0; for (const [fc, a] of F) lv += a * Math.exp(-(((k * f - fc) / 140) ** 2));
    if (lv > 0.01) parts.push([k, lv / Math.sqrt(k), 0]);
  }
  if (!parts.length) parts.push([1, 1, 0]);
  return additive(f, len, parts, { att: 0.35, rel: 0.5, vib: 0.006, vibRate: 5, vibDelay: 0.3, breath: 0.03, r });
}

// ---------- instruments ----------
// Each takes (midi note, length in seconds, rng) and returns a mono sample.
const piano = (m, len, r, bright = 1) => {
  const f = mtof(m), parts = [];
  for (let k = 1; k <= 9; k++) parts.push([k, (1 / Math.pow(k, 1.35)) * (k > 3 ? bright : 1), 3.2 / Math.pow(k, 0.7) * (m > 72 ? 0.6 : 1)]);
  const s = additive(f, len, parts, { att: 0.002, rel: 0.25, inharm: 0.00035 });
  for (let i = 0; i < Math.min(s.length, 400); i++) s[i] += (r() * 2 - 1) * 0.15 * Math.exp(-i / 60); // hammer
  return s;
};
const INST = {
  nylon: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.3, decay: 2.4, body: 0.08 }),
  steel: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.8, decay: 3 }),
  muted: (m, len, r) => pluck(mtof(m), Math.min(len, 0.2), r, { bright: 0.45, decay: 0.3, rel: 0.03 }),
  harp: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.55, decay: 4, rel: 0.4 }),
  koto: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.95, decay: 1.6, body: 0.2 }),
  epiano: (m, len) => fm(mtof(m), len, { ratio: 1, index: 1.6, idxDecay: 0.35, decay: 1.8, ratio2: 14, index2: 0.5, idx2Decay: 0.02, rel: 0.2 }),
  wurli: (m, len) => fm(mtof(m), len, { ratio: 1, index: 2.6, idxDecay: 0.6, decay: 1.2, sustain: 0.15, rel: 0.12 }),
  piano: (m, len, r) => piano(m, len, r, 1),
  softpiano: (m, len, r) => piano(m, len, r, 0.35),
  organ: (m, len) => additive(mtof(m), len, [[0.5, 0.45, 0], [1, 1, 0], [2, 0.55, 0], [3, 0.3, 0], [4, 0.22, 0], [6, 0.1, 0], [8, 0.06, 0]], { att: 0.01, rel: 0.05, vib: 0.003, vibRate: 6.5, vibDelay: 0 }),
  flute: (m, len, r) => additive(mtof(m), len, [[1, 1, 0], [2, 0.16, 0], [3, 0.05, 0]], { att: 0.07, rel: 0.12, vib: 0.006, vibDelay: 0.25, breath: 0.12, r }),
  whistle: (m, len, r) => additive(mtof(m), len, [[1, 1, 0], [2, 0.03, 0]], { att: 0.04, rel: 0.08, vib: 0.01, vibRate: 6, vibDelay: 0.15, breath: 0.04, r }),
  ocarina: (m, len, r) => additive(mtof(m), len, [[1, 1, 0], [3, 0.08, 0]], { att: 0.05, rel: 0.1, vib: 0.005, vibDelay: 0.3, breath: 0.06, r }),
  bell: (m, len) => fm(mtof(m), len, { ratio: 3.5, index: 3, idxDecay: 0.9, decay: 2.4, rel: 1.2 }),
  glock: (m, len) => fm(mtof(m), len, { ratio: 3.01, index: 0.9, idxDecay: 0.15, decay: 0.9, rel: 0.6 }),
  celesta: (m, len) => fm(mtof(m), len, { ratio: 4, index: 0.6, idxDecay: 0.1, decay: 0.7, rel: 0.4 }),
  kalimba: (m, len) => fm(mtof(m), len, { ratio: 5.8, index: 1.4, idxDecay: 0.03, decay: 0.55, rel: 0.3 }),
  marimba: (m, len) => additive(mtof(m), len, [[1, 1, 0.45], [4, 0.35, 0.07], [9.9, 0.08, 0.02]], { att: 0.001, rel: 0.2 }),
  vibes: (m, len) => additive(mtof(m), len, [[1, 1, 1.8], [4, 0.25, 0.3]], { att: 0.002, rel: 0.6, trem: 0.4 }),
  steelpan: (m, len) => additive(mtof(m), len, [[1, 1, 0.9], [2.01, 0.5, 0.5], [3.98, 0.2, 0.25], [5.1, 0.06, 0.1]], { att: 0.003, rel: 0.3 }),
  musicbox: (m, len) => fm(mtof(m), Math.min(len, 1.2), { ratio: 7, index: 0.7, idxDecay: 0.05, decay: 0.8, rel: 0.5 }),
  brass: (m, len) => synth(mtof(m), len, { detune: [-6, 6], cutoff: 500, envAmt: 2200, envDecay: 0.25, att: 0.035, rel: 0.12, vib: 0.004 }),
  trumpet: (m, len) => synth(mtof(m), len, { detune: [0], cutoff: 900, envAmt: 3200, envDecay: 0.18, q: 1.2, att: 0.025, rel: 0.1, vib: 0.006, vibDelay: 0.2 }),
  horn: (m, len) => synth(mtof(m), len, { detune: [-4, 4], cutoff: 450, envAmt: 900, envDecay: 0.4, att: 0.08, rel: 0.25, vib: 0.003 }),
  sax: (m, len) => synth(mtof(m), len, { detune: [0, 3], cutoff: 1500, envAmt: 1200, envDecay: 0.12, q: 2, att: 0.04, rel: 0.1, vib: 0.008, vibRate: 5, vibDelay: 0.18, drive: 0.6 }),
  harmonica: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.35, detune: [0, 8], cutoff: 2200, att: 0.03, rel: 0.08, vib: 0.012, vibRate: 6, vibDelay: 0.1 }),
  accordion: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.3, detune: [-10, 0, 10], cutoff: 2600, att: 0.04, rel: 0.08 }),
  strings: (m, len) => synth(mtof(m), len, { detune: [-9, -3, 4, 10], cutoff: 2400, att: 0.3, rel: 0.45, vib: 0.003, vibDelay: 0.1 }),
  pizz: (m, len, r) => pluck(mtof(m), Math.min(len, 0.4), r, { bright: 0.35, decay: 0.5, rel: 0.05, body: 0.15 }),
  warmpad: (m, len) => synth(mtof(m), len, { detune: [-12, 0, 12], cutoff: 900, att: 0.7, rel: 0.9 }),
  glasspad: (m, len) => fm(mtof(m), len, { ratio: 2, index: 0.7, idxDecay: 3, decay: 99, sustain: 1, att: 0.9, rel: 1.2 }),
  darkpad: (m, len) => synth(mtof(m), len, { detune: [-15, -5, 5, 15], cutoff: 420, q: 1.5, att: 1, rel: 1.2 }),
  sawlead: (m, len) => synth(mtof(m), len, { detune: [-7, 7], cutoff: 2800, envAmt: 1500, envDecay: 0.1, att: 0.006, rel: 0.1, vib: 0.005 }),
  squarelead: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.5, cutoff: 2600, att: 0.004, rel: 0.08, vib: 0.004, vibDelay: 0.3 }),
  synthbrass: (m, len) => synth(mtof(m), len, { detune: [-10, 0, 10], cutoff: 700, envAmt: 2500, envDecay: 0.3, q: 1.1, att: 0.02, rel: 0.2 }),
  synthpluck: (m, len) => synth(mtof(m), Math.min(len, 0.5), { detune: [-5, 5], cutoff: 250, envAmt: 4500, envDecay: 0.1, q: 1.4, att: 0.002, dec: 0.25, sus: 0, rel: 0.15 }),
  stab: (m, len) => synth(mtof(m), Math.min(len, 0.3), { detune: [-12, 0, 12], cutoff: 600, envAmt: 3500, envDecay: 0.08, q: 2, att: 0.002, dec: 0.15, sus: 0.2, rel: 0.1 }),
  crunch: (m, len) => synth(mtof(m), len, { detune: [-8, 8], cutoff: 1900, q: 1, drive: 3, att: 0.003, rel: 0.06 }),
  crunchlead: (m, len) => synth(mtof(m), len, { detune: [-5, 5], cutoff: 3200, q: 1.2, drive: 2.2, att: 0.004, rel: 0.12, vib: 0.009, vibRate: 5.5, vibDelay: 0.15 }),
  chip: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.25, cutoff: 9000, att: 0.001, rel: 0.02 }),
  chip8: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.125, cutoff: 9000, att: 0.001, rel: 0.02, vib: 0.01, vibRate: 7, vibDelay: 0.15 }),
  choirOo: (m, len, r) => choir(mtof(m), len, 'oo', r),
  choirAh: (m, len, r) => choir(mtof(m), len, 'ah', r),
  // basses
  sub: (m, len) => synth(mtof(m), len, { wave: 'tri', cutoff: 400, att: 0.004, rel: 0.06 }),
  b808: (m, len) => { const f = mtof(m), n = nlen(len, 0.25), out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * f * (1 + 1.2 * Math.exp(-t / 0.03))) / SR; out[i] = Math.tanh(Math.sin(ph) * 1.6 * Math.exp(-t / Math.max(0.4, len))) * Math.min(1, (n - i) / (0.05 * SR)); } return out; },
  finger: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.22, decay: 1.6, rel: 0.05, body: 0.3 }),
  upright: (m, len, r) => pluck(mtof(m), len, r, { bright: 0.12, decay: 0.9, rel: 0.06, body: 0.4 }),
  synthbass: (m, len) => synth(mtof(m), len, { detune: [0], cutoff: 220, envAmt: 900, envDecay: 0.12, q: 1.3, att: 0.003, rel: 0.06 }),
  acid: (m, len) => synth(mtof(m), len, { detune: [0], cutoff: 260, envAmt: 2600, envDecay: 0.16, q: 7, att: 0.002, rel: 0.05, drive: 0.8 }),
  reese: (m, len) => synth(mtof(m), len, { detune: [-14, 14], cutoff: 520, q: 1, att: 0.01, rel: 0.1, drive: 0.4 }),
  tuba: (m, len) => synth(mtof(m), len, { detune: [0], cutoff: 380, envAmt: 600, envDecay: 0.2, att: 0.03, rel: 0.12 }),
  chipbass: (m, len) => synth(mtof(m), len, { wave: 'tri', cutoff: 9000, att: 0.001, rel: 0.02 }),
  moog: (m, len) => synth(mtof(m), len, { wave: 'pulse', duty: 0.5, detune: [0, -1200], cutoff: 350, envAmt: 1200, envDecay: 0.2, q: 1.6, att: 0.003, rel: 0.06 }),
};

// ---------- drums ----------
function drumHit(type, o, r) {
  const sec = o.len || 0.5, n = Math.floor(sec * SR), out = new Float32Array(n);
  const noise = () => r() * 2 - 1;
  if (type === 'kick' || type === 'tom' || type === 'timp') {
    const f0 = o.f0 || 150, f1 = o.f1 || 48, pd = o.pd || 0.04, dec = o.dec || 0.3; let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / pd); ph += (TAU * f) / SR;
      let v = Math.sin(ph) + (type === 'timp' ? 0.4 * Math.sin(ph * 1.5) + 0.25 * Math.sin(ph * 1.98) : 0);
      v = v * Math.exp(-t / dec) + noise() * (o.click ?? 0.25) * Math.exp(-t / 0.003);
      out[i] = Math.tanh(v * (o.drive || 1.3));
    }
  } else if (type === 'snare') {
    const bp = biquad('bp', o.f || 3200, 0.8), hp = biquad('hp', 900); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += (TAU * (o.tone || 190)) / SR;
      out[i] = Math.sin(ph) * 0.6 * Math.exp(-t / 0.07) + hp.run(bp.run(noise()) * 2.2) * Math.exp(-t / (o.dec || 0.15)) * (o.snappy ?? 1);
    }
  } else if (type === 'clap') {
    const bp = biquad('bp', o.f || 1200, 0.9);
    for (let i = 0; i < n; i++) { const t = i / SR; let e = Math.exp(-t / (o.dec || 0.13)) * 0.7; for (const d of [0, 0.011, 0.022]) if (t >= d) e = Math.max(e, Math.exp(-(t - d) / 0.006)); out[i] = bp.run(noise()) * 3 * e; }
  } else if (type === 'hat' || type === 'shaker' || type === 'brush') {
    const hp = biquad(type === 'brush' ? 'bp' : 'hp', type === 'hat' ? 7500 : type === 'shaker' ? 5000 : 3500, type === 'brush' ? 0.7 : 0.8);
    const att = type === 'hat' ? 0.0005 : type === 'shaker' ? 0.012 : 0.03;
    for (let i = 0; i < n; i++) { const t = i / SR; out[i] = hp.run(noise()) * Math.min(1, t / att) * Math.exp(-t / (o.dec || 0.04)) * 1.4; }
  } else if (type === 'ride' || type === 'crash' || type === 'tamb' || type === 'cowbell') {
    const fr = type === 'cowbell' ? [545, 815] : type === 'tamb' ? [5100, 6800, 8200] : [320, 474, 615, 778, 928, 1152].map((x) => x * (type === 'crash' ? 1.3 : 1));
    const hp = biquad(type === 'cowbell' ? 'bp' : 'hp', type === 'cowbell' ? 2600 : type === 'crash' ? 3000 : 5000, type === 'cowbell' ? 1.2 : 0.7);
    const ph = fr.map(() => r());
    for (let i = 0; i < n; i++) {
      const t = i / SR; let s = 0;
      for (let k = 0; k < fr.length; k++) { ph[k] = (ph[k] + fr[k] / SR) % 1; s += ph[k] < 0.5 ? 1 : -1; }
      s = s / fr.length + (type === 'cowbell' ? 0 : noise() * (type === 'crash' ? 0.9 : 0.35));
      out[i] = hp.run(s) * Math.exp(-t / (o.dec || 1)) * (type === 'ride' ? 0.8 : 1.2);
    }
  } else if (type === 'conga' || type === 'wood' || type === 'stick') {
    const f = o.f || (type === 'conga' ? 220 : type === 'wood' ? 1100 : 2400); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * f * (1 + 0.4 * Math.exp(-t / 0.008))) / SR; out[i] = (Math.sin(ph) + noise() * 0.3 * Math.exp(-t / 0.004)) * Math.exp(-t / (o.dec || (type === 'conga' ? 0.18 : 0.035))); }
  } else if (type === 'rim' || type === 'snap') {
    const bp = biquad('bp', type === 'rim' ? 1700 : 2300, 1.4); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (TAU * 820) / SR; out[i] = (bp.run(noise()) * 2.5 + (type === 'rim' ? Math.sin(ph) * 0.8 : 0)) * Math.exp(-t / (o.dec || 0.025)); }
  } else if (type === 'chipnoise') { // 8-bit noise: held random values
    let v = 0; const hold = o.hold || 6;
    for (let i = 0; i < n; i++) { if (i % hold === 0) v = r() < 0.5 ? -1 : 1; out[i] = v * 0.6 * Math.exp(-i / SR / (o.dec || 0.08)); }
  }
  return out;
}

// Kits: which sound each pattern letter plays. Pattern rows use these keys.
const KITS = {
  pop: { k: ['kick', { f0: 140, dec: 0.32 }], s: ['snare', {}], c: ['clap', {}], h: ['hat', { dec: 0.035 }], o: ['hat', { dec: 0.3, len: 0.4 }], x: ['crash', { dec: 1.5, len: 2 }], t: ['tom', { f0: 180, f1: 110, dec: 0.25 }], u: ['tom', { f0: 130, f1: 80, dec: 0.3 }] },
  punchy: { k: ['kick', { f0: 170, f1: 52, pd: 0.03, dec: 0.25, click: 0.45, drive: 2 }], s: ['snare', { f: 4000, dec: 0.18, tone: 210 }], h: ['hat', { dec: 0.025 }], o: ['hat', { dec: 0.22, len: 0.3 }], x: ['crash', { dec: 1.4, len: 2 }], t: ['tom', { f0: 200, f1: 130, dec: 0.2 }], u: ['tom', { f0: 140, f1: 85, dec: 0.25 }] },
  lofi: { k: ['kick', { f0: 110, f1: 45, dec: 0.35, click: 0.05, drive: 1 }], s: ['snare', { f: 1800, dec: 0.2, tone: 170, snappy: 0.6 }], r: ['rim', {}], h: ['hat', { dec: 0.03 }], b: ['shaker', { dec: 0.06 }], x: ['ride', { dec: 1.2, len: 1.5 }] },
  trap: { k: ['kick', { f0: 120, f1: 40, dec: 0.45 }], c: ['clap', { dec: 0.18 }], s: ['snare', { f: 4500, dec: 0.12 }], h: ['hat', { dec: 0.018 }], o: ['hat', { dec: 0.2, len: 0.3 }], x: ['crash', { dec: 1.8, len: 2.2 }] },
  house: { k: ['kick', { f0: 135, f1: 46, pd: 0.035, dec: 0.28, drive: 1.6 }], c: ['clap', { dec: 0.15 }], h: ['hat', { dec: 0.03 }], o: ['hat', { dec: 0.18, len: 0.25 }], b: ['shaker', { dec: 0.05 }], x: ['crash', { dec: 1.6, len: 2 }], r: ['rim', {}] },
  rock: { k: ['kick', { f0: 155, f1: 55, dec: 0.3, click: 0.5, drive: 1.8 }], s: ['snare', { f: 3400, dec: 0.22, tone: 200 }], h: ['hat', { dec: 0.05 }], o: ['hat', { dec: 0.35, len: 0.4 }], x: ['crash', { dec: 1.8, len: 2.2 }], y: ['ride', { dec: 1 }], t: ['tom', { f0: 220, f1: 140, dec: 0.3 }], u: ['tom', { f0: 150, f1: 90, dec: 0.35 }] },
  jazz: { k: ['kick', { f0: 95, f1: 55, dec: 0.25, click: 0.05, drive: 1 }], s: ['brush', { dec: 0.12 }], y: ['ride', { dec: 1.4, len: 1.6 }], h: ['hat', { dec: 0.02 }], r: ['rim', { dec: 0.02 }], x: ['ride', { dec: 2, len: 2 }] },
  latin: { k: ['kick', { f0: 100, f1: 50, dec: 0.25, drive: 1 }], r: ['rim', {}], b: ['shaker', { dec: 0.07 }], g: ['conga', { f: 330 }], l: ['conga', { f: 220 }], w: ['wood', {}], h: ['hat', { dec: 0.03 }], x: ['ride', { dec: 1.3, len: 1.5 }], c: ['cowbell', { dec: 0.25 }] },
  orchestral: { k: ['timp', { f0: 70, f1: 58, pd: 0.08, dec: 0.9, len: 1.5, click: 0.1, drive: 1 }], u: ['timp', { f0: 95, f1: 82, pd: 0.08, dec: 0.8, len: 1.5, click: 0.1, drive: 1 }], s: ['snare', { f: 2800, dec: 0.12, tone: 230 }], x: ['crash', { dec: 2.4, len: 3 }], h: ['tamb', { dec: 0.15 }] },
  chip: { k: ['kick', { f0: 200, f1: 50, pd: 0.02, dec: 0.1, click: 0, drive: 3 }], s: ['chipnoise', { dec: 0.12, hold: 4 }], h: ['chipnoise', { dec: 0.025, hold: 1 }], o: ['chipnoise', { dec: 0.15, hold: 1 }], x: ['chipnoise', { dec: 0.5, hold: 2, len: 0.8 }] },
  march: { k: ['kick', { f0: 90, f1: 55, dec: 0.4, click: 0.1, drive: 1.2 }], s: ['snare', { f: 3000, dec: 0.14, tone: 240, snappy: 1.3 }], x: ['crash', { dec: 1.6, len: 2 }], h: ['tamb', { dec: 0.12 }], t: ['tom', { f0: 160, f1: 120, dec: 0.2 }] },
  reggae: { k: ['kick', { f0: 105, f1: 48, dec: 0.32 }], r: ['rim', { dec: 0.03 }], s: ['snare', { f: 3600, dec: 0.1, tone: 260, snappy: 0.7 }], h: ['hat', { dec: 0.04 }], o: ['hat', { dec: 0.2, len: 0.3 }], x: ['crash', { dec: 1.4, len: 2 }] },
  soft: { k: ['kick', { f0: 90, f1: 50, dec: 0.3, click: 0.02, drive: 1 }], b: ['shaker', { dec: 0.08 }], s: ['snap', {}], h: ['hat', { dec: 0.02 }], w: ['wood', {}], x: ['ride', { dec: 1.5, len: 2 }] },
  dnb: { k: ['kick', { f0: 160, f1: 50, pd: 0.025, dec: 0.18, click: 0.4, drive: 2 }], s: ['snare', { f: 4200, dec: 0.16, tone: 220 }], h: ['hat', { dec: 0.02 }], o: ['hat', { dec: 0.15, len: 0.2 }], x: ['crash', { dec: 1.5, len: 2 }], y: ['ride', { dec: 0.8 }] },
  cinematic: { k: ['kick', { f0: 80, f1: 35, pd: 0.08, dec: 0.8, len: 1.2, click: 0.2, drive: 2.5 }], s: ['snare', { f: 2400, dec: 0.3, tone: 150 }], x: ['crash', { dec: 3, len: 3.5 }], u: ['timp', { f0: 75, f1: 60, pd: 0.1, dec: 1, len: 1.5, click: 0.2, drive: 1.4 }], h: ['tamb', { dec: 0.1 }] },
};

// Grooves: A for verses, B for choruses, plus a one-bar fill. 16 steps a bar (12 in 3/4).
// 'x' is a hit, 'o' a softer one.
const GROOVES = {
  pop: { kit: 'pop', A: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.....x.x.x.....', s: '....x.......x...', c: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', o: '..............x.' }, fill: { k: 'x.......', s: '....xxxx', t: '........', u: '........' } },
  disco: { kit: 'pop', A: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.' }, B: { k: 'x...x...x...x...', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' }, fill: { s: 'x.x.xxxx', t: '........' } },
  rock: { kit: 'rock', A: { k: 'x.x...x.x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.x...x.x.x...x.', s: '....x.......x...', o: 'x...x...x...x...', y: '..x...x...x...x.' }, fill: { s: 'x.x.', t: '..xx', u: 'xx..' } },
  punk: { kit: 'punchy', A: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.x.x.x.x.x.x.x.', s: '..x...x...x...x.', o: 'x.x.x.x.x.x.x.x.' }, fill: { s: 'xxxxxxxx', t: '........' } },
  halftime: { kit: 'cinematic', A: { k: 'x...........x...', s: '........x.......', h: '....x.......x...' }, B: { k: 'x.....x.....x...', s: '........x.......', u: '..............xx', h: 'x.x.x.x.x.x.x.x.' }, fill: { u: 'x.x.xxxx', s: '........' } },
  lofi: { kit: 'lofi', A: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.xox.xox.xox.xo' }, B: { k: 'x.....x.x.x.....', s: '....x.......x..o', h: 'x.xox.xox.xox.xo', b: '..x...x...x...x.' }, fill: { s: 'x..x..x.', k: '........' } },
  boombap: { kit: 'lofi', A: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.....x..xx.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: '..............x.' }, fill: { s: '..x.x.xx' } },
  trap: { kit: 'trap', A: { k: 'x.........x.....', c: '........x.......', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x......x..x...x.', c: '........x.......', h: 'x.xxx.x.xxxxx.xx', o: '......x.........' }, fill: { h: 'xxxxxxxx', c: '......x.' } },
  house: { kit: 'house', A: { k: 'x...x...x...x...', h: '..x...x...x...x.', b: 'x.xxx.xxx.xxx.xx' }, B: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'xxxxxxxxxxxxxxxx' }, fill: { c: 'x.x.xxxx', k: 'x...x...' } },
  techno: { kit: 'house', A: { k: 'x...x...x...x...', h: '..x...x...x...x.', r: '...x..x.......x.' }, B: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', r: '...x..x....x..x.' }, fill: { r: 'xxxxxxxx' } },
  dnb: { kit: 'dnb', A: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.........xx....', s: '....x..x.x..x...', h: 'x.xxx.xxx.xxx.xx', y: 'x...x...x...x...' }, fill: { s: 'x.xxx.xx' } },
  jazz: { kit: 'jazz', A: { y: 'x...x..xx...x..x', h: '....x.......x...', k: 'x...............', s: '........o.......' }, B: { y: 'x...x..xx...x..x', h: '....x.......x...', k: 'x.....o.x.......', s: '....o.......o..o' }, fill: { s: 'o.o.o.oo' } },
  brushes: { kit: 'jazz', A: { s: 'x.o.x.o.x.o.x.o.', k: 'x.......x.......', h: '....x.......x...' }, B: { s: 'x.o.x.o.x.o.x.o.', y: 'x...x..xx...x..x', k: 'x.......x.......', h: '....x.......x...' }, fill: { s: 'xoxoxoxo' } },
  shuffle: { kit: 'jazz', A: { k: 'x.....x.x.......', s: '....x.......x...', y: 'x..x..x..x..x..x' }, B: { k: 'x.....x.x.....x.', s: '....x.......x...', y: 'x..x..x..x..x..x', h: '....x.......x...' }, fill: { s: 'x..x..xx' } },
  bossa: { kit: 'latin', A: { k: 'x..x..x.x..x..x.', r: '..x..x....x..x..', b: 'xoxoxoxoxoxoxoxo' }, B: { k: 'x..x..x.x..x..x.', r: '..x..x....x..x..', b: 'xoxoxoxoxoxoxoxo', g: '......x.......x.' }, fill: { r: 'x.x.x.xx' } },
  latin: { kit: 'latin', A: { k: 'x...x...x...x...', g: '..x...x.x.x...x.', l: 'x.......x.......', b: 'xoxoxoxoxoxoxoxo' }, B: { k: 'x...x...x...x...', g: '..x.x.x.x.x.x.x.', l: 'x..x....x..x....', b: 'xoxoxoxoxoxoxoxo', c: 'x...x...x...x...' }, fill: { g: 'xxxxxxxx', l: 'x.x.x.x.' } },
  reggae: { kit: 'reggae', A: { k: '........x.......', r: '........x.......', h: 'x.x.x.x.x.x.x.x.' }, B: { k: '........x.......', s: '........x.......', h: 'x.xox.xox.xox.xo', o: '......x.......x.' }, fill: { s: 'x.x.x.xx', k: 'x.......' } },
  march: { kit: 'march', A: { k: 'x.......x.......', s: '....x.xx....x.xx', h: '..x...x...x...x.' }, B: { k: 'x.......x.......', s: 'x.xxx.xxx.xxx.xx', x: 'x.......x.......' }, fill: { s: 'xxxxxxxx', t: 'x...x...' } },
  waltz: { kit: 'soft', A: { k: 'x...........', s: '....x...x...', h: 'x.x.x.x.x.x.' }, B: { k: 'x...........', s: '....x...x...', b: 'x.xxx.xxx.xx', x: 'x...........' }, fill: { s: 'x.x.xx' } },
  waltz3: { kit: 'orchestral', A: { k: 'x...........', h: '....x...x...' }, B: { k: 'x.....x.....', h: '....x...x...', s: '....x...x...' }, fill: { s: 'xxxxxx' } },
  orchestral: { kit: 'orchestral', A: { k: 'x...........x...', h: '....x.......x...' }, B: { k: 'x.......x.......', u: '....x.......x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, fill: { k: 'xxxx', u: 'xxxx' } },
  epic: { kit: 'cinematic', A: { k: 'x.......x.x.....', u: '......x.......x.', h: '....x.......x...' }, B: { k: 'x.....x.x.x.....', u: '....x.....x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, fill: { u: 'xxxxxxxx', s: '....xxxx' } },
  soft: { kit: 'soft', A: { k: 'x.......x.......', b: '..x...x...x...x.' }, B: { k: 'x.......x.......', b: 'x.xxx.xxx.xxx.xx', s: '....x.......x...' }, fill: { w: 'x.x.x.x.' } },
  tick: { kit: 'soft', A: { w: 'x...x...x...x...', k: 'x.......x.......' }, B: { w: 'x.x.x.x.x.x.x.x.', k: 'x.......x.......', s: '....x.......x...' }, fill: { w: 'xxxxxxxx' } },
  chip: { kit: 'chip', A: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.....x.x.......', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, fill: { s: 'x.x.xxxx' } },
  chipfast: { kit: 'chip', A: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', o: '..x...x...x...x.' }, fill: { s: 'xxxxxxxx' } },
  country: { kit: 'punchy', A: { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }, B: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', o: '..............x.' }, fill: { s: 'x.x.x.xx', t: '........' } },
  funk: { kit: 'punchy', A: { k: 'x..x..x...x..x..', s: '....x.......x..o', h: 'xxxxxxxxxxxxxxxx' }, B: { k: 'x..x..x...x..xx.', s: '....x..o.o..x..o', h: 'xxxxxxxxxxxxxxxo', o: '...............x' }, fill: { s: 'x.xox.xx' } },
  gospel: { kit: 'rock', A: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x.....x.x.x.....', s: '....x.......x...', o: 'x...x...x...x...' }, fill: { s: 'xxx.x.xx', u: '........' } },
  stomp: { kit: 'house', A: { k: 'x.......x.......', c: '....x.......x...' }, B: { k: 'x...x...x...x...', c: '....x.......x...', b: 'x.x.x.x.x.x.x.x.' }, fill: { c: 'x.x.x.xx' } },
  minimal: { kit: 'house', A: { k: 'x...x...x...x...', r: '......x.......x.', h: '..x...x...x...x.' }, B: { k: 'x...x...x...x...', r: '...x..x....x..x.', o: '..x...x...x...x.', c: '........x.......' }, fill: { r: 'x.xxx.xx' } },
  tropical: { kit: 'house', A: { k: 'x...x...x...x...', r: '...x..x....x..x.', b: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x...x...x...x...', c: '....x.......x...', r: '...x..x....x..x.', b: 'xxxxxxxxxxxxxxxx' }, fill: { r: 'x.x.x.x.' } },
  news: { kit: 'punchy', A: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...' }, B: { k: 'x.x.x...x.x.x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..............x.' }, fill: { s: 'xxxxxxxx' } },
  pulse: { kit: 'cinematic', A: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.' }, B: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, fill: { s: 'x.x.xxxx' } },
};

// ---------- harmony ----------
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], penta: [0, 2, 4, 7, 9], mpenta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10],
};
const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
// 'bVII', 'ii7', 'IVmaj7', 'V7', 'vi9', 'Isus4', 'viidim', 'iii' … → { root, tones } in semitones above the key.
function parseChord(tok) {
  const m = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(tok);
  if (!m) throw new Error(`Unknown chord ${tok}`);
  const minor = m[2] === m[2].toLowerCase(), suf = m[3];
  const root = (ROMAN[m[2].toUpperCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0) + 12) % 12;
  let tones = /dim/.test(suf) ? [0, 3, 6] : /aug/.test(suf) ? [0, 4, 8] : /sus4/.test(suf) ? [0, 5, 7] : /sus2/.test(suf) ? [0, 2, 7] : minor ? [0, 3, 7] : [0, 4, 7];
  if (/maj7/.test(suf)) tones.push(11);
  else if (/7|9/.test(suf)) tones.push(/dim7/.test(suf) ? 9 : 10);
  if (/9/.test(suf)) tones.push(14);
  if (/add9/.test(suf)) tones = [...tones.filter((t) => t !== 10), 14];
  if (/6/.test(suf)) tones.push(9);
  return { root, tones };
}
// A progression string: one token per bar; 'ii7-V7' splits a bar in two.
const parseProg = (s) => s.trim().split(/\s+/).map((bar) => bar.split('-').map(parseChord));

// Chord voicing near `center`, moving as little as possible from the last voicing.
function voice(ch, key, center, prev) {
  const pcs = ch.tones.map((t) => (key + ch.root + t) % 12);
  let best = null, bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    let base = center - 7 + ((order[0] - (center - 7)) % 12 + 12) % 12;
    const notes = []; let last = base - 1;
    for (const pc of order) { let n = last + 1 + ((pc - (last + 1)) % 12 + 12) % 12; notes.push(n); last = n; }
    const cost = prev ? notes.reduce((a, n, i) => a + Math.abs(n - (prev[i] ?? prev[prev.length - 1])), 0) : Math.abs(notes[0] - (center - 5));
    if (cost < bestCost && notes[notes.length - 1] < center + 12) { bestCost = cost; best = notes; }
  }
  return best || pcs.map((pc) => center - 6 + ((pc - center + 6) % 12 + 12) % 12).sort((a, b) => a - b);
}

// ---------- melody ----------
const RHY16 = {
  busy: ['x.x.x.x.x.x.xx..', 'x..x..x.x.x.x...', 'x.xxx.x.x...x.x.', 'x.x..xx.x.x.x...', 'xx.x..x.xx.x..x.'],
  sparse: ['x.......x.......', 'x...x.......x...', 'x.....x.x.......', 'x.......x...x...', '....x...x.......'],
  syncop: ['..x..x..x...x...', 'x..x..x...x.x...', '.x.x..x..x..x...', 'x..x...x..x.x...', '...x..x..x....x.'],
  long: ['x...............', 'x.......x.......', 'x...........x...', 'x.......x...x...'],
  hook: ['x.x.x...x.x.x...', 'x..xx...x..xx...', 'x.x...x.x.x...x.', 'x...x.x.x...x.x.'],
};
const RHY12 = {
  busy: ['x.x.x.x.x.x.', 'x..x.xx.x...', 'x.xx..x.x.x.'], sparse: ['x...x...x...', 'x.......x...', 'x...........'],
  syncop: ['..x...x...x.', 'x..x..x.....', '.x..x...x...'], long: ['x...........', 'x.......x...'], hook: ['x.x.x.x.....', 'x...x.x.x...'],
};
const CADENCE16 = ['x.......x.......', 'x...............', 'x...x...x.......', 'x.x.x...........'];
const CADENCE12 = ['x...........', 'x...x...x...', 'x.....x.....'];

// Writes the tune for one section: a two-bar idea, its answer, then a cadence that lands home.
function writeMelody({ r, bars, steps, chordAt, scale, key, center, style, hookRepeat, onBeat }) {
  const R = (steps === 12 ? RHY12 : RHY16)[style] || RHY16.busy, CAD = steps === 12 ? CADENCE12 : CADENCE16;
  const pool = [];
  for (let n = center - 12; n <= center + 14; n++) if (scale.includes((((n - key) % 12) + 12) % 12)) pool.push(n);
  const nearest = (n) => pool.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  const idxOf = (n) => pool.indexOf(nearest(n));
  const chordTone = (n, ch) => {
    const pcs = ch.tones.map((t) => (key + ch.root + t) % 12);
    let best = n, d = 99;
    for (let k = -6; k <= 6; k++) if (pcs.includes((((n + k) % 12) + 12) % 12) && Math.abs(k) < d) { d = Math.abs(k); best = n + k; }
    return clamp(best, pool[0], pool[pool.length - 1]);
  };
  const first = onBeat ? R.filter((x) => x[0] === 'x') : R; // an intro tune starts on the first beat
  const ideaR = [first[Math.floor(r() * first.length)], R[Math.floor(r() * R.length)]];
  const contour = ['arch', 'rise', 'fall', 'wave'][Math.floor(r() * 4)];
  const notes = [];
  let cur = chordTone(center + [0, 2, 4, -3][Math.floor(r() * 4)], chordAt(0, 0));
  let ideaPitches = null;
  for (let bar = 0; bar < bars; bar++) {
    const inPhrase = bar % 4, cadence = inPhrase === 3 || bar === bars - 1;
    const rh = cadence ? CAD[Math.floor(r() * CAD.length)] : ideaR[inPhrase % 2];
    const onsets = [...rh].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
    const reuse = hookRepeat && inPhrase === 2 && ideaPitches; // the hook comes back, moved to fit the chord
    onsets.forEach((s, j) => {
      const ch = chordAt(bar, s);
      if (reuse && j < ideaPitches.length) { cur = chordTone(ideaPitches[j] + (j === 0 ? 0 : 0), ch); }
      else {
        const prog = (bar % 4) / 4 + s / steps / 4;
        const bias = contour === 'rise' ? 0.6 : contour === 'fall' ? -0.6 : contour === 'arch' ? (prog < 0.5 ? 0.5 : -0.5) : Math.sin(prog * TAU) * 0.6;
        const roll = r() + bias * 0.25, step = roll < 0.12 ? 0 : roll < 0.5 ? -1 : roll < 0.88 ? 1 : (r() < 0.5 ? -2 : 2);
        let i = clamp(idxOf(cur) + step + (r() < 0.12 ? (r() < 0.5 ? -3 : 3) : 0), 0, pool.length - 1);
        cur = pool[i];
        if (s % 4 === 0 || cadence) cur = chordTone(cur, ch); // strong beats sit on the chord
      }
      if (cadence && j === onsets.length - 1 && bar === bars - 1) { // the last note of the section goes home
        const home = key + ch.root; let n = home; while (n < cur - 6) n += 12; while (n > cur + 6) n -= 12; cur = clamp(n, pool[0], pool[pool.length - 1]);
      }
      const end = j + 1 < onsets.length ? onsets[j + 1] : steps;
      notes.push({ bar, step: s, len: end - s, n: cur });
    });
    if (inPhrase === 0) ideaPitches = notes.filter((x) => x.bar === bar).map((x) => x.n);
  }
  return notes;
}

// ---------- reverb (Freeverb-style) and the master stage ----------
function reverb(inL, inR, outL, outR, { size = 0.8, damp = 0.35, gain = 1 } = {}) {
  const sc = SR / 44100, combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  for (const [inp, out, sp] of [[inL, outL, 0], [inR, outR, 23]]) {
    const cb = combs.map((c) => ({ b: new Float32Array(Math.round((c + sp) * sc)), i: 0, f: 0 }));
    const ab = aps.map((a) => ({ b: new Float32Array(Math.round((a + sp) * sc)), i: 0 }));
    const fb = 0.7 + size * 0.28;
    for (let n = 0; n < inp.length; n++) {
      const x = inp[n] * 0.015; let y = 0;
      for (const c of cb) { const o = c.b[c.i]; c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * fb; c.i = c.i + 1 === c.b.length ? 0 : c.i + 1; y += o; }
      for (const a of ab) { const o = a.b[a.i]; const v = -y + o; a.b[a.i] = y + o * 0.5; a.i = a.i + 1 === a.b.length ? 0 : a.i + 1; y = v; }
      out[n] += y * gain;
    }
  }
}
function master(L, R, target = 0.13) {
  let sum = 0, cnt = 0;
  for (let i = 0; i < L.length; i += 4) { const v = L[i] * L[i] + R[i] * R[i]; if (v > 1e-7) { sum += v; cnt++; } }
  const g = cnt ? target / Math.sqrt(sum / cnt / 2) : 1;
  let env = 1;
  const B = 64;
  for (let i = 0; i < L.length; i += B) { // gentle block limiter, then soft clipping for the last few peaks
    let pk = 0; for (let j = i; j < Math.min(i + B, L.length); j++) pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j]));
    pk *= g; const want = pk > 0.85 ? 0.85 / pk : 1;
    const start = env; env = want < env ? want : env + (want - env) * 0.02;
    for (let j = i; j < Math.min(i + B, L.length); j++) {
      const e = start + ((env - start) * (j - i)) / B;
      L[j] = Math.tanh(L[j] * g * e * 1.05) * 0.95; R[j] = Math.tanh(R[j] * g * e * 1.05) * 0.95;
    }
  }
}

// ---------- the song ----------
// Renders a track description to { L, R } at SR. Length is bars × beats at the given tempo, plus a tail.
export function renderSong(o, totalSec) {
  const r = rng(o.seed || 1);
  const beatsPerBar = o.beats || 4, steps = beatsPerBar * 4, beat = 60 / o.bpm, barLen = beatsPerBar * beat, stepLen = beat / 4;
  const bars = o.bars, key = 60 + (o.key || 0), scale = SCALES[o.mode || 'major'];
  const n = Math.ceil(totalSec * SR);
  const bus = { mL: new Float32Array(n), mR: new Float32Array(n), dL: new Float32Array(n), dR: new Float32Array(n), wL: new Float32Array(n), wR: new Float32Array(n) };
  const swing = o.swing || 0, human = o.human ? 0.008 : 0;
  const stepTime = (bar, s) => bar * barLen + s * stepLen + (s % 2 ? (swing * beat) / 2 : 0) + (human ? (r() - 0.5) * human * 2 : 0);

  // place a mono sample on a bus with pan, level and reverb send
  const put = (smp, t, vol, pan, send, drums) => {
    const st = Math.floor(t * SR); if (st >= n || st < 0) return;
    const a = (pan + 1) * Math.PI / 4, gl = Math.cos(a) * vol, gr = Math.sin(a) * vol;
    const L = drums ? bus.dL : bus.mL, Rr = drums ? bus.dR : bus.mR, m = Math.min(smp.length, n - st);
    for (let i = 0; i < m; i++) { const v = smp[i]; L[st + i] += v * gl; Rr[st + i] += v * gr; if (send) { bus.wL[st + i] += v * gl * send; bus.wR[st + i] += v * gr * send; } }
  };
  const cache = new Map();
  const note = (inst, m, lenSec) => {
    const q = Math.round(lenSec * 20) / 20 || 0.05, k = `${inst}|${m}|${q}`;
    if (!cache.has(k)) {
      const smp = INST[inst](m, q, rng(((o.seed || 1) * 131 + m * 7 + Math.round(q * 20) * 13) >>> 0));
      let pk = 0; for (let i = 0; i < smp.length; i++) pk = Math.max(pk, Math.abs(smp[i]));
      if (pk > 1e-6) for (let i = 0; i < smp.length; i++) smp[i] *= 0.7 / pk; // every instrument at the same peak, so `vol` sets the balance
      cache.set(k, smp);
    }
    return cache.get(k);
  };

  // --- the plan: intro, verses (A), choruses (B), a break (C), an ending ---
  const progs = { A: parseProg(o.prog.A), B: parseProg(o.prog.B || o.prog.A), C: parseProg(o.prog.C || o.prog.A) };
  const introBars = o.introBars ?? (['countin', 'drumfill', 'stab'].includes(o.intro) ? 1 : bars >= 24 ? 4 : 2);
  const outroBars = bars >= 24 ? 2 : 1;
  const plan = [];
  for (let b = 0; b < introBars; b++) plan.push({ sec: 'I', i: b });
  const unit = Math.max(2, Math.min(12, progs.A.length)), mid = bars - introBars - outroBars;
  const form = o.form || (mid >= unit * 5 ? 'ABACB' : mid >= unit * 3 ? 'ABAB' : 'AB');
  let left = mid, fi = 0;
  while (left > 0) {
    const sec = form[fi % form.length], len = Math.min(left, sec === 'C' ? Math.max(2, Math.round(unit / 2)) : unit * (mid >= 40 ? 2 : 1));
    for (let b = 0; b < len; b++) plan.push({ sec, i: b, len, pass: Math.floor(fi / form.length) });
    left -= len; fi++;
  }
  for (let b = 0; b < outroBars; b++) plan.push({ sec: 'O', i: b, last: b === outroBars - 1 });

  const progFor = (p) => (p.sec === 'I' ? progs.A : p.sec === 'O' ? progs.A : progs[p.sec]);
  const tonic = parseChord(['minor', 'dorian', 'phrygian', 'harmonic'].includes(o.mode) ? 'i' : 'I');
  const chordAt = (bar, s) => {
    const p = plan[bar]; if (p.sec === 'O' && p.last) return tonic;
    const pr = progFor(p), parts = pr[p.i % pr.length];
    return parts[Math.min(parts.length - 1, Math.floor((s / steps) * parts.length))];
  };
  const energy = (p) => ({ I: 0.3, A: 0.65, B: 1, C: 0.35, O: 0.6 })[p.sec];

  // --- drums ---
  const groove = GROOVES[o.groove || 'soft'], kit = KITS[o.kit || groove.kit], hits = {};
  for (const v of Object.keys(kit)) hits[v] = drumHit(kit[v][0], kit[v][1], rng((o.seed || 1) * 17 + v.charCodeAt(0)));
  const drumVol = o.drumVol ?? 0.55, pan = { h: 0.25, o: 0.25, b: -0.3, g: 0.35, l: -0.25, t: 0.3, u: -0.3, y: 0.3, w: 0.2, c: 0, r: -0.15, x: 0.1 };
  const playRow = (bar, row, v, sOff = 0) => hits[v] && [...row].forEach((ch, s) => { if (ch === 'x' || ch === 'o') put(hits[v], stepTime(bar, s + sOff), drumVol * (ch === 'o' ? 0.45 : 1) * (v === 'k' ? 1.1 : 0.8), pan[v] || 0, o.drumVerb ?? 0.08, true); });
  const kickTimes = [];
  if (o.groove) plan.forEach((p, bar) => {
    const introDrums = { beat: 1, drumfill: 1, countin: 0, chip: 0.5 }[o.intro] ?? 0;
    if (p.sec === 'I') {
      if (o.intro === 'countin') { for (let b = 0; b < beatsPerBar; b++) put(drumHit('stick', {}, r), bar * barLen + b * beat, 0.5, 0, 0.05, true); return; }
      if (o.intro === 'drumfill' || (p.i === introBars - 1 && ['beat', 'bass', 'riser', 'arp', 'lead'].includes(o.intro))) {
        const f = groove.fill, half = steps / 2;
        for (const v of Object.keys(groove.A)) if (!f[v]) playRow(bar, groove.A[v].slice(0, half), v);
        for (const v of Object.keys(f)) if (hits[v]) playRow(bar, f[v], v, steps - f[v].length);
        return;
      }
      if (o.intro === 'heartbeat') { if (hits.k) for (let b = 0; b < beatsPerBar; b += 2) { put(hits.k, bar * barLen + b * beat, drumVol * 0.8, 0, 0.15, true); put(hits.k, bar * barLen + b * beat + beat * 0.32, drumVol * 0.5, 0, 0.15, true); } return; }
      if (o.intro === 'claps') { for (const v of ['k', 'c', 's']) if (groove.B[v]) playRow(bar, groove.B[v], v); return; }
      if (o.intro === 'hats') { for (const v of ['h', 'y', 'b']) { const row = groove.B[v] || groove.A[v]; if (row && (v !== 'h' || p.i >= 0)) playRow(bar, p.i < introBars / 2 ? row.replace(/x/g, (c, i) => (i % 4 === 0 ? 'x' : '.')) : row, v); } return; }
      if (introDrums >= 1 || (introDrums && p.i >= introBars / 2)) for (const v of Object.keys(groove.A)) playRow(bar, groove.A[v], v);
      if (o.intro === 'stab' || o.intro === 'timp') { if (hits.x) put(hits.x, bar * barLen, drumVol * 0.7, 0, 0.3, true); if (hits.k) put(hits.k, bar * barLen, drumVol, 0, 0.2, true); }
      return;
    }
    if (p.sec === 'O' && p.last) { for (const v of ['k', 'x']) if (hits[v]) put(hits[v], bar * barLen, drumVol, 0, 0.2, true); kickTimes.push(bar * barLen); return; }
    if (p.sec === 'C' && !o.breakDrums) { if (hits.h && p.i % 2 === 1) playRow(bar, groove.A.h || '', 'h'); return; }
    const g = p.sec === 'B' ? groove.B : groove.A;
    const lastOfSection = p.len && p.i === p.len - 1;
    if (lastOfSection && p.sec !== 'O') {
      const f = groove.fill, half = steps / 2;
      for (const v of Object.keys(g)) if (!f[v]) playRow(bar, g[v].slice(0, half), v);
      for (const v of Object.keys(f)) if (hits[v]) playRow(bar, f[v], v, steps - f[v].length);
    } else for (const v of Object.keys(g)) playRow(bar, g[v], v);
    if (p.i === 0 && p.sec === 'B' && hits.x) put(hits.x, bar * barLen, drumVol * 0.7, 0.1, 0.25, true);
    if (g.k) [...g.k].forEach((ch, s) => { if (ch === 'x') kickTimes.push(stepTime(bar, s)); });
  });

  // --- bass ---
  const B = o.bass, bassLo = o.bassLow ?? 33;
  let prevBass = null;
  plan.forEach((p, bar) => {
    if (p.sec === 'I' && !['bass', 'drone'].includes(o.intro) && !(o.introBass && p.i >= introBars / 2)) return;
    if (p.sec === 'C' && !B.inBreak) return;
    const pat = (p.sec === 'O' && p.last) || (p.sec === 'I' && o.intro === 'drone') ? 'r' + '-'.repeat(steps - 1) : (p.sec === 'B' && B.patB) || B.pat;
    const st = [...pat.padEnd(steps, '.').slice(0, steps)];
    st.forEach((ch, s) => {
      if (ch === '.' || ch === '-') return;
      const chd = chordAt(bar, s), root = (key + chd.root) % 12;
      let m = bassLo + ((root - bassLo) % 12 + 12) % 12;
      if (prevBass != null && Math.abs(m + 12 - prevBass) < Math.abs(m - prevBass) && m + 12 <= bassLo + 14) m += 12;
      if (ch === '5') m += 7; else if (ch === '8') m += 12; else if (ch === '3') m += chd.tones[1]; else if (ch === '7') m += chd.tones[3] ?? 10;
      else if (ch === 'p') { const nx = chordAt(Math.min(bar + 1, bars - 1), 0); const nr = bassLo + (((key + nx.root - bassLo) % 12) + 12) % 12; m = nr - 1; }
      else if (ch === 'w') { const scaleNotes = scale.map((x) => (key + x) % 12); const cand = [m + 2, m + 4, m + 5, m + 7].filter((x) => scaleNotes.includes(x % 12)); m = cand[Math.floor(r() * cand.length)] ?? m; }
      prevBass = m;
      let e = s + 1; while (e < steps && st[e] === '-') e++;
      const len = (B.staccato ? Math.min(e - s, 2) : e - s) * stepLen * 0.95;
      put(note(B.inst, m, len), stepTime(bar, s), (B.vol ?? 0.5) * (p.sec === 'I' ? 0.8 : 1), 0, 0, false);
    });
  });

  // --- chords (comping) ---
  const playComp = (C, bar, p, volMul) => {
    const pat = (p.sec === 'B' && C.patB) || C.pat, st = [...pat.padEnd(steps, '.').slice(0, steps)];
    st.forEach((ch, s) => {
      if (ch === '.' || ch === '-') return;
      const chd = chordAt(bar, s);
      C.prev = voice(chd, key, C.center ?? 60, C.prev);
      let e = s + 1; while (e < steps && st[e] === '-') e++;
      if (p.sec === 'O' && p.last) e = steps;
      const len = (e - s) * stepLen * (C.gate ?? 0.95), t = stepTime(bar, s), v = (C.vol ?? 0.3) * volMul * (ch === 'o' ? 0.6 : 1);
      if (C.style === 'arp') {
        const order = C.order === 'down' ? [...C.prev].reverse() : C.order === 'updown' ? [...C.prev, ...C.prev.slice(1, -1).reverse()] : C.prev;
        C.k = (C.k || 0) + 1; const m = order[C.k % order.length] + (C.oct || 0);
        put(note(C.inst, m, len), t, v, C.pan ?? 0, C.send ?? 0.25, false);
      } else {
        const notes = C.prev.map((m) => m + (C.oct || 0)), up = ch !== 'u';
        (up ? notes : [...notes].reverse()).forEach((m, k) => put(note(C.inst, m, len), t + (C.strum ? k * C.strum : 0), (v * (up ? 1 : 0.7)) / Math.sqrt(notes.length), (C.pan ?? 0) + (k - 1) * (C.spread ?? 0.15), C.send ?? 0.25, false));
      }
    });
  };
  const layers = o.layers.map((l) => ({ ...l })); // fresh voicing state for every render
  plan.forEach((p, bar) => {
    const e = energy(p);
    for (const L of layers) {
      const introOn = p.sec !== 'I' || L.intro || (o.intro === 'chords' && L.main) || (o.intro === 'riser' && L.main) || (o.intro === 'vinyl' && L.main) || (o.intro === 'stab' && L.main) || (o.intro === 'piano' && L.main) || (o.intro === 'lead' && L.pad) || (o.intro === 'pad' && L.pad) || (o.intro === 'timp' && L.pad) || (o.intro === 'heartbeat' && L.pad) || (o.intro === 'arp' && L.style === 'arp') || (o.intro === 'chip' && L.style === 'arp');
      const on = p.sec === 'I' ? true : L.when ? L.when.includes(p.sec) : true; // in the intro, the intro type decides
      if (!on || !introOn) continue;
      if (o.intro === 'stab' && p.sec === 'I') { const C = { ...L, pat: 'x' + '.'.repeat(steps - 1), style: 'block' }; playComp(C, bar, p, 1.1); L.prev = C.prev; continue; }
      playComp(L, bar, p, L.dyn === false ? 1 : 0.7 + 0.3 * e);
    }
  });

  // --- melody: verse tune and chorus hook, written fresh for every section ---
  const M = o.lead;
  if (M) {
    const sections = [];
    plan.forEach((p, bar) => { if (p.i === 0 && (M.when || ['A', 'B']).includes(p.sec)) sections.push({ start: bar, len: p.len, sec: p.sec, pass: p.pass }); });
    if (['lead', 'bell', 'solo'].includes(o.intro)) sections.unshift({ start: 0, len: introBars, sec: 'I', pass: 0 });
    const tunes = {};
    for (const s of sections) {
      const tk = `${s.sec}${s.len}`;
      if (!tunes[tk]) { // each section kind gets its own tune; later passes repeat it, as songs do
        const rr = rng((o.seed || 1) * 977 + s.sec.charCodeAt(0) * 31 + s.len);
        tunes[tk] = writeMelody({ r: rr, bars: s.len, steps, chordAt: (b, st) => chordAt(s.start + b, st), scale: SCALES[M.scale || o.mode || 'major'], key, center: (M.center ?? 72) + (s.sec === 'B' ? (M.lift ?? 3) : 0), style: s.sec === 'B' ? M.styleB || 'hook' : s.sec === 'I' ? 'sparse' : M.style || 'busy', hookRepeat: s.sec === 'B', onBeat: s.sec === 'I' });
      }
      const inst = s.sec === 'I' && o.intro === 'bell' ? 'bell' : (s.sec === 'B' && M.instB) || M.inst;
      for (const nt of tunes[tk]) {
        const bar = s.start + nt.bar; if (bar >= bars) continue;
        const len = nt.len * stepLen * (M.gate ?? 0.9);
        // keep the tune on the current chord when a pass sits on different harmony
        put(note(inst, nt.n + (M.oct || 0), len), stepTime(bar, nt.step), (M.vol ?? 0.32) * (s.sec === 'I' ? 0.8 : 1), M.pan ?? 0.05, M.send ?? 0.3, false);
        if (M.double && s.sec === 'B') put(note(M.double, nt.n + 12, len), stepTime(bar, nt.step) + 0.006, (M.vol ?? 0.32) * 0.35, -0.3, 0.35, false);
      }
    }
    const end = plan.length - 1; // final note: the key's home note, held
    put(note(M.inst, key + 12 * Math.round(((M.center ?? 72) - key) / 12) + (M.oct || 0), barLen * 0.9), end * barLen, (M.vol ?? 0.32) * 0.9, M.pan ?? 0, (M.send ?? 0.3) + 0.1, false);
  }

  // --- intro colour: risers, vinyl, swells ---
  const introEnd = introBars * barLen;
  if (['riser', 'pad', 'timp', 'drone'].includes(o.intro) || o.riser) {
    const t0 = Math.max(0, introEnd - Math.min(introEnd, barLen * 2)), len = introEnd - t0, s0 = Math.floor(t0 * SR), m = Math.floor(len * SR);
    const bp = biquad('bp', 400, 2);
    for (let i = 0; i < m && s0 + i < n; i++) { const x = i / m; if ((i & 31) === 0) bp.set(300 + 7000 * x * x, 2); const v = bp.run(r() * 2 - 1) * x * x * 0.5; bus.dL[s0 + i] += v; bus.dR[s0 + i] += v * 0.8; bus.wL[s0 + i] += v * 0.4; bus.wR[s0 + i] += v * 0.4; }
  }
  if (o.vinyl) { // crackle and hiss across the whole track
    const lp = biquad('lp', 5000);
    for (let i = 0; i < n; i++) { let v = lp.run(r() * 2 - 1) * 0.004; if (r() < 0.0004) v += (r() * 2 - 1) * 0.25; bus.dL[i] += v; bus.dR[i] += v; }
  }
  if (['riser', 'vinyl', 'arp'].includes(o.intro)) { // the intro opens up from a muffled sound
    const lpL = biquad('lp', 300), lpR = biquad('lp', 300), m = Math.min(n, Math.floor(introEnd * SR));
    for (let i = 0; i < m; i++) { if ((i & 63) === 0) { const f = 700 * Math.pow(22, i / m); lpL.set(f); lpR.set(f); } bus.mL[i] = lpL.run(bus.mL[i]); bus.mR[i] = lpR.run(bus.mR[i]); }
  }
  // dance tracks: the music ducks under each kick
  if (o.pump) {
    const g = new Float32Array(n).fill(1);
    for (const t of kickTimes) { const s0 = Math.floor(t * SR), m = Math.floor(0.2 * SR); for (let i = 0; i < m && s0 + i < n; i++) g[s0 + i] = Math.min(g[s0 + i], 1 - o.pump * Math.exp(-i / (0.07 * SR))); }
    for (let i = 0; i < n; i++) { bus.mL[i] *= g[i]; bus.mR[i] *= g[i]; }
  }

  // --- mix ---
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = bus.mL[i] + bus.dL[i]; Rr[i] = bus.mR[i] + bus.dR[i]; }
  reverb(bus.wL, bus.wR, L, Rr, { size: o.room ?? 0.8, damp: o.damp ?? 0.35, gain: o.verb ?? 1 });
  master(L, Rr, o.level ?? 0.13);
  const fade = Math.floor(0.4 * SR); // the buffer's last moments fade, so nothing is cut off
  for (let i = 0; i < fade; i++) { const k = n - fade + i; L[k] *= 1 - i / fade; Rr[k] *= 1 - i / fade; }
  return { L, R: Rr };
}
