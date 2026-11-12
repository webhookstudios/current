// Title templates. Each has default texts/colors and a draw(ctx, S) function.
// S: { W, H, u, t, d, texts[], colors[], font, scale }
import { animText, measure, growRect, line, inout, roundRect, phase, fontStr, piece, drawText } from './textfx.js';
import { ease, clamp, rgba, shade, hash } from '../util.js';
import { lerp, kin, kend, dots, traceRect, checkBadge, polyPart, still, fitFont, wrap } from './scenekit.js';
import { SEQ_TITLES } from './sequences.js';

const TT = [];
const def = (cat, id, name, o, draw) => TT.push({ id, name, cat, texts: o.texts, colors: o.colors || ['#ffffff', '#ff4d6d'], font: o.font, dur: o.dur || 5, brandTexts: o.brandTexts, draw });
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
  const h = 130 * S.u, w = h + 8 * S.u + Math.max(m.w, m2.w) + h * 0.42; // the words end well clear of the round end
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
  const tagO = { font: 'Oswald', fontFixed: true, weight: 700, size: 36, upper: true, spacing: 0.06 };
  const tagCap = S.W * 0.9 - 28 * S.u - 60 * S.u;
  const tagW = Math.max(330 * S.u, Math.min(measure(ctx, S, tx(S, 1), tagO).w, tagCap) + 28 * S.u + 60 * S.u); // words, then the live dot
  growRect(ctx, 0, y - 56 * S.u, tagW, 56 * S.u, inout(S, 0.2, 0.4, 0.4, ease.outExpo), 'l', col(S, 1));
  animText(ctx, S, tx(S, 1), 28 * S.u, y - 28 * S.u, { ...tagO, color: '#ffffff', align: 'left', anim: 'fade', delay: 0.4, maxWidth: tagCap / S.W });
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
  const x = lx(S), y = ly(S), h = 76 * S.u, u = S.u;
  const k = inout(S, 0, 0.4, 0.4, ease.outExpo);
  const nO = { font: 'Bebas Neue', weight: 400, size: 72, spacing: 0.04 }, sO = { font: 'Bebas Neue', fontFixed: true, weight: 400, size: 42, spacing: 0.06 };
  const cap = S.W * 0.88 - x;
  const nw = Math.max(520 * u, Math.min(measure(ctx, S, tx(S, 0), nO).w, cap) + 34 * u + 40 * u);
  const sw = Math.max(560 * u, Math.min(measure(ctx, S, tx(S, 1), sO).w, cap) + 38 * u + 40 * u);
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.25, 1, 0, 0);
  growRect(ctx, 0, -h, nw, h, k, 'l', col(S, 1));
  growRect(ctx, 20 * u, 0, sw, h * 0.8, inout(S, 0.15, 0.4, 0.4, ease.outExpo), 'l', '#121826');
  ctx.restore();
  // the bars lean right, so the words start a little in from their sloped left edge
  animText(ctx, S, tx(S, 0), x + 34 * u, y - h / 2, { ...nO, color: col(S, 0), align: 'left', anim: 'left', delay: 0.2, stagger: 0, inDur: 0.4, maxWidth: cap / S.W });
  animText(ctx, S, tx(S, 1), x + 38 * u, y + h * 0.4, { ...sO, color: col(S, 1), align: 'left', anim: 'fade', delay: 0.45, maxWidth: cap / S.W });
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
    // real word timings when the caption came from speech recognition, else even spacing
    const tm = S.params?.words?.length === words.length ? S.params.words : null;
    const w0 = tm ? tm[i].t0 : i * per, w1 = tm ? (tm[i + 1]?.t0 ?? S.d) : (i + 1) * per;
    const active = S.t >= w0 && S.t < w1;
    const pop = active ? 1 + 0.12 * (1 - clamp((S.t - w0) / 0.15)) : 1;
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
  // Each pill is as wide as its word; the row is centred and shrinks to fit the frame.
  const u = S.u, items = [['❤️', tx(S, 0)], ['🔁', tx(S, 1)], ['➕', tx(S, 2)]];
  const label = fontStr(S.font || 'Poppins', 800, 40 * u);
  const h = 100 * u, padL = 30 * u, emo = 52 * u, gapE = 14 * u, padR = 38 * u, gap = 40 * u;
  ctx.font = label;
  const ws = items.map(([, l]) => padL + emo + gapE + ctx.measureText(l).width + padR);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  const fit = Math.min(1, (S.W * 0.92) / total);
  let left = S.W / 2 - (total * fit) / 2;
  items.forEach(([e, l], i) => {
    const w = ws[i], cx = left + (w * fit) / 2, y = S.H * 0.78;
    left += (w + gap) * fit;
    const k = inout(S, i * 0.2, 0.5, 0.4, ease.outBack);
    if (k <= 0) return;
    ctx.save(); ctx.translate(cx, y); ctx.scale(k * fit, k * fit);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
    ctx.font = fontStr('Noto Color Emoji', 400, 46 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, -w / 2 + padL + emo / 2, 2 * u);
    ctx.font = label; ctx.fillStyle = col(S, 0); ctx.textAlign = 'left'; ctx.fillText(l, -w / 2 + padL + emo + gapE, 3 * u);
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
  if (k > 0) { ctx.save(); ctx.translate(x + r, y); ctx.scale(k, k); ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = fitFont(ctx, tx(S, 0), S.font || 'Poppins', 900, 64 * S.u, r * 1.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tx(S, 0), 0, 4 * S.u); ctx.restore(); }
  const m = measure(ctx, S, tx(S, 1), { font: 'Poppins', weight: 700, size: 52 });
  const cap = S.W * 0.95 - (x + r * 2 + 46 * S.u) - 30 * S.u;
  growRect(ctx, x + r * 2 + 16 * S.u, y - 50 * S.u, Math.min(m.w, cap) + 60 * S.u, 100 * S.u, inout(S, 0.2, 0.5, 0.4, ease.outExpo), 'l', 'rgba(0,0,0,0.7)', 14 * S.u);
  animText(ctx, S, tx(S, 1), x + r * 2 + 46 * S.u, y, { font: 'Poppins', weight: 700, size: 52, color: col(S, 0), align: 'left', anim: 'fade', delay: 0.45, maxWidth: cap / S.W });
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
  ctx.font = fitFont(ctx, tx(S, 0), S.font || 'Anton', 400, 110 * S.u, R * 1.45); ctx.fillText(tx(S, 0), 0, -20 * S.u);
  ctx.font = fitFont(ctx, tx(S, 1), S.font || 'Anton', 400, 54 * S.u, R * 1.3); ctx.fillText(tx(S, 1), 0, 62 * S.u);
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
  animText(ctx, S, tx(S, 0), cx, cy, { font: 'Bangers', weight: 400, size: 200, color: col(S, 0), anim: 'bounce', inDur: 0.6, stagger: 0.05, stroke: { color: '#111', width: 10 }, spacing: 0.05, outDur: 0.3, maxWidth: (R * 1.5) / S.W });
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

// ===================== Professional =====================
// Calm, flat openers and closers for lessons and company videos. Each intro has a matching outro
// with the same look. Every shape is its own movable piece, like the lines of text.


// 1. Block Reveal: each line is uncovered by a solid block that sweeps across it and away,
// and the blocks sweep back over the lines to take them off again at the end.
function blockLine(ctx, S, text, x, y, o, color, delay, leave) {
  const m = measure(ctx, S, text, o);
  const fit = o.maxWidth && m.w > o.maxWidth * S.W ? (o.maxWidth * S.W) / m.w : 1;
  const pad = 16 * S.u, bw = m.w * fit + pad * 2, bh = m.h * fit * 0.84;
  const bx = x - pad, by = y - bh / 2;
  const io = ease.inOutCubic;
  const inGrow = io(clamp((S.t - delay) / 0.42)), inGo = io(clamp((S.t - delay - 0.47) / 0.42));
  const t0 = S.d - leave;
  const outGrow = io(clamp((S.t - t0) / 0.38)), outGo = io(clamp((S.t - t0 - 0.43) / 0.38));
  piece(ctx, { x: bx, y: by, w: bw, h: bh }, (c) => {
    if (S.t >= delay + 0.42 && outGrow < 1) drawText(c, S, text, x, y, { ...o, anim: 'fade', delay: 0, inDur: 0.001, outDur: 0.001 });
    c.fillStyle = color;
    for (const [grow, go] of [[inGrow, inGo], [outGrow, outGo]]) {
      if (grow <= 0 || go >= 1) continue;
      const l = bx + bw * go, r = bx + bw * grow;
      if (r > l) c.fillRect(l, by, r - l, bh);
    }
  });
}
function blockScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H;
  const ink = col(S, 0), b1 = col(S, 1), b2 = col(S, 2), muted = col(S, 3);
  const x = Math.max(W * 0.1, 80 * u);
  const mw = (W - x - Math.max(W * 0.1, 60 * u)) / W;
  const leave = 1.15; // the blocks come back this long before the end
  const co = { font: 'Montserrat', fontFixed: true, weight: 700, size: 28, spacing: 0.24, upper: true, align: 'left', maxWidth: mw };
  const to = { font: 'Montserrat', weight: 800, size: 136, color: ink, align: 'left', maxWidth: mw };
  const so = { font: 'Inter', fontFixed: true, weight: 400, size: 48, color: muted, align: 'left', maxWidth: mw };
  const mc = measure(ctx, S, tx(S, 0), co), mt = measure(ctx, S, tx(S, 1), to), ms = measure(ctx, S, tx(S, 2), so);
  const stack = mc.h + 38 * u + mt.h + 18 * u + ms.h + 44 * u + 3 * u;
  let y = H / 2 - stack / 2;
  const fo = 1 - kend(S, leave - 0.2, 0.4);
  // caption with a small square bullet
  const sq = 16 * u, ky = y + mc.h / 2;
  piece(ctx, { x, y: ky - sq / 2, w: sq, h: sq }, (c) => { const k = ease.outBack(clamp((S.t - 0.15) / 0.35)); if (k <= 0) return; c.globalAlpha = fo; c.fillStyle = b1; c.fillRect(x + sq / 2 - sq * k / 2, ky - sq * k / 2, sq * k, sq * k); });
  animText(ctx, S, tx(S, 0), x + sq + 16 * u, ky, { ...co, color: ink, anim: 'fade', delay: 0.3, inDur: 0.5, outDur: 0.4, outEarly: leave - 0.6 });
  y += mc.h + 38 * u;
  blockLine(ctx, S, tx(S, 1), x, y + mt.h / 2, to, b1, 0.45, leave);
  y += mt.h + 18 * u;
  blockLine(ctx, S, tx(S, 2), x, y + ms.h / 2, so, b2, 0.75, leave - 0.15);
  y += ms.h + 44 * u;
  // a thin rule that draws across, and pulls back at the end
  const rk = kin(S, 1.15, 0.9, ease.inOutCubic) * (1 - kend(S, leave - 0.1, 0.6, ease.inOutCubic));
  line(ctx, x, y, W - x, y, rk, rgba(ink, 0.28), 2.5 * u);
  // three small squares stacking up in the corner
  const s2 = 30 * u, gx = W - x - s2, gy = H - Math.max(H * 0.12, 70 * u) - s2;
  piece(ctx, { x: gx - s2 * 1.3, y: gy - s2 * 1.3, w: s2 * 2.3, h: s2 * 2.3 }, (c) => {
    [[0, 0, b1], [-1.3, 0, b2], [0, -1.3, ink]].forEach(([dx, dy, cc], i) => {
      const k = ease.outBack(clamp((S.t - 1.0 - i * 0.12) / 0.35));
      if (k <= 0) return;
      c.globalAlpha = fo; c.fillStyle = cc;
      const cx = gx + dx * s2 + s2 / 2, cy = gy + dy * s2 + s2 / 2;
      c.fillRect(cx - s2 * k / 2, cy - s2 * k / 2, s2 * k, s2 * k);
    });
  });
}

// 2. Lesson Opener: a label pill, the lesson title with an underline and a short description.
function lessonScene(ctx, S, outro) {
  const u = S.u, cy = S.H / 2;
  const acc = col(S, 1), sub = col(S, 2);
  const fo = 1 - kend(S, 0.6, 0.6);
  const mx = Math.max(S.W * 0.1, 70 * u), x0 = mx + 44 * u;
  const mw = (S.W - x0 - Math.max(S.W * 0.08, 50 * u)) / S.W;
  // background shapes: a large ring at the right edge, a faint dot grid
  const R = Math.min(S.H * 0.42, S.W * 0.32), rcx = S.W + R * 0.35;
  piece(ctx, { x: rcx - R, y: cy - R, w: R * 0.65, h: R * 2 }, (c) => {
    const k = kin(S, 0.15, 1.4, ease.inOutCubic);
    if (k <= 0) return;
    c.globalAlpha = 0.35 * fo; c.strokeStyle = acc; c.lineWidth = 3 * u;
    c.beginPath(); c.arc(rcx, cy, R, Math.PI * 0.5, Math.PI * (0.5 + k)); c.stroke();
  });
  const gap = 28 * u, gx = S.W - Math.max(S.W * 0.2, 240 * u), gy = S.H * 0.14;
  piece(ctx, { x: gx - 6 * u, y: gy - 6 * u, w: gap * 5 + 12 * u, h: gap * 2 + 12 * u }, (c) => dots(c, S, gx, gy, 6, 3, gap, 3.5 * u, sub, 0.6, 0.025, 0.4 * fo));
  // left bar, label pill, title, underline, description
  const label = tx(S, 0);
  const lo = { font: 'Montserrat', fontFixed: true, weight: 800, size: 30, spacing: 0.18, upper: true };
  const ml = measure(ctx, S, label, lo), ph = 56 * u, pw = ml.w + 48 * u;
  const mt = measure(ctx, S, tx(S, 1), { font: 'Montserrat', weight: 800, size: 108 });
  const ms = measure(ctx, S, tx(S, 2), { font: 'Inter', fontFixed: true, weight: 400, size: 40 });
  const blockH = ph + 34 * u + mt.h + 28 * u + 6 * u + 30 * u + ms.h;
  const top = cy - blockH / 2, py = top + ph / 2;
  growRect(ctx, mx, top - 10 * u, 8 * u, blockH + 20 * u, kin(S, 0, 0.5) * fo, 'd', acc, 4 * u);
  growRect(ctx, x0, top, pw, ph, kin(S, 0.25, 0.45, ease.outExpo) * fo, 'l', acc, ph / 2);
  animText(ctx, S, label, x0 + pw / 2, py, { ...lo, color: col(S, 3), anim: 'fade', delay: 0.5, inDur: 0.4 });
  if (outro) piece(ctx, { x: x0 + pw + 14 * u, y: py - 26 * u, w: 52 * u, h: 52 * u }, (c) => { c.globalAlpha = fo; checkBadge(c, x0 + pw + 40 * u, py, 26 * u, ease.outBack(clamp((S.t - 1.0) / 0.4)), acc, col(S, 3), u); });
  const ty = top + ph + 34 * u + mt.h / 2;
  const b = animText(ctx, S, tx(S, 1), x0, ty, { font: 'Montserrat', weight: 800, size: 108, color: col(S, 0), align: 'left', anim: 'up', delay: 0.55, inDur: 0.55, stagger: 0.015, maxWidth: mw });
  const ly = ty + mt.h / 2 + 28 * u;
  line(ctx, x0, ly, x0 + Math.min(Math.max(b.w, 120 * u), 320 * u), ly, kin(S, 1.0, 0.6) * fo, acc, 6 * u);
  animText(ctx, S, tx(S, 2), x0, ly + 36 * u + ms.h / 2, { font: 'Inter', fontFixed: true, weight: 400, size: 40, color: sub, align: 'left', anim: 'fade', delay: 1.05, inDur: 0.6, maxWidth: mw });
}

// 3. Side Panel: a slanted color panel slides in beside the title (above it on tall frames).
function panelScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H, tall = W < H * 0.9;
  const ink = col(S, 0), pc = col(S, 1), sub = col(S, 2), acc = col(S, 3);
  const k = kin(S, 0, 0.75, ease.outExpo);
  // The outro ends with the text leaving, then the panel sweeping across, then a short fade.
  const cover = outro ? kend(S, 0.8, 0.55, ease.inOutCubic) : 0;
  const fo = outro ? 1 - kend(S, 1.15, 0.35) : 1 - kend(S, 0.6, 0.6);
  const end = outro ? 1 - kend(S, 0.25, 0.25) : fo;
  const sl = 90 * u;
  const lines = outro ? [1, 2] : [1];
  const labelI = outro ? 3 : 2;
  let x0, panelBox, label;
  if (!tall) {
    const pw = W * 0.36;
    const edge = lerp(-sl, pw, k) + (W + sl - pw) * cover;
    piece(ctx, { x: 0, y: 0, w: pw + sl, h: H }, (c) => {
      if (k <= 0) return;
      c.globalAlpha = end; c.fillStyle = pc;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(edge + sl, 0); c.lineTo(edge, H); c.lineTo(0, H); c.closePath(); c.fill();
    });
    label = [pw / 2 + sl / 4, H / 2, (pw - 60 * u) / W];
    x0 = pw + sl + Math.max(W * 0.05, 60 * u);
  } else {
    const ph = H * 0.34;
    const edge = lerp(-sl, ph, k) + (H + sl - ph) * cover;
    piece(ctx, { x: 0, y: 0, w: W, h: ph + sl }, (c) => {
      if (k <= 0) return;
      c.globalAlpha = end; c.fillStyle = pc;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, edge); c.lineTo(0, edge + sl); c.closePath(); c.fill();
    });
    label = [W / 2, ph / 2, 0.86];
    x0 = Math.max(W * 0.08, 60 * u);
  }
  animText(ctx, S, tx(S, labelI), label[0], label[1], { font: 'Montserrat', fontFixed: true, weight: 800, size: 60, color: '#ffffff', anim: 'fade', delay: 0.6, inDur: 0.5, maxWidth: label[2], outDur: outro ? 0.3 : 0.5, outEarly: outro ? 0.85 : 0 });
  // title block, centered in the free area
  const mw = (W - x0 - Math.max(W * 0.06, 50 * u)) / W;
  const mt = measure(ctx, S, tx(S, 0), { font: 'Montserrat', weight: 800, size: 92 });
  const subH = lines.map((i) => measure(ctx, S, tx(S, i), { font: 'Inter', fontFixed: true, weight: 400, size: 38 }).h);
  const blockH = mt.h + 26 * u + 8 * u + 30 * u + subH.reduce((a, b) => a + b + 8 * u, 0);
  const areaT = tall ? H * 0.34 + sl : 0;
  let y = areaT + (H - areaT - blockH) / 2;
  const tout = { outDur: outro ? 0.3 : 0.5, outEarly: outro ? 0.85 : 0 };
  animText(ctx, S, tx(S, 0), x0, y + mt.h / 2, { font: 'Montserrat', weight: 800, size: 92, color: ink, align: 'left', anim: 'up', delay: 0.45, inDur: 0.55, stagger: 0.015, maxWidth: mw, ...tout });
  y += mt.h + 26 * u;
  line(ctx, x0, y, x0 + 120 * u, y, kin(S, 0.85, 0.5) * fo, acc, 8 * u);
  y += 8 * u + 30 * u;
  lines.forEach((i, n) => {
    animText(ctx, S, tx(S, i), x0, y + subH[n] / 2, { font: 'Inter', fontFixed: true, weight: 400, size: 38, color: sub, align: 'left', anim: 'fade', delay: 0.95 + n * 0.15, inDur: 0.5, maxWidth: mw, ...tout });
    y += subH[n] + 8 * u;
  });
  // small accents: an outlined circle drawing in at the top right, a dot grid at the bottom right
  const rr = 62 * u, rx = W - 110 * u, ry = (tall ? H * 0.34 + sl + 90 * u : 120 * u);
  piece(ctx, { x: rx - rr, y: ry - rr, w: rr * 2, h: rr * 2 }, (c) => {
    const kk = kin(S, 0.5, 1.0, ease.inOutCubic);
    if (kk <= 0) return;
    c.globalAlpha = 0.5 * fo; c.strokeStyle = pc; c.lineWidth = 3 * u;
    c.beginPath(); c.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk); c.stroke();
    c.globalAlpha = fo; c.fillStyle = acc;
    c.beginPath(); c.arc(rx + rr * 0.7, ry - rr * 0.7, 13 * u * ease.outBack(clamp((S.t - 1.3) / 0.4)), 0, Math.PI * 2); c.fill();
  });
  const gap = 26 * u, gx = W - 120 * u - gap * 2, gy = H - 120 * u - gap * 2;
  piece(ctx, { x: gx - 6 * u, y: gy - 6 * u, w: gap * 2 + 12 * u, h: gap * 2 + 12 * u }, (c) => dots(c, S, gx, gy, 3, 3, gap, 5 * u, pc, 1.1, 0.04, 0.45 * fo));
}

