// Building blocks shared by the professional titles and the Sequences (intros, outros and mid-rolls):
// timing, layout, labels, pills, cards, counting numbers and a few simple drawn icons.
// Everything draws with the movable-piece helpers from textfx.js, so each part can be dragged on its own.
import { animText, measure, growRect, line, roundRect, fontStr, piece, drawText } from './textfx.js';
import { ease, clamp, rgba } from '../util.js';

export const tx = (S, i) => S.texts[i] ?? '';
export const col = (S, i) => S.colors[i] || '#ffffff';
export const lerp = (a, b, k) => a + (b - a) * k;
// 0 → 1 over [delay, delay + dur].
export const kin = (S, delay, dur, e = ease.outCubic) => e(clamp((S.t - delay) / Math.max(dur, 0.001)));
// 0 → 1 over [d − before, d − before + dur]: for exits measured back from the end of the clip.
export const kend = (S, before, dur, e = ease.inCubic) => e(clamp((S.t - (S.d - before)) / Math.max(dur, 0.001)));
export const still = (alpha = 1) => ({ anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001, alpha });

// A grid of dots that pop in one by one.
export function dots(c, S, x, y, cols, rows, gap, r, color, delay, step, alpha) {
  c.fillStyle = color;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = ease.outBack(clamp((S.t - delay - (j * cols + i) * step) / 0.3));
    if (k <= 0) continue;
    c.globalAlpha = alpha * Math.min(1, k);
    c.beginPath(); c.arc(x + i * gap, y + j * gap, r * k, 0, Math.PI * 2); c.fill();
  }
}
// A rectangle outline drawn from the top middle down both sides at once; k = 0..1.
// Both halves go into one path, so where they meet there is no doubled, brighter spot.
export function traceRect(c, x, y, w, h, k) {
  const len = (w + h) * k, mx = x + w / 2;
  const walk = (pts) => {
    const out = [pts[0]];
    let left = len;
    for (let i = 1; i < pts.length && left > 0; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const seg = Math.hypot(bx - ax, by - ay), f = Math.min(1, left / seg);
      out.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
      left -= seg;
    }
    return out;
  };
  const right = walk([[mx, y], [x + w, y], [x + w, y + h], [mx, y + h]]);
  const leftHalf = walk([[mx, y], [x, y], [x, y + h], [mx, y + h]]).reverse();
  const pts = [...leftHalf, ...right.slice(1)];
  c.beginPath(); c.moveTo(...pts[0]);
  for (const p of pts.slice(1)) c.lineTo(...p);
  c.stroke();
}
export function checkBadge(c, x, y, r, k, fill, ink, u) {
  if (k <= 0) return;
  c.fillStyle = fill;
  c.beginPath(); c.arc(x, y, r * k, 0, Math.PI * 2); c.fill();
  c.strokeStyle = ink; c.lineWidth = Math.max(2 * u, r * 0.18); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - r * 0.42 * k, y + r * 0.02); c.lineTo(x - r * 0.1 * k, y + r * 0.32 * k); c.lineTo(x + r * 0.45 * k, y - r * 0.3 * k); c.stroke();
}
// Part of a polyline, drawn up to fraction k of its length; returns where it ends.
export function polyPart(c, pts, k) {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let left = segs.reduce((a, b) => a + b, 0) * k;
  c.beginPath(); c.moveTo(...pts[0]);
  let end = pts[0];
  for (let i = 0; i < segs.length && left > 0; i++) {
    const f = Math.min(1, left / segs[i]);
    end = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    c.lineTo(...end);
    left -= segs[i];
  }
  c.stroke();
  return end;
}

// A font that fits text into maxW by shrinking it evenly (fillText's own maxWidth squeezes the letters).
export const fitFont = (ctx, text, family, weight, px, maxW) => { ctx.font = fontStr(family, weight, px); const w = ctx.measureText(text).width; return w > maxW ? fontStr(family, weight, (px * maxW) / w) : ctx.font; };

// Break text into lines no wider than maxFrac of the frame.
export function wrap(ctx, S, text, family, weight, size, maxFrac, fixed = false) {
  ctx.font = fontStr(fixed ? family : S.font || family, weight, size * S.u * (S.scale || 1));
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > S.W * maxFrac && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}
// The same with a text style object (see TY below).
export const wrapO = (ctx, S, text, o, maxFrac) => wrap(ctx, S, o.upper ? String(text).toUpperCase() : text, o.font, o.weight, o.size, maxFrac, o.fontFixed);

