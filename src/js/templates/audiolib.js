// Built-in sound effects and music beds, synthesised with an OfflineAudioContext the first time
// they are used and cached as WAV files, so they behave like any imported audio file.
import { rng } from '../util.js';
import { encodeWav } from '../engine/audio.js';

const SR = 44100;
const noiseBuf = (ctx, sec, seed = 1) => {
  const b = ctx.createBuffer(1, Math.ceil(sec * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0); const r = rng(seed);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
};
function env(g, t0, a, peak, hold, rel, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.setValueAtTime(peak, t0 + a + hold);
  g.gain.exponentialRampToValueAtTime(end, t0 + a + hold + rel);
}
function tone(ctx, out, type, f0, f1, t0, dur, peak = 0.4, a = 0.005) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain(); env(g, t0, a, peak, 0, dur - a);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(ctx, out, t0, dur, filterType, f0, f1, peak = 0.5, q = 1, a = 0.01, seed = 3) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, dur + 0.1, seed);
  const f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain(); env(g, t0, a, peak, 0, dur - a);
  s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur + 0.1);
}

const SFX = [
  ['whoosh', 'Whoosh', 1.0, (c, o) => noise(c, o, 0, 0.9, 'bandpass', 300, 3000, 0.9, 1.5, 0.35)],
  ['swoosh-down', 'Swoosh Down', 0.8, (c, o) => noise(c, o, 0, 0.7, 'bandpass', 4000, 300, 0.9, 2, 0.15)],
  ['swipe', 'Quick Swipe', 0.35, (c, o) => noise(c, o, 0, 0.3, 'highpass', 1500, 6000, 0.7, 0.7, 0.05)],
  ['pop', 'Pop', 0.25, (c, o) => tone(c, o, 'sine', 900, 200, 0, 0.18, 0.7)],
  ['bubble', 'Bubble Pop', 0.3, (c, o) => tone(c, o, 'sine', 300, 1400, 0, 0.12, 0.6)],
  ['click', 'Click', 0.1, (c, o) => noise(c, o, 0, 0.04, 'highpass', 2000, 2000, 0.8, 0.7, 0.001)],
  ['ding', 'Ding', 1.6, (c, o) => { tone(c, o, 'sine', 1318, 1318, 0, 1.5, 0.35); tone(c, o, 'sine', 2637, 2637, 0, 0.8, 0.12); }],
  ['success', 'Success Chime', 1.4, (c, o) => [523, 659, 784, 1046].forEach((f, i) => tone(c, o, 'triangle', f, f, i * 0.09, 1.0, 0.25))],
  ['error', 'Error Buzz', 0.6, (c, o) => { tone(c, o, 'square', 150, 150, 0, 0.22, 0.2); tone(c, o, 'square', 150, 150, 0.28, 0.25, 0.2); }],
  ['notify', 'Notification', 0.8, (c, o) => { tone(c, o, 'sine', 880, 880, 0, 0.25, 0.3); tone(c, o, 'sine', 1320, 1320, 0.15, 0.5, 0.3); }],
  ['coin', 'Coin', 0.6, (c, o) => { tone(c, o, 'square', 988, 988, 0, 0.08, 0.15); tone(c, o, 'square', 1319, 1319, 0.08, 0.45, 0.15); }],
  ['level-up', 'Level Up', 1.0, (c, o) => [392, 523, 659, 784, 1046].forEach((f, i) => tone(c, o, 'square', f, f, i * 0.08, 0.2, 0.12))],
  ['laser', 'Laser', 0.4, (c, o) => tone(c, o, 'sawtooth', 2000, 150, 0, 0.35, 0.25)],
  ['boom', 'Boom Impact', 2.0, (c, o) => { tone(c, o, 'sine', 120, 30, 0, 1.6, 0.9); noise(c, o, 0, 1.2, 'lowpass', 1200, 80, 0.7, 0.7, 0.003, 9); }],
  ['hit', 'Punch Hit', 0.5, (c, o) => { tone(c, o, 'sine', 160, 50, 0, 0.3, 0.9); noise(c, o, 0, 0.15, 'lowpass', 3000, 400, 0.6, 0.7, 0.002, 5); }],
  ['riser', 'Riser', 3.0, (c, o) => { noise(c, o, 0, 2.9, 'bandpass', 200, 6000, 0.6, 3, 2.6, 11); tone(c, o, 'sawtooth', 110, 880, 0, 2.9, 0.08, 2.6); }],
  ['drop', 'Bass Drop', 2.0, (c, o) => tone(c, o, 'sine', 220, 35, 0, 1.9, 0.9, 0.01)],
  ['shutter', 'Camera Shutter', 0.4, (c, o) => { noise(c, o, 0, 0.05, 'highpass', 3000, 3000, 0.9, 0.7, 0.001, 2); noise(c, o, 0.12, 0.08, 'bandpass', 2000, 1500, 0.7, 1, 0.001, 4); }],
  ['typing', 'Typing', 2.0, (c, o) => { const r = rng(5); for (let t = 0; t < 1.9; t += 0.08 + r() * 0.1) noise(c, o, t, 0.03, 'bandpass', 2500 + r() * 2000, 2500, 0.6, 2, 0.001, Math.floor(r() * 99)); }],
  ['heartbeat', 'Heartbeat', 2.0, (c, o) => [0, 0.25, 1, 1.25].forEach((t, i) => tone(c, o, 'sine', i % 2 ? 50 : 60, 40, t, 0.18, 0.9))],
  ['tick', 'Clock Tick', 4.0, (c, o) => { for (let i = 0; i < 4; i++) noise(c, o, i, 0.03, 'bandpass', i % 2 ? 2000 : 2600, 2000, 0.7, 6, 0.001, i + 1); }],
  ['beep', 'Censor Beep', 1.0, (c, o) => tone(c, o, 'sine', 1000, 1000, 0, 0.95, 0.35, 0.01)],
  ['glitch', 'Glitch', 0.8, (c, o) => { const r = rng(7); for (let t = 0; t < 0.7; t += 0.04) if (r() > 0.4) tone(c, o, 'square', 100 + r() * 2000, 100 + r() * 2000, t, 0.035, 0.15); }],
  ['scratch', 'Record Scratch', 0.7, (c, o) => { noise(c, o, 0, 0.25, 'bandpass', 600, 2400, 0.8, 4, 0.01, 13); noise(c, o, 0.25, 0.35, 'bandpass', 2400, 400, 0.8, 4, 0.01, 14); }],
  ['applause', 'Applause', 4.0, (c, o) => { const r = rng(21); for (let t = 0; t < 3.8; t += 0.012) noise(c, o, t, 0.02, 'bandpass', 1000 + r() * 2500, 1500, 0.15 * Math.min(1, (3.8 - t)), 1.5, 0.001, Math.floor(r() * 999)); }],
  ['drumroll', 'Drum Roll', 3.0, (c, o) => { for (let t = 0; t < 2.6; t += 0.045) noise(c, o, t, 0.06, 'bandpass', 900, 700, 0.15 + t * 0.1, 1, 0.001, Math.floor(t * 100)); noise(c, o, 2.65, 0.3, 'highpass', 5000, 3000, 0.6, 0.7, 0.001, 77); tone(c, o, 'sine', 120, 50, 2.65, 0.3, 0.8); }],
  ['wind', 'Wind', 6.0, (c, o) => noise(c, o, 0, 5.8, 'bandpass', 400, 900, 0.5, 0.8, 1.5, 31)],
  ['boing', 'Boing', 0.8, (c, o) => { const os = c.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(180, 0); const lfo = c.createOscillator(); lfo.frequency.value = 14; const lg = c.createGain(); lg.gain.setValueAtTime(90, 0); lg.gain.exponentialRampToValueAtTime(1, 0.75); lfo.connect(lg); lg.connect(os.frequency); const g = c.createGain(); env(g, 0, 0.005, 0.5, 0, 0.7); os.connect(g); g.connect(o); os.start(0); lfo.start(0); os.stop(0.8); lfo.stop(0.8); }],
  ['cha-ching', 'Cha-Ching', 1.2, (c, o) => { noise(c, o, 0, 0.08, 'highpass', 4000, 4000, 0.6, 0.7, 0.001, 41); [2093, 2637, 3136].forEach((f, i) => tone(c, o, 'triangle', f, f, 0.12 + i * 0.05, 0.9, 0.18)); }],
  ['magic', 'Magic Sparkle', 1.5, (c, o) => { const r = rng(4); for (let i = 0; i < 14; i++) tone(c, o, 'sine', 1500 + r() * 2500, 2000 + r() * 2000, i * 0.06, 0.4, 0.08); }],
];