// 4. Line Frame: an outline draws itself around the title, with corner brackets.
function frameScene(ctx, S, outro) {
  const u = S.u, cx = S.W / 2, cy = S.H / 2;
  const fw = Math.min(S.W * 0.64, 1120 * u), fh = Math.min(S.H * 0.42, 400 * u);
  const L = cx - fw / 2, T = cy - fh / 2;
  let k = kin(S, 0, 1.1, ease.inOutCubic), shrink = 1;
  if (outro) shrink = 1 - kend(S, 0.8, 0.8, ease.inOutCubic);
  else k = Math.min(k, 1 - kend(S, 0.8, 0.8, ease.inOutCubic));
  const fo = 1 - kend(S, outro ? 1.1 : 0.6, 0.45);
  const zoom = (c) => { c.translate(cx, cy); c.scale(shrink, shrink); c.translate(-cx, -cy); };
  piece(ctx, { x: L, y: T, w: fw, h: fh }, (c) => {
    if (k <= 0 || shrink <= 0) return;
    zoom(c);
    c.globalAlpha = 0.85 * Math.min(1, shrink * 1.5); c.strokeStyle = col(S, 2); c.lineWidth = 3 * u; c.lineCap = 'square';
    traceRect(c, L, T, fw, fh, k);
  });
  const g = 18 * u, len = 46 * u;
  piece(ctx, { x: L - g - 4 * u, y: T - g - 4 * u, w: fw + 2 * g + 8 * u, h: fh + 2 * g + 8 * u }, (c) => {
    const kb = ease.outBack(clamp((S.t - 1.0) / 0.4));
    if (kb <= 0 || shrink <= 0) return;
    zoom(c);
    c.globalAlpha = fo; c.strokeStyle = col(S, 1); c.lineWidth = 6 * u; c.lineCap = 'round';
    const l = len * kb;
    for (const [x, y, sx, sy] of [[L - g, T - g, 1, 1], [L + fw + g, T - g, -1, 1], [L - g, T + fh + g, 1, -1], [L + fw + g, T + fh + g, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + l * sy); c.lineTo(x, y); c.lineTo(x + l * sx, y); c.stroke();
    }
  });
  const tout = outro ? { outDur: 0.4, outEarly: 0.7 } : { outDur: 0.5 };
  animText(ctx, S, tx(S, 0), cx, cy - 24 * u, { font: 'Montserrat', weight: 700, size: 104, color: col(S, 0), anim: 'blur', delay: 0.5, inDur: 0.7, stagger: 0.035, spacing: 0.04, maxWidth: (fw * 0.86) / S.W, ...tout });
  animText(ctx, S, tx(S, 1), cx, cy + 74 * u, { font: 'Montserrat', fontFixed: true, weight: 400, size: 30, spacing: 0.3, upper: true, color: col(S, 1), anim: 'fade', delay: 1.05, inDur: 0.6, maxWidth: (fw * 0.86) / S.W, ...tout });
}

// 5. Bold Bands: slanted color bands sweep in under the title, and out again at the end.
function bandsScene(ctx, S) {
  const u = S.u, W = S.W, H = S.H, cy = H * 0.5;
  const xt = Math.max(W * 0.09, 80 * u);
  const mainH = 168 * u, thinH = 22 * u, subH = 74 * u, sk = 0.35;
  const yMain = cy - 30 * u, yThin = yMain - mainH / 2 - 34 * u, ySub = yMain + mainH / 2 + 22 * u + subH / 2;
  const to = { font: 'Montserrat', weight: 900, size: 104, upper: true };
  const so = { font: 'Inter', fontFixed: true, weight: 700, size: 38 };
  const mt = measure(ctx, S, tx(S, 0), to), ms = measure(ctx, S, tx(S, 1), so);
  const mainR = Math.min(W * 0.96, Math.max(W * 0.62, xt + Math.min(mt.w, W * 0.86 - xt) + 90 * u));
  const subR = Math.min(W * 0.96, xt + Math.min(ms.w, W * 0.86 - xt) + 70 * u);
  const away = ease.inCubic(clamp((S.t - (S.d - 0.65)) / 0.55)) * W * 1.4;
  const band = (yc, h, x0, x1, color, alpha = 1) => (c) => {
    if (x1 - x0 < 1) return;
    c.globalAlpha = alpha; c.fillStyle = color;
    const s = sk * h / 2;
    c.beginPath(); c.moveTo(x0 + s + away, yc - h / 2); c.lineTo(x1 + s + away, yc - h / 2); c.lineTo(x1 - s + away, yc + h / 2); c.lineTo(x0 - s + away, yc + h / 2); c.closePath(); c.fill();
  };
  const kThin = kin(S, 0, 0.6, ease.outExpo), kMain = kin(S, 0.1, 0.6, ease.outExpo), kSub = kin(S, 0.35, 0.6, ease.outExpo);
  piece(ctx, { x: W * 0.3, y: yThin - thinH / 2, w: W * 0.7, h: thinH }, band(yThin, thinH, lerp(W * 1.2, W * 0.3, kThin), W * 1.2, col(S, 2)));
  piece(ctx, { x: 0, y: yMain - mainH / 2, w: mainR, h: mainH }, band(yMain, mainH, -W * 0.2, lerp(-W * 0.2, mainR, kMain), col(S, 1)));
  piece(ctx, { x: 0, y: ySub - subH / 2, w: subR, h: subH }, band(ySub, subH, -W * 0.2, lerp(-W * 0.2, subR, kSub), col(S, 4)));
  const tout = { outDur: 0.35, outEarly: 0.25 };
  animText(ctx, S, tx(S, 0), xt, yMain, { ...to, color: col(S, 0), align: 'left', anim: 'left', delay: 0.45, inDur: 0.55, ease: 'outExpo', maxWidth: (W * 0.86 - xt) / W, ...tout });
  animText(ctx, S, tx(S, 1), xt, ySub, { ...so, color: col(S, 3), align: 'left', anim: 'fade', delay: 0.85, inDur: 0.5, maxWidth: (W * 0.86 - xt) / W, ...tout });
}



// 6. Lesson Agenda: a heading, then numbered steps appearing one by one along a line.
//    The recap version ticks each step off instead.
function agendaScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H;
  const ink = col(S, 0), acc = col(S, 1), onAcc = col(S, 3);
  const x = Math.max(W * 0.12, 80 * u);
  const fo = 1 - kend(S, 0.6, 0.6);
  const ho = { font: 'Montserrat', weight: 800, size: 84, color: ink, align: 'left', maxWidth: (W - x - 60 * u) / W };
  const mh = measure(ctx, S, tx(S, 0), ho);
  const row = 112 * u, r = 28 * u;
  let y = H / 2 - (mh.h + 22 * u + 8 * u + 56 * u + row * 2 + r * 2) / 2;
  animText(ctx, S, tx(S, 0), x, y + mh.h / 2, { ...ho, anim: 'up', delay: 0.1, inDur: 0.5, stagger: 0.015 });
  y += mh.h + 22 * u;
  growRect(ctx, x, y, 72 * u, 8 * u, kin(S, 0.4, 0.4, ease.outExpo) * fo, 'l', acc, 4 * u);
  y += 8 * u + 56 * u + r;
  const mx = x + r;
  line(ctx, mx, y, mx, y + row * 2, kin(S, 0.7, 1.0, ease.inOutCubic) * fo, rgba(acc, 0.35), 4 * u);
  const mw = (W - mx - r - 34 * u - Math.max(W * 0.08, 50 * u)) / W;
  for (let i = 0; i < 3; i++) {
    const cy = y + i * row, d = 0.7 + i * 0.4;
    piece(ctx, { x: mx - r, y: cy - r, w: r * 2, h: r * 2 }, (c) => {
      const k = ease.outBack(clamp((S.t - d) / 0.4));
      if (k <= 0) return;
      c.globalAlpha = fo;
      if (outro) { checkBadge(c, mx, cy, r, k, acc, onAcc, u); return; }
      c.fillStyle = acc; c.beginPath(); c.arc(mx, cy, r * k, 0, Math.PI * 2); c.fill();
      if (k > 0.6) drawText(c, S, String(i + 1), mx, cy + u, { font: 'Montserrat', fontFixed: true, weight: 800, size: 30, color: onAcc, align: 'center', ...still(fo) });
    });
    animText(ctx, S, tx(S, i + 1), mx + r + 34 * u, cy, { font: 'Inter', fontFixed: true, weight: 400, size: 46, color: ink, align: 'left', anim: 'up', delay: d + 0.15, inDur: 0.45, stagger: 0.008, maxWidth: mw });
  }
}

