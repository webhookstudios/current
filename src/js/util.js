// Small shared helpers: ids, math, easing, time formatting, DOM building, events.

let idCounter = 0;
export const uid = (p = 'id') => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const EPS = 1e-4;

// Shortcut labels are written the Linux way ("Ctrl+Shift+Z"). On macOS they are shown with the Mac's
// symbols in its usual order (⌥⇧⌘Z); everywhere else the text is left exactly as written.
export const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MAC_MOD = { Alt: '⌥', Shift: '⇧', Ctrl: '⌘' };
const macCombo = (combo) => {
  const parts = combo.split('+'), key = parts.pop();
  const mods = Object.keys(MAC_MOD).filter((m) => parts.includes(m)).map((m) => MAC_MOD[m]).join('');
  return mods + (/^Del(ete)?$/.test(key) ? '⌫' : key);
};
// Any text (tips, toasts): rewrites combos such as "Ctrl+Z" or "Alt+1…7"; plain words are left alone.
export const keys = (text) => (IS_MAC && typeof text === 'string' ? text.replace(/\b(?:(?:Ctrl|Shift|Alt)\+)+[^\s,()/.]+/g, macCombo) : text);
// A shortcut field (menus, the shortcuts list): also shows a lone Delete key as ⌫.
export const keyLabel = (k) => (IS_MAC && /^Del(ete)?$/.test(k) ? '⌫' : keys(k));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  inBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// Seeded random, so templates and generated audio come out the same every time.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function fmtTime(sec, fps = 30, withFrames = true) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec + 1e-6);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const f = Math.floor((sec - total) * fps + 1e-6);
  const p = (n) => String(n).padStart(2, '0');
  return withFrames ? `${p(h)}:${p(m)}:${p(s)}:${p(f)}` : (h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`);
}
export const fmtDur = (sec) => fmtTime(sec, 30, false);
export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}

export const fileUrl = (p) => 'file://' + p.split('/').map(encodeURIComponent).join('/');
export const baseName = (p) => p.split('/').pop();
export const stripExt = (n) => n.replace(/\.[^.]+$/, '');
export const extOf = (p) => (p.match(/\.([^./]+)$/)?.[1] || '').toLowerCase();

const VIDEO_EXT = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mts', 'm2ts', 'ts', 'flv', 'wmv', 'mpg', 'mpeg', '3gp', 'ogv']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'wma']);
export function mediaKind(p) {
  const e = extOf(p);
  if (VIDEO_EXT.has(e)) return 'video';
  if (IMAGE_EXT.has(e)) return 'image';
  if (AUDIO_EXT.has(e)) return 'audio';
  return null;
}

// h('div.card.big', {onclick}, [children]) builds DOM quickly.
export function h(sel, attrs, ...kids) {
  const m = sel.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const node = document.createElement(m?.[1] || 'div');
  (m?.[2]?.match(/[.#][\w-]+/g) || []).forEach((t) => (t[0] === '.' ? node.classList.add(t.slice(1)) : (node.id = t.slice(1))));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value' || k === 'checked' || k === 'selected') node[k] = v;
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return node;
}

export class Emitter {
  constructor() { this.l = {}; }
  on(e, f) { (this.l[e] ||= new Set()).add(f); return () => this.l[e].delete(f); }
  emit(e, ...a) { this.l[e]?.forEach((f) => { try { f(...a); } catch (err) { console.error(err); } }); }
}

export function debounce(f, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

export function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}
export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex).map((c) => clamp(amt >= 0 ? c + (1 - c) * amt : c * (1 + amt)));
  return '#' + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}

// Inline SVG icons (stroke style), used across the UI.
const P = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5v14M18 5 9 12l9 7z"/>',
  next: '<path d="M18 5v14M6 5l9 7-9 7z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  split: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>',
  speed: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  freeze: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.5v5M14 9.5v5"/>',
  detach: '<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>',
  magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3z"/><path d="m5 8 4 4M12 15l4 4"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  media: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  title: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  transition: '<rect x="2" y="6" width="9" height="12" rx="1.5"/><rect x="13" y="6" width="9" height="12" rx="1.5"/><path d="M9 12h6M13 10l2 2-2 2"/>',
  effect: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  filter: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="9" r="6"/><circle cx="12" cy="15" r="6"/>',
  sticker: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.67 2.68M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="17" cy="13" r="2.2" fill="currentColor" stroke="none"/>',
  cc: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17.5 10.2a2.4 2.4 0 1 0 0 3.6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  fullscreen: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  wand: '<path d="m15 4-1-1M15 4l1-1M15 4l-1 1M15 4l1 1M21 10l-1-1M21 10l1-1M21 10l-1 1M21 10l1 1M3 21l12-12 1.5 1.5-12 12z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronR: '<path d="m9 6 6 6-6 6"/>',
  brand: '<path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.4 0l1.9 1.9a2.4 2.4 0 0 1 0 3.4L9.9 19.8"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  shape: '<rect x="3" y="3" width="10" height="10" rx="2.5"/><circle cx="15.5" cy="15.5" r="5.5"/>',
  zoomArea: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3"/><circle cx="14.5" cy="14.5" r="3.5"/><path d="m17 17 4 4"/>',
  pauses: '<path d="M3 10.5v3M6 8v8M9 10.5v3M15 10.5v3M18 8v8M21 10.5v3"/><path d="M12 4v16" stroke-dasharray="2 2.5"/>',
  chart: '<path d="M3 21h18"/><path d="M6 17v-5M11 17V6M16 17v-8M20 17v-3"/>',
  midroll: '<rect x="2" y="5" width="6" height="14" rx="1.5"/><rect x="16" y="5" width="6" height="14" rx="1.5"/><path d="M12 8v8M9.5 12h5"/>',
  news: '<path d="M4 4h12a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M18 8h2v10a2 2 0 0 1-2 2"/><path d="M8 8h6M8 12h6M8 16h3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  marker: '<path d="M6 3h12v13l-6 5-6-5z"/>',
  text: '<path d="M17 6.1H3M21 12.1H3M15.1 18H3"/>',
  color: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2a5.6 5.6 0 0 0 5.6-5.6C22 6 17.5 2 12 2z"/>',
  motion: '<path d="M5 12h14M13 6l6 6-6 6M5 6v12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  aspect: '<rect x="2" y="5" width="20" height="14" rx="2"/>',
};
export const icon = (name, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.classList.add('ic');
  s.innerHTML = P[name] || P.info;
  return s;
};

// Fonts offered in the font menus (all bundled, or standard on Ubuntu).
export const FONTS = ['Montserrat', 'Poppins', 'Inter', 'Oswald', 'Bebas Neue', 'Anton', 'Archivo Black', 'Playfair Display', 'Abril Fatface', 'Lobster', 'Pacifico', 'Dancing Script', 'Great Vibes', 'Caveat', 'Permanent Marker', 'Bangers', 'Righteous', 'Orbitron', 'Monoton', 'Press Start 2P', 'Rubik Mono One', 'Space Grotesk', 'Noto Sans', 'DejaVu Serif', 'Liberation Mono'];
