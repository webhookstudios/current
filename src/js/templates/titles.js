// Title templates. Each has default texts/colors and a draw(ctx, S) function.
// S: { W, H, u, t, d, texts[], colors[], font, scale }
import { animText, measure, growRect, line, inout, roundRect, phase, fontStr } from './textfx.js';
import { ease, clamp, rgba, shade, hash } from '../util.js';

const TT = [];
const def = (cat, id, name, o, draw) => TT.push({ id, name, cat, texts: o.texts, colors: o.colors || ['#ffffff', '#ff4d6d'], font: o.font, dur: o.dur || 5, draw });
const tx = (S, i) => S.texts[i] ?? '';
const col = (S, i) => S.colors[i] || '#ffffff';

// ===================== Basic =====================
const basic = (id, name, font, weight, anim, extra = {}) => def('Basic', id, name, { texts: [extra.text || 'Your Title Here'], font, colors: extra.colors }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * (extra.y || 0.5), { font, weight, size: extra.size || 110, color: col(S, 0), anim, upper: extra.upper, spacing: extra.spacing, shadow: extra.shadow ?? { blur: 18, y: 4 }, stroke: extra.stroke, maxWidth: 0.9, gradient: extra.gradient && [col(S, 0), col(S, 1)], glow: extra.glow && col(S, 1), outAnim: extra.outAnim });
});
basic('basic-fade', 'Simple Fade', 'Montserrat', 800, 'fade');
basic('basic-rise', 'Rise Up', 'Poppins', 800, 'up', { outAnim: 'same' });
basic('basic-pop', 'Pop Letters', 'Poppins', 900, 'pop', { outAnim: 'same' });
basic('basic-type', 'Typewriter', 'Space Grotesk', 700, 'type', { text: 'Once upon a time...', size: 84 });
basic('basic-blur', 'Blur In', 'Inter', 800, 'blur', { size: 100 });
basic('basic-bounce', 'Bouncy', 'Bangers', 400, 'drop', { size: 140, colors: ['#ffd60a', '#ff4d6d'], stroke: { color: '#1b1b1b', width: 6 }, spacing: 0.04 });
basic('basic-track', 'Tracking In', 'Bebas Neue', 400, 'track', { size: 150, spacing: 0.08, upper: true });
basic('basic-wave', 'Wavy', 'Righteous', 400, 'wave', { size: 120, colors: ['#ffffff', '#4cc9f0'], gradient: true });
basic('basic-glitch', 'Glitch', 'Orbitron', 900, 'glitch', { size: 110, upper: true, spacing: 0.05 });
basic('basic-zoom', 'Zoom Punch', 'Anton', 400, 'zoom', { size: 170, upper: true });
basic('basic-flip', 'Flip Up', 'Archivo Black', 400, 'flip', { size: 120, upper: true });
basic('basic-mask', 'Mask Reveal', 'Playfair Display', 900, 'mask', { size: 120 });
basic('basic-outline', 'Outline', 'Anton', 400, 'up', { size: 160, upper: true, stroke: { color: '#ffffff', width: 0 }, colors: ['#ffffff', '#ffffff'] });
basic('basic-script', 'Script', 'Pacifico', 400, 'fade', { size: 120, shadow: { blur: 24, y: 6, color: 'rgba(0,0,0,0.45)' } });
basic('basic-neon', 'Neon Glow', 'Monoton', 400, 'fade', { size: 120, colors: ['#ffffff', '#ff2bd6'], glow: true, upper: true });
basic('basic-marker', 'Marker', 'Permanent Marker', 400, 'pop', { size: 120, colors: ['#ffffff', '#ff4d6d'] });