// 7. Chart Rise: bars rise like a report chart and a trend line draws over them, next to the title.
function chartScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H, tall = W < H * 0.9;
  const ink = col(S, 0), bar = col(S, 1), trend = col(S, 2), muted = col(S, 3);
  const fo = 1 - kend(S, 0.6, 0.6);
  const drop = outro ? 1 - kend(S, 1.1, 0.6, ease.inOutCubic) : 1; // the outro lowers the bars again
  let c0, c1, base, ch, x, mw, mid;
  if (!tall) { c0 = W * 0.56; c1 = W - Math.max(W * 0.08, 60 * u); base = H * 0.74; ch = H * 0.46; x = Math.max(W * 0.08, 70 * u); mw = (c0 - x - 60 * u) / W; mid = H / 2; }
  else { c0 = W * 0.12; c1 = W * 0.88; base = H * 0.84; ch = H * 0.24; x = W * 0.12; mw = 0.76; mid = H * 0.36; }
  const hs = [0.32, 0.48, 0.4, 0.62, 0.56, 0.84], n = hs.length;
  const slot = (c1 - c0) / n, bw = slot * 0.62;
  line(ctx, c0 - 10 * u, base, c1 + 10 * u, base, kin(S, 0, 0.5, ease.inOutCubic) * fo, rgba(muted, 0.7), 3 * u);
  piece(ctx, { x: c0, y: base - ch, w: c1 - c0, h: ch }, (c) => {
    c.fillStyle = bar;
    hs.forEach((hh, i) => {
      const k = kin(S, 0.25 + i * 0.09, 0.6) * drop;
      if (k <= 0) return;
      c.globalAlpha = fo * (0.45 + 0.55 * (i + 1) / n);
      const h = ch * hh * k;
      roundRect(c, c0 + slot * i + (slot - bw) / 2, base - h, bw, h, Math.min(8 * u, bw / 4, h / 2));
      c.fill();
    });
  });
  const pts = hs.map((hh, i) => [c0 + slot * i + slot / 2, base - ch * hh - 26 * u]);
  piece(ctx, { x: c0, y: base - ch - 40 * u, w: c1 - c0, h: ch }, (c) => {
    const k = kin(S, 1.0, 0.9, ease.inOutCubic);
    if (k <= 0) return;
    c.globalAlpha = fo * drop; c.strokeStyle = trend; c.lineWidth = 5 * u; c.lineCap = 'round'; c.lineJoin = 'round';
    const end = polyPart(c, pts, k);
    const kd = ease.outBack(clamp((S.t - 1.85) / 0.35));
    if (kd > 0) { c.fillStyle = trend; c.beginPath(); c.arc(end[0], end[1], 11 * u * kd, 0, Math.PI * 2); c.fill(); }
  });
  const lo = { font: 'Montserrat', fontFixed: true, weight: 700, size: 26, spacing: 0.24, upper: true, color: trend, align: 'left', maxWidth: mw };
  const to = { font: 'Montserrat', weight: 800, size: 92, color: ink, align: 'left', maxWidth: mw };
  const so = { font: 'Inter', fontFixed: true, weight: 400, size: 40, color: muted, align: 'left', maxWidth: mw };
  const ml = measure(ctx, S, tx(S, 2), lo), mt = measure(ctx, S, tx(S, 0), to), ms = measure(ctx, S, tx(S, 1), so);
  let y = mid - (ml.h + 26 * u + mt.h + 20 * u + ms.h) / 2;
  animText(ctx, S, tx(S, 2), x, y + ml.h / 2, { ...lo, anim: 'fade', delay: 0.2, inDur: 0.5 });
  y += ml.h + 26 * u;
  animText(ctx, S, tx(S, 0), x, y + mt.h / 2, { ...to, anim: 'up', delay: 0.35, inDur: 0.55, stagger: 0.015 });
  y += mt.h + 20 * u;
  animText(ctx, S, tx(S, 1), x, y + ms.h / 2, { ...so, anim: 'fade', delay: 0.75, inDur: 0.6 });
}

