// Project model, editing operations and undo history.
import { uid, Emitter, EPS, clamp } from './util.js';

export const store = new Emitter();
Object.assign(store, {
  project: null,
  path: null,
  time: 0,
  playing: false,
  selection: new Set(),
  selectedTransition: null, // { clipId, side: 'in'|'out' }
  zoom: 80, // timeline pixels per second
  snap: true,
  dirty: false,
  undoStack: [],
  redoStack: [],
  clipboard: null,
});

export const ASPECTS = {
  '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350],
  '4:3': [1440, 1080], '21:9': [2560, 1080],
};

export const VISUAL = new Set(['video', 'image', 'title', 'element', 'background', 'adjust']);
export const AUDIBLE = new Set(['video', 'audio']);

export function newProject({ name = 'My Video', aspect = '16:9', fps = 30 } = {}) {
  const [width, height] = ASPECTS[aspect] || ASPECTS['16:9'];
  return {
    version: 1,
    name,
    width,
    height,
    fps,
    background: '#000000',
    media: [],
    tracks: [
      { id: uid('t'), kind: 'video', name: 'Track 3' },
      { id: uid('t'), kind: 'video', name: 'Track 2' },
      { id: uid('t'), kind: 'video', name: 'Track 1', main: true },
      { id: uid('t'), kind: 'audio', name: 'Audio 1' },
      { id: uid('t'), kind: 'audio', name: 'Audio 2' },
    ],
    clips: [],
  };
}

export const defaultTransform = () => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, flipH: false, flipV: false });
export const defaultColor = () => ({ exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, hue: 0, highlights: 0, shadows: 0, vignette: 0, sharpen: 0 });

export function makeClip(type, o = {}) {
  const c = {
    id: uid('c'),
    type,
    trackId: o.trackId,
    start: o.start ?? 0,
    duration: o.duration ?? 5,
    name: o.name || type,
  };
  if (type === 'video' || type === 'image' || type === 'audio') {
    c.mediaId = o.mediaId;
    c.in = o.in ?? 0;
  }
  if (type === 'video' || type === 'audio') c.speed = 1;
  if (VISUAL.has(type) && type !== 'adjust') {
    c.transform = defaultTransform();
    c.blend = 'normal';
    c.color = defaultColor();
    c.filter = null; // { id, amount }
    c.effects = []; // [{ id, amount }]
    c.anim = { in: null, out: null, loop: null, inDur: 0.6, outDur: 0.6 };
    c.tIn = null; // { id, duration }
    c.tOut = null;
  }
  if (type === 'video' || type === 'image') {
    c.crop = { l: 0, t: 0, r: 0, b: 0 };
    c.chroma = { on: false, color: '#00ff00', similarity: 0.15, smooth: 0.08, spill: 0.5 };
  }
  if (AUDIBLE.has(type)) Object.assign(c, { volume: 1, fadeIn: 0, fadeOut: 0, muted: false, audioFx: { preset: 'none', mix: 1, low: 0, mid: 0, high: 0, lowCut: false, compress: false, denoise: 0, denoisePath: null } });
  if (type === 'title' || type === 'element' || type === 'background') {
    c.template = o.template;
    c.params = o.params || {};
  }
  if (type === 'adjust') {
    c.filter = o.filter || null;
    c.effects = o.effects || [];
    c.color = defaultColor();
  }
  return c;
}

// ---------- queries ----------
export const P = () => store.project;
export const clipById = (id) => store.project.clips.find((c) => c.id === id);
export const trackById = (id) => store.project.tracks.find((t) => t.id === id);
export const mediaById = (id) => store.project.media.find((m) => m.id === id);
export const clipEnd = (c) => c.start + c.duration;
export const trackClips = (trackId) => store.project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
export const projectDuration = () => store.project.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
export const videoTracks = () => store.project.tracks.filter((t) => t.kind === 'video');
export const audioTracks = () => store.project.tracks.filter((t) => t.kind === 'audio');
export const trackKindFor = (type) => (type === 'audio' ? 'audio' : 'video');
export const selectedClips = () => [...store.selection].map(clipById).filter(Boolean);
export const mainTrack = () => store.project.tracks.find((t) => t.main) || videoTracks().at(-1);

// Longest a clip may be, given its source.
export function maxDuration(c) {
  if (c.type === 'video' || c.type === 'audio') {
    const m = mediaById(c.mediaId);
    if (m?.duration) return (m.duration - c.in) / (c.speed || 1);
  }
  return Infinity;
}

// ---------- history ----------
const snapshot = () => JSON.stringify(store.project);

export function checkpoint() {
  store.undoStack.push(snapshot());
  if (store.undoStack.length > 200) store.undoStack.shift();
  store.redoStack.length = 0;
}

export function changed(kind = 'edit') {
  store.dirty = true;
  store.emit('change', kind);
}

// Run fn as one undoable step.
export function edit(fn) {
  checkpoint();
  const r = fn();
  changed();
  return r;
}

function restore(json) {
  const sel = [...store.selection];
  store.project = JSON.parse(json);
  store.selection = new Set(sel.filter((id) => clipById(id)));
  store.selectedTransition = null;
  changed('history');
  store.emit('selection');
}
export function undo() {
  if (!store.undoStack.length) return;
  store.redoStack.push(snapshot());
  restore(store.undoStack.pop());
}
export function redo() {
  if (!store.redoStack.length) return;
  store.undoStack.push(snapshot());
  restore(store.redoStack.pop());
}

