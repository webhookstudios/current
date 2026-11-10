// Media library: probing imported files, proxies for unsupported formats, thumbnails,
// timeline filmstrips and audio waveforms.
import { fileUrl, baseName, mediaKind, uid, sleep } from '../util.js';
import { decodeFile, peaksFrom } from './audio.js';
import { store } from '../state.js';

export const thumbs = new Map(); // mediaId -> dataURL
export const strips = new Map(); // mediaId -> [{t, img}]
export const peaks = new Map(); // path -> Float32Array (50/s)
export const images = new Map(); // mediaId -> HTMLImageElement (decoded)
const pending = new Map();

function loadVideoMeta(path) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.src = fileUrl(path);
    const done = () => { v.onloadeddata = v.onerror = null; };
    v.onloadeddata = () => { done(); resolve(v); };
    v.onerror = () => { done(); reject(new Error('unsupported')); };
    setTimeout(() => { if (v.readyState < 2) { done(); reject(new Error('timeout')); } }, 15000);
  });
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image.'));
    img.src = fileUrl(path);
  });
}

function snap(el, w, h, tw = 240) {
  const c = document.createElement('canvas');
  c.width = tw; c.height = Math.round((tw * h) / w) || 135;
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  return c;
}

const seek = (v, t) => new Promise((r) => { if (Math.abs(v.currentTime - t) < 0.001) return r(); v.onseeked = () => { v.onseeked = null; r(); }; v.currentTime = t; });

// Probe a file and return a media record (not yet added to the project).
export async function probe(path, onStatus) {
  const kind = mediaKind(path);
  if (!kind) throw new Error(`${baseName(path)} is not a supported media file.`);
  const m = { id: uid('m'), type: kind, path, name: baseName(path) };
  if (kind === 'image') {
    const img = await loadImage(path);
    Object.assign(m, { width: img.naturalWidth, height: img.naturalHeight, duration: 0 });
    images.set(m.id, img);
    thumbs.set(m.id, snap(img, m.width, m.height).toDataURL('image/jpeg', 0.8));
    return m;
  }
  if (kind === 'audio') {
    const a = new Audio();
    a.preload = 'metadata';
    a.src = fileUrl(path);
    await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error('unsupported')); }).catch(async () => {
      onStatus?.('Converting audio…');
      m.proxy = await window.native.proxy(path);
      a.src = fileUrl(m.proxy);
      await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error(`Could not read ${m.name}.`)); });
    });
    m.duration = a.duration;
    m.hasAudio = true;
    return m;
  }
  let v;
  try { v = await loadVideoMeta(path); } catch {
    onStatus?.(`Optimizing ${m.name} for editing…`);
    m.proxy = await window.native.proxy(path);
    v = await loadVideoMeta(m.proxy);
  }
  Object.assign(m, { width: v.videoWidth, height: v.videoHeight, duration: v.duration });
  await seek(v, Math.min(m.duration * 0.1, 1));
  thumbs.set(m.id, snap(v, m.width, m.height).toDataURL('image/jpeg', 0.75));
  v.removeAttribute('src'); v.load();
  return m;
}

export const playPath = (m) => m.proxy || m.path;

// After a project loads: rebuild thumbnails, decoded images and peaks for every media item.
export async function warm(m) {
  if (pending.has(m.id)) return pending.get(m.id);
  const job = (async () => {
    try {
      if (m.type === 'image') {
        if (!images.has(m.id)) {
          const img = await loadImage(m.path);
          images.set(m.id, img);
          thumbs.set(m.id, snap(img, img.naturalWidth, img.naturalHeight).toDataURL('image/jpeg', 0.8));
        }
      } else if (m.type === 'video' && !thumbs.has(m.id)) {
        const v = await loadVideoMeta(playPath(m));
        await seek(v, Math.min(m.duration * 0.1, 1));
        thumbs.set(m.id, snap(v, m.width, m.height).toDataURL('image/jpeg', 0.75));
        v.removeAttribute('src'); v.load();
      }
      store.emit('media');
      if (m.type !== 'image') loadPeaks(playPath(m), m);
      if (m.type === 'video') buildStrip(m);
    } catch (e) { m.missing = true; store.emit('media'); }
  })();
  pending.set(m.id, job);
  return job;
}

export async function loadPeaks(path, m) {
  if (peaks.has(path)) return peaks.get(path);
  peaks.set(path, null);
  const buf = await decodeFile(path);
  if (!buf) { if (m && m.type === 'video') m.hasAudio = false; peaks.delete(path); store.emit('media'); return null; }
  if (m) m.hasAudio = true;
  const p = peaksFrom(buf);
  peaks.set(path, p);
  store.emit('waveform');
  return p;
}

// Small frames across the video for timeline clips.
let stripQueue = Promise.resolve();
export function buildStrip(m) {
  if (strips.has(m.id)) return;
  strips.set(m.id, []);
  stripQueue = stripQueue.then(async () => {
    try {
      const v = await loadVideoMeta(playPath(m));
      const n = Math.min(60, Math.max(4, Math.ceil(m.duration / 2)));
      const arr = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * m.duration + 0.05;
        await seek(v, Math.min(t, m.duration - 0.05));
        arr.push({ t, img: snap(v, m.width, m.height, 120) });
        if (i % 6 === 5) { strips.set(m.id, arr.slice()); store.emit('strip'); await sleep(0); }
      }
      strips.set(m.id, arr);
      store.emit('strip');
      v.removeAttribute('src'); v.load();
    } catch { /* thumbnails are optional */ }
  });
}

export function stripFrameAt(mediaId, t) {
  const s = strips.get(mediaId);
  if (!s || !s.length) return null;
  let best = s[0];
  for (const f of s) { if (f.t <= t + 0.01) best = f; else break; }
  return best.img;
}
