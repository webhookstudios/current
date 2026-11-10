// What is visible/audible at time t: per-track states including transitions.
import { clamp } from '../util.js';

const ADJ = 0.01;

// Returns the state of one track at t:
//   null | { a, b, p, tr }  where a/b are clips (either may be null for fades) and tr the transition,
//   or { a } for a single clip.
export function trackStateAt(clips, t) {
  // clips must be sorted by start
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    if (c.tIn) {
      const d = Math.min(c.tIn.duration, c.duration);
      const prev = clips.find((o) => o !== c && Math.abs(o.start + o.duration - c.start) < ADJ);
      if (prev) {
        const dd = Math.min(d, prev.duration * 2, c.duration * 2);
        const s = c.start - dd / 2;
        if (t >= s && t < s + dd) return { a: prev, b: c, p: (t - s) / dd, tr: c.tIn };
      } else if (t >= c.start && t < c.start + d) return { a: null, b: c, p: (t - c.start) / d, tr: c.tIn };
    }
    if (c.tOut) {
      const d = Math.min(c.tOut.duration, c.duration);
      const end = c.start + c.duration;
      const next = clips.find((o) => o !== c && Math.abs(o.start - end) < ADJ && o.tIn);
      if (!next && t >= end - d && t < end) return { a: c, b: null, p: (t - (end - d)) / d, tr: c.tOut };
    }
  }
  for (const c of clips) if (t >= c.start && t < c.start + c.duration) return { a: c };
  return null;
}

export function sortedByTrack(project) {
  const m = new Map(project.tracks.map((t) => [t.id, []]));
  for (const c of project.clips) m.get(c.trackId)?.push(c);
  for (const arr of m.values()) arr.sort((x, y) => x.start - y.start);
  return m;
}

// Visual layers bottom to top: [{ track, state }]
export function visualStack(project, t, byTrack = sortedByTrack(project)) {
  const out = [];
  const vids = project.tracks.filter((tr) => tr.kind === 'video');
  for (let i = vids.length - 1; i >= 0; i--) {
    const tr = vids[i];
    if (tr.hidden) continue;
    const st = trackStateAt(byTrack.get(tr.id) || [], t);
    if (st) out.push({ track: tr, state: st });
  }
  return out;
}

export function audibleAt(project, t) {
  const muted = new Set(project.tracks.filter((tr) => tr.muted).map((tr) => tr.id));
  return project.clips.filter((c) => (c.type === 'video' || c.type === 'audio') && !muted.has(c.trackId) && t >= c.start && t < c.start + c.duration);
}

export function sourceTime(c, t, mediaDur) {
  const st = (c.in || 0) + (t - c.start) * (c.speed || 1);
  return clamp(st, 0, Math.max(0, (mediaDur || Infinity) - 0.04));
}

export const localTime = (c, t) => clamp(t - c.start, 0, c.duration);

// Clip loudness at t from volume and fades (0..n).
export function clipGain(c, t) {
  if (c.muted) return 0;
  let g = c.volume ?? 1;
  const lt = t - c.start;
  if (c.fadeIn > 0 && lt < c.fadeIn) g *= clamp(lt / c.fadeIn);
  if (c.fadeOut > 0 && lt > c.duration - c.fadeOut) g *= clamp((c.duration - lt) / c.fadeOut);
  return g;
}