// ===================== Openers =====================
def('Openers', 'open-cinematic', 'Cinematic Title', { texts: ['THE JOURNEY', 'A FILM BY YOU'], font: 'Bebas Neue', colors: ['#f5f0e6', '#c9a227'], dur: 6 }, (ctx, S) => {
  const k = inout(S, 0, 2.2, 1.2, ease.outQuart);
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.47, { font: 'Bebas Neue', weight: 400, size: 190, color: col(S, 0), anim: 'track', inDur: 2.4, stagger: 0, spacing: 0.25 - 0.1 * k, outDur: 1.2, shadow: { blur: 30, y: 0, color: 'rgba(0,0,0,0.5)' }, maxWidth: 0.92 });
  const lw = S.W * 0.22 * k;
  line(ctx, S.W / 2 - lw, S.H * 0.6, S.W / 2 + lw, S.H * 0.6, 1, col(S, 1), 3 * S.u);
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.66, { font: 'Montserrat', fontFixed: true, weight: 400, size: 34, spacing: 0.5, color: col(S, 1), anim: 'fade', delay: 1, inDur: 1.2, outDur: 1 });
});
def('Openers', 'open-split', 'Split Reveal', { texts: ['SPLIT', 'REVEAL'], font: 'Anton', colors: ['#ffffff', '#ff4d6d'] }, (ctx, S) => {
  const k = inout(S, 0.2, 0.7, 0.5, ease.outExpo);
  const bh = Math.max(3, 8 * S.u);
  // keep both words clear of the bar: half a line height plus a gap on each side
  const m0 = measure(ctx, S, tx(S, 0), { font: 'Anton', weight: 400, size: 170, upper: true, spacing: 0.04 });
  const m1 = measure(ctx, S, tx(S, 1), { font: 'Anton', weight: 400, size: 170, upper: true, spacing: 0.04 });
  const gap = 26 * S.u;
  growRect(ctx, S.W / 2 - S.W * 0.3, S.H / 2 - bh / 2, S.W * 0.6, bh, k, 'c', col(S, 1));
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2 - bh / 2 - gap - m0.h / 2, { font: 'Anton', weight: 400, size: 170, color: col(S, 0), anim: 'maskDown', delay: 0.5, inDur: 0.6, upper: true, spacing: 0.04, maxWidth: 0.9 });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H / 2 + bh / 2 + gap + m1.h / 2, { font: 'Anton', weight: 400, size: 170, color: col(S, 1), anim: 'mask', delay: 0.6, inDur: 0.6, upper: true, spacing: 0.04, maxWidth: 0.9 });
});
def('Openers', 'open-stomp', 'Stomp', { texts: ['GET\nREADY'], font: 'Anton', colors: ['#ffffff', '#ffd60a'], dur: 4 }, (ctx, S) => {
  const shake = S.t < 0.6 ? (hash(Math.floor(S.t * 40)) - 0.5) * 12 * S.u : 0;
  ctx.save(); ctx.translate(shake, -shake);
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Anton', weight: 400, size: 220, lineHeight: 1.0, color: col(S, 0), anim: 'zoom', inDur: 0.35, stagger: 0.0, upper: true, extrude: col(S, 1) });
  ctx.restore();
});
def('Openers', 'open-kinetic', 'Kinetic Words', { texts: ['MAKE', 'IT', 'HAPPEN'], font: 'Archivo Black', colors: ['#ffffff', '#4cc9f0'], dur: 4 }, (ctx, S) => {
  const words = [tx(S, 0), tx(S, 1), tx(S, 2)];
  words.forEach((w, i) => {
    const big = i === 2;
    animText(ctx, S, w, S.W / 2, S.H * (0.34 + i * 0.16), { font: 'Archivo Black', weight: 400, size: big ? 170 : 110, color: big ? col(S, 1) : col(S, 0), anim: i % 2 ? 'left' : 'right', delay: i * 0.35, inDur: 0.5, stagger: 0, upper: true, ease: 'outExpo' });
  });
});
def('Openers', 'open-minimal', 'Minimal Line', { texts: ['minimal', 'chapter one'], font: 'Inter', colors: ['#ffffff', '#ffffff'] }, (ctx, S) => {
  const k = inout(S, 0, 1, 0.6, ease.inOutCubic);
  const b = animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.47, { font: 'Inter', weight: 300, size: 110, color: col(S, 0), anim: 'fade', delay: 0.6, spacing: 0.15, inDur: 1 });
  line(ctx, S.W / 2 - S.W * 0.12, S.H * 0.56, S.W / 2 + S.W * 0.12, S.H * 0.56, k, col(S, 1), 2 * S.u);
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.61, { font: 'Inter', fontFixed: true, weight: 400, size: 30, spacing: 0.4, color: col(S, 1), anim: 'fade', delay: 1, upper: true });
  return b;
});
def('Openers', 'open-elegant', 'Elegant Script', { texts: ['Forever', 'SUMMER 2026'], font: 'Great Vibes', colors: ['#fff6e5', '#e8c07d'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.46, { font: 'Great Vibes', weight: 400, size: 200, color: col(S, 0), anim: 'blur', inDur: 1.6, stagger: 0.06, shadow: { blur: 20, y: 4, color: 'rgba(0,0,0,0.35)' } });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.62, { font: 'Playfair Display', fontFixed: true, weight: 400, size: 40, spacing: 0.45, color: col(S, 1), anim: 'fade', delay: 1.2 });
});
def('Openers', 'open-retro', 'Retro 80s', { texts: ['RETRO', 'NIGHTS'], font: 'Monoton', colors: ['#ff2bd6', '#2de2e6'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.42, { font: 'Monoton', weight: 400, size: 180, color: '#ffffff', glow: col(S, 0), anim: 'flip', inDur: 0.8, upper: true });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.62, { font: 'Pacifico', fontFixed: true, weight: 400, size: 120, color: col(S, 1), glow: col(S, 1), anim: 'blur', delay: 0.5, inDur: 0.9 });
  const k = inout(S, 0.8, 0.8);
  line(ctx, S.W * 0.3, S.H * 0.73, S.W * 0.7, S.H * 0.73, k, col(S, 0), 4 * S.u);
});
def('Openers', 'open-chrome', 'Chrome', { texts: ['LEGEND'], font: 'Rubik Mono One', colors: ['#f0f4ff', '#3a4a6b'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Rubik Mono One', weight: 400, size: 150, gradient: ['#ffffff', col(S, 0), '#8792a8', col(S, 1), '#e8eeff'], anim: 'zoom', inDur: 0.9, stagger: 0.05, stroke: { color: '#11131a', width: 4 }, upper: true });
  const shine = clamp((S.t - 1) / 0.9);
  if (shine > 0 && shine < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const x = S.W * (0.1 + shine * 0.8);
    const g = ctx.createLinearGradient(x - 80 * S.u, 0, x + 80 * S.u, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H); ctx.restore();
  }
});
def('Openers', 'open-box', 'Boxed Title', { texts: ['BREAKING', 'The story so far'], font: 'Oswald', colors: ['#ffffff', '#e63946'] }, (ctx, S) => {
  const m = measure(ctx, S, tx(S, 0), { font: 'Oswald', weight: 700, size: 130, upper: true });
  const k = inout(S, 0, 0.5, 0.5, ease.outExpo);
  const pad = 40 * S.u;
  growRect(ctx, S.W / 2 - m.w / 2 - pad, S.H * 0.45 - m.h / 2, m.w + pad * 2, m.h, k, 'l', col(S, 1));
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Oswald', weight: 700, size: 130, color: col(S, 0), anim: 'mask', delay: 0.3, upper: true });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.58, { font: 'Oswald', fontFixed: true, weight: 400, size: 52, color: col(S, 0), anim: 'up', delay: 0.6, stagger: 0, shadow: { blur: 10 } });
});
def('Openers', 'open-gradient', 'Gradient Pop', { texts: ['HELLO WORLD'], font: 'Poppins', colors: ['#ff7a18', '#af002d'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Poppins', weight: 900, size: 150, gradient: [col(S, 0), col(S, 1)], anim: 'pop', inDur: 0.6, stagger: 0.04, upper: true, maxWidth: 0.92, shadow: { blur: 30, y: 10, color: 'rgba(0,0,0,0.35)' } });
});
def('Openers', 'open-countdown', 'Countdown 3-2-1', { texts: ['3', 'GO!'], font: 'Anton', colors: ['#ffffff', '#ff4d6d'], dur: 4 }, (ctx, S) => {
  const n = Math.max(1, parseInt(tx(S, 0)) || 3);
  const step = (S.d - 0.8) / n;
  const i = Math.floor(S.t / step);
  const local = (S.t - i * step) / step;
  const cx = S.W / 2, cy = S.H / 2, R = Math.min(S.W, S.H) * 0.28;
  ctx.lineWidth = 14 * S.u;
  if (i < n) {
    ctx.strokeStyle = rgba(col(S, 0), 0.25); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = col(S, 1); ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * local); ctx.stroke();
    const s = 1 + (1 - ease.outBack(clamp(local * 3))) * 0.6;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.font = fontStr(S.font || 'Anton', 400, 300 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col(S, 0); ctx.globalAlpha = clamp(local * 6) * (1 - clamp((local - 0.85) * 6));
    ctx.fillText(String(n - i), 0, 0); ctx.restore();
  } else {
    const SS = { ...S, t: S.t - n * step, d: S.d - n * step };
    animText(ctx, SS, tx(S, 1), cx, cy, { font: 'Anton', weight: 400, size: 260, color: col(S, 1), anim: 'zoom', inDur: 0.3, stagger: 0, outDur: 0.2, upper: true });
  }
});

// ===================== Lower Thirds =====================
const L3 = (id, name, o, draw) => def('Lower Thirds', id, name, { texts: o.texts || ['Alex Morgan', 'Creative Director'], colors: o.colors, font: o.font }, draw);
const lx = (S) => S.W * (S.W > S.H ? 0.07 : 0.08);
const ly = (S) => S.H * (S.W > S.H ? 0.8 : 0.78);

L3('lt-bar', 'Accent Bar', { colors: ['#ffffff', '#ff4d6d'], font: 'Montserrat' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const k = inout(S, 0, 0.5, 0.5, ease.outExpo);
  growRect(ctx, x, y - 70 * S.u, 10 * S.u, 140 * S.u, k, 'u', col(S, 1));
  animText(ctx, S, tx(S, 0), x + 36 * S.u, y - 26 * S.u, { font: 'Montserrat', weight: 800, size: 64, color: col(S, 0), align: 'left', anim: 'right', delay: 0.15, inDur: 0.6, stagger: 0, ease: 'outExpo', shadow: { blur: 10 } });
  animText(ctx, S, tx(S, 1), x + 36 * S.u, y + 40 * S.u, { font: 'Montserrat', fontFixed: true, weight: 400, size: 38, color: col(S, 0), align: 'left', anim: 'fade', delay: 0.45, shadow: { blur: 8 } });
});
L3('lt-box', 'Solid Box', { colors: ['#111111', '#ffd60a'], font: 'Poppins' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m = measure(ctx, S, tx(S, 0), { font: 'Poppins', weight: 800, size: 60 });
  const m2 = measure(ctx, S, tx(S, 1), { font: 'Poppins', fontFixed: true, weight: 500, size: 36 });
  const pad = 28 * S.u;
  const k = inout(S, 0, 0.5, 0.45, ease.outExpo);
  const k2 = inout(S, 0.15, 0.5, 0.45, ease.outExpo);
  growRect(ctx, x, y - 90 * S.u, m.w + pad * 2, 96 * S.u, k, 'l', col(S, 1));
  growRect(ctx, x, y + 6 * S.u, m2.w + pad * 2, 64 * S.u, k2, 'l', col(S, 0));
  animText(ctx, S, tx(S, 0), x + pad, y - 42 * S.u, { font: 'Poppins', weight: 800, size: 60, color: col(S, 0), align: 'left', anim: 'mask', delay: 0.3, inDur: 0.45 });
  animText(ctx, S, tx(S, 1), x + pad, y + 38 * S.u, { font: 'Poppins', fontFixed: true, weight: 500, size: 36, color: col(S, 1), align: 'left', anim: 'mask', delay: 0.4, inDur: 0.45 });
});
L3('lt-pill', 'Gradient Pill', { colors: ['#7b2ff7', '#f107a3'], font: 'Poppins' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m = measure(ctx, S, tx(S, 0), { font: 'Poppins', weight: 700, size: 52 });
  const m2 = measure(ctx, S, tx(S, 1), { font: 'Poppins', fontFixed: true, weight: 400, size: 32 });
  const w = Math.max(m.w, m2.w) + 140 * S.u, h = 130 * S.u;
  const k = inout(S, 0, 0.6, 0.5, ease.outBack);
  if (k > 0) {
    ctx.save();
    ctx.translate(x + h / 2, y); ctx.scale(k, k); ctx.translate(-(x + h / 2), -y);
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, col(S, 0)); g.addColorStop(1, col(S, 1));
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24 * S.u; ctx.shadowOffsetY = 8 * S.u;
    roundRect(ctx, x, y - h / 2, w * Math.min(1, k * 1.2), h, h / 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + h / 2, y, h * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.font = fontStr('Noto Color Emoji', 400, 44 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = clamp(k); ctx.fillText('👋', x + h / 2, y + 2 * S.u); ctx.globalAlpha = 1;
  animText(ctx, S, tx(S, 0), x + h + 8 * S.u, y - 22 * S.u, { font: 'Poppins', weight: 700, size: 52, color: '#ffffff', align: 'left', anim: 'right', stagger: 0, delay: 0.3, inDur: 0.5 });
  animText(ctx, S, tx(S, 1), x + h + 8 * S.u, y + 30 * S.u, { font: 'Poppins', fontFixed: true, weight: 400, size: 32, color: 'rgba(255,255,255,0.85)', align: 'left', anim: 'fade', delay: 0.5 });
});
L3('lt-underline', 'Underline', { colors: ['#ffffff', '#4cc9f0'], font: 'Inter' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const b = animText(ctx, S, tx(S, 0), x, y - 28 * S.u, { font: 'Inter', weight: 800, size: 66, color: col(S, 0), align: 'left', anim: 'up', inDur: 0.5, shadow: { blur: 12 } });
  line(ctx, x, y + 14 * S.u, x + Math.max(b.w, 200 * S.u), y + 14 * S.u, inout(S, 0.2, 0.6), col(S, 1), 6 * S.u);
  animText(ctx, S, tx(S, 1), x, y + 52 * S.u, { font: 'Inter', fontFixed: true, weight: 500, size: 34, color: col(S, 0), align: 'left', anim: 'fade', delay: 0.5, upper: true, spacing: 0.15, shadow: { blur: 8 } });
});
L3('lt-news', 'News Banner', { texts: ['LIVE: City Marathon Draws Record Crowd', 'BREAKING NEWS'], colors: ['#ffffff', '#d62828'], font: 'Oswald' }, (ctx, S) => {
  const y = S.H * 0.84, h = 90 * S.u;
  const k = inout(S, 0, 0.5, 0.4, ease.outExpo);
  growRect(ctx, 0, y, S.W, h, k, 'l', 'rgba(10,14,30,0.92)');
  const tagW = 330 * S.u;
  growRect(ctx, 0, y - 56 * S.u, tagW, 56 * S.u, inout(S, 0.2, 0.4, 0.4, ease.outExpo), 'l', col(S, 1));
  animText(ctx, S, tx(S, 1), 28 * S.u, y - 28 * S.u, { font: 'Oswald', fontFixed: true, weight: 700, size: 36, color: '#ffffff', align: 'left', anim: 'fade', delay: 0.4, upper: true, spacing: 0.06 });
  animText(ctx, S, tx(S, 0), 40 * S.u, y + h / 2, { font: 'Oswald', weight: 400, size: 46, color: col(S, 0), align: 'left', anim: 'up', delay: 0.5, stagger: 0, inDur: 0.4, maxWidth: 0.92 });
  // live dot
  const blink = Math.floor(S.t * 2) % 2 ? 1 : 0.35;
  ctx.fillStyle = rgba('#ffffff', blink * clamp(k)); ctx.beginPath(); ctx.arc(tagW - 30 * S.u, y - 28 * S.u, 9 * S.u, 0, 7); ctx.fill();
});
L3('lt-corner', 'Corner Brackets', { colors: ['#ffffff', '#ffd60a'], font: 'Space Grotesk' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m = measure(ctx, S, tx(S, 0), { font: 'Space Grotesk', weight: 700, size: 58 });
  const w = m.w + 80 * S.u, h = 160 * S.u, k = inout(S, 0, 0.6, 0.5, ease.outExpo), L = 36 * S.u * k;
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 5 * S.u; ctx.lineCap = 'square';
  const bx = x, by = y - h / 2;
  if (k > 0) {
    ctx.beginPath();
    ctx.moveTo(bx, by + L); ctx.lineTo(bx, by); ctx.lineTo(bx + L, by);
    ctx.moveTo(bx + w - L, by + h); ctx.lineTo(bx + w, by + h); ctx.lineTo(bx + w, by + h - L);
    ctx.stroke();
  }
  animText(ctx, S, tx(S, 0), bx + 40 * S.u, y - 22 * S.u, { font: 'Space Grotesk', weight: 700, size: 58, color: col(S, 0), align: 'left', anim: 'type', delay: 0.3, stagger: 0.04, cursor: false, shadow: { blur: 10 } });
  animText(ctx, S, tx(S, 1), bx + 40 * S.u, y + 36 * S.u, { font: 'Space Grotesk', fontFixed: true, weight: 400, size: 32, color: col(S, 1), align: 'left', anim: 'fade', delay: 0.9 });
});
L3('lt-glass', 'Frosted Card', { colors: ['#ffffff', '#00f5d4'], font: 'Poppins' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m = measure(ctx, S, tx(S, 0), { font: 'Poppins', weight: 700, size: 54 });
  const w = m.w + 100 * S.u, h = 150 * S.u;
  const k = inout(S, 0, 0.6, 0.5, ease.outCubic);
  ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 40 * S.u);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * S.u;
  roundRect(ctx, x, y - h / 2, w, h, 22 * S.u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col(S, 1); roundRect(ctx, x + 30 * S.u, y - h / 2 + 30 * S.u, 8 * S.u, h - 60 * S.u, 4 * S.u); ctx.fill();
  ctx.restore();
  animText(ctx, S, tx(S, 0), x + 60 * S.u, y - 22 * S.u, { font: 'Poppins', weight: 700, size: 54, color: col(S, 0), align: 'left', anim: 'up', delay: 0.25, stagger: 0.02 });
  animText(ctx, S, tx(S, 1), x + 60 * S.u, y + 32 * S.u, { font: 'Poppins', fontFixed: true, weight: 400, size: 32, color: 'rgba(255,255,255,0.8)', align: 'left', anim: 'fade', delay: 0.5 });
});
L3('lt-split', 'Two Tone', { colors: ['#ffffff', '#3a86ff'], font: 'Oswald' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m1 = measure(ctx, S, tx(S, 0), { font: 'Oswald', weight: 700, size: 54, upper: true });
  const m2 = measure(ctx, S, tx(S, 1), { font: 'Oswald', fontFixed: true, weight: 400, size: 54, upper: true });
  const pad = 26 * S.u, h = 84 * S.u;
  const k1 = inout(S, 0, 0.45, 0.4, ease.outExpo), k2 = inout(S, 0.2, 0.45, 0.4, ease.outExpo);
  growRect(ctx, x, y - h / 2, m1.w + pad * 2, h, k1, 'l', col(S, 1));
  growRect(ctx, x + m1.w + pad * 2, y - h / 2, m2.w + pad * 2, h, k2, 'l', '#ffffff');
  animText(ctx, S, tx(S, 0), x + pad, y, { font: 'Oswald', weight: 700, size: 54, color: col(S, 0), align: 'left', anim: 'mask', delay: 0.25, upper: true });
  animText(ctx, S, tx(S, 1), x + m1.w + pad * 3, y, { font: 'Oswald', fontFixed: true, weight: 400, size: 54, color: '#111111', align: 'left', anim: 'mask', delay: 0.4, upper: true });
});
L3('lt-location', 'Location Pin', { texts: ['Reykjavík, Iceland', '64.1466° N, 21.9426° W'], colors: ['#ffffff', '#ff4d6d'], font: 'Montserrat' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const k = inout(S, 0, 0.6, 0.4, ease.outBack);
  const r = 26 * S.u;
  if (k > 0) {
    ctx.save(); ctx.translate(x + r, y - 10 * S.u); ctx.scale(k, k);
    ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.arc(0, -r * 0.4, r, Math.PI * 0.85, Math.PI * 0.15); ctx.lineTo(0, r * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.4, 0, 7); ctx.fill(); ctx.restore();
  }
  animText(ctx, S, tx(S, 0), x + r * 2 + 24 * S.u, y - 22 * S.u, { font: 'Montserrat', weight: 800, size: 54, color: col(S, 0), align: 'left', anim: 'right', delay: 0.2, stagger: 0, shadow: { blur: 12 } });
  animText(ctx, S, tx(S, 1), x + r * 2 + 24 * S.u, y + 30 * S.u, { font: 'Space Grotesk', fontFixed: true, weight: 400, size: 30, color: col(S, 0), align: 'left', anim: 'type', delay: 0.6, stagger: 0.03, cursor: false, shadow: { blur: 8 } });
});
L3('lt-handle', 'Social Handle', { texts: ['@yourchannel', 'Follow for more'], colors: ['#ffffff', '#e1306c'], font: 'Poppins' }, (ctx, S) => {
  const x = lx(S), y = ly(S);
  const m = measure(ctx, S, tx(S, 0), { font: 'Poppins', weight: 700, size: 50 });
  const h = 100 * S.u, w = m.w + h + 60 * S.u;
  const k = inout(S, 0, 0.5, 0.4, ease.outExpo);
  growRect(ctx, x, y - h / 2, w, h, k, 'l', 'rgba(0,0,0,0.65)', h / 2);
  const g = ctx.createLinearGradient(x, y - h / 2, x + h, y + h / 2); g.addColorStop(0, '#feda75'); g.addColorStop(0.5, col(S, 1)); g.addColorStop(1, '#4f5bd5');
  const kk = inout(S, 0.15, 0.5, 0.4, ease.outBack);
  if (kk > 0) {
    ctx.save(); ctx.translate(x + h / 2, y); ctx.scale(kk, kk);
    ctx.fillStyle = g; roundRect(ctx, -h * 0.34, -h * 0.34, h * 0.68, h * 0.68, h * 0.18); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * S.u; roundRect(ctx, -h * 0.2, -h * 0.2, h * 0.4, h * 0.4, h * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, h * 0.09, 0, 7); ctx.stroke(); ctx.restore();
  }
  animText(ctx, S, tx(S, 0), x + h + 8 * S.u, y - 14 * S.u, { font: 'Poppins', weight: 700, size: 50, color: col(S, 0), align: 'left', anim: 'right', delay: 0.3, stagger: 0, inDur: 0.5 });
  animText(ctx, S, tx(S, 1), x + h + 8 * S.u, y + 28 * S.u, { font: 'Poppins', fontFixed: true, weight: 400, size: 26, color: 'rgba(255,255,255,0.75)', align: 'left', anim: 'fade', delay: 0.5 });
});
L3('lt-sports', 'Sports Stat', { texts: ['J. RIVERA', '#10 · 24 PTS · 8 AST'], colors: ['#ffffff', '#f77f00'], font: 'Bebas Neue' }, (ctx, S) => {
  const x = lx(S), y = ly(S), h = 76 * S.u;
  const k = inout(S, 0, 0.4, 0.4, ease.outExpo);
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.25, 1, 0, 0);
  growRect(ctx, 0, -h, 520 * S.u, h, k, 'l', col(S, 1));
  growRect(ctx, 20 * S.u, 0, 560 * S.u, h * 0.8, inout(S, 0.15, 0.4, 0.4, ease.outExpo), 'l', '#121826');
  ctx.restore();
  animText(ctx, S, tx(S, 0), x + 24 * S.u, y - h / 2, { font: 'Bebas Neue', weight: 400, size: 72, color: col(S, 0), align: 'left', anim: 'left', delay: 0.2, stagger: 0, inDur: 0.4, spacing: 0.04 });
  animText(ctx, S, tx(S, 1), x + 38 * S.u, y + h * 0.4, { font: 'Bebas Neue', fontFixed: true, weight: 400, size: 42, color: col(S, 1), align: 'left', anim: 'fade', delay: 0.45, spacing: 0.06 });
});
L3('lt-minimal-right', 'Right Aligned', { colors: ['#ffffff', '#ffffff'], font: 'Playfair Display' }, (ctx, S) => {
  const x = S.W - lx(S), y = ly(S);
  animText(ctx, S, tx(S, 0), x, y - 26 * S.u, { font: 'Playfair Display', weight: 700, size: 62, color: col(S, 0), align: 'right', anim: 'fade', inDur: 0.9, shadow: { blur: 14 } });
  line(ctx, x, y + 14 * S.u, x - 180 * S.u, y + 14 * S.u, inout(S, 0.3, 0.8), col(S, 1), 2 * S.u);
  animText(ctx, S, tx(S, 1), x, y + 48 * S.u, { font: 'Inter', fontFixed: true, weight: 400, size: 28, color: col(S, 1), align: 'right', anim: 'fade', delay: 0.6, spacing: 0.3, upper: true });
});

// ===================== Subtitles =====================
const SUB = (id, name, o, draw) => def('Subtitles', id, name, { texts: [o.text || 'This is what a subtitle looks like.'], colors: o.colors || ['#ffffff', '#000000'], font: o.font }, draw);
SUB('sub-classic', 'Classic', { font: 'Inter' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.88, { font: 'Inter', weight: 700, size: 52, color: col(S, 0), anim: 'fade', inDur: 0.15, outDur: 0.15, stroke: { color: col(S, 1), width: 5 }, maxWidth: 0.9 });
});
SUB('sub-box', 'Boxed', { font: 'Inter', colors: ['#ffffff', 'rgba(0,0,0,0.7)'] }, (ctx, S) => {
  const m = measure(ctx, S, tx(S, 0), { font: 'Inter', weight: 600, size: 48 });
  const sc = Math.min(1, (S.W * 0.9) / (m.w + 60 * S.u));
  const a = phase(S, 0.15, 0.15).vis;
  ctx.globalAlpha = a; ctx.fillStyle = col(S, 1).startsWith('#') ? rgba(col(S, 1), 0.7) : col(S, 1);
  roundRect(ctx, S.W / 2 - (m.w / 2 + 30 * S.u) * sc, S.H * 0.88 - (m.h / 2 + 14 * S.u) * sc, (m.w + 60 * S.u) * sc, (m.h + 28 * S.u) * sc, 10 * S.u); ctx.fill();
  ctx.globalAlpha = 1;
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.88, { font: 'Inter', weight: 600, size: 48, color: col(S, 0), anim: 'fade', inDur: 0.15, outDur: 0.15, maxWidth: 0.86 });
});
SUB('sub-karaoke', 'Word Highlight', { font: 'Montserrat', colors: ['#ffffff', '#ffd60a'], text: 'Every word lights up as it is spoken' }, (ctx, S) => {
  const words = tx(S, 0).split(' ');
  const size = 58 * S.u * (S.scale || 1);
  ctx.font = fontStr(S.font || 'Montserrat', 900, size);
  const space = ctx.measureText(' ').width;
  const widths = words.map((w) => ctx.measureText(w.toUpperCase()).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  const sc = Math.min(1, (S.W * 0.9) / total);
  let x = S.W / 2 - (total * sc) / 2;
  const per = (S.d - 0.3) / words.length;
  const a = phase(S, 0.15, 0.15).vis;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  words.forEach((w, i) => {
    const active = S.t >= i * per && S.t < (i + 1) * per;
    const pop = active ? 1 + 0.12 * (1 - clamp((S.t - i * per) / 0.15)) : 1;
    ctx.save(); ctx.translate(x + (widths[i] * sc) / 2, S.H * 0.86); ctx.scale(sc * pop, sc * pop);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.lineWidth = 10 * S.u; ctx.strokeStyle = '#000'; ctx.strokeText(w.toUpperCase(), 0, 0);
    ctx.fillStyle = active ? col(S, 1) : col(S, 0); ctx.fillText(w.toUpperCase(), 0, 0);
    ctx.restore();
    x += (widths[i] + space) * sc;
  });
  ctx.restore();
});
SUB('sub-creator', 'Creator Bold', { font: 'Anton', colors: ['#ffffff', '#ff4d6d'], text: 'WAIT FOR IT...' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.7, { font: 'Anton', weight: 400, size: 96, color: col(S, 0), anim: 'pop', inDur: 0.25, stagger: 0.02, outDur: 0.15, stroke: { color: '#000', width: 9 }, upper: true, maxWidth: 0.9, shadow: { color: col(S, 1), blur: 0, x: 6, y: 6 } });
});
SUB('sub-cinema', 'Cinema Italic', { font: 'Playfair Display', colors: ['#fff8dc', '#000000'], text: 'We were never meant to stay.' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.9, { font: 'Playfair Display', weight: 400, size: 46, color: col(S, 0), anim: 'fade', inDur: 0.3, outDur: 0.3, shadow: { blur: 8, y: 2, color: 'rgba(0,0,0,0.9)' }, maxWidth: 0.9 });
});

