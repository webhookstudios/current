// Animated text and shape drawing used by title, element and background templates.
// Everything draws on a full-frame 2D canvas. Sizes are given at 1080p and scaled by S.u.
import { clamp, ease, rgba, hash } from '../util.js';

const FALLBACK = ', "Noto Sans", "Noto Color Emoji", sans-serif';
export const fontStr = (family, weight, px) => `${weight} ${Math.max(1, px)}px "${family}"${FALLBACK}`;

// Progress of the in and out phases of a clip with total duration d.
export function phase(S, inDur = 0.8, outDur = 0.6, delay = 0) {
  const a = clamp((S.t - delay) / Math.max(inDur, 0.001));
  const b = clamp((S.t - (S.d - outDur)) / Math.max(outDur, 0.001));
  return { a, b, vis: Math.min(a, 1 - b) };
}

const CHAR_ANIMS = new Set(['letters', 'pop', 'drop', 'up', 'down', 'type', 'wave', 'blur', 'flip', 'spin', 'glitch', 'bounce', 'rise', 'zoom', 'track', 'random']);

/*
 * Draws text with an entrance/exit animation.
 * o: { font, weight, size, color, gradient:[c1,c2], align, anim, outAnim, delay, inDur, outDur, stagger,
 *      stroke:{color,width}, shadow:{color,blur,x,y}, glow, spacing, upper, lineHeight, maxWidth, alpha }
 * Returns the drawn text box {x, y, w, h} (unanimated), useful for decorations.
 */
// ---------- movable pieces ----------
// While a clip's template draws, every animText / growRect / line call is one "piece" with a key
// (p0, p1, ...). A piece's saved offset (params.offsets[key], as fractions of the frame) shifts it,
// and its box is recorded so the preview can offer a handle for each piece.
let CUR = null;
export function beginParts(S) { CUR = S; S._pn = 0; }
export function endParts() { CUR = null; }
function partBegin() {
  if (!CUR) return { key: null, ox: 0, oy: 0 };
  const key = 'p' + CUR._pn++;
  const o = CUR.params?.offsets?.[key];
  return { key, ox: (o?.x || 0) * CUR.W, oy: (o?.y || 0) * CUR.H };
}
function partRecord(P, box, type) {
  if (CUR?.rec && P.key && box && box.w > 0 && box.h > 0) CUR.rec.push({ key: P.key, type, x: box.x, y: box.y, w: box.w, h: box.h });
}

export function animText(ctx, S, text, x, y, o = {}) {
  const P = partBegin();
  const box = animTextRaw(ctx, S, text, x + P.ox, y + P.oy, o);
  partRecord(P, box, 'text');
  return box;
}

// The same drawing without making it a piece of its own, for text that belongs to a larger piece.
export const drawText = (ctx, S, text, x, y, o) => animTextRaw(ctx, S, text, x, y, o);