// 8. Chapter Number: a huge outlined number fills with color from the bottom, beside the chapter title.
function numberScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H, tall = W < H * 0.9;
  const ink = col(S, 0), fill = col(S, 1), stroke = col(S, 2), muted = col(S, 3);
  const fo = 1 - kend(S, 0.6, 0.6);
  const no = { font: 'Montserrat', weight: 900, size: tall ? 340 : 420, lineHeight: 1.0, align: 'center' };
  const mn = measure(ctx, S, tx(S, 0), no);
  const sz = no.size * u * (S.scale || 1);
  const show = kin(S, 0, 0.4);
  const lvl = kin(S, 0.35, 0.9, ease.inOutCubic) * (outro ? 1 - kend(S, 1.2, 0.6, ease.inOutCubic) : 1);
  const to = { font: 'Montserrat', weight: 800, size: 88, color: ink };
  const so = { font: 'Inter', fontFixed: true, weight: 400, size: 40, color: muted };
  let nx, ny, dv, tx0, align, mw, top;
  const mt0 = measure(ctx, S, tx(S, 1), to), ms0 = measure(ctx, S, tx(S, 2), so);
  if (!tall) {
    const x0 = Math.max(W * 0.1, 80 * u);
    nx = x0 + mn.w / 2; ny = H / 2;
    const dx = x0 + mn.w + 56 * u;
    dv = [dx, H / 2 - 130 * u, dx, H / 2 + 130 * u];
    tx0 = dx + 56 * u; align = 'left'; mw = (W - tx0 - 60 * u) / W;
    top = H / 2 - (mt0.h + 22 * u + ms0.h) / 2;
  } else {
    nx = W / 2; ny = H * 0.34;
    const dy = ny + sz * 0.45 + 40 * u;
    dv = [W / 2 - 110 * u, dy, W / 2 + 110 * u, dy];
    tx0 = W / 2; align = 'center'; mw = 0.86;
    top = dy + 50 * u;
  }
  piece(ctx, { x: nx - mn.w / 2, y: ny - sz * 0.42, w: mn.w, h: sz * 0.84 }, (c) => {
    if (show <= 0) return;
    const sc = 1.06 - 0.06 * show;
    c.translate(nx, ny); c.scale(sc, sc); c.translate(-nx, -ny);
    drawText(c, S, tx(S, 0), nx, ny, { ...no, color: stroke, outline: true, ...still(show * fo) });
    if (lvl > 0) {
      const gb = ny + sz * 0.37, gt = ny - sz * 0.37;
      c.beginPath(); c.rect(nx - mn.w, gb - (gb - gt) * lvl, mn.w * 2, (gb - gt) * lvl + sz * 0.1); c.clip();
      drawText(c, S, tx(S, 0), nx, ny, { ...no, color: fill, ...still(show * fo) });
    }
  });
  line(ctx, ...dv, kin(S, 0.6, 0.5, ease.inOutCubic) * fo, rgba(stroke, 0.45), 3 * u);
  animText(ctx, S, tx(S, 1), tx0, top + mt0.h / 2, { ...to, align, anim: 'up', delay: 0.8, inDur: 0.55, stagger: 0.015, maxWidth: mw });
  animText(ctx, S, tx(S, 2), tx0, top + mt0.h + 22 * u + ms0.h / 2, { ...so, align, anim: 'fade', delay: 1.1, inDur: 0.6, maxWidth: mw });
}