// ===================== Social =====================
def('Social', 'social-subscribe', 'Subscribe Button', { texts: ['SUBSCRIBE', 'SUBSCRIBED'], colors: ['#ffffff', '#ff0000'], font: 'Roboto', dur: 4 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H * 0.78;
  const k = inout(S, 0, 0.5, 0.4, ease.outBack);
  const clicked = S.t > 1.6;
  const label = clicked ? tx(S, 1) : tx(S, 0);
  const fnt = S.font || 'Montserrat';
  ctx.font = fontStr(fnt, 800, 50 * S.u);
  const w = ctx.measureText(label).width + 110 * S.u, h = 96 * S.u;
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  const press = S.t > 1.45 && S.t < 1.65 ? 0.92 : 1; ctx.scale(press, press);
  ctx.fillStyle = clicked ? '#606060' : col(S, 1); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20 * S.u;
  roundRect(ctx, -w / 2, -h / 2, w, h, 14 * S.u); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = col(S, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2 * S.u);
  // bell
  const bx = w / 2 + 70 * S.u;
  ctx.fillStyle = rgba('#ffffff', clamp((S.t - 1.9) * 4));
  ctx.save(); ctx.translate(bx, 0); ctx.rotate(Math.sin(S.t * 25) * 0.3 * clamp(2.6 - S.t));
  ctx.beginPath(); ctx.arc(0, -6 * S.u, 26 * S.u, Math.PI, 0); ctx.lineTo(30 * S.u, 22 * S.u); ctx.lineTo(-30 * S.u, 22 * S.u); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 30 * S.u, 8 * S.u, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
  // cursor
  const ck = clamp((S.t - 0.6) / 0.8);
  if (ck > 0 && S.t < S.d - 0.4) {
    const px = cx + w * 0.7 * (1 - ease.outCubic(ck)) + 20 * S.u, py = cy + 120 * S.u * (1 - ease.outCubic(ck)) + 10 * S.u;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3 * S.u;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 60 * S.u); ctx.lineTo(px + 16 * S.u, py + 46 * S.u); ctx.lineTo(px + 28 * S.u, py + 70 * S.u); ctx.lineTo(px + 38 * S.u, py + 65 * S.u); ctx.lineTo(px + 26 * S.u, py + 42 * S.u); ctx.lineTo(px + 46 * S.u, py + 42 * S.u); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
});
def('Social', 'social-like', 'Like & Share', { texts: ['LIKE', 'SHARE', 'FOLLOW'], colors: ['#ffffff', '#ff4d6d'], dur: 4 }, (ctx, S) => {
  const items = [['❤️', tx(S, 0)], ['🔁', tx(S, 1)], ['➕', tx(S, 2)]];
  items.forEach(([emo, label], i) => {
    const x = S.W / 2 + (i - 1) * 300 * S.u, y = S.H * 0.78;
    const k = inout(S, i * 0.2, 0.5, 0.4, ease.outBack);
    if (k <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, -130 * S.u, -50 * S.u, 260 * S.u, 100 * S.u, 50 * S.u); ctx.fill();
    ctx.font = fontStr('Noto Color Emoji', 400, 46 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emo, -70 * S.u, 2 * S.u);
    ctx.font = fontStr(S.font || 'Poppins', 800, 40 * S.u); ctx.fillStyle = col(S, 0); ctx.textAlign = 'left'; ctx.fillText(label, -30 * S.u, 3 * S.u);
    ctx.restore();
  });
});
def('Social', 'social-comment', 'Comment Bubble', { texts: ['@viewer', 'This is the best tutorial ever!'], colors: ['#111111', '#ffffff'], font: 'Inter' }, (ctx, S) => {
  const x = S.W * 0.08, y = S.H * 0.2;
  const m = measure(ctx, S, tx(S, 1), { font: 'Inter', weight: 500, size: 40 });
  const w = Math.min(S.W * 0.84, m.w + 200 * S.u), h = 150 * S.u;
  const k = inout(S, 0, 0.5, 0.4, ease.outBack);
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = col(S, 1); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 24 * S.u;
  roundRect(ctx, 0, 0, w, h, 26 * S.u); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#8ecae6'; ctx.beginPath(); ctx.arc(70 * S.u, h / 2, 42 * S.u, 0, 7); ctx.fill();
  ctx.font = fontStr('Noto Color Emoji', 400, 44 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('😀', 70 * S.u, h / 2 + 2 * S.u);
  ctx.restore();
  const SS = { ...S, scale: (S.scale || 1) * k };
  animText(ctx, SS, tx(S, 0), x + 140 * S.u * k, y + 48 * S.u * k, { font: 'Inter', fontFixed: true, weight: 700, size: 30, color: rgba(col(S, 0), 0.6), align: 'left', anim: 'fade', delay: 0.3 });
  animText(ctx, SS, tx(S, 1), x + 140 * S.u * k, y + 98 * S.u * k, { font: 'Inter', weight: 500, size: 40, color: col(S, 0), align: 'left', anim: 'type', delay: 0.4, stagger: 0.025, cursor: false });
});
def('Social', 'social-swipe', 'Swipe Up', { texts: ['SWIPE UP', 'link in bio'], colors: ['#ffffff', '#00f5d4'], font: 'Poppins' }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H * 0.82;
  const bob = Math.sin(S.t * 6) * 12 * S.u;
  const k = phase(S, 0.4, 0.4).vis;
  ctx.globalAlpha = k; ctx.strokeStyle = col(S, 1); ctx.lineWidth = 8 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) { const yy = cy - 120 * S.u + bob + i * 30 * S.u; ctx.globalAlpha = k * (1 - i * 0.4); ctx.beginPath(); ctx.moveTo(cx - 40 * S.u, yy + 20 * S.u); ctx.lineTo(cx, yy - 20 * S.u); ctx.lineTo(cx + 40 * S.u, yy + 20 * S.u); ctx.stroke(); }
  ctx.globalAlpha = 1;
  animText(ctx, S, tx(S, 0), cx, cy, { font: 'Poppins', weight: 900, size: 64, color: col(S, 0), anim: 'up', inDur: 0.5, spacing: 0.08, shadow: { blur: 14 } });
  animText(ctx, S, tx(S, 1), cx, cy + 60 * S.u, { font: 'Poppins', fontFixed: true, weight: 400, size: 32, color: col(S, 0), anim: 'fade', delay: 0.4, shadow: { blur: 10 } });
});
def('Social', 'social-notify', 'Notification', { texts: ['New message', 'Hey! Are you watching this?'], colors: ['#111111', '#ffffff'], font: 'Inter' }, (ctx, S) => {
  const w = Math.min(S.W * 0.86, 820 * S.u), h = 150 * S.u, x = S.W / 2 - w / 2;
  const k = inout(S, 0, 0.6, 0.5, ease.outBack);
  const y = S.H * 0.06 - (1 - k) * 220 * S.u;
  ctx.fillStyle = rgba(col(S, 1), 0.95); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 30 * S.u;
  roundRect(ctx, x, y, w, h, 34 * S.u); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#34c759'; roundRect(ctx, x + 30 * S.u, y + 35 * S.u, 80 * S.u, 80 * S.u, 20 * S.u); ctx.fill();
  ctx.font = fontStr('Noto Color Emoji', 400, 44 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💬', x + 70 * S.u, y + 77 * S.u);
  ctx.textAlign = 'left'; ctx.fillStyle = col(S, 0);
  ctx.font = fontStr(S.font || 'Inter', 700, 36 * S.u); ctx.fillText(tx(S, 0), x + 140 * S.u, y + 55 * S.u);
  ctx.font = fontStr(S.font || 'Inter', 400, 34 * S.u); ctx.fillStyle = rgba(col(S, 0), 0.75); ctx.fillText(tx(S, 1), x + 140 * S.u, y + 100 * S.u, w - 170 * S.u);
});

// ===================== Callouts =====================
def('Callouts', 'call-arrow', 'Arrow Label', { texts: ['Look here!'], colors: ['#ffffff', '#ffd60a'], font: 'Permanent Marker' }, (ctx, S) => {
  const x = S.W * 0.62, y = S.H * 0.3;
  const k = inout(S, 0, 0.7, 0.4, ease.outCubic);
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 10 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p0 = [x, y + 40 * S.u], p1 = [x - 140 * S.u, y + 50 * S.u], p2 = [x - 200 * S.u, y + 200 * S.u];
  if (k > 0) {
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
    const N = 30;
    let last = p0;
    for (let i = 1; i <= N * k; i++) { const t = i / N; const px = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]; const py = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]; ctx.lineTo(px, py); last = [px, py]; }
    ctx.stroke();
    if (k > 0.95) { ctx.beginPath(); ctx.moveTo(last[0] - 34 * S.u, last[1] - 30 * S.u); ctx.lineTo(last[0], last[1]); ctx.lineTo(last[0] + 30 * S.u, last[1] - 34 * S.u); ctx.stroke(); }
  }
  animText(ctx, S, tx(S, 0), x + 20 * S.u, y, { font: 'Permanent Marker', weight: 400, size: 70, color: col(S, 0), align: 'left', anim: 'pop', delay: 0.4, stroke: { color: '#000', width: 5 } });
});
def('Callouts', 'call-circle', 'Circle Highlight', { texts: ['Important'], colors: ['#ffffff', '#ff4d6d'], font: 'Caveat' }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2;
  const k = inout(S, 0, 0.9, 0.4, ease.inOutCubic);
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 9 * S.u; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 80 * k; i++) { const a = -0.5 + (i / 80) * Math.PI * 2.15; const r = 1 + Math.sin(a * 3) * 0.04; const px = cx + Math.cos(a) * 230 * S.u * r; const py = cy + Math.sin(a) * 130 * S.u * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  animText(ctx, S, tx(S, 0), cx, cy - 190 * S.u, { font: 'Caveat', weight: 700, size: 80, color: col(S, 0), anim: 'up', delay: 0.6, stroke: { color: '#000', width: 4 } });
});
def('Callouts', 'call-step', 'Numbered Step', { texts: ['1', 'Open the settings'], colors: ['#ffffff', '#3a86ff'], font: 'Poppins' }, (ctx, S) => {
  const x = S.W * 0.08, y = S.H * 0.18, r = 56 * S.u;
  const k = inout(S, 0, 0.5, 0.4, ease.outBack);
  if (k > 0) { ctx.save(); ctx.translate(x + r, y); ctx.scale(k, k); ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = fontStr(S.font || 'Poppins', 900, 64 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tx(S, 0), 0, 4 * S.u); ctx.restore(); }
  const m = measure(ctx, S, tx(S, 1), { font: 'Poppins', weight: 700, size: 52 });
  growRect(ctx, x + r * 2 + 16 * S.u, y - 50 * S.u, m.w + 60 * S.u, 100 * S.u, inout(S, 0.2, 0.5, 0.4, ease.outExpo), 'l', 'rgba(0,0,0,0.7)', 14 * S.u);
  animText(ctx, S, tx(S, 1), x + r * 2 + 46 * S.u, y, { font: 'Poppins', weight: 700, size: 52, color: col(S, 0), align: 'left', anim: 'fade', delay: 0.45 });
});
def('Callouts', 'call-speech', 'Speech Bubble', { texts: ['Hello there!'], colors: ['#111111', '#ffffff'], font: 'Bangers' }, (ctx, S) => {
  const cx = S.W * 0.65, cy = S.H * 0.3;
  const m = measure(ctx, S, tx(S, 0), { font: 'Bangers', weight: 400, size: 80 });
  const w = m.w + 120 * S.u, h = m.h + 90 * S.u;
  const k = inout(S, 0, 0.5, 0.35, ease.outBack);
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy + h / 2); ctx.scale(k, k); ctx.translate(-cx, -(cy + h / 2));
  ctx.fillStyle = col(S, 1); ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * S.u;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - w * 0.2, cy + h * 0.38); ctx.lineTo(cx - w * 0.35, cy + h * 0.85); ctx.lineTo(cx - w * 0.02, cy + h * 0.45); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 3 * S.u, h / 2 - 3 * S.u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  animText(ctx, S, tx(S, 0), cx, cy, { font: 'Bangers', weight: 400, size: 80, color: col(S, 0), anim: 'pop', delay: 0.2, spacing: 0.03, outDur: 0.3 });
});
def('Callouts', 'call-sale', 'Sale Badge', { texts: ['50%', 'OFF'], colors: ['#ffffff', '#e63946'], font: 'Anton' }, (ctx, S) => {
  const cx = S.W * 0.78, cy = S.H * 0.3, R = 150 * S.u;
  const k = inout(S, 0, 0.6, 0.4, ease.outBack);
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.25 + (1 - k) * -1 + Math.sin(S.t * 3) * 0.04); ctx.scale(k, k);
  ctx.fillStyle = col(S, 1); ctx.beginPath();
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = i % 2 ? R * 0.88 : R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = col(S, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = fontStr(S.font || 'Anton', 400, 110 * S.u); ctx.fillText(tx(S, 0), 0, -20 * S.u);
  ctx.font = fontStr(S.font || 'Anton', 400, 54 * S.u); ctx.fillText(tx(S, 1), 0, 62 * S.u);
  ctx.restore();
});
def('Callouts', 'call-quote', 'Quote', { texts: ['The best way to predict the future is to create it.', 'PETER DRUCKER'], colors: ['#ffffff', '#ffd60a'], font: 'Playfair Display', dur: 7 }, (ctx, S) => {
  ctx.font = fontStr('Playfair Display', 900, 260 * S.u); ctx.fillStyle = rgba(col(S, 1), 0.9 * phase(S, 0.6, 0.6).vis); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('“', S.W / 2, S.H * 0.3);
  const wrapped = wrap(ctx, S, tx(S, 0), 'Playfair Display', 400, 64, 0.75);
  animText(ctx, S, wrapped, S.W / 2, S.H * 0.52, { font: 'Playfair Display', weight: 400, size: 64, color: col(S, 0), anim: 'fade', stagger: 0.015, inDur: 0.6, shadow: { blur: 16 } });
  animText(ctx, S, '— ' + tx(S, 1), S.W / 2, S.H * 0.75, { font: 'Inter', fontFixed: true, weight: 600, size: 32, color: col(S, 1), anim: 'fade', delay: 1.5, spacing: 0.25 });
});

