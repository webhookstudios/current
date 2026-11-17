// Seeing the media for the assistant, all on this computer: contact sheets (several frames of a file in
// one picture, each labelled with its time), single frames, and an analysis of each file: shot changes,
// dark, soft and shaky stretches, where the motion peaks, and quiet and loud parts of the sound.
// Analyses are kept in the cache, keyed by the file, so each file is only analysed once.
import { fileUrl, clamp } from '../util.js';
import { store, mediaById } from '../state.js';
import { playPath, images, loadPeaks, peaks } from '../engine/media.js';
import { findPauses } from '../ui/silence.js';

const ANALYSIS_VERSION = 2;
export const SHEET_MAX = 16;

// ---------- frames ----------
function openVideo(path) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.src = fileUrl(path);
    const done = () => { v.onloadeddata = v.onerror = null; clearTimeout(limit); };
    const limit = setTimeout(() => { done(); reject(new Error('The video took too long to open.')); }, 15000);
    v.onloadeddata = () => { done(); resolve(v); };
    v.onerror = () => { done(); reject(new Error('The video could not be opened.')); };
  });
}
const closeVideo = (v) => { v.removeAttribute('src'); v.load(); };

function seek(v, t) {
  t = clamp(t, 0, Math.max(0, (v.duration || 0) - 0.04));
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return resolve();
    const done = () => { v.removeEventListener('seeked', done); clearTimeout(limit); resolve(); };
    const limit = setTimeout(done, 4000);
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

async function imageOf(m) {
  if (images.get(m.id)) return images.get(m.id);
  const img = new Image();
  img.src = fileUrl(m.path);
  await img.decode();
  images.set(m.id, img);
  return img;
}

// A canvas fitted inside max x max, keeping the source's shape.
function fitCanvas(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  return c;
}
const jpeg = (canvas, q = 0.8) => canvas.toDataURL('image/jpeg', q).split(',')[1];

export const clockLabel = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

// One frame of a file at time t (seconds into the file), at most max pixels on its longer side.
export async function mediaFrame(m, t = 0, max = 1024) {
  if (m.type === 'audio') throw new Error(`${m.name} is a sound file, so it has no pictures.`);
  if (m.type === 'image') {
    const img = await imageOf(m);
    const c = fitCanvas(img.naturalWidth, img.naturalHeight, max);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: jpeg(c), mediaType: 'image/jpeg', width: c.width, height: c.height };
  }
  const v = await openVideo(playPath(m));
  try {
    await seek(v, t);
    const c = fitCanvas(v.videoWidth, v.videoHeight, max);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return { data: jpeg(c), mediaType: 'image/jpeg', width: c.width, height: c.height };
  } finally { closeVideo(v); }
}

// count frames spread evenly from `from` to `to` (seconds into the file) in a grid, each labelled with
// its time. Returns the picture and the times shown.
export async function contactSheet(m, { from = 0, to = m.duration, count = 9 } = {}) {
  if (m.type === 'audio') throw new Error(`${m.name} is a sound file, so it has no pictures.`);
  if (m.type === 'image') return { ...(await mediaFrame(m, 0, 1024)), times: [0] };
  from = clamp(from, 0, m.duration); to = clamp(to, from, m.duration);
  if (to - from < 0.1) { from = Math.max(0, from - 0.5); to = Math.min(m.duration, to + 0.5); }
  const n = clamp(Math.round(count), 1, SHEET_MAX);
  const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
  const v = await openVideo(playPath(m));
  try {
    const tall = v.videoHeight > v.videoWidth;
    const cw = tall ? 200 : 340, ch = Math.round((cw * v.videoHeight) / v.videoWidth) || 190;
    const gap = 6;
    const sheet = document.createElement('canvas');
    sheet.width = cols * cw + (cols + 1) * gap; sheet.height = rows * ch + (rows + 1) * gap;
    const g = sheet.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = '600 15px sans-serif'; g.textBaseline = 'middle';
    const times = [];
    for (let i = 0; i < n; i++) {
      const t = from + ((i + 0.5) * (to - from)) / n;
      await seek(v, t);
      const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (ch + gap);
      g.drawImage(v, x, y, cw, ch);
      const label = clockLabel(t), lw = g.measureText(label).width + 12;
      g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(x + 4, y + ch - 26, lw, 22);
      g.fillStyle = '#fff'; g.fillText(label, x + 10, y + ch - 15);
      times.push(Math.round(t * 100) / 100);
    }
    return { data: jpeg(sheet, 0.78), mediaType: 'image/jpeg', width: sheet.width, height: sheet.height, times };
  } finally { closeVideo(v); }
}

// ---------- analysis ----------
const AW = 80; // analysis frames are this wide (and as tall as the shape needs)

