// Editing actions shared by the library, timeline, preview, inspector and keyboard shortcuts.
import {
  store, edit, makeClip, addClip, mediaById, clipById, trackById, mainTrack, freeTrack, trackClips, clipEnd,
  removeClips, splitClip, selectedClips, select, prevAdjacent, nextAdjacent, cloneClip, VISUAL, AUDIBLE, checkpoint, changed, maxDuration, ensureTrack,
} from './state.js';
import { probe, warm } from './engine/media.js';
import { titleById } from './templates/titles.js';
import { elementById, backgroundById } from './templates/elements.js';
import { effectById, filterById } from './templates/effects.js';
import { transitionById } from './templates/transitions.js';
import { AUDIO_LIBRARY, libraryAudioPath } from './templates/audiolib.js';
import { toast } from './ui/widgets.js';
import { packById } from './templates/packs.js';
import { videoTracks, projectDuration } from './state.js';
import { EPS, mediaKind, baseName } from './util.js';
import { brandClip } from './brand.js';

export const app = { player: null, busy: null }; // filled in by app.js

// ---------- import ----------
export async function importPaths(paths) {
  const added = [];
  for (const p of paths) {
    if (!mediaKind(p)) { toast(`${baseName(p)} is not a supported file`, 'err'); continue; }
    const existing = store.project.media.find((m) => m.path === p);
    if (existing) { added.push(existing); continue; }
    const stop = app.busy?.(`Importing ${baseName(p)}…`);
    try {
      const m = await probe(p, (msg) => app.busy?.(msg));
      store.project.media.push(m);
      added.push(m);
      warm(m);
      store.dirty = true;
      store.emit('media');
    } catch (e) {
      toast(`Could not import ${baseName(p)}: ${e.message}`, 'err', 6000);
    } finally { stop?.(); app.busy?.(null); }
  }
  return added;
}

async function libraryMedia(item) {
  const stop = app.busy?.(`Preparing ${item.name}…`);
  try {
    const path = await libraryAudioPath(item);
    let m = store.project.media.find((x) => x.path === path);
    if (!m) {
      m = await probe(path);
      m.name = item.name;
      m.library = item.id;
      store.project.media.push(m);
      warm(m);
      store.emit('media');
    }
    return m;
  } finally { stop?.(); app.busy?.(null); }
}

// ---------- creating clips ----------
export async function clipFromPayload(pl) {
  if (pl.kind === 'media') {
    const m = mediaById(pl.id);
    if (!m) return null;
    if (m.missing) { toast('That file is missing on disk.', 'err'); return null; }
    const c = makeClip(m.type, { mediaId: m.id, name: m.name, duration: m.type === 'image' ? 5 : m.duration });
    if (m.type === 'video' && m.hasAudio === false) c.muted = true;
    return c;
  }
  if (pl.kind === 'audio-lib') {
    const item = AUDIO_LIBRARY.find((a) => a.id === pl.id);
    const m = await libraryMedia(item);
    return makeClip('audio', { mediaId: m.id, name: item.name, duration: m.duration });
  }
  if (pl.kind === 'title') { const t = titleById(pl.id); return brandClip(makeClip('title', { template: t.id, name: t.name, duration: t.dur, params: { texts: [...t.texts], colors: [...t.colors] } }), t); }
  if (pl.kind === 'element') { const t = elementById(pl.id); return brandClip(makeClip('element', { template: t.id, name: t.name, duration: t.dur, params: { colors: [...t.colors] } }), t); }
  if (pl.kind === 'background') { const t = backgroundById(pl.id); return makeClip('background', { template: t.id, name: t.name, duration: 5, params: { colors: [...t.colors] } }); }
  if (pl.kind === 'effect') { const e = effectById(pl.id); return makeClip('adjust', { name: e.name, duration: 5, effects: [{ id: e.id, amount: e.def }] }); }
  if (pl.kind === 'filter') { const f = filterById(pl.id); return makeClip('adjust', { name: f.name, duration: 5, filter: { id: f.id, amount: 1 } }); }
  return null;
}

