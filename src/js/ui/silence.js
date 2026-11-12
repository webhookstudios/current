// Remove pauses: find the quiet stretches of a clip from its waveform, show them, then cut them
// out and close the gaps (later clips on the same track move up). One undo step.
import { h, clamp } from '../util.js';
import { store, edit, mediaById, cloneClip, select, clipById } from '../state.js';
import { peaks, playPath, loadPeaks } from '../engine/media.js';
import { app } from '../actions.js';
import { modal, slider, toast } from './widgets.js';

const PPS = 50; // waveform peaks per second

// Pauses in clip time [[from, to], ...]. rel: dB below the clip's loudest part that counts as
// quiet; minLen: shortest pause to cut; pad: silence to keep next to speech.
export function findPauses(c, { rel = 30, minLen = 0.7, pad = 0.15 } = {}) {
  c = clipById(c.id) || c; // undo replaces clip objects, so always use the current one
  const m = mediaById(c.mediaId);
  const pk = m && peaks.get(playPath(m));
  if (!pk) return null;
  const speed = c.speed || 1;
  const s0 = c.in || 0, s1 = s0 + c.duration * speed;
  const i0 = Math.floor(s0 * PPS), i1 = Math.min(pk.length, Math.ceil(s1 * PPS));
  let max = 0;
  for (let i = i0; i < i1; i++) max = Math.max(max, pk[i]);
  if (max <= 0) return [];
  const thr = max * Math.pow(10, -rel / 20);
  const out = [];
  let start = -1;
  for (let i = i0; i <= i1; i++) {
    const quiet = i < i1 && pk[i] < thr;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      const a = start / PPS + (start === i0 ? 0 : pad), b = i / PPS - (i === i1 ? 0 : pad);
      if ((i - start) / PPS >= minLen && b - a > 0.05) out.push([clamp((a - s0) / speed, 0, c.duration), clamp((b - s0) / speed, 0, c.duration)]);
      start = -1;
    }
  }
  return out;
}

export function removePauses(c, pauses) {
  c = clipById(c.id);
  if (!c) return [];
  if (!pauses.length) return [];
  const keep = [];
  let cur = 0;
  for (const [a, b] of pauses) { if (a > cur + 0.02) keep.push([cur, a]); cur = Math.max(cur, b); }
  if (cur < c.duration - 0.02) keep.push([cur, c.duration]);
  if (!keep.length) return [];
  const removed = c.duration - keep.reduce((s, [a, b]) => s + b - a, 0);
  const p = store.project, speed = c.speed || 1;
  const orig = { in: c.in || 0, start: c.start, end: c.start + c.duration, tOut: c.tOut, fadeOut: c.fadeOut };
  const ids = [];
  edit(() => {
    for (const o of p.clips) if (o.trackId === c.trackId && o.id !== c.id && o.start >= orig.end - 0.001) o.start -= removed;
    let t = orig.start;
    keep.forEach(([a, b], i) => {
      const part = i === 0 ? c : cloneClip(c);
      part.start = t;
      part.in = orig.in + a * speed;
      part.duration = b - a;
      if (i > 0) { part.tIn = null; part.fadeIn = 0; }
      if (i < keep.length - 1) { part.tOut = null; part.fadeOut = 0; } else { part.tOut = orig.tOut; part.fadeOut = Math.min(orig.fadeOut || 0, part.duration); }
      if (i > 0) p.clips.push(part);
      t += b - a;
      ids.push(part.id);
    });
    select(ids);
  });
  return ids;
}

export async function openRemovePauses(c) {
  const m = mediaById(c.mediaId);
  if (!m) return;
  if (!peaks.get(playPath(m))) {
    const stop = app.busy?.('Reading the sound…');
    try { await loadPeaks(playPath(m), m); } finally { stop?.(); app.busy?.(null); }
  }
  const opts = { rel: 30, minLen: 0.7, pad: 0.15 };
  const cv = h('canvas.sil-wave', { width: 900, height: 120 });
  const summary = h('div.sil-sum');
  let found = [];
  const draw = () => {
    found = findPauses(c, opts) || [];
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const pk = peaks.get(playPath(m)), speed = c.speed || 1, s0 = c.in || 0;
    ctx.fillStyle = 'rgba(236,138,119,0.22)';
    for (const [a, b] of found) ctx.fillRect((a / c.duration) * W, 0, ((b - a) / c.duration) * W, H);
    ctx.fillStyle = '#1fd1b9';
    for (let x = 0; x < W; x++) {
      const src = s0 + (x / W) * c.duration * speed;
      const v = pk ? pk[Math.floor(src * PPS)] || 0 : 0;
      const hh = Math.max(1, v * H * 0.9);
      ctx.fillRect(x, H / 2 - hh / 2, 1, hh);
    }
    const total = found.reduce((s, [a, b]) => s + b - a, 0);
    summary.textContent = found.length ? `${found.length} pause${found.length > 1 ? 's' : ''} found. ${total.toFixed(1)} s will be cut, and the clip gets ${total.toFixed(1)} s shorter.` : 'No pauses found with these settings. Try a lower “Shorter than” or a higher “Quieter than”.';
    btn.disabled = !found.length;
  };
  const body = h('div.sil',
    h('div.hint', 'The shaded parts are the pauses that will be cut. Clips after this one on the same track move up to close the gaps. Clips on other tracks stay where they are.'),
    cv, summary,
    slider({ label: 'Quieter than', min: 12, max: 50, step: 1, value: opts.rel, unit: 'dB below the loudest part', onInput: (v) => { opts.rel = v; draw(); } }),
    slider({ label: 'Longer than', min: 0.2, max: 3, step: 0.1, value: opts.minLen, unit: 's', onInput: (v) => { opts.minLen = v; draw(); } }),
    slider({ label: 'Keep around speech', min: 0, max: 0.5, step: 0.05, value: opts.pad, unit: 's', onInput: (v) => { opts.pad = v; draw(); } }));
  const dlg = modal({
    title: 'Remove pauses', body, width: '960px',
    actions: [
      { label: 'Cancel', run: (close) => close() },
      { label: 'Remove pauses', primary: true, run: (close) => {
        const total = found.reduce((s, [a, b]) => s + b - a, 0);
        const ids = removePauses(c, found);
        close();
        if (ids.length) { app.player.seek(store.time); toast(`Removed ${found.length} pauses (${total.toFixed(1)} s). Press Ctrl+Z to undo.`); }
      } },
    ],
  });
  const btn = dlg.el.querySelector('.modal-f .btn.primary');
  draw();
}
