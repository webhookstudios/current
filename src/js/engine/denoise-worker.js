// Background-noise removal by spectral gating.
// 1. STFT (2048-point, 75% overlap). 2. Learn a noise floor per frequency bin from the quietest frames.
// 3. Attenuate each bin by how far it sits above that floor, smoothed over time and frequency.
// 4. Overlap-add back to audio.
'use strict';

function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function process(x, level, report, base, span) {
  const N = 2048, H = 512, bins = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.max(1, Math.ceil((x.length + N) / H));
  const pad = new Float32Array(frames * H + N);
  pad.set(x, N / 2);
  const mags = new Float32Array(frames * bins);
  const energy = new Float32Array(frames);
  const re = new Float64Array(N), im = new Float64Array(N);
  // pass 1: magnitudes
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = pad[f * H + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    let e = 0;
    for (let k = 0; k < bins; k++) { const m = Math.hypot(re[k], im[k]); mags[f * bins + k] = m; e += m * m; }
    energy[f] = e;
    if (f % 400 === 0) report(base + span * 0.4 * (f / frames));
  }
  // noise profile: mean magnitude over the quietest 15% of frames
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
  const take = Math.max(1, Math.floor(frames * 0.15));
  const noise = new Float32Array(bins);
  for (let i = 0; i < take; i++) { const f = order[i]; for (let k = 0; k < bins; k++) noise[k] += mags[f * bins + k]; }
  for (let k = 0; k < bins; k++) noise[k] /= take;
  const [over, floor] = [[1.5, 0.2], [2.2, 0.1], [3.2, 0.05]][Math.max(0, Math.min(2, level - 1))];
  // pass 2: gains, smoothed
  const out = new Float32Array(pad.length);
  const norm = new Float32Array(pad.length);
  const prevG = new Float32Array(bins).fill(1);
  const g = new Float32Array(bins);
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < bins; k++) {
      const m = mags[f * bins + k];
      const thr = noise[k] * over;
      let v = m <= 0 ? floor : Math.max(floor, 1 - (thr * thr) / (m * m));
      v = v > prevG[k] ? 0.6 * v + 0.4 * prevG[k] : 0.25 * v + 0.75 * prevG[k]; // fast attack, slow release
      g[k] = v;
    }
    for (let k = 1; k < bins - 1; k++) prevG[k] = (g[k - 1] + 2 * g[k] + g[k + 1]) / 4;
    prevG[0] = g[0]; prevG[bins - 1] = g[bins - 1];
    for (let i = 0; i < N; i++) { re[i] = pad[f * H + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) { re[k] *= prevG[k]; im[k] *= prevG[k]; if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[f * H + i] += re[i] * win[i]; norm[f * H + i] += win[i] * win[i]; }
    if (f % 400 === 0) report(base + span * (0.4 + 0.6 * (f / frames)));
  }
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { const n = norm[i + N / 2]; y[i] = n > 1e-6 ? out[i + N / 2] / n : 0; }
  return y;
}

self.onmessage = (e) => {
  try {
    const { channels, level } = e.data;
    const span = 1 / channels.length;
    let last = 0;
    const report = (p) => { if (p - last > 0.02) { last = p; self.postMessage({ progress: p }); } };
    const res = channels.map((c, i) => process(c, level, report, i * span, span));
    self.postMessage({ channels: res }, res.map((r) => r.buffer));
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