// Place a library item. at = { trackId, time } from a drop, or omitted to use the playhead.
export async function insertItem(pl, at) {
  if (pl.kind === 'transition') return addTransitionAtPlayhead(pl.id);
  if (pl.kind === 'pack') return insertPack(packById(pl.id), at);
  if ((pl.kind === 'effect' || pl.kind === 'filter') && !at) {
    const targets = selectedClips().filter((c) => VISUAL.has(c.type) && c.type !== 'adjust');
    if (targets.length) { edit(() => targets.forEach((c) => applyLook(c, pl))); toast(`Applied ${pl.kind === 'effect' ? effectById(pl.id).name : filterById(pl.id).name}`); return; }
  }
  const c = await clipFromPayload(pl);
  if (!c) return;
  const kind = c.type === 'audio' ? 'audio' : 'video';
  edit(() => {
    let t = at?.time ?? store.time;
    let track = at?.trackId ? trackById(at.trackId) : null;
    if (at?.newTrack) track = ensureTrack(kind, at.newTrack);
    if (track && track.kind !== kind) track = null;
    if (!track) {
      if ((c.type === 'video' || c.type === 'image') && !at) {
        const main = mainTrack();
        const busy = trackClips(main.id).some((o) => o.start < t + c.duration - EPS && clipEnd(o) > t + EPS);
        if (busy) t = trackClips(main.id).reduce((m, o) => Math.max(m, clipEnd(o)), 0);
        track = main;
      } else track = freeTrack(kind, t, t + c.duration, c.type === 'video' || c.type === 'image' ? mainTrack() : null);
    }
    c.trackId = track.id;
    c.start = Math.max(0, t);
    addClip(c);
    select(c.id);
  });
  if (!at) app.player?.seek(store.time);
}

// ---------- intro / outro packs ----------
// Intros added with + go at the very start (everything else shifts later); outros go at the end.
// A drop places the pack at the drop point, stacking its layers upward from the dropped track.
export async function insertPack(pack, at, quiet = false) {
  if (!pack) return;
  const made = [];
  for (const L of pack.layers) {
    const kind = L.kind === 'audio' ? 'audio-lib' : L.kind;
    const c = await clipFromPayload({ kind, id: L.id });
    if (!c) continue;
    c.duration = L.dur ?? (L.kind === 'audio' ? Math.min(c.duration, pack.dur - (L.at || 0)) : pack.dur - (L.at || 0));
    if (c.params && (L.texts || L.colors || L.params)) {
      if (L.texts) c.params.texts = [...L.texts];
      if (L.colors) c.params.colors = [...L.colors];
      if (L.params) Object.assign(c.params, L.params);
      brandClip(c, L.kind === 'title' ? titleById(L.id) : L.kind === 'element' ? elementById(L.id) : null);
    }
    if (c.transform) Object.assign(c.transform, { x: L.x ?? 0, y: L.y ?? 0, scale: L.scale ?? 1 });
    made.push({ c, off: L.at || 0, audio: L.kind === 'audio' });
  }
  edit(() => {
    let t;
    if (at) t = at.time;
    else if (pack.cat === 'Intros') {
      t = 0;
      for (const o of store.project.clips) o.start += pack.dur;
    } else t = projectDuration();
    const vids = () => videoTracks();
    let idx = at?.trackId && trackById(at.trackId)?.kind === 'video' ? vids().indexOf(trackById(at.trackId)) : vids().indexOf(mainTrack());
    if (at?.newTrack) idx = -1;
    const ids = [];
    for (const { c, off, audio } of made) {
      c.start = t + off;
      if (audio) { c.trackId = freeTrack('audio', c.start, clipEnd(c)).id; addClip(c, { overwrite: false }); ids.push(c.id); continue; }
      let track = null;
      for (let i = idx; i >= 0; i--) {
        const tr = vids()[i];
        if (!tr.locked && !trackClips(tr.id).some((o) => o.start < clipEnd(c) - EPS && clipEnd(o) > c.start + EPS)) { track = tr; idx = i - 1; break; }
      }
      if (!track) { track = ensureTrack('video', 'top'); idx = -1; }
      c.trackId = track.id;
      addClip(c, { overwrite: false });
      ids.push(c.id);
    }
    select(ids);
    store.time = t;
  });
  app.player?.seek(store.time);
  if (!quiet) toast(`Added ${pack.name}. Select any piece to edit its text or move it.`);
}

function applyLook(c, pl) {
  if (pl.kind === 'filter') c.filter = { id: pl.id, amount: 1 };
  else if (!c.effects.some((e) => e.id === pl.id)) c.effects.push({ id: pl.id, amount: effectById(pl.id).def });
}