// ---------- layout ----------
// The frame: margins, whether it is tall (9:16) or square-ish, and the shared fade at the end.
export function frame(S) {
  const u = S.u, W = S.W, H = S.H, tall = W < H * 0.9, square = !tall && W < H * 1.25;
  const mx = Math.max(W * 0.08, 60 * u), my = Math.max(H * 0.1, 60 * u);
  return { u, W, H, tall, square, mx, my, cw: W - mx * 2, ch: H - my * 2, fo: 1 - kend(S, 0.6, 0.6) };
}

// Text styles. Titles follow a brand kit's font; labels and body text keep theirs.
export const TY = {
  label: { font: 'Montserrat', fontFixed: true, weight: 700, size: 26, spacing: 0.22, upper: true },
  title: { font: 'Montserrat', weight: 800, size: 84 },
  big: { font: 'Montserrat', weight: 800, size: 120 },
  head: { font: 'Montserrat', weight: 800, size: 46 },
  body: { font: 'Inter', fontFixed: true, weight: 400, size: 38 },
  small: { font: 'Inter', fontFixed: true, weight: 400, size: 30 },
  strong: { font: 'Inter', fontFixed: true, weight: 700, size: 38 },
  num: { font: 'Montserrat', fontFixed: true, weight: 800, size: 40 },
  hand: { font: 'Caveat', fontFixed: true, weight: 700, size: 56 },
};
export const sized = (o, size, extra = {}) => ({ ...o, size, ...extra });

// A stack of lines drawn one under another from top y: [{ text, o, color, gap, anim, delay }].
// Returns the total height, so callers can measure first (draw = false) and centre the block.
export function stack(ctx, S, items, x, y, { align = 'left', maxW = 0.8, draw = true, out = {} } = {}) {
  let h = 0;
  items.forEach((it, i) => {
    if (it.text == null || it.text === '') return;
    const m = measure(ctx, S, it.text, it.o);
    const fit = m.w > maxW * S.W ? (maxW * S.W) / m.w : 1;
    if (i && h) h += (it.gap ?? 18) * S.u;
    if (draw) animText(ctx, S, it.text, x, y + h + (m.h * fit) / 2, { ...it.o, color: it.color, align, maxWidth: maxW, anim: it.anim || 'up', delay: it.delay ?? 0.2 + i * 0.15, inDur: it.inDur ?? 0.5, stagger: it.stagger ?? (it.anim === 'fade' ? 0 : 0.012), ...out });
    h += m.h * fit;
  });
  return h;
}

// A pill as wide as its text (up to maxW px), which grows open and then shows the text.
// align 'left' puts its left edge at x, 'center' its middle. Returns { w, h }.
export function pill(ctx, S, text, x, y, { o = TY.label, bg, ink, delay = 0.2, align = 'left', maxW = S.W * 0.8, padX = 26, h = 54, r } = {}) {
  const u = S.u, pad = padX * u, hh = h * u;
  const m = measure(ctx, S, text, o);
  const w = Math.min(m.w + pad * 2, maxW);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const fo = 1 - kend(S, 0.6, 0.6);
  growRect(ctx, left, y - hh / 2, w, hh, kin(S, delay, 0.4, ease.outExpo), 'l', bg, r ?? hh / 2, fo);
  animText(ctx, S, text, left + w / 2, y, { ...o, color: ink, anim: 'fade', delay: delay + 0.2, inDur: 0.35, maxWidth: (w - pad * 2) / S.W });
  return { w, h: hh };
}