// ===================== End Credits =====================
def('End Credits', 'end-thanks', 'Thanks for Watching', { texts: ['Thanks for watching!', 'See you in the next one'], colors: ['#ffffff', '#ff4d6d'], font: 'Pacifico' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Pacifico', weight: 400, size: 120, color: col(S, 0), anim: 'pop', stagger: 0.04, shadow: { blur: 20 }, maxWidth: 0.9 });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.6, { font: 'Poppins', fontFixed: true, weight: 600, size: 44, color: col(S, 1), anim: 'up', delay: 1, stagger: 0 });
});
def('End Credits', 'end-roll', 'Rolling Credits', { texts: ['THE END', 'Directed by\nYour Name\n\nEdited by\nYour Name\n\nMusic\nSplice Library\n\nThank you'], colors: ['#ffffff', '#bbbbbb'], font: 'Montserrat', dur: 12 }, (ctx, S) => {
  const lines = (tx(S, 0) + '\n\n\n' + tx(S, 1)).split('\n');
  const lh = 64 * S.u;
  const total = lines.length * lh + S.H;
  const y0 = S.H + 40 * S.u - (S.t / S.d) * total;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const y = y0 + i * lh;
    if (y < -lh || y > S.H + lh) return;
    const head = i === 0;
    const isRole = !head && lines[i + 1] && lines[i + 1].trim() && (i === 0 || !lines[i - 1].trim() || lines[i - 1] === tx(S, 0));
    ctx.font = fontStr(S.font || 'Montserrat', head ? 900 : isRole ? 400 : 700, (head ? 90 : isRole ? 30 : 44) * S.u);
    ctx.fillStyle = isRole ? col(S, 1) : col(S, 0);
    ctx.fillText(isRole ? ln.toUpperCase() : ln, S.W / 2, y);
  });
});
def('End Credits', 'end-coming', 'Coming Soon', { texts: ['COMING SOON', '12.25.2026'], colors: ['#ffffff', '#c9a227'], font: 'Bebas Neue' }, (ctx, S) => {
  const k = inout(S, 0.3, 1.5, 0.8, ease.outCubic);
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.47, { font: 'Bebas Neue', weight: 400, size: 200, color: col(S, 0), anim: 'blur', stagger: 0.08, inDur: 1.2, spacing: 0.12 });
  line(ctx, S.W * 0.5 - S.W * 0.15, S.H * 0.6, S.W * 0.5 + S.W * 0.15, S.H * 0.6, k, col(S, 1), 2 * S.u);
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.66, { font: 'Bebas Neue', fontFixed: true, weight: 400, size: 60, color: col(S, 1), anim: 'fade', delay: 1.4, spacing: 0.3 });
});
def('End Credits', 'end-chapter', 'Chapter Card', { texts: ['CHAPTER 2', 'The Long Road Home'], colors: ['#ffffff', '#ffffff'], font: 'Playfair Display' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.42, { font: 'Inter', fontFixed: true, weight: 600, size: 34, spacing: 0.6, color: rgba(col(S, 1), 0.8), anim: 'fade', inDur: 1 });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.53, { font: 'Playfair Display', weight: 700, size: 104, color: col(S, 0), anim: 'blur', delay: 0.5, stagger: 0.03, inDur: 0.9, maxWidth: 0.9 });
});