export function applyLookToClip(clipId, pl) {
  const c = clipById(clipId);
  if (!c || !VISUAL.has(c.type)) return false;
  edit(() => applyLook(c, pl));
  select(c.id);
  return true;
}

// ---------- transitions ----------
export function setTransition(clip, side, id, duration = 1) {
  const tr = { id, duration: Math.min(duration, clip.duration) };
  if (side === 'in') clip.tIn = tr; else clip.tOut = tr;
}

export function addTransitionAtPlayhead(id) {
  const t = store.time;
  let target = selectedClips().find((c) => VISUAL.has(c.type));
  let side = 'in';
  if (!target) {
    // nearest cut on the main track
    const clips = trackClips(mainTrack().id);
    let best = null, bd = Infinity;
    for (const c of clips) {
      const ds = Math.abs(c.start - t);
      if (ds < bd) { bd = ds; best = c; side = 'in'; }
      const de = Math.abs(clipEnd(c) - t);
      if (de < bd && !nextAdjacent(c)) { bd = de; best = c; side = 'out'; }
    }
    target = best;
  } else if (Math.abs(clipEnd(target) - t) < Math.abs(target.start - t) && !nextAdjacent(target)) side = 'out';
  if (!target) { toast('Add a clip to the timeline first.', 'err'); return; }
  edit(() => setTransition(target, side, id));
  toast(`Added ${transitionById(id).name}`);
}

// ---------- edit commands ----------
export function splitAtPlayhead() {
  const t = store.time;
  let targets = selectedClips().filter((c) => c.start < t && clipEnd(c) > t);
  if (!targets.length) targets = store.project.clips.filter((c) => c.start < t - 0.02 && clipEnd(c) > t + 0.02 && !trackById(c.trackId)?.locked);
  if (!targets.length) return;
  edit(() => {
    const created = targets.map((c) => splitClip(c, t)).filter(Boolean);
    if (created.length) select(created.map((c) => c.id));
  });
}

export function deleteSelected(ripple = false) {
  if (store.selectedTransition) {
    const { clipId, side } = store.selectedTransition;
    const c = clipById(clipId);
    if (c) edit(() => { if (side === 'in') c.tIn = null; else c.tOut = null; });
    store.selectedTransition = null;
    store.emit('selection');
    return;
  }
  const ids = [...store.selection].filter((id) => !trackById(clipById(id)?.trackId)?.locked);
  if (!ids.length) return;
  edit(() => removeClips(ids, ripple));
  store.emit('selection');
}

export function duplicateSelected() {
  const sel = selectedClips();
  if (!sel.length) return;
  edit(() => {
    const out = sel.map((c) => {
      const n = cloneClip(c);
      n.start = clipEnd(c);
      addClip(n);
      return n.id;
    });
    select(out);
  });
}

export function copySelected() {
  const sel = selectedClips();
  if (!sel.length) return;
  const t0 = Math.min(...sel.map((c) => c.start));
  store.clipboard = sel.map((c) => ({ ...JSON.parse(JSON.stringify(c)), _off: c.start - t0 }));
  toast(`Copied ${sel.length} clip${sel.length > 1 ? 's' : ''}`);
}
export function cutSelected() { copySelected(); deleteSelected(); }
export function paste() {
  if (!store.clipboard?.length) return;
  edit(() => {
    const ids = store.clipboard.map((src) => {
      const n = cloneClip(src);
      n.start = store.time + src._off;
      delete n._off;
      if (!trackById(n.trackId)) n.trackId = freeTrack(n.type === 'audio' ? 'audio' : 'video', n.start, n.start + n.duration).id;
      addClip(n);
      return n.id;
    });
    select(ids);
  });
}

export function freezeFrame() {
  const c = selectedClips().find((x) => x.type === 'video') || store.project.clips.find((x) => x.type === 'video' && x.start <= store.time && clipEnd(x) > store.time);
  if (!c) { toast('Select a video clip under the playhead to freeze a frame.', 'err'); return; }
  const t = store.time;
  if (t <= c.start || t >= clipEnd(c)) { toast('Move the playhead over the clip first.', 'err'); return; }
  // Freeze uses a 0-speed hold: split, insert a 2s still, ripple the rest.
  edit(() => {
    const right = splitClip(c, t) || null;
    const hold = cloneClip(c);
    hold.start = t;
    hold.in = c.in + (t - c.start) * (c.speed || 1);
    hold.speed = 0.0001;
    hold.duration = 2;
    hold.muted = true;
    hold.tIn = hold.tOut = null;
    hold.name = 'Freeze frame';
    for (const o of store.project.clips) if (o.trackId === c.trackId && o.start >= t - EPS && o.id !== hold.id) o.start += 2;
    store.project.clips.push(hold);
    select(hold.id);
    return right;
  });
}