// 9. Monogram: a rounded badge with initials turns in, then the name slides out from behind it.
function monogramScene(ctx, S, outro) {
  const u = S.u, W = S.W, H = S.H, tall = W < H * 0.9;
  const badge = col(S, 0), ini = col(S, 1), ink = col(S, 2), muted = col(S, 3);
  const fo = 1 - kend(S, 0.6, 0.6);
  const bs = (tall ? 180 : 200) * u, gap = 48 * u;
  const no = { font: 'Montserrat', weight: 800, size: 96, color: ink };
  const so = { font: 'Inter', fontFixed: true, weight: 400, size: 38, color: muted };
  const mname = measure(ctx, S, tx(S, 1), no), mtag = measure(ctx, S, tx(S, 2), so);
  const kb = ease.outBack(clamp(S.t / 0.6));
  const ks = kin(S, 0.7, 0.7, ease.inOutCubic) * (outro ? 1 - kend(S, 1.25, 0.6, ease.inOutCubic) : 1);
  const gone = outro ? kend(S, 0.6, 0.5) : 0; // the outro ends with the badge shrinking away
  let bx, by, tx0, tyN, tyT, align, mw;
  if (!tall) {
    mw = (W * 0.9 - bs - gap) / W;
    const tw = Math.min(Math.max(mname.w, mtag.w), mw * W);
    bx = lerp(W / 2 - bs / 2, W / 2 - (bs + gap + tw) / 2, ks); by = H / 2 - bs / 2;
    tx0 = bx + bs + gap - (1 - ks) * (tw + gap); align = 'left';
    tyN = H / 2 - (mname.h + 24 * u + mtag.h) / 2 + mname.h / 2;
  } else {
    mw = 0.86;
    bx = W / 2 - bs / 2; by = H * 0.38 - bs / 2;
    tx0 = W / 2; align = 'center';
    tyN = by + bs + 60 * u + mname.h / 2;
  }
  tyT = tyN + mname.h / 2 + 24 * u + mtag.h / 2;
  piece(ctx, { x: bx, y: by, w: bs, h: bs }, (c) => {
    const k = kb * (1 - gone);
    if (k <= 0) return;
    const cx = bx + bs / 2, cy = by + bs / 2;
    c.globalAlpha = outro ? 1 : fo;
    c.translate(cx, cy); c.rotate((1 - kb) * -Math.PI / 2); c.scale(k, k); c.translate(-cx, -cy);
    c.fillStyle = badge; roundRect(c, bx, by, bs, bs, bs * 0.26); c.fill();
    const ki = clamp((S.t - 0.3) / 0.3) * (outro ? 1 : fo);
    if (ki > 0) drawText(c, S, tx(S, 0), cx, cy + 2 * u, { font: 'Montserrat', fontFixed: true, weight: 800, size: bs / u * 0.42, color: ini, align: 'center', upper: true, maxWidth: (bs * 0.78) / W, ...still(ki) });
  });
  // the name and tagline: on wide frames they slide out from behind the badge's right edge
  const reveal = (text, o, y, alpha) => (c) => {
    if (!tall) { c.beginPath(); c.rect(bx + bs + 2 * u, 0, W, H); c.clip(); }
    drawText(c, S, text, tx0, y, { ...o, align, maxWidth: mw, ...still(alpha) });
  };
  // on tall frames the text fades in below the badge, and in the outro fades out before the badge goes
  const tIn = tall ? kin(S, 0.7, 0.5) * (outro ? 1 - kend(S, 1.25, 0.5) : 1) : 1;
  const textA = (outro ? 1 : fo) * tIn;
  piece(ctx, { x: tall ? W * 0.07 : bx + bs + gap, y: tyN - mname.h / 2, w: tall ? W * 0.86 : mname.w, h: mname.h }, reveal(tx(S, 1), no, tyN, textA));
  piece(ctx, { x: tall ? W * 0.07 : bx + bs + gap, y: tyT - mtag.h / 2, w: tall ? W * 0.86 : mtag.w, h: mtag.h }, reveal(tx(S, 2), so, tyT, textA * kin(S, 1.0, 0.5)));
  const ux = tall ? W / 2 - 45 * u : tx0, uy = tyN + mname.h / 2 + 8 * u;
  piece(ctx, { x: tall ? ux : bx + bs + gap, y: uy - 6 * u, w: 90 * u, h: 12 * u }, (c) => {
    const k = kin(S, 1.3, 0.5);
    if (k <= 0) return;
    if (!tall) { c.beginPath(); c.rect(bx + bs + 2 * u, 0, W, H); c.clip(); }
    c.globalAlpha = outro ? 1 : fo; c.strokeStyle = badge; c.lineWidth = 6 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ux, uy); c.lineTo(ux + 90 * u * k, uy); c.stroke();
  });
}

// 10. Shutter: two panels part to show the title, and close over it again at the end.
function shutterScene(ctx, S) {
  const u = S.u, W = S.W, H = S.H;
  const ink = col(S, 0), top = col(S, 1), bot = col(S, 2), acc = col(S, 3);
  const band = Math.min(H * 0.46, 520 * u);
  const open = kin(S, 0.35, 0.75, ease.inOutCubic) * (1 - kend(S, 0.55, 0.5, ease.inOutCubic));
  const gh = band * open / 2;
  piece(ctx, { x: 0, y: 0, w: W, h: H / 2 - band / 2 }, (c) => {
    c.fillStyle = top; c.fillRect(0, 0, W, H / 2 - gh);
    c.fillStyle = acc; c.fillRect(0, H / 2 - gh - 4 * u, W, 4 * u * Math.min(1, open * 4));
  });
  piece(ctx, { x: 0, y: H / 2 + band / 2, w: W, h: H / 2 - band / 2 }, (c) => {
    c.fillStyle = bot; c.fillRect(0, H / 2 + gh, W, H / 2 - gh);
  });
  // the seam: a thin line across the closed panels before they open (and after they close)
  const seam = kin(S, 0, 0.35) * (1 - Math.min(1, open * 3));
  growRect(ctx, W * 0.2, H / 2 - 2.5 * u, W * 0.6, 5 * u, seam, 'c', acc);
  const tout = { outDur: 0.35, outEarly: 0.6 };
  animText(ctx, S, tx(S, 0), W / 2, H / 2 - 34 * u, { font: 'Montserrat', weight: 800, size: 110, color: ink, anim: 'up', delay: 0.75, inDur: 0.55, stagger: 0.02, maxWidth: 0.86, ...tout });
  growRect(ctx, W / 2 - 70 * u, H / 2 + 44 * u, 140 * u, 4 * u, kin(S, 1.05, 0.5, ease.outExpo) * (1 - kend(S, 0.95, 0.35)), 'c', acc);
  animText(ctx, S, tx(S, 1), W / 2, H / 2 + 92 * u, { font: 'Montserrat', fontFixed: true, weight: 400, size: 30, spacing: 0.28, upper: true, color: ink, anim: 'fade', delay: 1.15, inDur: 0.6, maxWidth: 0.86, ...tout });
}