function animTextRaw(ctx, S, text, x, y, o = {}) {
  if (text == null) return { x, y, w: 0, h: 0 };
  text = String(text);
  if (o.upper) text = text.toUpperCase();
  const size = (o.size || 80) * S.u * (S.scale || 1);
  const fam = o.fontFixed ? o.font : (S.font || o.font || 'Montserrat');
  ctx.font = fontStr(fam, o.weight || 700, size);
  const spacing = (o.spacing || 0) * size;
  const lines = text.split('\n');
  const lh = size * (o.lineHeight || 1.18);
  const align = o.align || 'center';
  const anim = o.anim || 'fade';
  const inDur = o.inDur ?? 0.7, outDur = o.outDur ?? 0.5, delay = o.delay || 0;
  const stagger = o.stagger ?? (CHAR_ANIMS.has(anim) ? 0.035 : 0);
  const outStart = S.d - outDur - (o.outEarly || 0);
  const easeIn = ease[o.ease || 'outCubic'];

  // measure
  let maxW = 0;
  const layout = lines.map((ln) => {
    const chars = [...ln];
    let cx = 0;
    const pos = chars.map((ch) => { const w = ctx.measureText(ch).width; const p = { ch, x: cx, w }; cx += w + spacing; return p; });
    const w = Math.max(0, cx - spacing);
    maxW = Math.max(maxW, w);
    return { chars: pos, w };
  });
  const totalH = lh * lines.length;
  const top = y - totalH / 2 + lh / 2; // y is the vertical center of the block
  let fitScale = 1;
  if (o.maxWidth && maxW > o.maxWidth * S.W) fitScale = (o.maxWidth * S.W) / maxW;

  ctx.save();
  if (fitScale !== 1) { ctx.translate(x, y); ctx.scale(fitScale, fitScale); ctx.translate(-x, -y); }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';

  const nChars = layout.reduce((n, l) => n + l.chars.length, 0);
  let idx = 0;
  layout.forEach((L, li) => {
    const lx = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
    const ly = top + li * lh;
    if (anim === 'mask' || anim === 'maskDown') {
      // whole line rises out of a clipping box
      const k = easeIn(clamp((S.t - delay - li * 0.12) / inDur));
      const q = ease.inCubic(clamp((S.t - outStart) / outDur));
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx - size, ly - lh / 2 - size * 0.1, L.w + size * 2, lh + size * 0.2);
      ctx.clip();
      const dir = anim === 'mask' ? 1 : -1;
      const dy = (1 - k) * lh * dir - q * lh * dir;
      L.chars.forEach((c) => drawGlyph(ctx, S, o, c.ch, lx + c.x + c.w / 2, ly + dy, size, 1, 1, 0, 1));
      ctx.restore();
      idx += L.chars.length;
      return;
    }
    L.chars.forEach((c) => {
      const i = idx++;
      const order = anim === 'random' ? hash(i * 7.13) * nChars : i;
      const kRaw = clamp((S.t - delay - order * stagger) / inDur);
      const qRaw = clamp((S.t - outStart - (o.outStagger ? order * o.outStagger : 0)) / outDur);
      if (anim === 'type') {
        const shown = kRaw > 0 ? 1 : 0;
        const q = qRaw;
        if (shown) drawGlyph(ctx, S, o, c.ch, lx + c.x + c.w / 2, ly, size, 1, 1, 0, 1 - q);
        return;
      }
      const k = easeIn(kRaw);
      const q = ease.inCubic(qRaw);
      const outA = o.outAnim === 'fade' || !o.outAnim ? 1 : 0; // fade-only exit by default
      let kk = outA ? k : Math.min(k, 1 - q);
      let alpha = Math.min(1, kRaw * 2.5) * (outA ? 1 - q : 1) * (o.alpha ?? 1);
      let dx = 0, dy = 0, sx = 1, sy = 1, rot = 0;
      const cx = lx + c.x + c.w / 2;
      switch (anim) {
        case 'fade': alpha = kk * (outA ? 1 - q : 1); break;
        case 'up': case 'rise': dy = (1 - kk) * size * (anim === 'rise' ? 1.2 : 0.6); break;
        case 'down': dy = -(1 - kk) * size * 0.6; break;
        case 'left': dx = (1 - kk) * S.W * 0.25; break;
        case 'right': dx = -(1 - kk) * S.W * 0.25; break;
        case 'pop': case 'letters': { const b = ease.outBack(kRaw); sx = sy = Math.max(0, outA ? b : Math.min(b, 1 - q)); break; }
        case 'bounce': { const b = ease.outElastic(kRaw); sx = sy = Math.max(0, outA ? b : Math.min(b, 1 - q)); break; }
        case 'drop': dy = -(1 - ease.outBounce(kRaw)) * size * 2; alpha = Math.min(1, kRaw * 4) * (1 - q); break;
        case 'zoom': sx = sy = 1 + (1 - kk) * 2.5; alpha = kk * (1 - q); break;
        case 'scale': sx = sy = 0.6 + 0.4 * kk; break;
        case 'flip': sy = kk; break;
        case 'spin': rot = (1 - kk) * Math.PI; sx = sy = kk; break;
        case 'blur': ctx.filter = kk < 1 ? `blur(${(1 - kk) * size * 0.25}px)` : 'none'; dx = 0; break;
        case 'track': dx = (cx - x) * (1 - kk) * 0.6; break;
        case 'wave': dy = Math.sin(S.t * 4 - i * 0.45) * size * 0.08 + (1 - kk) * size * 0.5; break;
        case 'glitch': {
          const g = (kRaw < 1 || hash(Math.floor(S.t * 10) + i) > 0.96) ? 1 : 0;
          if (g) { dx = (hash(Math.floor(S.t * 30) * 3 + i) - 0.5) * size * 0.4; alpha *= hash(Math.floor(S.t * 25) + i * 2) > 0.3 ? 1 : 0.2; }
          break;
        }
        default: break;
      }
      if (alpha <= 0.001 || sx <= 0.001 || sy <= 0.001) { ctx.filter = 'none'; return; }
      if (anim === 'glitch' && (kRaw < 1)) {
        drawGlyph(ctx, S, { ...o, color: '#ff2a6d', gradient: null, stroke: null, shadow: null }, c.ch, cx + dx - size * 0.04, ly + dy, size, sx, sy, rot, alpha * 0.8);
        drawGlyph(ctx, S, { ...o, color: '#05d9e8', gradient: null, stroke: null, shadow: null }, c.ch, cx + dx + size * 0.04, ly + dy, size, sx, sy, rot, alpha * 0.8);
      }
      drawGlyph(ctx, S, o, c.ch, cx + dx, ly + dy, size, sx, sy, rot, alpha);
      ctx.filter = 'none';
    });
  });
  // typewriter cursor
  if (anim === 'type' && o.cursor !== false) {
    const typed = Math.floor(clamp((S.t - delay) / stagger, 0, nChars));
    if (typed < nChars || Math.floor(S.t * 2) % 2 === 0) {
      let k = typed, li = 0;
      while (li < layout.length - 1 && k > layout[li].chars.length) { k -= layout[li].chars.length; li++; }
      const L = layout[li];
      const lx = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
      const cxp = k >= L.chars.length ? L.w : L.chars[k]?.x ?? 0;
      const q = clamp((S.t - outStart) / outDur);
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = o.cursorColor || o.color || '#fff';
      ctx.fillRect(lx + cxp + size * 0.05, top + li * lh - size * 0.45, Math.max(2, size * 0.07), size * 0.9);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  const bw = maxW * fitScale;
  const bx = align === 'center' ? x - bw / 2 : align === 'right' ? x - bw : x;
  return { x: bx, y: y - (totalH * fitScale) / 2, w: bw, h: totalH * fitScale, size: size * fitScale };
}

function drawGlyph(ctx, S, o, ch, cx, cy, size, sx, sy, rot, alpha) {
  if (ch === ' ') return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.textAlign = 'center';
  let fill = o.color || '#ffffff';
  if (o.gradient) {
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.45);
    o.gradient.forEach((c, i) => g.addColorStop(i / (o.gradient.length - 1), c));
    fill = g;
  }
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
  }
  if (o.shadow) {
    ctx.shadowColor = o.shadow.color || 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = (o.shadow.blur ?? 12) * S.u;
    ctx.shadowOffsetX = (o.shadow.x ?? 0) * S.u;
    ctx.shadowOffsetY = (o.shadow.y ?? 4) * S.u;
  }
  if (o.extrude) {
    ctx.fillStyle = o.extrude;
    for (let i = 1; i <= 6; i++) ctx.fillText(ch, i * size * 0.012, i * size * 0.012);
    ctx.shadowColor = 'transparent';
  }
  if (o.stroke && o.strokeUnder !== false) {
    ctx.strokeStyle = o.stroke.color;
    ctx.lineWidth = o.stroke.width * S.u * 2;
    ctx.strokeText(ch, 0, 0);
    ctx.shadowColor = 'transparent';
  }
  if (!o.outline) {
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
  } else {
    ctx.strokeStyle = fill;
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.strokeText(ch, 0, 0);
  }
  ctx.restore();
}