// ===================== Cinematic & Retro extras =====================
def('Cinematic', 'cine-date', 'Date Stamp', { texts: ['JUN 14 2026', '06:42 PM'], colors: ['#ff9f1c', '#ff9f1c'], font: 'Press Start 2P' }, (ctx, S) => {
  const a = phase(S, 0.2, 0.2).vis;
  ctx.globalAlpha = a * (0.85 + 0.15 * Math.sin(S.t * 30));
  ctx.font = fontStr('Press Start 2P', 400, 40 * S.u); ctx.fillStyle = col(S, 0); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.shadowColor = col(S, 0); ctx.shadowBlur = 12 * S.u;
  ctx.fillText(tx(S, 0), S.W * 0.93, S.H * 0.86);
  ctx.fillText(tx(S, 1), S.W * 0.93, S.H * 0.92);
  ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
});
def('Cinematic', 'cine-rec', 'Camcorder REC', { texts: ['REC', 'SP'], colors: ['#ffffff', '#ff2d2d'], font: 'Space Grotesk' }, (ctx, S) => {
  const u = S.u, m = 50 * u;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4 * u;
  const L = 70 * u;
  [[m, m, 1, 1], [S.W - m, m, -1, 1], [m, S.H - m, 1, -1], [S.W - m, S.H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + L * sy); ctx.lineTo(x, y); ctx.lineTo(x + L * sx, y); ctx.stroke(); });
  if (Math.floor(S.t * 1.5) % 2 === 0) { ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.arc(m + 60 * u, m + 60 * u, 16 * u, 0, 7); ctx.fill(); }
  ctx.font = fontStr(S.font || 'Space Grotesk', 700, 44 * u); ctx.fillStyle = col(S, 0); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(tx(S, 0), m + 90 * u, m + 62 * u);
  ctx.textAlign = 'right';
  const secs = Math.floor(S.t); ctx.fillText(`00:00:${String(secs).padStart(2, '0')}`, S.W - m - 30 * u, m + 62 * u);
  ctx.fillText(tx(S, 1), S.W - m - 30 * u, S.H - m - 50 * u);
  // battery
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 3 * u; ctx.strokeRect(m + 30 * u, S.H - m - 70 * u, 70 * u, 34 * u);
  ctx.fillStyle = col(S, 0); ctx.fillRect(m + 36 * u, S.H - m - 64 * u, 40 * u, 22 * u); ctx.fillRect(m + 100 * u, S.H - m - 60 * u, 6 * u, 14 * u);
});
def('Cinematic', 'cine-bars-title', 'Letterbox Title', { texts: ['NORTHBOUND'], colors: ['#ffffff', '#000000'], font: 'Oswald', dur: 6 }, (ctx, S) => {
  const k = inout(S, 0, 1.2, 1, ease.inOutCubic);
  const bh = S.H * 0.12 * k;
  ctx.fillStyle = col(S, 1); ctx.fillRect(0, 0, S.W, bh); ctx.fillRect(0, S.H - bh, S.W, bh);
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Oswald', weight: 400, size: 120, spacing: 0.5, color: col(S, 0), anim: 'fade', delay: 1, inDur: 1.5, outDur: 1, upper: true, maxWidth: 0.9 });
});
def('Cinematic', 'cine-glitch-logo', 'Glitch Reveal', { texts: ['SYSTEM ONLINE'], colors: ['#ffffff', '#05d9e8'], font: 'Orbitron' }, (ctx, S) => {
  const g = S.t < 1 || (Math.floor(S.t * 8) % 13 === 0);
  if (g) {
    for (let i = 0; i < 8; i++) { const y = hash(Math.floor(S.t * 20) + i) * S.H; ctx.fillStyle = rgba(col(S, 1), 0.25); ctx.fillRect(0, y, S.W, 4 * S.u + hash(i + S.t) * 20 * S.u); }
  }
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Orbitron', weight: 900, size: 100, color: col(S, 0), anim: 'glitch', stagger: 0.03, inDur: 0.9, upper: true, spacing: 0.06, glow: col(S, 1), maxWidth: 0.9 });
});