def('Professional', 'pro-block', 'Block Reveal', { texts: ['Team training · Part 1', 'Welcome Aboard', 'Everything you need for your first week'], font: 'Montserrat', colors: ['#1b1f24', '#e4572e', '#1f6f5c', '#5a5f66'], dur: 5 }, (ctx, S) => blockScene(ctx, S, false));
def('Professional', 'pro-block-end', 'Block Reveal Thanks', { texts: ['Session complete', 'Thanks for Watching', 'Questions? hello@company.com'], font: 'Montserrat', colors: ['#1b1f24', '#e4572e', '#1f6f5c', '#5a5f66'], dur: 6 }, (ctx, S) => blockScene(ctx, S, true));
def('Professional', 'pro-lesson', 'Lesson Opener', { texts: ['Lesson 01', 'Getting Started', 'Your first spreadsheet, step by step'], font: 'Montserrat', colors: ['#ffffff', '#ffb703', '#a9bcd8', '#0f1e36'], dur: 5 }, (ctx, S) => lessonScene(ctx, S, false));
def('Professional', 'pro-lesson-end', 'Lesson Complete', { texts: ['Lesson complete', 'Nice work!', 'Up next: Lesson 02 · Formulas'], font: 'Montserrat', colors: ['#ffffff', '#ffb703', '#a9bcd8', '#0f1e36'], dur: 6 }, (ctx, S) => lessonScene(ctx, S, true));
def('Professional', 'pro-panel', 'Side Panel', { texts: ['Quarterly Review', 'Results, plans and next steps', 'Q3 2026'], font: 'Montserrat', colors: ['#16202c', '#2154e8', '#5b6675', '#ff8a3d'], dur: 5 }, (ctx, S) => panelScene(ctx, S, false));
def('Professional', 'pro-panel-end', 'Side Panel Contact', { texts: ['Thank you', 'hello@company.com', 'www.company.com', 'Get in touch'], font: 'Montserrat', colors: ['#16202c', '#2154e8', '#5b6675', '#ff8a3d'], dur: 6 }, (ctx, S) => panelScene(ctx, S, true));
def('Professional', 'pro-frame', 'Line Frame', { texts: ['Introduction', 'Module 1 · Getting started'], font: 'Montserrat', colors: ['#ffffff', '#1fd1b9', '#ffffff'], dur: 5 }, (ctx, S) => frameScene(ctx, S, false));
def('Professional', 'pro-frame-end', 'Line Frame Questions', { texts: ['Questions?', 'contact@company.com'], font: 'Montserrat', colors: ['#ffffff', '#1fd1b9', '#ffffff'], dur: 6 }, (ctx, S) => frameScene(ctx, S, true));
def('Professional', 'pro-bands', 'Bold Bands', { texts: ['Market Update', 'Weekly briefing for the team'], font: 'Montserrat', colors: ['#ffffff', '#2f6bff', '#1fd1b9', '#0e1116', '#ffffff'], dur: 5 }, (ctx, S) => bandsScene(ctx, S));
def('Professional', 'pro-bands-end', 'Bold Bands Thanks', { texts: ['Thanks for Watching', 'Subscribe for more updates'], font: 'Montserrat', colors: ['#ffffff', '#2f6bff', '#1fd1b9', '#0e1116', '#ffffff'], dur: 6 }, (ctx, S) => bandsScene(ctx, S));

def('Professional', 'pro-agenda', 'Lesson Agenda', { texts: ['In this lesson', 'Opening a new workbook', 'Entering and editing data', 'Saving and sharing your file'], font: 'Montserrat', colors: ['#151826', '#4f46e5', '#6b7080', '#ffffff'], dur: 5 }, (ctx, S) => agendaScene(ctx, S, false));
def('Professional', 'pro-agenda-end', 'Lesson Recap', { texts: ['Recap', 'Opened a new workbook', 'Entered and edited data', 'Saved and shared your file'], font: 'Montserrat', colors: ['#151826', '#4f46e5', '#6b7080', '#ffffff'], dur: 6 }, (ctx, S) => agendaScene(ctx, S, true));
def('Professional', 'pro-chart', 'Chart Rise', { texts: ['Quarterly Results', 'Revenue, growth and what comes next', 'Q3 2026'], font: 'Montserrat', colors: ['#ffffff', '#34d399', '#fbbf24', '#9ca3af'], dur: 5 }, (ctx, S) => chartScene(ctx, S, false));
def('Professional', 'pro-chart-end', 'Chart Rise Thanks', { texts: ['Thank You', 'Questions? finance@company.com', 'Q3 2026'], font: 'Montserrat', colors: ['#ffffff', '#34d399', '#fbbf24', '#9ca3af'], dur: 6 }, (ctx, S) => chartScene(ctx, S, true));
def('Professional', 'pro-number', 'Chapter Number', { texts: ['02', 'Chapter Two', 'Working with formulas'], font: 'Montserrat', colors: ['#ffffff', '#f97316', '#ffffff', '#a1a1aa'], dur: 5 }, (ctx, S) => numberScene(ctx, S, false));
def('Professional', 'pro-number-end', 'Chapter Complete', { texts: ['02', 'Chapter complete', 'Next up: Chapter 03 · Charts'], font: 'Montserrat', colors: ['#ffffff', '#f97316', '#ffffff', '#a1a1aa'], dur: 6 }, (ctx, S) => numberScene(ctx, S, true));
def('Professional', 'pro-monogram', 'Monogram', { texts: ['YC', 'Your Company', 'Design · Strategy · Growth'], brandTexts: { 0: 'initials', 1: 'company' }, font: 'Montserrat', colors: ['#7c3aed', '#ffffff', '#111827', '#6b7280'], dur: 5 }, (ctx, S) => monogramScene(ctx, S, false));
def('Professional', 'pro-monogram-end', 'Monogram Contact', { texts: ['YC', 'Thank You', 'www.yourcompany.com'], brandTexts: { 0: 'initials' }, font: 'Montserrat', colors: ['#7c3aed', '#ffffff', '#111827', '#6b7280'], dur: 6 }, (ctx, S) => monogramScene(ctx, S, true));
def('Professional', 'pro-shutter', 'Shutter', { texts: ['Welcome', 'Annual meeting 2026'], font: 'Montserrat', colors: ['#1f2933', '#1f2933', '#3e4c59', '#e11d48'], dur: 5 }, (ctx, S) => shutterScene(ctx, S));
def('Professional', 'pro-shutter-end', 'Shutter Close', { texts: ['Thanks for Watching', 'See you at the next meeting'], font: 'Montserrat', colors: ['#1f2933', '#1f2933', '#3e4c59', '#e11d48'], dur: 6 }, (ctx, S) => shutterScene(ctx, S));


// ---------- Professional lower thirds: one in each style, bottom left, with their own backing ----------
const ltPos = (S) => ({ u: S.u, x: Math.max(S.W * 0.06, 60 * S.u), yb: S.H - Math.max(S.H * 0.12, 110 * S.u) });
const ltLeave = (S, lead = 0.5) => 1 - kend(S, lead, lead, ease.inOutCubic); // 1 → 0 at the end
const initialsOf = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function ltText(ctx, S, nameO, roleO, ni = 0, ri = 1) {
  const mn = measure(ctx, S, tx(S, ni), nameO), mr = measure(ctx, S, tx(S, ri), roleO);
  const cap = S.W * 0.6;
  return { mn, mr, w: Math.min(Math.max(mn.w, mr.w), cap), cap: cap / S.W };
}

function ltBlock(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 54, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 30, color: col(S, 3), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 26 * u, w = m.w + pad * 2, hh = m.mn.h + m.mr.h + pad * 1.5, top = yb - hh;
  growRect(ctx, x, top, w, hh, kin(S, 0, 0.45, ease.outExpo) * ltLeave(S, 0.45), 'l', col(S, 4), 6 * u);
  blockLine(ctx, S, tx(S, 0), x + pad, top + pad * 0.75 + m.mn.h / 2, { ...no, maxWidth: m.cap }, col(S, 1), 0.3, 1.1);
  blockLine(ctx, S, tx(S, 1), x + pad, top + pad * 0.75 + m.mn.h + m.mr.h / 2, { ...ro, maxWidth: m.cap }, col(S, 2), 0.5, 1.0);
}