// --- tiny music sequencer ---
// Each bar plays a pad chord, a bass line, an optional arpeggio, an optional lead tune and drums.
// beats: 4 (default) or 3 for waltz time. swing delays every second sixteenth by that share of one.
// lead: { wave, pat, oct, vol, len, from, seed } plays a tune made once per chord, so it repeats.
// drums: k (kick), s (snare), h (hat), and optional c (clap) and o (open hat), one letter per step.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
function music(o) {
  return (ctx, out) => {
    const beat = 60 / o.bpm, beats = o.beats || 4, steps = beats * 4;
    const bars = o.bars || 16;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    const master = ctx.createGain(); master.gain.value = 0.8; comp.connect(master); master.connect(out);
    const prog = o.prog;
    const sw = (s) => (s % 2 ? (o.swing || 0) * beat / 4 : 0);
    let phrases = null;
    if (o.lead) {
      const r = rng(o.lead.seed || 7), pat = o.lead.pat || 'x..x..x.x.x.....';
      phrases = prog.map(() => { let d = Math.floor(r() * 3); return [...pat.slice(0, steps)].map((ch) => { if (ch !== 'x') return null; d = Math.max(0, Math.min(5, d + [-1, 1, 1, -2, 0, 2][Math.floor(r() * 6)])); return d; }); });
    }
    for (let bar = 0; bar < bars; bar++) {
      const chord = prog[bar % prog.length].map((n) => n + o.key);
      const t0 = bar * beats * beat, len = beats * beat;
      // pad chord
      chord.forEach((n) => {
        const osc = ctx.createOscillator(); osc.type = o.pad || 'triangle'; osc.frequency.value = NOTE(n + 12);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.padCut || 1800;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05 * (o.padVol ?? 1), t0 + 0.3); g.gain.setValueAtTime(0.05 * (o.padVol ?? 1), t0 + len - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + len);
        osc.connect(lp); lp.connect(g); g.connect(comp); osc.start(t0); osc.stop(t0 + len + 0.05);
      });
      // bass
      for (let b = 0; b < beats; b++) { if (o.bassPat && !o.bassPat[b]) continue; tone(ctx, comp, o.bass || 'sine', NOTE(chord[0] - 12), NOTE(chord[0] - 12), t0 + b * beat, beat * 0.9, 0.28, 0.01); }
      // arpeggio
      if (o.arp) for (let s = 0; s < beats * 2; s++) { const n = chord[(s * (o.arpStep || 1)) % chord.length] + 24; tone(ctx, comp, o.arp, NOTE(n), NOTE(n), t0 + s * beat / 2, beat / 2 * 0.9, 0.06, 0.005); }
      // lead tune
      if (phrases && bar >= (o.lead.from || 0)) {
        const ph = phrases[bar % prog.length], L = o.lead;
        ph.forEach((d, s) => {
          if (d == null) return;
          const n = chord[d % chord.length] + 12 * Math.floor(d / chord.length) + (L.oct ?? 24), t = t0 + (s * beat) / 4 + sw(s);
          tone(ctx, comp, L.wave || 'square', NOTE(n), NOTE(n), t, (beat / 4) * (L.len || 1.8), L.vol || 0.06, 0.005);
        });
      }
      // drums
      if (o.drums && bar >= (o.drumsFrom || 0)) {
        const dr = o.drums;
        for (let s = 0; s < steps; s++) {
          const t = t0 + (s * beat) / 4 + sw(s);
          if (dr.k[s] === 'x') tone(ctx, comp, 'sine', 150, 45, t, 0.25, 0.8, 0.002);
          if (dr.s[s] === 'x') noise(ctx, comp, t, 0.16, 'bandpass', 1800, 1200, 0.35, 0.8, 0.002, s + bar * 16);
          if (dr.h[s] === 'x') noise(ctx, comp, t, 0.05, 'highpass', 7000, 7000, 0.12, 0.7, 0.001, s * 3 + bar);
          if (dr.c?.[s] === 'x') { noise(ctx, comp, t, 0.12, 'bandpass', 1400, 1100, 0.3, 1.2, 0.001, s * 7 + bar); noise(ctx, comp, t + 0.012, 0.14, 'bandpass', 1500, 1000, 0.25, 1.2, 0.001, s * 5 + bar); }
          if (dr.o?.[s] === 'x') noise(ctx, comp, t, 0.3, 'highpass', 6000, 6000, 0.1, 0.7, 0.002, s * 11 + bar);
        }
      }
    }
  };
}
const D = {
  pop: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
  lofi: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  rock: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  half: { k: 'x...........x...', s: '........x.......', h: 'x...x...x...x...' },
  house: { k: 'x...x...x...x...', s: '................', c: '....x.......x...', h: '..x...x...x...x.', o: '..x...x...x...x.' },
  trap: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.xxx.x.x.xx' },
  onedrop: { k: '........x.......', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
  march: { k: 'x.......x.......', s: '....x.xx....x.xx', h: '................' },
  train: { k: 'x.......x.......', s: '..x...x...x...xx', h: 'x.x.x.x.x.x.x.x.' },
  dnb: { k: 'x.........x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
  stomp: { k: 'x...x...x...x...', s: '................', c: '....x.......x...', h: '................' },
  shuffle: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x..x..x..x..x..x' },
  waltz: { k: 'x...........', s: '....x...x...', h: 'x.x.x.x.x.x.' },
  bossa: { k: 'x..x..x.x..x..x.', s: '..x..x....x..x..', h: 'x.x.x.x.x.x.x.x.' },
  minimal: { k: 'x...x...x...x...', s: '................', h: '..x...x...x...x.', c: '........x.......' },
};
const MUSIC = [
  ['m-upbeat', 'Upbeat Pop', 120, { bpm: 120, key: 0, prog: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], arp: 'square', drums: D.pop, drumsFrom: 2, bassPat: [1, 0, 1, 1] }],
  ['m-chill', 'Chill Lo-Fi', 120, { bpm: 80, key: -3, prog: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 60, 64, 67]], pad: 'sine', padCut: 1200, drums: D.lofi, bass: 'triangle' }],
  ['m-cinematic', 'Cinematic Rise', 96, { bpm: 80, key: -5, bars: 32, prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], pad: 'sawtooth', padCut: 900, drums: D.half, drumsFrom: 8, bassPat: [1, 0, 0, 0] }],
  ['m-corporate', 'Bright Corporate', 120, { bpm: 110, key: 2, prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], arp: 'triangle', arpStep: 2, drums: D.pop, drumsFrom: 4 }],
  ['m-rock', 'Garage Drive', 104, { bpm: 128, key: -2, bars: 28, prog: [[64, 68, 71], [64, 68, 71], [69, 73, 76], [71, 75, 78]], pad: 'sawtooth', padCut: 2400, bass: 'sawtooth', drums: D.rock }],
  ['m-ambient', 'Calm Ambient', 120, { bpm: 60, key: 0, bars: 15, prog: [[60, 64, 67, 71], [65, 69, 72, 76], [57, 60, 64, 67], [62, 65, 69, 72]], pad: 'sine', padCut: 2000, arp: 'sine', arpStep: 3, bassPat: [1, 0, 0, 0] }],
  ['m-synthwave', 'Neon Drive', 120, { bpm: 100, key: -4, bars: 25, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], pad: 'sawtooth', padCut: 1500, arp: 'sawtooth', bass: 'sawtooth', drums: D.pop, drumsFrom: 4 }],
  ['m-funk', 'Funky Groove', 120, { bpm: 108, key: -5, bars: 24, prog: [[57, 60, 64, 67], [62, 65, 69, 72]], arp: 'square', arpStep: 2, bass: 'square', bassPat: [1, 1, 0, 1], drums: { k: 'x..x..x...x..x..', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' } }],
  ['m-piano', 'Gentle Keys', 120, { bpm: 72, key: 0, bars: 16, prog: [[60, 64, 67, 72], [57, 60, 64, 69], [65, 69, 72, 77], [67, 71, 74, 79]], pad: 'sine', padCut: 2600, arp: 'triangle', arpStep: 1, bassPat: [1, 0, 0, 0] }],
  ['m-epic', 'Epic Trailer', 120, { bpm: 90, key: -3, bars: 28, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pad: 'sawtooth', padCut: 1200, bass: 'sawtooth', drums: { k: 'x.......x.x.....', s: '........x.......', h: '................' }, drumsFrom: 4, bassPat: [1, 0, 1, 0] }],
  ['m-hiphop', 'Boom Bap', 120, { bpm: 90, key: -2, bars: 22, prog: [[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 60, 64]], pad: 'triangle', padCut: 1400, bass: 'sine', drums: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } }],
  ['m-edm', 'Festival Pulse', 120, { bpm: 126, key: 1, bars: 32, prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], pad: 'sawtooth', padCut: 2200, arp: 'sawtooth', arpStep: 1, bass: 'sawtooth', bassPat: [0, 1, 0, 1], drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' }, drumsFrom: 4 }],
  ['m-acoustic', 'Morning Acoustic', 120, { bpm: 100, key: 7, bars: 24, prog: [[55, 59, 62], [62, 66, 69], [64, 67, 71], [60, 64, 67]], pad: 'triangle', padCut: 3200, arp: 'triangle', arpStep: 1, bassPat: [1, 0, 1, 0], drums: D.half, drumsFrom: 8 }],
  ['m-tension', 'Suspense', 120, { bpm: 70, key: -6, bars: 16, prog: [[57, 60, 63], [56, 59, 62], [57, 60, 63], [58, 61, 64]], pad: 'sawtooth', padCut: 700, bassPat: [1, 0, 0, 0], arp: 'sine', arpStep: 3 }],
  ['m-jazz', 'Late Night Jazz', 120, { bpm: 92, key: -2, bars: 24, prog: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 61, 64, 67]], pad: 'sine', padCut: 1800, bass: 'triangle', bassPat: [1, 1, 1, 1], drums: { k: 'x.......x.......', s: '........x.......', h: 'x..x..x.x..x..x.' } }],
  ['m-kids', 'Playful Day', 120, { bpm: 140, key: 5, bars: 28, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], arp: 'square', arpStep: 1, pad: 'triangle', padCut: 3500, drums: D.pop, bassPat: [1, 0, 1, 0] }],
  ['m-chillwave', 'Sunset Chillwave', 120, { bpm: 85, key: -4, bars: 24, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pad: 'sawtooth', padCut: 1000, arp: 'sine', arpStep: 2, drums: D.lofi, bass: 'sine' }],
  ['m-inspire', 'Inspiring Rise', 120, { bpm: 116, key: 2, bars: 28, prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], pad: 'triangle', padCut: 2400, arp: 'triangle', arpStep: 2, drums: D.pop, drumsFrom: 8, bassPat: [1, 0, 1, 1] }],
  ['m-dark', 'Dark Pulse', 120, { bpm: 120, key: -7, bars: 24, prog: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 58, 62]], pad: 'sawtooth', padCut: 800, bass: 'sawtooth', bassPat: [1, 1, 1, 1], drums: { k: 'x...x...x...x...', s: '........x.......', h: '.x.x.x.x.x.x.x.x' }, drumsFrom: 4 }],
  ['m-happy', 'Sunny Strum', 96, { bpm: 132, key: 5, bars: 26, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], arp: 'triangle', pad: 'triangle', padCut: 3000, drums: D.half, bassPat: [1, 0, 1, 0] }],
  // added in 1.6
  ['m-house', 'Deep House Night', 0, { bpm: 122, key: -3, bars: 40, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], pad: 'sawtooth', padCut: 1100, bass: 'sine', bassPat: [0, 1, 0, 1], drums: D.house, drumsFrom: 4 }],
  ['m-trap', 'Midnight Trap', 0, { bpm: 70, key: -4, bars: 20, prog: [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 55, 59]], pad: 'sawtooth', padCut: 800, bass: 'sine', bassPat: [1, 0, 0, 1], drums: D.trap, lead: { wave: 'triangle', pat: 'x.....x.....x...', oct: 24, vol: 0.05, seed: 3, from: 4 } }],
  ['m-reggae', 'Island Skank', 0, { bpm: 76, key: 2, bars: 24, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [65, 69, 72]], pad: 'triangle', padCut: 2400, padVol: 0.6, arp: 'square', arpStep: 1, bass: 'sine', bassPat: [1, 0, 1, 0], drums: D.onedrop }],
  ['m-waltz', 'Ballroom Waltz', 0, { bpm: 150, key: 0, beats: 3, bars: 48, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], pad: 'sine', padCut: 2600, bassPat: [1, 0, 0], drums: D.waltz, drumsFrom: 8, lead: { wave: 'triangle', pat: 'x...x...x...', oct: 24, vol: 0.07, seed: 11 } }],
  ['m-march', 'Brass Parade', 0, { bpm: 112, key: 5, bars: 32, prog: [[60, 64, 67], [67, 71, 74], [65, 69, 72], [67, 71, 74]], pad: 'sawtooth', padCut: 1800, bass: 'triangle', bassPat: [1, 0, 1, 0], drums: D.march, lead: { wave: 'sawtooth', pat: 'x.x.x...x.x.x...', oct: 12, vol: 0.05, seed: 5, from: 4 } }],
  ['m-lullaby', 'Starlit Lullaby', 0, { bpm: 66, key: 7, bars: 16, prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], pad: 'sine', padCut: 1600, bassPat: [1, 0, 0, 0], lead: { wave: 'sine', pat: 'x...x...x...x...', oct: 36, vol: 0.08, len: 3, seed: 21 } }],
  ['m-tech', 'Tech Explainer', 0, { bpm: 118, key: 2, bars: 32, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]], pad: 'triangle', padCut: 2000, arp: 'sine', arpStep: 2, bass: 'sine', bassPat: [1, 0, 1, 1], drums: D.minimal, drumsFrom: 4 }],
  ['m-news', 'News Desk', 0, { bpm: 120, key: -2, bars: 32, prog: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]], pad: 'sawtooth', padCut: 1300, bass: 'sawtooth', bassPat: [1, 1, 1, 1], arp: 'square', arpStep: 1, drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, drumsFrom: 2 }],
  ['m-pixel', 'Pixel Quest', 0, { bpm: 140, key: 0, bars: 40, prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], pad: 'square', padCut: 1600, padVol: 0.5, bass: 'square', bassPat: [1, 1, 1, 1], drums: D.pop, lead: { wave: 'square', pat: 'x.x.x.xxx.x.x.x.', oct: 24, vol: 0.05, len: 1.4, seed: 9 } }],
  ['m-boss', 'Boss Battle', 0, { bpm: 160, key: -3, bars: 48, prog: [[57, 60, 64], [56, 60, 63], [53, 57, 60], [52, 56, 59]], pad: 'sawtooth', padCut: 1400, bass: 'sawtooth', bassPat: [1, 1, 1, 1], drums: D.rock, lead: { wave: 'square', pat: 'xx.xx.x.xx.xx.x.', oct: 24, vol: 0.05, len: 1.2, seed: 13, from: 4 } }],
  ['m-road', 'Open Road', 0, { bpm: 104, key: 4, bars: 32, prog: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], pad: 'triangle', padCut: 3000, arp: 'triangle', arpStep: 1, bassPat: [1, 0, 1, 0], drums: D.train, drumsFrom: 4, lead: { wave: 'triangle', pat: 'x..x..x...x.x...', oct: 24, vol: 0.05, seed: 17, from: 8 } }],
  ['m-tropical', 'Tropical Breeze', 0, { bpm: 100, key: 7, bars: 32, prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], pad: 'sine', padCut: 2200, padVol: 0.7, bass: 'sine', bassPat: [1, 0, 1, 0], drums: { k: 'x...x...x...x...', s: '......x.......x.', h: '..x...x...x...x.' }, lead: { wave: 'sine', pat: 'x.xx.x.xx.x.x...', oct: 36, vol: 0.06, len: 1.0, seed: 23 } }],
  ['m-bossa', 'Café Bossa', 0, { bpm: 96, key: -2, bars: 24, prog: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 61, 64, 67]], pad: 'sine', padCut: 1900, bass: 'triangle', bassPat: [1, 0, 1, 0], drums: D.bossa, swing: 0.15 }],
  ['m-blues', 'Slow Blues', 0, { bpm: 72, key: -5, bars: 24, prog: [[60, 64, 67, 70], [65, 69, 72, 75], [60, 64, 67, 70], [67, 71, 74, 77]], pad: 'triangle', padCut: 1500, bass: 'triangle', bassPat: [1, 1, 1, 1], drums: D.shuffle, swing: 0.3, lead: { wave: 'sawtooth', pat: 'x..x....x.x.....', oct: 12, vol: 0.04, len: 2.5, seed: 31, from: 4 } }],
  ['m-country', 'Dusty Trail', 0, { bpm: 110, key: 7, bars: 32, prog: [[60, 64, 67], [65, 69, 72], [60, 64, 67], [67, 71, 74]], pad: 'triangle', padCut: 2800, arp: 'triangle', arpStep: 2, bassPat: [1, 0, 1, 0], drums: D.train }],
  ['m-orchestral', 'Grand Horizon', 0, { bpm: 84, key: 2, bars: 28, prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], pad: 'sawtooth', padCut: 1000, bass: 'sawtooth', bassPat: [1, 0, 0, 0], drums: { k: 'x.......x.......', s: '................', h: '................' }, drumsFrom: 8, lead: { wave: 'triangle', pat: 'x.......x...x...', oct: 24, vol: 0.07, len: 3, seed: 37, from: 4 } }],
  ['m-mystery', 'Mystery Case', 0, { bpm: 90, key: -1, bars: 24, prog: [[57, 60, 64], [57, 60, 63], [53, 56, 60], [52, 56, 59]], pad: 'sine', padCut: 900, bass: 'triangle', bassPat: [1, 0, 1, 0], arp: 'sine', arpStep: 2, drums: { k: 'x.......x.......', s: '................', h: '..x...x...x...x.' } }],
  ['m-shadows', 'Creeping Shadows', 0, { bpm: 60, key: -8, bars: 14, prog: [[57, 60, 63], [56, 59, 62], [57, 60, 63], [58, 61, 64]], pad: 'sawtooth', padCut: 500, bassPat: [1, 0, 0, 0], lead: { wave: 'sine', pat: 'x.......x.......', oct: 24, vol: 0.05, len: 6, seed: 41 } }],
  ['m-arcade', 'Retro Arcade', 0, { bpm: 132, key: 2, bars: 40, prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], pad: 'square', padCut: 1400, padVol: 0.5, arp: 'square', arpStep: 1, bass: 'square', bassPat: [1, 0, 1, 1], drums: D.pop, lead: { wave: 'square', pat: 'x.x.xx.x.x.xx.x.', oct: 24, vol: 0.045, len: 1.2, seed: 43, from: 4 } }],
  ['m-dnb', 'Liquid Rush', 0, { bpm: 172, key: -3, bars: 56, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 65]], pad: 'sawtooth', padCut: 1200, bass: 'sine', bassPat: [1, 0, 0, 1], drums: D.dnb, drumsFrom: 8 }],
  ['m-soul', 'Sunday Soul', 0, { bpm: 80, key: -4, bars: 24, prog: [[60, 64, 67, 71], [65, 69, 72, 76], [62, 65, 69, 72], [67, 71, 74, 77]], pad: 'triangle', padCut: 1700, bass: 'triangle', bassPat: [1, 0, 1, 1], drums: D.lofi, swing: 0.2, lead: { wave: 'sine', pat: 'x..x..x.....x...', oct: 24, vol: 0.06, len: 2, seed: 47, from: 4 } }],
  ['m-motivation', 'Morning Motivation', 0, { bpm: 124, key: 4, bars: 40, prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], pad: 'triangle', padCut: 2600, arp: 'triangle', arpStep: 2, bassPat: [1, 0, 1, 1], drums: D.house, drumsFrom: 4, lead: { wave: 'triangle', pat: 'x.x...x.x.x.....', oct: 24, vol: 0.05, seed: 53, from: 8 } }],
  ['m-focus', 'Focus Study', 0, { bpm: 75, key: 0, bars: 24, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]], pad: 'sine', padCut: 1300, drums: D.lofi, bass: 'triangle', bassPat: [1, 0, 0, 1], swing: 0.12, lead: { wave: 'sine', pat: 'x.....x...x.....', oct: 24, vol: 0.05, len: 2.5, seed: 59 } }],
  ['m-breath', 'Deep Breath', 0, { bpm: 50, key: 2, bars: 12, prog: [[60, 64, 67, 72], [57, 60, 64, 69], [65, 69, 72, 76], [60, 64, 67, 72]], pad: 'sine', padCut: 1400, bassPat: [1, 0, 0, 0], lead: { wave: 'sine', pat: 'x...............', oct: 36, vol: 0.05, len: 10, seed: 61 } }],
  ['m-bells', 'Festive Bells', 0, { bpm: 120, key: 7, bars: 32, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], pad: 'triangle', padCut: 2400, bassPat: [1, 0, 1, 0], drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, drumsFrom: 4, lead: { wave: 'sine', pat: 'x.x.x...x.x.x...', oct: 36, vol: 0.08, len: 2, seed: 67 } }],
  ['m-gameday', 'Game Day', 0, { bpm: 128, key: -2, bars: 40, prog: [[57, 60, 64], [57, 60, 64], [60, 64, 67], [55, 59, 62]], pad: 'sawtooth', padCut: 2200, bass: 'sawtooth', bassPat: [1, 1, 1, 1], drums: D.stomp, lead: { wave: 'sawtooth', pat: 'x..x..x.x.......', oct: 12, vol: 0.04, seed: 71, from: 8 } }],
  ['m-runway', 'Runway', 0, { bpm: 124, key: -5, bars: 40, prog: [[57, 60, 64], [57, 60, 64], [55, 58, 62], [55, 58, 62]], pad: 'sawtooth', padCut: 700, padVol: 0.6, bass: 'sawtooth', bassPat: [0, 1, 0, 1], drums: D.minimal }],
  ['m-bouncy', 'Bouncy Castle', 0, { bpm: 150, key: 5, bars: 40, prog: [[60, 64, 67], [67, 71, 74], [65, 69, 72], [67, 71, 74]], pad: 'triangle', padCut: 3200, bass: 'square', bassPat: [1, 0, 1, 0], drums: D.pop, lead: { wave: 'square', pat: 'x.x.x.x.xx.x....', oct: 24, vol: 0.045, len: 1.3, seed: 73 } }],
  ['m-tender', 'Tender Moments', 0, { bpm: 68, key: 3, bars: 16, prog: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [67, 71, 74, 77]], pad: 'sine', padCut: 2000, arp: 'triangle', arpStep: 1, bassPat: [1, 0, 0, 0], lead: { wave: 'sine', pat: 'x.......x...x...', oct: 24, vol: 0.06, len: 4, seed: 79, from: 4 } }],
  ['m-sunrise', 'City Sunrise', 0, { bpm: 92, key: 2, bars: 32, prog: [[60, 64, 67, 71], [55, 59, 62, 65], [57, 60, 64, 67], [53, 57, 60, 64]], pad: 'triangle', padCut: 2000, bass: 'sine', bassPat: [1, 0, 1, 1], drums: D.lofi, drumsFrom: 2, lead: { wave: 'triangle', pat: 'x..x..x...x.....', oct: 24, vol: 0.05, seed: 83, from: 4 } }],
];