// ===================== Kinetic / Fun =====================
def('Fun', 'fun-comic', 'Comic Burst', { texts: ['BOOM!'], colors: ['#ffd60a', '#e63946'], font: 'Bangers', dur: 3 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = Math.min(S.W, S.H) * 0.33;
  const k = inout(S, 0, 0.35, 0.3, ease.outBack);
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate(Math.sin(S.t * 8) * 0.02);
  ctx.fillStyle = col(S, 1); ctx.strokeStyle = '#111'; ctx.lineWidth = 10 * S.u; ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? R * 0.62 : R * (0.95 + hash(i) * 0.15); ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  animText(ctx, S, tx(S, 0), cx, cy, { font: 'Bangers', weight: 400, size: 200, color: col(S, 0), anim: 'bounce', inDur: 0.6, stagger: 0.05, stroke: { color: '#111', width: 10 }, spacing: 0.05, outDur: 0.3 });
});
def('Fun', 'fun-sticker-text', 'Sticker Text', { texts: ['so cute!'], colors: ['#ff4d6d', '#ffffff'], font: 'Caveat' }, (ctx, S) => {
  ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.rotate(-0.08); ctx.translate(-S.W / 2, -S.H / 2);
  animText(ctx, S, tx(S, 0), S.W / 2, S.H / 2, { font: 'Caveat', weight: 700, size: 150, color: col(S, 0), anim: 'pop', stagger: 0.05, stroke: { color: col(S, 1), width: 14 }, shadow: { blur: 14, y: 6 } });
  ctx.restore();
});
def('Fun', 'fun-pixel', 'Pixel Game', { texts: ['LEVEL UP!', 'PRESS START'], colors: ['#ffffff', '#ffd60a'], font: 'Press Start 2P' }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Press Start 2P', weight: 400, size: 90, color: col(S, 1), anim: 'drop', stagger: 0.06, extrude: '#b5179e', maxWidth: 0.9 });
  if (Math.floor(S.t * 2) % 2 === 0) animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.62, { font: 'Press Start 2P', fontFixed: true, weight: 400, size: 36, color: col(S, 0), anim: 'fade', delay: 1, inDur: 0.01 });
});
def('Fun', 'fun-rainbow', 'Rainbow Wave', { texts: ['PARTY TIME'], colors: ['#ffffff', '#ffffff'], font: 'Righteous' }, (ctx, S) => {
  const text = tx(S, 0).toUpperCase();
  const size = 130 * S.u * (S.scale || 1);
  ctx.font = fontStr(S.font || 'Righteous', 400, size);
  const chars = [...text]; const ws = chars.map((c) => ctx.measureText(c).width); const tw = ws.reduce((a, b) => a + b, 0);
  const sc = Math.min(1, S.W * 0.9 / tw);
  let x = S.W / 2 - (tw * sc) / 2; const vis = phase(S, 0.5, 0.4);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  chars.forEach((c, i) => {
    const k = ease.outBack(clamp((S.t - i * 0.05) / 0.5));
    ctx.save(); ctx.translate(x + (ws[i] * sc) / 2, S.H / 2 + Math.sin(S.t * 5 + i * 0.6) * 24 * S.u); ctx.scale(k * sc, k * sc);
    ctx.globalAlpha = 1 - vis.b; ctx.fillStyle = `hsl(${(i * 32 + S.t * 120) % 360} 90% 60%)`; ctx.lineWidth = 10 * S.u; ctx.strokeStyle = '#fff';
    ctx.strokeText(c, 0, 0); ctx.fillText(c, 0, 0); ctx.restore();
    x += ws[i] * sc;
  });
});
def('Fun', 'fun-stack', 'Word Stack', { texts: ['WORK\nHARD\nPLAY\nHARDER'], colors: ['#ffffff', '#ff4d6d'], font: 'Anton' }, (ctx, S) => {
  const words = tx(S, 0).split('\n');
  const size = Math.min(170, 640 / Math.max(1, words.length));
  words.forEach((w, i) => {
    animText(ctx, S, w, S.W / 2, S.H / 2 + (i - (words.length - 1) / 2) * size * 0.95 * S.u, { font: 'Anton', weight: 400, size, color: i === words.length - 1 ? col(S, 1) : col(S, 0), anim: 'mask', delay: i * 0.18, inDur: 0.4, upper: true, lineHeight: 1 });
  });
});