function grab(v, g, w, h) {
  g.drawImage(v, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h), hist = new Float32Array(64);
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    L[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
    hist[((d[p] >> 6) << 4) | ((d[p + 1] >> 6) << 2) | (d[p + 2] >> 6)]++;
  }
  for (let i = 0; i < 64; i++) hist[i] /= L.length;
  return { L, hist };
}
const meanOf = (L) => { let s = 0; for (const x of L) s += x; return s / L.length; };
function sharpnessOf(L, w, h) {
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    s += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]); n++;
  }
  return n ? s / n : 0;
}
const histDiff = (a, b) => { let s = 0; for (let i = 0; i < 64; i++) s += Math.abs(a[i] - b[i]); return s / 2; };
const lumaDiff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return s / A.length; };
// How far the picture moved from A to B (camera motion), searched up to R pixels each way.
function shiftOf(A, B, w, h, R = 3) {
  let best = [0, 0], bd = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    let s = 0, n = 0;
    for (let y = R; y < h - R; y += 1) for (let x = R; x < w - R; x += 2) { s += Math.abs(A[y * w + x] - B[(y + dy) * w + x + dx]); n++; }
    const d = s / n + 0.0004 * (dx * dx + dy * dy); // ties go to the smaller move
    if (d < bd) { bd = d; best = [dx, dy]; }
  }
  return best;
}
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r2 = (t) => Math.round(t * 100) / 100;

// Join the times where flag[i] is true into [from, to] stretches at least minLen long.
function stretches(times, flags, dt, dur, minLen = 0.5) {
  const out = [];
  let a = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) { if (a < 0) a = i; continue; }
    if (a >= 0) {
      const from = Math.max(0, times[a] - dt / 2), to = Math.min(dur, times[i - 1] + dt / 2);
      if (to - from >= minLen) out.push([r2(from), r2(to)]);
      a = -1;
    }
  }
  return out;
}
// The k highest local peaks of score, at least gap seconds apart.
function topPeaks(times, score, k = 5, gap = 2, skip = () => false) {
  const idx = score.map((s, i) => i).filter((i) => !skip(i) && score[i] > 0).sort((a, b) => score[b] - score[a]);
  const out = [];
  for (const i of idx) { if (out.every((j) => Math.abs(times[j] - times[i]) >= gap)) out.push(i); if (out.length >= k) break; }
  return out.sort((a, b) => a - b).map((i) => r2(times[i]));
}

async function videoAnalysis(m, onProgress) {
  const v = await openVideo(playPath(m));
  try {
    const dur = m.duration;
    const w = AW, h = clamp(Math.round((AW * v.videoHeight) / v.videoWidth) || 45, 16, 160);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const dt = clamp(dur / 300, 0.5, 3), n = Math.max(1, Math.floor(dur / dt));
    const PAIR = 1 / 15; // a second frame this soon after each sample shows how the camera moves
    const times = [], frames = [], mean = [], sharp = [], vel = [], motion = [];
    for (let i = 0; i < n; i++) {
      const t = Math.min(dur - PAIR - 0.05, (i + 0.5) * dt);
      await seek(v, t); const A = grab(v, g, w, h);
      await seek(v, t + PAIR); const B = grab(v, g, w, h);
      times.push(t); frames.push(A);
      mean.push(meanOf(A.L)); sharp.push(sharpnessOf(A.L, w, h));
      vel.push(shiftOf(A.L, B.L, w, h)); motion.push(lumaDiff(A.L, B.L));
      if (i % 10 === 9) onProgress?.(i / n);
    }
    // shot changes: a jump in colour or brightness well above the change around it
    const change = frames.map((f, i) => (i ? Math.max(histDiff(frames[i - 1].hist, f.hist), lumaDiff(frames[i - 1].L, f.L) * 2) : 0));
    const cutsAt = [];
    for (let i = 1; i < n; i++) {
      const around = change.slice(Math.max(1, i - 6), i).concat(change.slice(i + 1, i + 7));
      if (change[i] > 0.3 && change[i] > 3 * Math.max(0.02, median(around))) cutsAt.push(i);
    }
    // narrow each cut down to about dt/16 between the two samples
    const cuts = [];
    for (const i of cutsAt) {
      let a = times[i - 1], b = times[i];
      const before = frames[i - 1], after = frames[i];
      for (let k = 0; k < 4; k++) {
        const mid = (a + b) / 2;
        await seek(v, mid); const f = grab(v, g, w, h);
        if (histDiff(f.hist, before.hist) <= histDiff(f.hist, after.hist)) a = mid; else b = mid;
      }
      const at = r2((a + b) / 2);
      // a wipe or flash can look like several cuts in a row: shots shorter than a second are merged
      if (at >= 1 && dur - at >= 1 && (!cuts.length || at - cuts.at(-1) >= 1)) cuts.push(at);
    }
    const nearCut = (i) => cuts.some((c) => Math.abs(times[i] - c) < dt * 1.5);
    const dark = mean.map((x) => x < 0.08);
    const lit = sharp.filter((s, i) => !dark[i]);
    const typical = median(lit);
    const soft = sharp.map((s, i) => !dark[i] && (s < 0.012 || s < 0.4 * typical));
    // shaky: the camera's movement jumps around from one sample to the next, and is not tiny
    const shakeScore = vel.map(([x, y], i) => {
      if (i === 0 || i === n - 1 || nearCut(i)) return 0;
      const [px, py] = vel[i - 1], [nx, ny] = vel[i + 1];
      return Math.hypot(x - (px + nx) / 2, y - (py + ny) / 2);
    });
    const shaky = shakeScore.map((s) => s >= 1.5);
    const shots = [];
    let s0 = 0;
    for (const c of cuts) { shots.push([r2(s0), c]); s0 = c; }
    shots.push([r2(s0), r2(dur)]);
    return {
      sampled_every: r2(dt),
      shots,
      dark: stretches(times, dark, dt, dur),
      soft: stretches(times, soft, dt, dur, 1),
      shaky: stretches(times, shaky, dt, dur, 1),
      motion_peaks: topPeaks(times, motion, 5, 2, (i) => dark[i] || soft[i] || nearCut(i)),
      brightness: r2(median(mean)),
    };
  } finally { closeVideo(v); }
}