export function measure(ctx, S, text, o = {}) {
  const size = (o.size || 80) * S.u * (S.scale || 1);
  ctx.font = fontStr(o.fontFixed ? o.font : (S.font || o.font || 'Montserrat'), o.weight || 700, size);
  const t = o.upper ? String(text).toUpperCase() : String(text);
  const lines = t.split('\n');
  const spacing = (o.spacing || 0) * size;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width + spacing * Math.max(0, [...l].length - 1)));
  return { w, h: size * (o.lineHeight || 1.18) * lines.length, size };
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

// Rectangle that grows from one side: dir 'l','r','u','d','c' (center). alpha fades it (for exits, so
// a shape with words on it fades with them instead of shrinking out from under them).
export function growRect(ctx, x, y, w, h, k, dir = 'l', color = '#fff', r = 0, alpha = 1) {
  const P = partBegin();
  x += P.ox; y += P.oy;
  partRecord(P, { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.max(Math.abs(w), 6), h: Math.max(Math.abs(h), 6) }, 'rect');
  if (k <= 0) return;
  let rx = x, ry = y, rw = w, rh = h;
  if (dir === 'l') rw = w * k;
  else if (dir === 'r') { rw = w * k; rx = x + w - rw; }
  else if (dir === 'u') { rh = h * k; ry = y + h - rh; }
  else if (dir === 'd') rh = h * k;
  else if (dir === 'c') { rw = w * k; rx = x + (w - rw) / 2; }
  else if (dir === 'cv') { rh = h * k; ry = y + (h - rh) / 2; }
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.fillStyle = color;
  roundRect(ctx, rx, ry, rw, rh, r);
  ctx.fill();
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, k, color, width) {
  const P = partBegin();
  x1 += P.ox; x2 += P.ox; y1 += P.oy; y2 += P.oy;
  const pad = Math.max(6, width);
  partRecord(P, { x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad, w: Math.abs(x2 - x1) + pad * 2, h: Math.abs(y2 - y1) + pad * 2 }, 'line');
  if (k <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k);
  ctx.stroke();
}

// Any other shape that can be moved on its own, like a text line or a bar. box is where it sits
// (unmoved); draw(ctx) paints it there. Call it every frame, visible or not, so piece keys stay stable.
export function piece(ctx, box, draw) {
  const P = partBegin();
  partRecord(P, { x: box.x + P.ox, y: box.y + P.oy, w: box.w, h: box.h }, 'shape');
  if (!draw) return;
  ctx.save();
  ctx.translate(P.ox, P.oy);
  draw(ctx);
  ctx.restore();
}

// Two-phase in/out value for decorations: grows over [delay, delay+dur], shrinks at the end.
export function inout(S, delay = 0, dur = 0.6, outDur = 0.5, e = ease.outCubic) {
  const a = e(clamp((S.t - delay) / dur));
  const b = ease.inCubic(clamp((S.t - (S.d - outDur)) / outDur));
  return Math.max(0, a - b);
}

export { rgba };