// ---------- selection & time ----------
export function select(ids, additive = false) {
  if (!additive) store.selection.clear();
  for (const id of [].concat(ids)) {
    if (additive && store.selection.has(id)) store.selection.delete(id);
    else if (id) store.selection.add(id);
  }
  store.selectedTransition = null;
  store.emit('selection');
}
export function selectTransition(clipId, side) {
  store.selection.clear();
  store.selectedTransition = { clipId, side };
  store.emit('selection');
}
export function setTime(t) {
  store.time = Math.max(0, t);
  store.emit('time', store.time);
}

// ---------- editing operations ----------

// Clear [start, end) on a track, trimming or splitting clips that are in the way.
export function clearRange(trackId, start, end, exceptId) {
  const p = store.project;
  for (const o of trackClips(trackId)) {
    if (o.id === exceptId) continue;
    const os = o.start, oe = clipEnd(o);
    if (oe <= start + EPS || os >= end - EPS) continue;
    if (os >= start - EPS && oe <= end + EPS) {
      p.clips.splice(p.clips.indexOf(o), 1);
      store.selection.delete(o.id);
    } else if (os < start && oe > end) {
      const right = cloneClip(o);
      trimStart(right, end - os);
      p.clips.push(right);
      o.duration = start - os;
      o.tOut = null;
    } else if (os < start) {
      o.duration = start - os;
      o.tOut = null;
    } else {
      trimStart(o, end - os);
    }
  }
}

function trimStart(c, by) {
  c.start += by;
  c.duration -= by;
  if ('in' in c) c.in += by * (c.speed || 1);
  c.tIn = null;
}

export function cloneClip(c) {
  const n = JSON.parse(JSON.stringify(c));
  n.id = uid('c');
  return n;
}

export function addClip(c, { overwrite = true } = {}) {
  if (overwrite) clearRange(c.trackId, c.start, clipEnd(c), c.id);
  store.project.clips.push(c);
  return c;
}

export function removeClips(ids, ripple = false) {
  const p = store.project;
  for (const id of ids) {
    const c = clipById(id);
    if (!c) continue;
    p.clips.splice(p.clips.indexOf(c), 1);
    if (ripple) for (const o of p.clips) if (o.trackId === c.trackId && o.start >= clipEnd(c) - EPS) o.start -= c.duration;
    store.selection.delete(id);
  }
}

export function splitClip(c, t) {
  if (t <= c.start + 0.02 || t >= clipEnd(c) - 0.02) return null;
  const right = cloneClip(c);
  const off = t - c.start;
  right.start = t;
  right.duration = c.duration - off;
  if ('in' in right) right.in = c.in + off * (c.speed || 1);
  right.tIn = null;
  c.duration = off;
  c.tOut = null;
  if (c.fadeOut) c.fadeOut = Math.min(c.fadeOut, c.duration);
  right.fadeIn = 0;
  c.fadeOut = 0;
  store.project.clips.push(right);
  return right;
}

export function ensureTrack(kind, where = 'top') {
  const p = store.project;
  const n = p.tracks.filter((t) => t.kind === kind).length + 1;
  const t = { id: uid('t'), kind, name: kind === 'video' ? `Track ${n}` : `Audio ${n}` };
  if (kind === 'video') {
    const first = p.tracks.findIndex((x) => x.kind === 'video');
    p.tracks.splice(where === 'top' ? Math.max(0, first) : p.tracks.indexOf(mainTrack()) + 1, 0, t);
  } else p.tracks.push(t);
  return t;
}

// First track of the right kind that is free over [start, end), creating one if needed.
export function freeTrack(kind, start, end, prefer) {
  const tracks = store.project.tracks.filter((t) => t.kind === kind);
  const order = prefer ? [prefer, ...tracks.filter((t) => t.id !== prefer.id)] : (kind === 'video' ? [...tracks].reverse() : tracks);
  for (const t of order) {
    if (t.locked) continue;
    if (!trackClips(t.id).some((c) => c.start < end - EPS && clipEnd(c) > start + EPS)) return t;
  }
  return ensureTrack(kind, 'top');
}

export function deleteTrack(id) {
  const p = store.project;
  const t = trackById(id);
  if (!t || t.main) return;
  if (p.tracks.filter((x) => x.kind === t.kind).length <= 1) return;
  p.clips = p.clips.filter((c) => c.trackId !== id);
  p.tracks.splice(p.tracks.indexOf(t), 1);
}

// Neighbour that touches this clip's start (for transitions between clips).
export function prevAdjacent(c) {
  return trackClips(c.trackId).find((o) => o.id !== c.id && Math.abs(clipEnd(o) - c.start) < 0.01);
}
export function nextAdjacent(c) {
  return trackClips(c.trackId).find((o) => o.id !== c.id && Math.abs(o.start - clipEnd(c)) < 0.01);
}

// Snap time t to clip edges and the playhead; returns snapped time.
export function snapTime(t, pxPerSec, excludeIds = new Set(), threshold = 8) {
  if (!store.snap) return t;
  const lim = threshold / pxPerSec;
  let best = t, bd = lim;
  const tryT = (x) => { const d = Math.abs(x - t); if (d < bd) { bd = d; best = x; } };
  tryT(store.time);
  tryT(0);
  for (const c of store.project.clips) {
    if (excludeIds.has(c.id)) continue;
    tryT(c.start);
    tryT(clipEnd(c));
  }
  return best;
}

export function clampClip(c) {
  c.duration = clamp(c.duration, 0.05, maxDuration(c));
  if (c.tIn) c.tIn.duration = Math.min(c.tIn.duration, c.duration);
  if (c.tOut) c.tOut.duration = Math.min(c.tOut.duration, c.duration);
}