function ltLesson(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 54, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 30, color: col(S, 2), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 26 * u, bar = 8 * u, w = m.w + pad * 2 + bar, hh = m.mn.h + m.mr.h + pad * 1.4, top = yb - hh;
  const out = ltLeave(S);
  growRect(ctx, x, top, w, hh, kin(S, 0.1, 0.5, ease.outExpo) * out, 'l', rgba(col(S, 3), 0.94), 4 * u);
  growRect(ctx, x, top, bar, hh, kin(S, 0, 0.35) * out, 'd', col(S, 1));
  const tout = { outDur: 0.3, outEarly: 0.45 };
  animText(ctx, S, tx(S, 0), x + bar + pad, top + pad * 0.7 + m.mn.h / 2, { ...no, anim: 'up', delay: 0.35, inDur: 0.45, stagger: 0.012, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), x + bar + pad, top + pad * 0.7 + m.mn.h + m.mr.h / 2, { ...ro, anim: 'fade', delay: 0.55, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltPanel(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 52, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 30, color: col(S, 2), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 24 * u, sl = 26 * u;
  const ph = m.mn.h + pad, sh = m.mr.h + pad * 0.7, pw = m.mn.w + pad * 2 + sl, sw = m.mr.w + pad * 2;
  const top = yb - ph - sh;
  const out = ltLeave(S), kp = kin(S, 0, 0.5, ease.outExpo) * out, ks = kin(S, 0.2, 0.5, ease.outExpo) * out;
  piece(ctx, { x, y: top, w: pw, h: ph }, (c) => {
    if (kp <= 0) return;
    const r = x + pw * kp;
    c.fillStyle = col(S, 1);
    c.beginPath(); c.moveTo(x, top); c.lineTo(r, top); c.lineTo(r - sl, top + ph); c.lineTo(x, top + ph); c.closePath(); c.fill();
    c.fillStyle = col(S, 3); c.fillRect(x, top, 8 * u, ph * kp);
  });
  growRect(ctx, x, top + ph, sw, sh, ks, 'l', col(S, 4));
  const tout = { outDur: 0.3, outEarly: 0.45 };
  animText(ctx, S, tx(S, 0), x + pad + 8 * u, top + ph / 2, { ...no, anim: 'up', delay: 0.3, inDur: 0.45, stagger: 0.012, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), x + pad, top + ph + sh / 2, { ...ro, anim: 'fade', delay: 0.5, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltFrame(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 700, size: 50, color: col(S, 0), align: 'left' };
  const ro = { font: 'Montserrat', fontFixed: true, weight: 400, size: 24, spacing: 0.28, upper: true, color: col(S, 1), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 28 * u, w = m.w + pad * 2, hh = m.mn.h + m.mr.h + pad * 1.5, top = yb - hh;
  const out = ltLeave(S, 0.6);
  const k = kin(S, 0, 0.8, ease.inOutCubic) * out;
  piece(ctx, { x, y: top, w, h: hh }, (c) => {
    if (k <= 0) return;
    c.globalAlpha = Math.min(1, k * 2) * 0.88; c.fillStyle = col(S, 3); c.fillRect(x, top, w, hh);
    c.globalAlpha = 0.85; c.strokeStyle = col(S, 2); c.lineWidth = 2 * u; traceRect(c, x, top, w, hh, k);
    const kb = ease.outBack(clamp((S.t - 0.7) / 0.35)) * out;
    if (kb <= 0) return;
    c.globalAlpha = 1; c.strokeStyle = col(S, 1); c.lineWidth = 4 * u; c.lineCap = 'round';
    const g = 8 * u, l = 22 * u * kb;
    for (const [px, py, sx, sy] of [[x - g, top - g, 1, 1], [x + w + g, top + hh + g, -1, -1]]) { c.beginPath(); c.moveTo(px, py + l * sy); c.lineTo(px, py); c.lineTo(px + l * sx, py); c.stroke(); }
  });
  const tout = { outDur: 0.3, outEarly: 0.5 };
  animText(ctx, S, tx(S, 0), x + pad, top + pad * 0.75 + m.mn.h / 2, { ...no, anim: 'blur', delay: 0.35, inDur: 0.5, stagger: 0.025, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), x + pad, top + pad * 0.75 + m.mn.h + m.mr.h / 2 + 4 * u, { ...ro, anim: 'fade', delay: 0.6, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltBands(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 900, size: 52, upper: true, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 700, size: 28, color: col(S, 3), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 26 * u, sk = 0.35, mh = m.mn.h + pad * 0.7, sh = m.mr.h + pad * 0.5, th = 8 * u;
  const yS = yb - sh / 2, yM = yS - sh / 2 - 8 * u - mh / 2, yT = yM - mh / 2 - 12 * u - th / 2;
  const away = ease.inCubic(clamp((S.t - (S.d - 0.55)) / 0.5)) * S.W * 0.9;
  const band = (yc, hh, x0, x1, colr) => (c) => {
    if (x1 - x0 < 1) return;
    const s = sk * hh / 2;
    c.fillStyle = colr;
    c.beginPath(); c.moveTo(x0 + s + away, yc - hh / 2); c.lineTo(x1 + s + away, yc - hh / 2); c.lineTo(x1 - s + away, yc + hh / 2); c.lineTo(x0 - s + away, yc + hh / 2); c.closePath(); c.fill();
  };
  const mr = x + m.mn.w + pad * 2, sr = x + m.mr.w + pad * 2, tr = x + Math.max(m.mn.w, m.mr.w) * 0.6 + pad;
  const L = x - 40 * u;
  piece(ctx, { x, y: yT - th / 2, w: tr - x, h: th }, band(yT, th, L, lerp(L, tr, kin(S, 0, 0.5, ease.outExpo)), col(S, 2)));
  piece(ctx, { x, y: yM - mh / 2, w: mr - x, h: mh }, band(yM, mh, L, lerp(L, mr, kin(S, 0.08, 0.5, ease.outExpo)), col(S, 1)));
  piece(ctx, { x, y: yS - sh / 2, w: sr - x, h: sh }, band(yS, sh, L, lerp(L, sr, kin(S, 0.25, 0.5, ease.outExpo)), col(S, 4)));
  const tout = { outDur: 0.3, outEarly: 0.2 };
  animText(ctx, S, tx(S, 0), x + pad * 0.6, yM, { ...no, anim: 'left', delay: 0.3, inDur: 0.45, ease: 'outExpo', maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), x + pad * 0.6, yS, { ...ro, anim: 'fade', delay: 0.55, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltAgenda(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 46, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 28, color: col(S, 2), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 22 * u, r = 34 * u, hh = Math.max(r * 2 + pad, m.mn.h + m.mr.h + pad * 1.4), w = r * 2 + pad * 3 + m.w, top = yb - hh;
  const out = ltLeave(S);
  growRect(ctx, x, top, w, hh, kin(S, 0, 0.45, ease.outExpo) * out, 'l', col(S, 3), 16 * u);
  const cx = x + pad + r, cy = top + hh / 2;
  piece(ctx, { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, (c) => {
    const k = ease.outBack(clamp((S.t - 0.25) / 0.4)) * out;
    if (k <= 0) return;
    c.fillStyle = col(S, 1); c.beginPath(); c.arc(cx, cy, r * k, 0, Math.PI * 2); c.fill();
    if (k > 0.6) drawText(c, S, initialsOf(tx(S, 0)), cx, cy + u, { font: 'Montserrat', fontFixed: true, weight: 800, size: 28, color: col(S, 3), align: 'center', ...still(Math.min(1, (k - 0.6) * 2.5)) });
  });
  const tx0 = cx + r + pad, tout = { outDur: 0.3, outEarly: 0.45 };
  animText(ctx, S, tx(S, 0), tx0, cy - m.mr.h / 2, { ...no, anim: 'up', delay: 0.35, inDur: 0.45, stagger: 0.012, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), tx0, cy + m.mn.h / 2 - 2 * u, { ...ro, anim: 'fade', delay: 0.55, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltChart(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 48, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 28, color: col(S, 3), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 24 * u, icon = 56 * u, hh = m.mn.h + m.mr.h + pad * 1.6, w = icon + pad * 3 + m.w, top = yb - hh;
  const out = ltLeave(S);
  growRect(ctx, x, top, w, hh, kin(S, 0, 0.45, ease.outExpo) * out, 'l', rgba(col(S, 4), 0.94), 10 * u);
  const ix = x + pad, ib = top + hh / 2 + icon / 2;
  piece(ctx, { x: ix, y: ib - icon, w: icon, h: icon }, (c) => {
    c.fillStyle = col(S, 1);
    [0.45, 0.7, 1].forEach((f, i) => {
      const k = kin(S, 0.25 + i * 0.1, 0.4) * out;
      if (k <= 0) return;
      const bw = icon * 0.24, bh = icon * f * k;
      c.globalAlpha = 0.55 + i * 0.22;
      c.fillRect(ix + i * icon * 0.38, ib - bh, bw, bh);
    });
  });
  const tx0 = ix + icon + pad, ty = top + pad * 0.8 + m.mn.h / 2, tout = { outDur: 0.3, outEarly: 0.45 };
  animText(ctx, S, tx(S, 0), tx0, ty, { ...no, anim: 'up', delay: 0.35, inDur: 0.45, stagger: 0.012, maxWidth: m.cap, ...tout });
  line(ctx, tx0, ty + m.mn.h / 2 + 2 * u, tx0 + 60 * u, ty + m.mn.h / 2 + 2 * u, kin(S, 0.6, 0.4) * out, col(S, 2), 4 * u);
  animText(ctx, S, tx(S, 1), tx0, ty + m.mn.h / 2 + 12 * u + m.mr.h / 2, { ...ro, anim: 'fade', delay: 0.6, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltNumber(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 48, color: col(S, 0), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 28, color: col(S, 3), align: 'left' };
  const m = ltText(ctx, S, no, ro, 1, 2);
  const pad = 24 * u, hh = m.mn.h + m.mr.h + pad * 1.5, tag = hh, w = m.w + pad * 2, top = yb - hh;
  const out = ltLeave(S);
  const kt = ease.outBack(clamp(S.t / 0.4)) * out;
  piece(ctx, { x, y: top, w: tag, h: tag }, (c) => {
    if (kt <= 0) return;
    const cx = x + tag / 2, cy = top + tag / 2;
    c.translate(cx, cy); c.scale(kt, kt); c.translate(-cx, -cy);
    c.fillStyle = col(S, 1); c.fillRect(x, top, tag, tag);
    drawText(c, S, tx(S, 0), cx, cy + 2 * u, { font: 'Montserrat', fontFixed: true, weight: 900, size: 52, color: col(S, 2), align: 'center', maxWidth: (tag * 0.78) / S.W, ...still(1) });
  });
  growRect(ctx, x + tag, top, w, hh, kin(S, 0.2, 0.45, ease.outExpo) * out, 'l', rgba(col(S, 4), 0.95));
  const tout = { outDur: 0.3, outEarly: 0.45 };
  animText(ctx, S, tx(S, 1), x + tag + pad, top + pad * 0.75 + m.mn.h / 2, { ...no, anim: 'up', delay: 0.45, inDur: 0.45, stagger: 0.012, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 2), x + tag + pad, top + pad * 0.75 + m.mn.h + m.mr.h / 2, { ...ro, anim: 'fade', delay: 0.65, inDur: 0.4, maxWidth: m.cap, ...tout });
}

function ltMonogram(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 46, color: col(S, 2), align: 'left' };
  const ro = { font: 'Inter', fontFixed: true, weight: 400, size: 28, color: col(S, 3), align: 'left' };
  const m = ltText(ctx, S, no, ro, 1, 2);
  const pad = 22 * u, bs = m.mn.h + m.mr.h + pad * 1.4, top = yb - bs;
  const out = ltLeave(S);
  const kb = ease.outBack(clamp(S.t / 0.45)) * out;
  const ks = kin(S, 0.4, 0.5, ease.inOutCubic) * ltLeave(S, 0.8);
  const pw = m.w + pad * 2;
  const reveal = (draw) => (c) => { c.beginPath(); c.rect(x + bs * 0.5, 0, S.W, S.H); c.clip(); c.translate(-(1 - ks) * (pw + bs * 0.5), 0); draw(c); };
  piece(ctx, { x: x + bs * 0.5, y: top, w: pw + bs * 0.5, h: bs }, reveal((c) => { c.fillStyle = col(S, 4); roundRect(c, x + bs * 0.5, top, pw + bs * 0.5, bs, 10 * u); c.fill(); }));
  piece(ctx, { x: x + bs + pad, y: top, w: m.w, h: bs }, reveal((c) => {
    drawText(c, S, tx(S, 1), x + bs + pad, top + pad * 0.7 + m.mn.h / 2, { ...no, maxWidth: m.cap, ...still(1) });
    drawText(c, S, tx(S, 2), x + bs + pad, top + pad * 0.7 + m.mn.h + m.mr.h / 2, { ...ro, maxWidth: m.cap, ...still(1) });
  }));
  piece(ctx, { x, y: top, w: bs, h: bs }, (c) => {
    if (kb <= 0) return;
    const cx = x + bs / 2, cy = top + bs / 2;
    c.translate(cx, cy); c.rotate((1 - Math.min(1, kb)) * -Math.PI / 2); c.scale(kb, kb); c.translate(-cx, -cy);
    c.fillStyle = col(S, 0); roundRect(c, x, top, bs, bs, bs * 0.26); c.fill();
    drawText(c, S, tx(S, 0), cx, cy + 2 * u, { font: 'Montserrat', fontFixed: true, weight: 800, size: bs / u * 0.4, color: col(S, 1), align: 'center', upper: true, maxWidth: (bs * 0.78) / S.W, ...still(1) });
  });
}

function ltShutter(ctx, S) {
  const { u, x, yb } = ltPos(S);
  const no = { font: 'Montserrat', weight: 800, size: 50, color: col(S, 0), align: 'left' };
  const ro = { font: 'Montserrat', fontFixed: true, weight: 400, size: 22, spacing: 0.28, upper: true, color: col(S, 0), align: 'left' };
  const m = ltText(ctx, S, no, ro);
  const pad = 26 * u, w = m.w + pad * 2, hh = m.mn.h + m.mr.h + pad * 1.5, top = yb - hh, mid = top + hh / 2;
  const kw = kin(S, 0, 0.35, ease.outExpo), open = kin(S, 0.3, 0.5, ease.inOutCubic) * ltLeave(S, 0.55);
  const bar = 6 * u, gh = (hh / 2) * open;
  piece(ctx, { x, y: top - bar, w, h: hh + bar * 2 }, (c) => {
    if (kw <= 0) return;
    const bw = w * kw * (S.t > S.d - 0.25 ? 1 - clamp((S.t - (S.d - 0.25)) / 0.25) : 1);
    if (open > 0) { c.fillStyle = col(S, 4); c.fillRect(x, mid - gh, bw, gh * 2); }
    c.fillStyle = col(S, 1); c.fillRect(x, mid - gh - bar, bw, bar);
    c.fillStyle = col(S, 3); c.fillRect(x, mid + gh, bw, bar);
  });
  const tout = { outDur: 0.25, outEarly: 0.55 };
  animText(ctx, S, tx(S, 0), x + pad, top + pad * 0.75 + m.mn.h / 2, { ...no, anim: 'up', delay: 0.6, inDur: 0.4, stagger: 0.012, maxWidth: m.cap, ...tout });
  animText(ctx, S, tx(S, 1), x + pad, top + pad * 0.75 + m.mn.h + m.mr.h / 2, { ...ro, anim: 'fade', delay: 0.75, inDur: 0.4, maxWidth: m.cap, ...tout });
}

def('Professional', 'lt-pro-block', 'Block Reveal Lower Third', { texts: ['Alex Morgan', 'Head of Training'], font: 'Montserrat', colors: ['#1b1f24', '#e4572e', '#1f6f5c', '#5a5f66', '#f3efe6'] }, ltBlock);
def('Professional', 'lt-pro-lesson', 'Lesson Lower Third', { texts: ['Jordan Lee', 'Spreadsheet instructor'], font: 'Montserrat', colors: ['#ffffff', '#ffb703', '#a9bcd8', '#0f1e36'] }, ltLesson);
def('Professional', 'lt-pro-panel', 'Side Panel Lower Third', { texts: ['Sam Rivera', 'Chief Financial Officer'], font: 'Montserrat', colors: ['#ffffff', '#2154e8', '#16202c', '#ff8a3d', '#ffffff'] }, ltPanel);
def('Professional', 'lt-pro-frame', 'Line Frame Lower Third', { texts: ['Taylor Brooks', 'Product designer'], font: 'Montserrat', colors: ['#ffffff', '#1fd1b9', '#ffffff', '#15181d'] }, ltFrame);
def('Professional', 'lt-pro-bands', 'Bold Bands Lower Third', { texts: ['Casey Park', 'Market analyst'], font: 'Montserrat', colors: ['#ffffff', '#2f6bff', '#1fd1b9', '#0e1116', '#ffffff'] }, ltBands);
def('Professional', 'lt-pro-agenda', 'Agenda Lower Third', { texts: ['Riley Chen', 'Your instructor today'], font: 'Montserrat', colors: ['#151826', '#4f46e5', '#6b7080', '#ffffff'] }, ltAgenda);
def('Professional', 'lt-pro-chart', 'Chart Lower Third', { texts: ['Morgan Diaz', 'Head of Sales'], font: 'Montserrat', colors: ['#ffffff', '#34d399', '#fbbf24', '#9ca3af', '#111827'] }, ltChart);
def('Professional', 'lt-pro-number', 'Chapter Lower Third', { texts: ['02', 'Working with formulas', 'Chapter Two'], font: 'Montserrat', colors: ['#ffffff', '#f97316', '#ffffff', '#a1a1aa', '#18181b'] }, ltNumber);
def('Professional', 'lt-pro-monogram', 'Monogram Lower Third', { texts: ['YC', 'Alex Morgan', 'Head of Design'], brandTexts: { 0: 'initials' }, font: 'Montserrat', colors: ['#7c3aed', '#ffffff', '#111827', '#6b7280', '#ffffff'] }, ltMonogram);
def('Professional', 'lt-pro-shutter', 'Shutter Lower Third', { texts: ['Jamie Fox', 'Event host'], font: 'Montserrat', colors: ['#1f2933', '#1f2933', '#3e4c59', '#e11d48', '#fdf6e3'] }, ltShutter);


// The titles the Sequences are built from; they are found by id but are not listed in the Titles tab.
TT.push(...SEQ_TITLES);
export const TITLES = TT;
export const TITLE_CATS = [...new Set(TT.filter((t) => !t.seq).map((t) => t.cat))];
export const titleById = (id) => TT.find((t) => t.id === id);