// A rounded card that rises a little and fades in at time delay; draws extra content inside with
// inner(c) in the same piece, so the card and what is printed on it move together.
export function card(ctx, S, b, { color, delay = 0.2, r = 18, rise = 26, border, inner, shadow = 0 } = {}) {
  const u = S.u, fo = 1 - kend(S, 0.6, 0.6);
  piece(ctx, b, (c) => {
    const k = kin(S, delay, 0.5, ease.outCubic);
    if (k <= 0) return;
    c.globalAlpha = fo * k;
    c.translate(0, (1 - k) * rise * u);
    if (shadow) { c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = shadow * u; c.shadowOffsetY = shadow * 0.3 * u; }
    if (color) { c.fillStyle = color; roundRect(c, b.x, b.y, b.w, b.h, r * u); c.fill(); }
    c.shadowColor = 'transparent';
    if (border) { c.strokeStyle = border; c.lineWidth = 3 * u; roundRect(c, b.x, b.y, b.w, b.h, r * u); c.stroke(); }
    if (inner) inner(c, k);
  });
}
// Text printed on a card that has already been drawn: it fades in with its own small delay.
export function cardText(ctx, S, text, x, y, o, color, { align = 'left', maxW, delay = 0.4, anim = 'fade' } = {}) {
  return animText(ctx, S, text, x, y, { ...o, color, align, maxWidth: maxW, anim, delay, inDur: 0.45, stagger: anim === 'fade' ? 0 : 0.01 });
}

// ---------- numbers ----------
// The number in a text, or fallback.
export const numOf = (text, fallback = 0) => { const v = parseFloat(String(text).replace(/,/g, '').replace(/[^\d.-]/g, '')); return Number.isFinite(v) ? v : fallback; };
// A list of numbers from text like "12 18 15 24" or "12, 18, 15".
export const listOf = (text, fallback) => { const v = String(text).split(/[\s,;]+/).map((x) => parseFloat(x)).filter(Number.isFinite); return v.length >= 2 ? v : fallback; };
// The text with its number counted up from zero: "2,480" at k = 0.5 → "1,240". Keeps any words,
// signs, currency and decimals around the number.
export function countUp(text, k) {
  const m = String(text).match(/^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!m || k >= 1) return String(text);
  const raw = m[2].replace(/,/g, ''), dec = (raw.split('.')[1] || '').length;
  let s = (parseFloat(raw) * clamp(k)).toFixed(dec);
  if (m[2].includes(',')) { const [a, b] = s.split('.'); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); }
  return m[1] + s + m[3];
}