export function detachAudio() {
  const vids = selectedClips().filter((c) => c.type === 'video' && !c.muted);
  if (!vids.length) { toast('Select a video clip with sound.', 'err'); return; }
  edit(() => {
    const ids = vids.map((v) => {
      const a = makeClip('audio', { mediaId: v.mediaId, name: `${v.name} (audio)`, duration: v.duration, in: v.in, start: v.start });
      a.speed = v.speed; a.volume = v.volume; a.fadeIn = v.fadeIn; a.fadeOut = v.fadeOut; a.audioFx = JSON.parse(JSON.stringify(v.audioFx || a.audioFx));
      a.trackId = freeTrack('audio', a.start, clipEnd(a)).id;
      addClip(a, { overwrite: false });
      v.muted = true;
      return a.id;
    });
    select(ids);
  });
  toast('Audio detached to its own track');
}

export function setSpeed(c, speed) {
  const oldSpeed = c.speed || 1;
  const srcLen = c.duration * oldSpeed;
  c.speed = speed;
  c.duration = Math.min(srcLen / speed, maxDuration(c));
}

export function selectAll() { select(store.project.clips.map((c) => c.id)); }

export function nudgeSelection(dt) {
  const sel = selectedClips();
  if (!sel.length) return;
  edit(() => sel.forEach((c) => { c.start = Math.max(0, c.start + dt); }));
}

export { checkpoint, changed, AUDIBLE, prevAdjacent };

// ---------- starter templates ----------
// Lays out intro, placeholder scenes (named after what to drop there), overlays, outro and music.
export async function buildFromTemplate(tpl) {
  const main = mainTrack();
  let t = 0;
  const intro = packById(tpl.intro), outro = packById(tpl.outro);
  if (intro) {
    await insertPack(intro, { time: 0, trackId: main.id }, true);
    if (tpl.introTexts) { const ti = store.project.clips.find((c) => c.type === 'title' && c.start < intro.dur); if (ti) ti.params.texts = [...tpl.introTexts]; }
    t += intro.dur;
  }
  for (const [label, dur, bg, trans, over] of tpl.scenes) {
    const c = await clipFromPayload({ kind: 'background', id: bg });
    const isEl = over && /^(el-|emo-)/.test(over[0]);
    const overlay = over ? await clipFromPayload({ kind: isEl ? 'element' : 'title', id: over[0] }) : null;
    edit(() => {
      c.name = `Your clip: ${label}`;
      c.start = t; c.duration = dur; c.trackId = main.id;
      if (trans) c.tIn = { id: trans, duration: 0.8 };
      addClip(c, { overwrite: false });
      if (overlay) {
        if (Array.isArray(over[1])) overlay.params.texts = [...over[1]]; else if (over[1]) Object.assign(overlay.params, over[1]);
        overlay.start = t + 0.4; overlay.duration = Math.max(1, dur - 0.8);
        overlay.trackId = freeTrack('video', overlay.start, clipEnd(overlay), videoTracks()[videoTracks().indexOf(main) - 1]).id;
        addClip(overlay, { overwrite: false });
      }
    });
    t += dur;
  }
  if (outro) {
    await insertPack(outro, { time: t, trackId: main.id }, true);
    edit(() => { const first = store.project.clips.find((c) => c.trackId === main.id && Math.abs(c.start - t) < 1e-6); if (first) first.tIn = { id: 'dissolve', duration: 0.8 }; });
    t += outro.dur;
  }
  if (tpl.music) {
    const m = await clipFromPayload({ kind: 'audio-lib', id: tpl.music });
    edit(() => {
      m.start = 0; m.duration = Math.min(m.duration, t); m.fadeOut = Math.min(2.5, m.duration / 3); m.volume = 0.6;
      m.trackId = freeTrack('audio', 0, m.duration).id;
      addClip(m, { overwrite: false });
    });
  }
  store.undoStack.length = 0;
  store.redoStack.length = 0;
  select([]);
  app.player?.seek(0);
}