// ===================== Intro & outro titles =====================
def('Openers', 'open-welcome', 'Welcome To', { texts: ['WELCOME TO', 'My Channel'], font: 'Poppins', colors: ['#ffffff', '#ffd60a'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.4, { font: 'Poppins', fontFixed: true, weight: 600, size: 44, spacing: 0.45, color: col(S, 1), anim: 'fade', inDur: 0.6 });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.53, { font: 'Poppins', weight: 900, size: 150, color: col(S, 0), anim: 'pop', delay: 0.35, stagger: 0.045, shadow: { blur: 24, y: 8, color: 'rgba(0,0,0,0.4)' }, maxWidth: 0.9 });
});
def('Openers', 'open-brand', 'Brand Reveal', { texts: ['BRANDNAME', 'creative studio'], font: 'Montserrat', colors: ['#ffffff', '#1fd1b9'] }, (ctx, S) => {
  const b = animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.48, { font: 'Montserrat', weight: 900, size: 130, spacing: 0.12, color: col(S, 0), anim: 'rise', stagger: 0.05, inDur: 0.6, upper: true, maxWidth: 0.9 });
  const k = inout(S, 0.7, 0.7);
  line(ctx, S.W / 2 - b.w / 2, S.H * 0.58, S.W / 2 - b.w / 2 + b.w * k, S.H * 0.58, 1, col(S, 1), 6 * S.u);
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.64, { font: 'Montserrat', fontFixed: true, weight: 400, size: 38, spacing: 0.4, color: col(S, 1), anim: 'fade', delay: 1.1, upper: true });
});
def('Openers', 'open-neon-sign', 'Neon Sign', { texts: ['OPEN', 'late night stories'], font: 'Monoton', colors: ['#ff2bd6', '#2de2e6'] }, (ctx, S) => {
  const on = S.t < 0.8 ? (hash(Math.floor(S.t * 20)) > 0.45 ? 1 : 0.15) : (hash(Math.floor(S.t * 7)) > 0.97 ? 0.3 : 1);
  ctx.save(); ctx.globalAlpha = on;
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Monoton', weight: 400, size: 200, color: '#ffffff', glow: col(S, 0), anim: 'fade', inDur: 0.05, upper: true, maxWidth: 0.9 });
  ctx.restore();
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.66, { font: 'Pacifico', fontFixed: true, weight: 400, size: 70, color: '#ffffff', glow: col(S, 1), anim: 'blur', delay: 1, inDur: 0.8 });
});
def('Openers', 'open-vlog', 'Vlog Day', { texts: ['Day 12', 'exploring the old town'], font: 'Caveat', colors: ['#ffffff', '#ffd60a'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Caveat', weight: 700, size: 220, color: col(S, 0), anim: 'pop', stagger: 0.07, shadow: { blur: 18, y: 6 }, maxWidth: 0.9 });
  const k = inout(S, 0.6, 0.8, 0.4, ease.inOutCubic);
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 10 * S.u; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 40 * k; i++) { const t = i / 40; const x = S.W * (0.35 + t * 0.3), y = S.H * 0.58 + Math.sin(t * Math.PI * 3) * 8 * S.u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } if (k > 0) ctx.stroke();
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.66, { font: 'Poppins', fontFixed: true, weight: 500, size: 44, color: col(S, 0), anim: 'up', delay: 1, stagger: 0, shadow: { blur: 10 } });
});
def('Openers', 'open-year', 'Big Year', { texts: ['2026', 'YEAR IN REVIEW'], font: 'Anton', colors: ['#ffffff', '#ff4d6d'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.46, { font: 'Anton', weight: 400, size: 330, color: col(S, 0), anim: 'mask', inDur: 0.9, ease: 'outExpo', lineHeight: 1 });
  const m = measure(ctx, S, tx(S, 1), { font: 'Inter', fontFixed: true, weight: 800, size: 40, spacing: 0.3 });
  growRect(ctx, S.W / 2 - m.w / 2 - 24 * S.u, S.H * 0.7 - 32 * S.u, m.w + 48 * S.u, 64 * S.u, inout(S, 0.6, 0.5, 0.4, ease.outExpo), 'c', col(S, 1));
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.7, { font: 'Inter', fontFixed: true, weight: 800, size: 40, spacing: 0.3, color: '#ffffff', anim: 'fade', delay: 0.9 });
});
def('End Credits', 'end-subscribe-text', 'Subscribe Reminder', { texts: ["DON'T FORGET TO", 'SUBSCRIBE'], font: 'Anton', colors: ['#ffffff', '#ff0000'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.38, { font: 'Montserrat', fontFixed: true, weight: 800, size: 54, spacing: 0.15, color: col(S, 0), anim: 'up', stagger: 0.02, shadow: { blur: 12 } });
  const m = measure(ctx, S, tx(S, 1), { font: 'Anton', weight: 400, size: 150, upper: true, spacing: 0.04 });
  const k = inout(S, 0.4, 0.5, 0.4, ease.outBack);
  growRect(ctx, S.W / 2 - m.w / 2 - 40 * S.u, S.H * 0.52 - m.h / 2, m.w + 80 * S.u, m.h, k, 'c', col(S, 1), 18 * S.u);
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.52, { font: 'Anton', weight: 400, size: 150, spacing: 0.04, color: col(S, 0), anim: 'zoom', delay: 0.6, stagger: 0.03, inDur: 0.4, upper: true });
});
def('End Credits', 'end-see-you', 'See You Next Time', { texts: ['See you next time', '@yourchannel'], font: 'Dancing Script', colors: ['#ffffff', '#ffd60a'] }, (ctx, S) => {
  animText(ctx, S, tx(S, 0), S.W / 2, S.H * 0.45, { font: 'Dancing Script', weight: 700, size: 150, color: col(S, 0), anim: 'blur', stagger: 0.05, inDur: 0.8, shadow: { blur: 16, y: 5 }, maxWidth: 0.9 });
  animText(ctx, S, tx(S, 1), S.W / 2, S.H * 0.62, { font: 'Poppins', fontFixed: true, weight: 600, size: 46, color: col(S, 1), anim: 'type', delay: 1.2, stagger: 0.05, cursor: false });
});

function wrap(ctx, S, text, family, weight, size, maxFrac) {
  ctx.font = fontStr(S.font || family, weight, size * S.u * (S.scale || 1));
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

export const TITLES = TT;
export const TITLE_CATS = [...new Set(TT.map((t) => t.cat))];
export const titleById = (id) => TT.find((t) => t.id === id);