// The waveform (50 peaks a second), waiting for one that is already being read.
export async function waveform(m) {
  let pk = await loadPeaks(playPath(m), m);
  for (let i = 0; !pk && peaks.has(playPath(m)) && i < 600; i++) { await new Promise((r) => setTimeout(r, 100)); pk = peaks.get(playPath(m)); }
  return pk || null;
}

async function soundAnalysis(m) {
  const pk = await waveform(m);
  if (!pk) return { has_sound: false };
  const PPS = 50, dur = m.duration;
  let max = 0;
  for (const x of pk) max = Math.max(max, x);
  if (max <= 0.001) return { has_sound: false };
  const quiet = (findPauses({ mediaId: m.id, in: 0, duration: dur, speed: 1 }, { rel: 30, minLen: 0.7, pad: 0 }) || []).map(([a, b]) => [r2(a), r2(b)]);
  const win = PPS / 2, times = [], level = [];
  for (let i = 0; i < pk.length; i += win) {
    let w = 0;
    for (let j = i; j < Math.min(pk.length, i + win); j++) w = Math.max(w, pk[j]);
    times.push((i + win / 2) / PPS); level.push(w);
  }
  const loud = topPeaks(times, level.map((x) => (x >= max * 0.7 ? x : 0)), 5, 2);
  const quietTime = quiet.reduce((s, [a, b]) => s + b - a, 0);
  return { has_sound: true, quiet, loud_peaks: loud, sound_share: r2(clamp(1 - quietTime / Math.max(dur, 0.01))) };
}

// ---------- cache ----------
function hashOf(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
async function cacheName(m, kind) {
  const st = await window.native.stat(m.path);
  return `${kind}-v${ANALYSIS_VERSION}-${hashOf(`${m.path}|${st?.size}|${st?.mtime}`)}.json`;
}
export async function cacheGet(m, kind) {
  try {
    const p = await window.native.cachePath(await cacheName(m, kind));
    if (!(await window.native.exists(p))) return null;
    return JSON.parse(await window.native.readText(p));
  } catch { return null; }
}
export async function cachePut(m, kind, value) {
  try { await window.native.cacheWrite(await cacheName(m, kind), new TextEncoder().encode(JSON.stringify(value)).buffer); } catch { /* the cache is optional */ }
}

const running = new Map();
// The analysis of one media item (kept in the cache; fresh: work it out again).
export async function analyseMedia(m, onProgress, { fresh = false } = {}) {
  const cached = !fresh && (await cacheGet(m, 'analysis'));
  if (cached) return { ...cached, media_id: m.id, name: m.name }; // the same file may have another id in this project
  if (running.has(m.id)) return running.get(m.id);
  const job = (async () => {
    const out = { media_id: m.id, name: m.name, type: m.type, duration: r2(m.duration || 0) };
    if (m.type === 'video') Object.assign(out, await videoAnalysis(m, onProgress));
    if (m.type === 'image') {
      const img = await imageOf(m);
      const cv = fitCanvas(img.naturalWidth, img.naturalHeight, AW);
      const g = cv.getContext('2d', { willReadFrequently: true });
      const f = grab(img, g, cv.width, cv.height);
      Object.assign(out, { brightness: r2(meanOf(f.L)), dark: meanOf(f.L) < 0.08, soft: sharpnessOf(f.L, cv.width, cv.height) < 0.012 });
    }
    if (m.type === 'video' || m.type === 'audio') Object.assign(out, await soundAnalysis(m));
    await cachePut(m, 'analysis', out);
    return out;
  })();
  running.set(m.id, job);
  try { return await job; } finally { running.delete(m.id); }
}

export const mediaOrThrow = (id) => {
  const m = mediaById(id) || store.project.media.find((x) => x.name === id);
  if (!m) throw new Error(`There is no media item ${id}. Call list_media for the ids.`);
  if (m.missing) throw new Error(`${m.name} is missing on disk.`);
  return m;
};
