// Clip motion presets (Animation tab): entrance, exit and continuous motions.
// Each returns a delta { x, y, scale, rotation, opacity } given eased progress k (0 = start of motion, 1 = rest).
import { ease, clamp } from '../util.js';

const IN = [
  ['fade', 'Fade In', (k) => ({ opacity: k })],
  ['zoom-in', 'Zoom In', (k) => ({ scale: 0.4 + 0.6 * k, opacity: k })],
  ['zoom-out', 'Zoom Out', (k) => ({ scale: 1.8 - 0.8 * k, opacity: k })],
  ['slide-left', 'Slide from Right', (k) => ({ x: (1 - k) * 1.0 })],
  ['slide-right', 'Slide from Left', (k) => ({ x: -(1 - k) * 1.0 })],
  ['slide-up', 'Slide from Bottom', (k) => ({ y: (1 - k) * 1.0 })],
  ['slide-down', 'Slide from Top', (k) => ({ y: -(1 - k) * 1.0 })],
  ['rotate', 'Rotate In', (k) => ({ rotation: (1 - k) * -180, scale: k, opacity: k })],
  ['spin', 'Spin In', (k) => ({ rotation: (1 - k) * 360, opacity: k })],
  ['pop', 'Pop', (k) => ({ scale: ease.outBack(k), opacity: clamp(k * 3) }), 'linear'],
  ['bounce', 'Bounce', (k) => ({ y: -(1 - ease.outBounce(k)) * 0.8 }), 'linear'],
  ['swing', 'Swing', (k) => ({ rotation: Math.sin((1 - k) * 12) * 25 * (1 - k), opacity: clamp(k * 3) }), 'linear'],
  ['drop', 'Drop', (k) => ({ y: -(1 - k) * 0.6, scale: 1 + (1 - k) * 0.4, opacity: k })],
  ['flip', 'Flip In', (k) => ({ scaleX: k, opacity: clamp(k * 2) })],
];
const LOOP = [
  ['ken-burns-in', 'Ken Burns Zoom In', (p) => ({ scale: 1 + 0.18 * p })],
  ['ken-burns-out', 'Ken Burns Zoom Out', (p) => ({ scale: 1.18 - 0.18 * p })],
  ['pan-left', 'Pan Left', (p) => ({ scale: 1.15, x: 0.06 - 0.12 * p })],
  ['pan-right', 'Pan Right', (p) => ({ scale: 1.15, x: -0.06 + 0.12 * p })],
  ['pulse', 'Pulse', (p, t) => ({ scale: 1 + Math.sin(t * 6) * 0.04 })],
  ['float', 'Float', (p, t) => ({ y: Math.sin(t * 2) * 0.02, rotation: Math.sin(t * 1.4) * 2 })],
  ['shake', 'Shake', (p, t) => ({ x: Math.sin(t * 47) * 0.006, y: Math.cos(t * 39) * 0.006, rotation: Math.sin(t * 31) * 0.8 })],
  ['wiggle', 'Wiggle', (p, t) => ({ rotation: Math.sin(t * 8) * 6 })],
  ['heartbeat', 'Heartbeat', (p, t) => { const b = t % 1; return { scale: 1 + (b < 0.15 ? Math.sin(b / 0.15 * Math.PI) * 0.08 : b < 0.35 ? Math.sin((b - 0.2) / 0.15 * Math.PI) * 0.05 : 0) }; }],
];

export const ANIM_IN = IN.map(([id, name, f, e]) => ({ id, name, f, e: e || 'outCubic' }));
export const ANIM_OUT = IN.map(([id, name, f, e]) => ({ id, name: name.replace(' In', ' Out').replace(' from ', ' to ').replace('Pop', 'Pop Out').replace('Bounce', 'Bounce Out').replace('Swing', 'Swing Out').replace('Drop', 'Lift Out'), f, e: e || 'outCubic' }));
export const ANIM_LOOP = LOOP.map(([id, name, f]) => ({ id, name, f }));

// Combined transform delta for clip c at local time lt.
export function animDelta(c, lt) {
  const a = c.anim;
  const r = { x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0, opacity: 1 };
  if (!a) return r;
  const apply = (d) => {
    if (d.x) r.x += d.x; if (d.y) r.y += d.y;
    if (d.scale != null) r.scale *= d.scale; if (d.scaleX != null) r.scaleX *= d.scaleX;
    if (d.rotation) r.rotation += d.rotation; if (d.opacity != null) r.opacity *= d.opacity;
  };
  if (a.loop) { const L = ANIM_LOOP.find((x) => x.id === a.loop); if (L) apply(L.f(clamp(lt / c.duration), lt)); }
  if (a.in) {
    const A = ANIM_IN.find((x) => x.id === a.in);
    const raw = clamp(lt / Math.max(0.05, a.inDur || 0.6));
    if (A && raw < 1) apply(A.f(A.e === 'linear' ? raw : ease[A.e](raw)));
  }
  if (a.out) {
    const A = ANIM_OUT.find((x) => x.id === a.out);
    const raw = clamp((c.duration - lt) / Math.max(0.05, a.outDur || 0.6));
    if (A && raw < 1) apply(A.f(A.e === 'linear' ? raw : ease[A.e](raw)));
  }
  return r;
}