export const AUDIO_LIBRARY = [
  ...MUSIC.map(([id, name, dur, o]) => ({ id, name, cat: 'Music', dur: Math.round(((o.bars || 16) * (o.beats || 4) * 60) / o.bpm), gen: music(o) })),
  ...SFX.map(([id, name, dur, gen]) => ({ id: `sfx-${id}`, name, cat: 'Sound Effects', dur, gen })),
];
export const AUDIO_CATS = ['Music', 'Sound Effects'];

// Path to the cached WAV for a library item, rendering it first if needed.
export async function libraryAudioPath(item) {
  const name = `lib-${item.id}-v1.wav`;
  const p = await window.native.cachePath(name);
  if (await window.native.exists(p)) return p;
  const ctx = new OfflineAudioContext(2, Math.ceil(item.dur * SR) + SR / 2, SR);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  item.gen(ctx, out);
  const buf = await ctx.startRendering();
  return window.native.cacheWrite(name, encodeWav(buf));
}

// Quick in-app preview of a library item.
let previewSrc = null;
export async function previewLibraryAudio(item, actx) {
  stopLibraryPreview();
  const p = await libraryAudioPath(item);
  const data = await window.native.readBinary(p);
  const buf = await actx.decodeAudioData(data);
  const s = actx.createBufferSource(); s.buffer = buf; s.connect(actx.destination); s.start();
  previewSrc = s;
  return p;
}
export function stopLibraryPreview() { try { previewSrc?.stop(); } catch { /* */ } previewSrc = null; }