// ---------- small drawn icons ----------
// Each draws centred at (x, y) with size r (about the radius), in color, scaled by k.
export function glyph(c, name, x, y, r, color, k = 1, u = 1) {
  if (k <= 0) return;
  c.save();
  c.translate(x, y); c.scale(k, k);
  c.fillStyle = color; c.strokeStyle = color; c.lineWidth = Math.max(2 * u, r * 0.16); c.lineCap = 'round'; c.lineJoin = 'round';
  const R = r;
  switch (name) {
    case 'bulb':
      c.beginPath(); c.arc(0, -R * 0.2, R * 0.62, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(R * 0.28, R * 0.55); c.lineTo(-R * 0.28, R * 0.55); c.closePath(); c.fill();
      c.fillRect(-R * 0.28, R * 0.66, R * 0.56, R * 0.14); c.fillRect(-R * 0.2, R * 0.86, R * 0.4, R * 0.12);
      break;
    case 'pause': c.fillRect(-R * 0.42, -R * 0.55, R * 0.3, R * 1.1); c.fillRect(R * 0.12, -R * 0.55, R * 0.3, R * 1.1); break;
    case 'check': c.beginPath(); c.moveTo(-R * 0.5, 0); c.lineTo(-R * 0.12, R * 0.4); c.lineTo(R * 0.55, -R * 0.42); c.stroke(); break;
    case 'cross': c.beginPath(); c.moveTo(-R * 0.42, -R * 0.42); c.lineTo(R * 0.42, R * 0.42); c.moveTo(R * 0.42, -R * 0.42); c.lineTo(-R * 0.42, R * 0.42); c.stroke(); break;
    case 'plus': c.beginPath(); c.moveTo(-R * 0.45, 0); c.lineTo(R * 0.45, 0); c.moveTo(0, -R * 0.45); c.lineTo(0, R * 0.45); c.stroke(); break;
    case 'minus': c.beginPath(); c.moveTo(-R * 0.45, 0); c.lineTo(R * 0.45, 0); c.stroke(); break;
    case 'arrow': c.beginPath(); c.moveTo(-R * 0.55, 0); c.lineTo(R * 0.5, 0); c.moveTo(R * 0.1, -R * 0.4); c.lineTo(R * 0.52, 0); c.lineTo(R * 0.1, R * 0.4); c.stroke(); break;
    case 'question':
      c.beginPath(); c.arc(0, -R * 0.25, R * 0.36, Math.PI * 1.05, Math.PI * 2.35); c.lineTo(0, R * 0.18); c.stroke();
      c.beginPath(); c.arc(0, R * 0.52, R * 0.09, 0, Math.PI * 2); c.fill();
      break;
    case 'pin':
      c.beginPath(); c.arc(0, -R * 0.25, R * 0.55, Math.PI * 0.82, Math.PI * 2.18); c.lineTo(0, R * 0.85); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, -R * 0.25, R * 0.22, 0, Math.PI * 2); c.fill();
      break;
    case 'book':
      c.beginPath(); c.moveTo(0, -R * 0.45); c.quadraticCurveTo(-R * 0.45, -R * 0.62, -R * 0.9, -R * 0.45); c.lineTo(-R * 0.9, R * 0.55); c.quadraticCurveTo(-R * 0.45, R * 0.38, 0, R * 0.55);
      c.quadraticCurveTo(R * 0.45, R * 0.38, R * 0.9, R * 0.55); c.lineTo(R * 0.9, -R * 0.45); c.quadraticCurveTo(R * 0.45, -R * 0.62, 0, -R * 0.45); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.lineWidth = Math.max(2 * u, R * 0.08); c.beginPath(); c.moveTo(0, -R * 0.4); c.lineTo(0, R * 0.48); c.stroke();
      break;
    case 'flask':
      c.beginPath(); c.moveTo(-R * 0.2, -R * 0.8); c.lineTo(-R * 0.2, -R * 0.2); c.lineTo(-R * 0.7, R * 0.7); c.lineTo(R * 0.7, R * 0.7); c.lineTo(R * 0.2, -R * 0.2); c.lineTo(R * 0.2, -R * 0.8); c.stroke();
      c.beginPath(); c.moveTo(-R * 0.48, R * 0.3); c.lineTo(R * 0.48, R * 0.3); c.lineTo(R * 0.7, R * 0.7); c.lineTo(-R * 0.7, R * 0.7); c.closePath(); c.fill();
      break;
    case 'pencil':
      c.rotate(-Math.PI / 4);
      c.fillRect(-R * 0.6, -R * 0.18, R * 1.0, R * 0.36);
      c.beginPath(); c.moveTo(R * 0.45, -R * 0.18); c.lineTo(R * 0.8, 0); c.lineTo(R * 0.45, R * 0.18); c.closePath(); c.fill();
      break;
    case 'clock':
      c.beginPath(); c.arc(0, 0, R * 0.7, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R * 0.42); c.moveTo(0, 0); c.lineTo(R * 0.3, R * 0.12); c.stroke();
      break;
    case 'calendar':
      roundRect(c, -R * 0.75, -R * 0.6, R * 1.5, R * 1.35, R * 0.18); c.stroke();
      c.fillRect(-R * 0.75, -R * 0.6, R * 1.5, R * 0.36);
      c.fillRect(-R * 0.45, -R * 0.85, R * 0.14, R * 0.4); c.fillRect(R * 0.31, -R * 0.85, R * 0.14, R * 0.4);
      break;
    case 'person':
      c.beginPath(); c.arc(0, -R * 0.38, R * 0.32, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, R * 0.62, R * 0.6, Math.PI, 0); c.closePath(); c.fill();
      break;
    case 'target':
      c.beginPath(); c.arc(0, 0, R * 0.75, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, R * 0.42, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, R * 0.14, 0, Math.PI * 2); c.fill();
      break;
    case 'speaker':
      c.beginPath(); c.moveTo(-R * 0.7, -R * 0.25); c.lineTo(-R * 0.3, -R * 0.25); c.lineTo(R * 0.25, -R * 0.65); c.lineTo(R * 0.25, R * 0.65); c.lineTo(-R * 0.3, R * 0.25); c.lineTo(-R * 0.7, R * 0.25); c.closePath(); c.fill();
      c.beginPath(); c.arc(R * 0.3, 0, R * 0.5, -Math.PI / 4, Math.PI / 4); c.stroke();
      break;
    case 'chat':
      roundRect(c, -R * 0.8, -R * 0.6, R * 1.6, R * 1.05, R * 0.3); c.fill();
      c.beginPath(); c.moveTo(-R * 0.35, R * 0.4); c.lineTo(-R * 0.55, R * 0.8); c.lineTo(R * 0.05, R * 0.4); c.closePath(); c.fill();
      break;
    case 'mail':
      roundRect(c, -R * 0.8, -R * 0.55, R * 1.6, R * 1.1, R * 0.14); c.stroke();
      c.beginPath(); c.moveTo(-R * 0.75, -R * 0.45); c.lineTo(0, R * 0.12); c.lineTo(R * 0.75, -R * 0.45); c.stroke();
      break;
    case 'phone':
      roundRect(c, -R * 0.42, -R * 0.78, R * 0.84, R * 1.56, R * 0.16); c.stroke();
      c.beginPath(); c.arc(0, R * 0.52, R * 0.08, 0, Math.PI * 2); c.fill();
      break;
    case 'globe':
      c.beginPath(); c.arc(0, 0, R * 0.72, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(0, 0, R * 0.32, R * 0.72, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-R * 0.72, 0); c.lineTo(R * 0.72, 0); c.stroke();
      break;
    case 'flag':
      c.beginPath(); c.moveTo(-R * 0.5, R * 0.8); c.lineTo(-R * 0.5, -R * 0.75); c.stroke();
      c.beginPath(); c.moveTo(-R * 0.5, -R * 0.75); c.lineTo(R * 0.6, -R * 0.5); c.lineTo(-R * 0.5, -R * 0.1); c.closePath(); c.fill();
      break;
    case 'megaphone':
      c.beginPath(); c.moveTo(-R * 0.7, -R * 0.2); c.lineTo(R * 0.55, -R * 0.65); c.lineTo(R * 0.55, R * 0.65); c.lineTo(-R * 0.7, R * 0.2); c.closePath(); c.fill();
      c.fillRect(-R * 0.55, R * 0.15, R * 0.22, R * 0.5);
      break;
    case 'heart':
      c.beginPath(); c.moveTo(0, R * 0.7); c.bezierCurveTo(-R * 1.0, 0, -R * 0.55, -R * 0.85, 0, -R * 0.35); c.bezierCurveTo(R * 0.55, -R * 0.85, R * 1.0, 0, 0, R * 0.7); c.fill();
      break;
    case 'gem':
      c.beginPath(); c.moveTo(-R * 0.7, -R * 0.2); c.lineTo(-R * 0.35, -R * 0.62); c.lineTo(R * 0.35, -R * 0.62); c.lineTo(R * 0.7, -R * 0.2); c.lineTo(0, R * 0.72); c.closePath(); c.fill();
      break;
    case 'rocket':
      c.beginPath(); c.moveTo(0, -R * 0.85); c.quadraticCurveTo(R * 0.45, -R * 0.35, R * 0.3, R * 0.4); c.lineTo(-R * 0.3, R * 0.4); c.quadraticCurveTo(-R * 0.45, -R * 0.35, 0, -R * 0.85); c.fill();
      c.beginPath(); c.moveTo(-R * 0.3, R * 0.1); c.lineTo(-R * 0.6, R * 0.6); c.lineTo(-R * 0.25, R * 0.45); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(R * 0.3, R * 0.1); c.lineTo(R * 0.6, R * 0.6); c.lineTo(R * 0.25, R * 0.45); c.closePath(); c.fill();
      break;
    case 'shield':
      c.beginPath(); c.moveTo(0, -R * 0.8); c.lineTo(R * 0.65, -R * 0.55); c.lineTo(R * 0.6, R * 0.1); c.quadraticCurveTo(R * 0.4, R * 0.6, 0, R * 0.82); c.quadraticCurveTo(-R * 0.4, R * 0.6, -R * 0.6, R * 0.1); c.lineTo(-R * 0.65, -R * 0.55); c.closePath(); c.fill();
      break;
    case 'bars':
      c.fillRect(-R * 0.65, R * 0.05, R * 0.34, R * 0.6); c.fillRect(-R * 0.17, -R * 0.3, R * 0.34, R * 0.95); c.fillRect(R * 0.31, -R * 0.65, R * 0.34, R * 1.3);
      break;
    default: c.beginPath(); c.arc(0, 0, R * 0.5, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
// An icon in a filled circle that pops in at time delay, as its own piece.
export function iconDisc(ctx, S, name, x, y, r, bg, ink, delay = 0.2) {
  const u = S.u, fo = 1 - kend(S, 0.6, 0.6);
  piece(ctx, { x: x - r, y: y - r, w: r * 2, h: r * 2 }, (c) => {
    const k = ease.outBack(clamp((S.t - delay) / 0.45));
    if (k <= 0) return;
    c.globalAlpha = fo;
    c.fillStyle = bg; c.beginPath(); c.arc(x, y, r * k, 0, Math.PI * 2); c.fill();
    glyph(c, name, x, y, r * 0.62, ink, Math.min(1, k), u);
  });
}

// ---------- sequence layout: colours, columns, headers ----------
export const isLight = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return true; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6; };
// The colours of a scene. On dark backgrounds cards are a faint wash of the card colour.
export const K = (S) => { const ink = col(S, 0); return { ink, acc: col(S, 1), acc2: col(S, 2), muted: col(S, 3), surf: isLight(ink) ? rgba(col(S, 4), 0.1) : col(S, 4), on: col(S, 5), dark: isLight(ink) }; };
// Content width and left edge: the frame minus margins, never wider than 1500 px at 1080p.
export const area = (f) => { const cw = Math.min(f.cw, 1500 * f.u); return { cw, x0: (f.W - cw) / 2 }; };
export const fo = (S) => 1 - kend(S, 0.6, 0.6);

// An icon in a circle with a tag pill beside it, then the title (wrapped) under them.
// Returns the height; draw = false only measures.
export function header(ctx, S, f, k, { icon, tag, title, x, y, align = 'left', maxW, size = 72, draw = true, delay = 0.1, tagBg }) {
  const u = f.u, r = 32 * u;
  const pw = tag ? measure(ctx, S, tag, TY.label).w + 52 * u : 0;
  const rowH = icon ? r * 2 : tag ? 54 * u : 0;
  const rowW = (icon ? r * 2 + (tag ? 18 * u : 0) : 0) + pw;
  const t = title ? wrapO(ctx, S, title, sized(TY.title, size), maxW) : '';
  const mt = t ? measure(ctx, S, t, sized(TY.title, size)) : { h: 0 };
  const gap = rowH && t ? 28 * u : 0;
  if (draw) {
    let rx = align === 'center' ? x - rowW / 2 : x;
    if (icon) { iconDisc(ctx, S, icon, rx + r, y + rowH / 2, r, tagBg || k.acc, k.on, delay); rx += r * 2 + 18 * u; }
    if (tag) pill(ctx, S, tag, rx, y + rowH / 2, { bg: tagBg || k.acc, ink: k.on, delay: delay + 0.08, maxW: maxW * S.W - (icon ? r * 2 + 18 * u : 0) });
    if (t) animText(ctx, S, t, x, y + rowH + gap + mt.h / 2, { ...sized(TY.title, size), color: k.ink, align, maxWidth: maxW, anim: 'up', delay: delay + 0.25, inDur: 0.5, stagger: 0.008 });
  }
  return rowH + gap + mt.h;
}
// Wrapped text drawn centred on (x, y) in one go; returns its measured box size.
export function para(ctx, S, text, x, y, o, color, maxW, { align = 'left', delay = 0.6, anim = 'fade', draw = true, top = false } = {}) {
  const t = wrapO(ctx, S, text, o, maxW);
  const m = measure(ctx, S, t, o);
  if (draw) animText(ctx, S, t, x, top ? y + m.h / 2 : y, { ...o, color, align, maxWidth: maxW, anim, delay, inDur: 0.5, stagger: anim === 'fade' ? 0 : 0.006 });
  return m;
}
// A column of blocks, centred in the frame height: blocks = [height, draw(y)].
export function column(f, blocks, gap, mid = f.H / 2) {
  const total = blocks.reduce((a, [h]) => a + h, 0) + gap * (blocks.length - 1);
  let y = mid - total / 2;
  for (const [h, draw] of blocks) { draw(y); y += h + gap; }
}


export { animText, measure, growRect, line, roundRect, fontStr, piece, drawText, ease, clamp, rgba };
