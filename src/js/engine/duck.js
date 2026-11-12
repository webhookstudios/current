// Clip roles and auto-ducking. Music clips with ducking on dip while a voice clip is actually
// talking: speech is found from the voice clips' waveform peaks (50 per second), held across
// short gaps between words, and smoothed so the music fades down and back up instead of jumping.
import { store, mediaById, projectDuration } from '../state.js';
import { peaks, playPath } from './media.js';

export const ROLES = [['voice', 'Voice'], ['music', 'Music'], ['effect', 'Sound effect']];

// What a sound clip is, if the user has not said: voiceovers, recordings and video sound are
// voice; songs from the library and imported audio are music; library sound effects are effects.
export function roleOf(c) {
  if (c.role) return c.role;
  if (c.type === 'video') return 'voice';
  const m = mediaById(c.mediaId);
  if (m?.voiceover || m?.recording || m?.type === 'video' || /^Voiceover \d+$/.test(m?.name || '')) return 'voice'; // incl. sound detached from a video
  if (m?.library && /^sfx-/.test(m.library)) return 'effect';
  return 'music';
}

export const ducks = (c) => (c.type === 'audio' || c.type === 'video') && roleOf(c) === 'music' && !!c.duck?.on;

const RATE = 20;          // envelope points per second
const GATE = 0.04;        // peak level that counts as talking (about −28 dBFS)
const HOLD = 0.35, ATTACK = 0.15, RELEASE = 0.6;

let cache = null;
const invalidate = () => { cache = null; };
store.on('change', invalidate);
store.on('waveform', invalidate);
store.on('media', invalidate);

// 0..1 for each 1/RATE s of the project: how far the music should be down.
export function duckEnvelope(project = store.project) {
  if (cache && cache.project === project) return cache.env;
  const dur = Math.max(0, projectDuration());
  const n = Math.ceil(dur * RATE) + 2;
  const talk = new Uint8Array(n);
  const muted = new Set(project.tracks.filter((t) => t.muted).map((t) => t.id));
  for (const c of project.clips) {
    if (!(c.type === 'video' || c.type === 'audio') || c.muted || muted.has(c.trackId) || roleOf(c) !== 'voice') continue;
    const m = mediaById(c.mediaId);
    const pk = m && peaks.get(c.audioFx?.denoisePath || playPath(m)) || (m && peaks.get(playPath(m)));
    if (!pk) continue;
    const vol = c.volume ?? 1, speed = c.speed || 1;
    const i0 = Math.max(0, Math.floor(c.start * RATE)), i1 = Math.min(n, Math.ceil((c.start + c.duration) * RATE));
    for (let i = i0; i < i1; i++) {
      const src = (c.in || 0) + (i / RATE - c.start) * speed;
      const p = pk[Math.floor(src * 50)] || 0;
      if (p * vol > GATE) talk[i] = 1;
    }
  }
  // hold across short gaps, then smooth with separate attack and release
  const held = new Uint8Array(n);
  let last = -1e9;
  for (let i = 0; i < n; i++) { if (talk[i]) last = i; if (i - last <= HOLD * RATE) held[i] = 1; }
  for (let i = n - 1, next = 1e9; i >= 0; i--) { if (talk[i]) next = i; if (next - i <= ATTACK * RATE) held[i] = 1; } // start dipping just before speech
  const env = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    const target = held[i];
    const k = target > v ? 1 / (ATTACK * RATE) : 1 / (RELEASE * RATE);
    v += Math.max(-k, Math.min(k, target - v));
    env[i] = v;
  }
  cache = { project, env };
  return env;
}

// Multiplier for a clip's volume at timeline time t (1 when not ducking).
export function duckGain(c, t) {
  if (!ducks(c)) return 1;
  const env = duckEnvelope();
  const d = env[Math.max(0, Math.min(env.length - 1, Math.round(t * RATE)))] || 0;
  return Math.pow(10, -(c.duck.amount ?? 12) * d / 20);
}

// The same, as a curve over [start, end] for offline mixing.
export function duckCurve(c, start, end) {
  const n = Math.max(2, Math.ceil((end - start) * RATE) + 1);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = duckGain(c, start + (i / (n - 1)) * (end - start));
  return out;
}
