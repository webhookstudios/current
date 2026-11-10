// Stickers / animated elements and backgrounds, drawn on a full-frame 2D canvas.
import { fontStr, roundRect, inout, phase } from './textfx.js';
import { ease, clamp, hash, rgba, shade } from '../util.js';

const EL = [];
const def = (cat, id, name, o, draw) => EL.push({ id, name, cat, colors: o.colors || ['#ffffff', '#ff4d6d'], dur: o.dur || 4, emoji: o.emoji, draw });
const col = (S, i) => S.colors[i] || '#ffffff';

// ---- Emoji stickers with motion styles ----
function emojiDraw(emoji, motion) {
  return (ctx, S) => {
    const cx = S.W / 2, cy = S.H / 2;
    const base = 300 * S.u * (S.scale || 1);
    const k = inout(S, 0, 0.5, 0.35, ease.outBack);
    if (k <= 0) return;
    let s = k, r = 0, dy = 0, dx = 0;
    const t = S.t;
    if (motion === 'bounce') dy = -Math.abs(Math.sin(t * 4)) * 60 * S.u;
    if (motion === 'spin') r = t * 2;
    if (motion === 'pulse') s *= 1 + Math.sin(t * 6) * 0.08;
    if (motion === 'float') { dy = Math.sin(t * 2) * 30 * S.u; r = Math.sin(t * 1.5) * 0.1; }
    if (motion === 'shake') { dx = Math.sin(t * 40) * 8 * S.u; r = Math.sin(t * 30) * 0.08; }
    if (motion === 'wobble') r = Math.sin(t * 5) * 0.25;
    ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(r); ctx.scale(s, s);
    ctx.font = fontStr('Noto Color Emoji', 400, base); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(S.params?.emoji || emoji, 0, base * 0.05);
    ctx.restore();
  };
}
const EMO = [
  ['Faces', [['😂', 'Laughing', 'shake'], ['😍', 'Heart Eyes', 'pulse'], ['😎', 'Cool', 'float'], ['🤯', 'Mind Blown', 'shake'], ['😱', 'Shocked', 'shake'], ['🥳', 'Party', 'bounce'], ['🤔', 'Thinking', 'wobble'], ['😭', 'Crying', 'shake'], ['🙄', 'Eye Roll', 'float'], ['😴', 'Sleepy', 'float'], ['🤩', 'Star Struck', 'pulse'], ['😡', 'Angry', 'shake'], ['👀', 'Eyes', 'wobble'], ['💀', 'Skull', 'bounce']]],
  ['Gestures', [['👍', 'Thumbs Up', 'bounce'], ['👏', 'Clap', 'shake'], ['🙌', 'Raised Hands', 'bounce'], ['👉', 'Point Right', 'wobble'], ['👇', 'Point Down', 'bounce'], ['✌️', 'Peace', 'wobble'], ['🤞', 'Fingers Crossed', 'pulse'], ['💪', 'Strong', 'pulse'], ['👋', 'Wave', 'wobble']]],
  ['Symbols', [['❤️', 'Heart', 'pulse'], ['🔥', 'Fire', 'wobble'], ['⭐', 'Star', 'spin'], ['✨', 'Sparkles', 'pulse'], ['💯', 'Hundred', 'bounce'], ['✅', 'Check', 'pulse'], ['❌', 'Cross', 'shake'], ['⚡', 'Lightning', 'shake'], ['💥', 'Boom', 'pulse'], ['❓', 'Question', 'wobble'], ['❗', 'Exclamation', 'shake'], ['🎉', 'Party Popper', 'bounce'], ['🏆', 'Trophy', 'float'], ['💡', 'Idea', 'pulse'], ['🎵', 'Music Note', 'float'], ['💰', 'Money', 'bounce'], ['🚀', 'Rocket', 'float'], ['📍', 'Pin', 'bounce'], ['🎬', 'Clapper', 'wobble'], ['📸', 'Camera', 'pulse'], ['🌟', 'Glowing Star', 'spin'], ['🍿', 'Popcorn', 'bounce']]],
];
EMO.forEach(([cat, list]) => list.forEach(([e, name, m]) => def(`Emoji · ${cat}`, `emo-${name.toLowerCase().replace(/\W+/g, '-')}`, name, { emoji: e }, emojiDraw(e, m))));

// ---- Shapes & annotations ----
def('Annotate', 'el-arrow', 'Drawn Arrow', { colors: ['#ffd60a'] }, (ctx, S) => {
  const k = inout(S, 0, 0.7, 0.4, ease.inOutCubic);
  const x0 = S.W * 0.35, y0 = S.H * 0.6, x1 = S.W * 0.62, y1 = S.H * 0.42;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 14 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); ctx.stroke();
  if (k > 0.98) { const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1 - Math.cos(a - 0.5) * 60 * S.u, y1 - Math.sin(a - 0.5) * 60 * S.u); ctx.lineTo(x1, y1); ctx.lineTo(x1 - Math.cos(a + 0.5) * 60 * S.u, y1 - Math.sin(a + 0.5) * 60 * S.u); ctx.stroke(); }
});
def('Annotate', 'el-circle', 'Scribble Circle', { colors: ['#ff4d6d'] }, (ctx, S) => {
  const k = inout(S, 0, 0.9, 0.4, ease.inOutCubic);
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 10 * S.u; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 90 * k; i++) { const a = (i / 90) * Math.PI * 2.2 - 1; const r = 1 + Math.sin(a * 2.3) * 0.05; const x = S.W / 2 + Math.cos(a) * 260 * S.u * r, y = S.H / 2 + Math.sin(a) * 170 * S.u * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
});
def('Annotate', 'el-underline', 'Underline Swoosh', { colors: ['#ffd60a'] }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.4, ease.inOutCubic);
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 16 * S.u; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 40 * k; i++) { const t = i / 40; const x = S.W * (0.3 + t * 0.4), y = S.H * 0.62 + Math.sin(t * Math.PI) * 20 * S.u - t * 20 * S.u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
});
def('Annotate', 'el-check', 'Check Mark', { colors: ['#2dc653'] }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.4, ease.outCubic);
  const cx = S.W / 2, cy = S.H / 2, R = 160 * S.u;
  ctx.fillStyle = col(S, 0); ctx.beginPath(); ctx.arc(cx, cy, R * ease.outBack(clamp(k * 1.5)), 0, 7); ctx.fill();
  const k2 = clamp(k * 2 - 0.8);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 26 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const p = [[cx - 70 * S.u, cy], [cx - 15 * S.u, cy + 55 * S.u], [cx + 75 * S.u, cy - 55 * S.u]];
  ctx.moveTo(...p[0]);
  if (k2 < 0.4) ctx.lineTo(p[0][0] + (p[1][0] - p[0][0]) * k2 / 0.4, p[0][1] + (p[1][1] - p[0][1]) * k2 / 0.4);
  else { ctx.lineTo(...p[1]); const t = (k2 - 0.4) / 0.6; ctx.lineTo(p[1][0] + (p[2][0] - p[1][0]) * t, p[1][1] + (p[2][1] - p[1][1]) * t); }
  if (k2 > 0) ctx.stroke();
});
def('Annotate', 'el-cross', 'Wrong X', { colors: ['#e63946'] }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.4, ease.outCubic);
  const cx = S.W / 2, cy = S.H / 2, L = 140 * S.u;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 34 * S.u; ctx.lineCap = 'round';
  const a = clamp(k * 2), b = clamp(k * 2 - 1);
  ctx.beginPath(); ctx.moveTo(cx - L, cy - L); ctx.lineTo(cx - L + 2 * L * a, cy - L + 2 * L * a); ctx.stroke();
  if (b > 0) { ctx.beginPath(); ctx.moveTo(cx + L, cy - L); ctx.lineTo(cx + L - 2 * L * b, cy - L + 2 * L * b); ctx.stroke(); }
});
def('Annotate', 'el-click', 'Mouse Click', { colors: ['#ffffff', '#4cc9f0'] }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2, t = S.t % 1.5;
  const rip = clamp((t - 0.3) / 0.6);
  if (rip > 0 && rip < 1) { ctx.strokeStyle = rgba(col(S, 1), 1 - rip); ctx.lineWidth = 6 * S.u; ctx.beginPath(); ctx.arc(cx, cy, 20 * S.u + rip * 90 * S.u, 0, 7); ctx.stroke(); }
  const press = t > 0.25 && t < 0.4 ? 0.85 : 1;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(press * 1.6 * S.u, press * 1.6 * S.u);
  ctx.fillStyle = col(S, 0); ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.lineTo(16, 46); ctx.lineTo(28, 70); ctx.lineTo(38, 65); ctx.lineTo(26, 42); ctx.lineTo(46, 42); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
});
def('Annotate', 'el-highlight-box', 'Highlight Box', { colors: ['#ffd60a'] }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.4, ease.outCubic);
  const w = S.W * 0.4, h = S.H * 0.3, x = (S.W - w) / 2, y = (S.H - h) / 2;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 8 * S.u; ctx.setLineDash([Math.max(1, (w + h) * 2 * k), 1e5]);
  roundRect(ctx, x, y, w, h, 16 * S.u); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = rgba(col(S, 0), 0.12 * k); ctx.fill();
});
def('Annotate', 'el-progress', 'Progress Bar', { colors: ['#ff4d6d', '#ffffff'] }, (ctx, S) => {
  const h = 14 * S.u;
  ctx.fillStyle = rgba(col(S, 1), 0.25); ctx.fillRect(0, S.H - h, S.W, h);
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, S.H - h, S.W * clamp(S.t / S.d), h);
});

// ---- Particles & overlays ----
def('Overlays', 'el-confetti', 'Confetti', { colors: ['#ff4d6d', '#ffd60a'], dur: 4 }, (ctx, S) => {
  const pal = [col(S, 0), col(S, 1), '#4cc9f0', '#2dc653', '#b5179e', '#ffffff'];
  for (let i = 0; i < 160; i++) {
    const x0 = hash(i) * S.W, sp = 0.35 + hash(i + 1) * 0.5, delay = hash(i + 2) * 1.2;
    const t = S.t - delay; if (t < 0) continue;
    const y = -40 * S.u + t * sp * S.H * 0.7; if (y > S.H + 40) continue;
    const x = x0 + Math.sin(t * 3 + i) * 40 * S.u;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5 + i); ctx.scale(1, Math.sin(t * 8 + i));
    ctx.fillStyle = pal[i % pal.length]; ctx.fillRect(-8 * S.u, -5 * S.u, 16 * S.u, 10 * S.u); ctx.restore();
  }
});
def('Overlays', 'el-hearts', 'Floating Hearts', { colors: ['#ff4d6d'], dur: 5 }, (ctx, S) => {
  ctx.font = fontStr('Noto Color Emoji', 400, 60 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 26; i++) {
    const delay = hash(i) * 3, t = S.t - delay; if (t < 0) continue;
    const y = S.H + 40 * S.u - t * S.H * 0.35, x = S.W * (0.6 + hash(i + 4) * 0.35) + Math.sin(t * 2 + i) * 40 * S.u;
    ctx.globalAlpha = clamp(1 - t / 3.5) * phase(S, 0.1, 0.4).vis; ctx.save(); ctx.translate(x, y); const s = 0.6 + hash(i + 9) * 0.8; ctx.scale(s, s);
    ctx.fillText(['❤️', '💖', '💕', '💗'][i % 4], 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;
});
def('Overlays', 'el-sparkle-burst', 'Sparkle Burst', { colors: ['#ffd60a', '#ffffff'], dur: 3 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + hash(i) * 0.3, t = clamp(S.t / 1.4), r = ease.outCubic(t) * (200 + hash(i + 3) * 300) * S.u;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = (1 - t) * (10 + hash(i) * 14) * S.u;
    if (s <= 0) continue;
    ctx.fillStyle = i % 2 ? col(S, 0) : col(S, 1); ctx.beginPath();
    for (let j = 0; j < 8; j++) { const aa = (j / 8) * Math.PI * 2; const rr = j % 2 ? s * 0.35 : s * 1.4; ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
    ctx.closePath(); ctx.fill();
  }
});
def('Overlays', 'el-speed-lines', 'Speed Lines', { colors: ['#ffffff'], dur: 3 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = Math.hypot(S.W, S.H) / 2;
  ctx.fillStyle = col(S, 0); const a0 = phase(S, 0.2, 0.3).vis;
  for (let i = 0; i < 90; i++) {
    const f = Math.floor(S.t * 15);
    if (hash(i * 3 + f) < 0.35) continue;
    const a = (i / 90) * Math.PI * 2 + hash(i + f) * 0.05, w = 0.008 + hash(i + 2 * f) * 0.012, r0 = R * (0.45 + hash(i + f * 7) * 0.25);
    ctx.globalAlpha = a0 * 0.85; ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * R * 1.1, cy + Math.sin(a - w) * R * 1.1); ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a + w) * R * 1.1, cy + Math.sin(a + w) * R * 1.1); ctx.fill();
  }
  ctx.globalAlpha = 1;
});
def('Overlays', 'el-bubbles', 'Bubbles', { colors: ['#bde0fe'], dur: 6 }, (ctx, S) => {
  for (let i = 0; i < 40; i++) {
    const t = (S.t * (0.1 + hash(i) * 0.15) + hash(i + 1)) % 1;
    const x = hash(i + 2) * S.W + Math.sin(S.t * 2 + i) * 20 * S.u, y = S.H * (1.1 - t * 1.2), r = (10 + hash(i + 3) * 40) * S.u;
    ctx.strokeStyle = rgba(col(S, 0), 0.7); ctx.lineWidth = 3 * S.u; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, 7); ctx.fill();
  }
});
def('Overlays', 'el-dust', 'Floating Dust', { colors: ['#fff3d6'], dur: 6 }, (ctx, S) => {
  for (let i = 0; i < 120; i++) {
    const x = (hash(i) * S.W + S.t * (10 + hash(i + 1) * 30) * S.u) % S.W, y = (hash(i + 2) * S.H + Math.sin(S.t * 0.7 + i) * 30 * S.u);
    const r = (1 + hash(i + 3) * 4) * S.u, tw = 0.4 + 0.6 * Math.abs(Math.sin(S.t * (0.5 + hash(i)) + i));
    ctx.fillStyle = rgba(col(S, 0), 0.7 * tw); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
});

// ---- Frames ----
def('Frames', 'el-frame-film', 'Film Strip', { colors: ['#111111', '#ffffff'] }, (ctx, S) => {
  const b = 70 * S.u; ctx.fillStyle = col(S, 0);
  ctx.fillRect(0, 0, S.W, b); ctx.fillRect(0, S.H - b, S.W, b);
  ctx.fillStyle = col(S, 1); const off = (S.t * 120 * S.u) % (60 * S.u);
  for (let x = -60 * S.u + off; x < S.W; x += 60 * S.u) { roundRect(ctx, x, b * 0.3, 32 * S.u, b * 0.4, 5 * S.u); ctx.fill(); roundRect(ctx, x, S.H - b * 0.7, 32 * S.u, b * 0.4, 5 * S.u); ctx.fill(); }
});
def('Frames', 'el-frame-polaroid', 'Instant Photo', { colors: ['#fbfbf8', '#333333'] }, (ctx, S) => {
  const m = Math.min(S.W, S.H) * 0.06;
  ctx.fillStyle = col(S, 0); ctx.beginPath(); ctx.rect(0, 0, S.W, S.H);
  ctx.rect(m + S.W * 0.12, m, S.W - 2 * m - S.W * 0.24, S.H - m * 4); ctx.fill('evenodd');
  ctx.fillStyle = col(S, 1); ctx.font = fontStr('Caveat', 700, 60 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(S.params?.caption || 'good times ♥', S.W / 2, S.H - m * 1.5);
});
def('Frames', 'el-frame-rounded', 'Rounded Border', { colors: ['#ffffff'] }, (ctx, S) => {
  const m = 40 * S.u; ctx.fillStyle = col(S, 0); ctx.beginPath(); ctx.rect(0, 0, S.W, S.H); ctx.roundRect(m, m, S.W - 2 * m, S.H - 2 * m, 50 * S.u); ctx.fill('evenodd');
});
def('Frames', 'el-frame-viewfinder', 'Viewfinder', { colors: ['#ffffff'] }, (ctx, S) => {
  const m = 60 * S.u, L = 90 * S.u; ctx.strokeStyle = col(S, 0); ctx.lineWidth = 5 * S.u;
  [[m, m, 1, 1], [S.W - m, m, -1, 1], [m, S.H - m, 1, -1], [S.W - m, S.H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + L * sy); ctx.lineTo(x, y); ctx.lineTo(x + L * sx, y); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(S.W / 2 - 30 * S.u, S.H / 2); ctx.lineTo(S.W / 2 + 30 * S.u, S.H / 2); ctx.moveTo(S.W / 2, S.H / 2 - 30 * S.u); ctx.lineTo(S.W / 2, S.H / 2 + 30 * S.u); ctx.stroke();
});
def('Frames', 'el-frame-bars', 'Cinema Bars', { colors: ['#000000'] }, (ctx, S) => {
  const k = inout(S, 0, 0.8, 0.8, ease.inOutCubic); const h = S.H * 0.12 * k; ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, h); ctx.fillRect(0, S.H - h, S.W, h);
});
def('Frames', 'el-frame-vignette', 'Soft Vignette', { colors: ['#000000'] }, (ctx, S) => {
  const g = ctx.createRadialGradient(S.W / 2, S.H / 2, Math.min(S.W, S.H) * 0.3, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * 0.55);
  g.addColorStop(0, rgba(col(S, 0), 0)); g.addColorStop(1, rgba(col(S, 0), 0.85)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
});

def('Annotate', 'el-arrow-bounce', 'Bouncing Arrow', { colors: ['#ffffff', '#ff4d6d'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.4, 0.3, ease.outBack); if (k <= 0) return;
  const y = S.H / 2 + Math.abs(Math.sin(S.t * 4)) * -40 * S.u, s = 110 * S.u * k;
  ctx.save(); ctx.translate(S.W / 2, y); ctx.fillStyle = col(S, 1); ctx.strokeStyle = col(S, 0); ctx.lineWidth = 8 * S.u; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.35, -s); ctx.lineTo(s * 0.35, -s); ctx.lineTo(s * 0.35, 0); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0); ctx.lineTo(-s * 0.35, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
});
def('Annotate', 'el-loading', 'Loading Dots', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const vis = phase(S, 0.3, 0.3).vis;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, on = ((Math.floor(S.t * 10) - i) % 8 + 8) % 8; ctx.fillStyle = rgba(col(S, 0), vis * (1 - on / 8)); ctx.beginPath(); ctx.arc(S.W / 2 + Math.cos(a) * 60 * S.u, S.H / 2 + Math.sin(a) * 60 * S.u, 12 * S.u, 0, 7); ctx.fill(); }
});
def('Overlays', 'el-like-count', 'Likes Counter', { colors: ['#ffffff', '#ff4d6d'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.4, ease.outBack); if (k <= 0) return;
  const n = Math.floor(Math.min(1, S.t / 2) ** 2 * (S.params?.count || 9999));
  ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, -220 * S.u, -70 * S.u, 440 * S.u, 140 * S.u, 70 * S.u); ctx.fill();
  const beat = 1 + Math.max(0, Math.sin(S.t * 8)) * 0.12; ctx.save(); ctx.translate(-130 * S.u, 0); ctx.scale(beat, beat);
  ctx.font = fontStr('Noto Color Emoji', 400, 70 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❤️', 0, 4 * S.u); ctx.restore();
  ctx.fillStyle = col(S, 0); ctx.font = fontStr('Poppins', 800, 70 * S.u); ctx.textAlign = 'left'; ctx.fillText(n.toLocaleString(), -60 * S.u, 6 * S.u); ctx.restore();
});
def('Shapes', 'el-badge-burst', 'Starburst Badge', { colors: ['#ffd60a', '#111111'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.4, ease.outBack); if (k <= 0) return;
  const R = 150 * S.u; ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k); ctx.rotate(S.t * 0.4);
  ctx.fillStyle = col(S, 0); ctx.beginPath(); for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, r = i % 2 ? R * 0.82 : R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.rotate(-S.t * 0.4); ctx.fillStyle = col(S, 1); ctx.font = fontStr('Anton', 400, 70 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.params?.label || 'NEW!', 0, 4 * S.u); ctx.restore();
});

// ---- More annotations ----
def('Annotate', 'el-highlighter', 'Highlighter Swipe', { colors: ['#ffe600'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.4, ease.outCubic); if (k <= 0) return;
  ctx.fillStyle = rgba(col(S, 0), 0.45); ctx.save(); ctx.translate(S.W * 0.3, S.H * 0.5); ctx.rotate(-0.02);
  roundRect(ctx, 0, -32 * S.u, S.W * 0.4 * k, 64 * S.u, 10 * S.u); ctx.fill(); ctx.restore();
});
def('Annotate', 'el-strike', 'Scribble Strike', { colors: ['#ff4d6d'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.4, ease.inOutCubic); if (k <= 0) return;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 9 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const n = 6;
  for (let i = 0; i <= 60 * k; i++) { const t = i / 60, seg = t * n, x = S.W * (0.32 + 0.36 * t), y = S.H * 0.5 + (Math.floor(seg) % 2 ? -1 : 1) * (seg % 1 - 0.5) * 24 * S.u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
});
def('Annotate', 'el-brace', 'Curly Bracket', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.4, ease.outCubic); if (k <= 0) return;
  const x = S.W / 2, h0 = S.H * 0.32 * k, w = 40 * S.u, cy = S.H / 2;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 8 * S.u; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(x + w, cy - h0); ctx.quadraticCurveTo(x, cy - h0, x, cy - h0 * 0.6); ctx.lineTo(x, cy - w * 0.4); ctx.quadraticCurveTo(x, cy, x - w, cy);
  ctx.quadraticCurveTo(x, cy, x, cy + w * 0.4); ctx.lineTo(x, cy + h0 * 0.6); ctx.quadraticCurveTo(x, cy + h0, x + w, cy + h0); ctx.stroke();
});
def('Annotate', 'el-stars-rating', 'Star Rating', { colors: ['#ffd60a', '#555555'], dur: 4 }, (ctx, S) => {
  const n = Math.max(0, Math.min(5, S.params?.rating ?? 5)), r = 46 * S.u;
  for (let i = 0; i < 5; i++) {
    const k = ease.outBack(clamp((S.t - i * 0.15) / 0.4)) * (1 - ease.inCubic(clamp((S.t - (S.d - 0.35)) / 0.35))); if (k <= 0) continue;
    const cx = S.W / 2 + (i - 2) * r * 2.3, cy = S.H / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.fillStyle = i < n ? col(S, 0) : col(S, 1); ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
});
def('Annotate', 'el-question', 'Question Bubble', { colors: ['#3a86ff', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.35, ease.outBack); if (k <= 0) return;
  const R = 80 * S.u, p = 1 + Math.sin(S.t * 4) * 0.05;
  ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.scale(k * p, k * p);
  ctx.fillStyle = col(S, 0); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-R * 0.35, R * 0.8); ctx.lineTo(-R * 0.6, R * 1.35); ctx.lineTo(R * 0.05, R * 0.95); ctx.fill();
  ctx.fillStyle = col(S, 1); ctx.font = fontStr('Poppins', 900, R * 1.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.params?.label || '?', 0, R * 0.08); ctx.restore();
});
def('Annotate', 'el-magnifier', 'Magnifier', { colors: ['#ffffff', '#111111'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.35, ease.outBack); if (k <= 0) return;
  const R = 90 * S.u, bob = Math.sin(S.t * 2.5) * 12 * S.u;
  ctx.save(); ctx.translate(S.W / 2 + bob, S.H / 2 - bob * 0.5); ctx.scale(k, k);
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 34 * S.u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(R * 0.75, R * 0.75); ctx.lineTo(R * 1.6, R * 1.6); ctx.stroke();
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 16 * S.u; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6 * S.u; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke(); ctx.restore();
});
def('Annotate', 'el-number-badge', 'Number Badge', { colors: ['#ff4d6d', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.45, 0.35, ease.outBack); if (k <= 0) return;
  const R = 60 * S.u, ring = clamp((S.t - 0.3) / 0.8);
  ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k);
  ctx.fillStyle = col(S, 0); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  if (ring < 1) { ctx.strokeStyle = rgba(col(S, 0), 1 - ring); ctx.lineWidth = 6 * S.u; ctx.beginPath(); ctx.arc(0, 0, R * (1 + ring * 0.8), 0, 7); ctx.stroke(); }
  ctx.fillStyle = col(S, 1); ctx.font = fontStr('Poppins', 900, R * 1.1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(S.params?.label ?? '1'), 0, R * 0.08); ctx.restore();
});
def('Annotate', 'el-spot-focus', 'Focus Spotlight', { colors: ['#000000'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.7, 0.5, ease.inOutCubic); if (k <= 0) return;
  const R = Math.min(S.W, S.H) * (0.9 - 0.68 * k);
  ctx.fillStyle = rgba(col(S, 0), 0.7 * k); ctx.beginPath(); ctx.rect(0, 0, S.W, S.H); ctx.arc(S.W / 2, S.H / 2, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
});
def('Annotate', 'el-zigzag', 'Zigzag Underline', { colors: ['#1fd1b9'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.4, ease.inOutCubic); if (k <= 0) return;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 10 * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  const n = 12, w = S.W * 0.36;
  for (let i = 0; i <= n * k; i++) { const x = S.W * 0.32 + (i / n) * w, y = S.H * 0.55 + (i % 2 ? -16 : 16) * S.u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
});
def('Annotate', 'el-tooltip', 'Tooltip Label', { colors: ['#111111', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.45, 0.35, ease.outBack); if (k <= 0) return;
  const label = S.params?.label || 'Click here';
  ctx.font = fontStr('Poppins', 700, 44 * S.u); const w = ctx.measureText(label).width + 60 * S.u, hh = 84 * S.u;
  ctx.save(); ctx.translate(S.W / 2, S.H / 2 + hh); ctx.scale(k, k); ctx.translate(0, -hh);
  ctx.fillStyle = col(S, 0); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18 * S.u;
  roundRect(ctx, -w / 2, -hh / 2, w, hh, 16 * S.u); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18 * S.u, hh / 2 - 1); ctx.lineTo(0, hh / 2 + 22 * S.u); ctx.lineTo(18 * S.u, hh / 2 - 1); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = col(S, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 3 * S.u); ctx.restore();
});

// ---- Arrow pointers ----
const arrowHead = (ctx, x, y, a, size) => { ctx.beginPath(); ctx.moveTo(x - Math.cos(a - 0.5) * size, y - Math.sin(a - 0.5) * size); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(a + 0.5) * size, y - Math.sin(a + 0.5) * size); ctx.stroke(); };
def('Arrows', 'el-arrow-curved', 'Curved Pointer', { colors: ['#ffd60a', '#111111'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.8, 0.4, ease.inOutCubic); if (k <= 0) return;
  const wig = S.t > 0.8 ? Math.sin((S.t - 0.8) * 5) * 10 * S.u : 0;
  const p0 = [S.W * 0.36, S.H * 0.66], p1 = [S.W * 0.42, S.H * 0.38], p2 = [S.W * 0.6 + wig, S.H * 0.42 + wig * 0.5];
  const pt = (t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[24, col(S, 1)], [14, col(S, 0)]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w * S.u; ctx.beginPath();
    for (let i = 0; i <= 40 * k; i++) { const [x, y] = pt(i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (k > 0.95) { const [x, y] = pt(1), [xa, ya] = pt(0.95); arrowHead(ctx, x, y, Math.atan2(y - ya, x - xa), 60 * S.u); }
  }
});
def('Arrows', 'el-arrow-pulse', 'Nudging Pointer', { colors: ['#ff4d6d', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.4, 0.3, ease.outBack); if (k <= 0) return;
  const nudge = Math.max(0, Math.sin(S.t * 6)) * 30 * S.u, s = 90 * S.u;
  ctx.save(); ctx.translate(S.W / 2 + nudge, S.H / 2); ctx.scale(k, k);
  ctx.fillStyle = col(S, 0); ctx.strokeStyle = col(S, 1); ctx.lineWidth = 7 * S.u; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 1.4, -s * 0.35); ctx.lineTo(0, -s * 0.35); ctx.lineTo(0, -s * 0.8); ctx.lineTo(s, 0); ctx.lineTo(0, s * 0.8); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 1.4, s * 0.35); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16 * S.u; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke(); ctx.restore();
});
def('Arrows', 'el-arrow-sketch', 'Sketch Arrow', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.7, 0.4, ease.inOutCubic); if (k <= 0) return;
  ctx.strokeStyle = col(S, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const x0 = S.W * 0.33, x1 = S.W * 0.63, y = S.H * 0.5, jit = Math.floor(S.t * 8);
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineWidth = (8 - pass * 3) * S.u; ctx.beginPath();
    for (let i = 0; i <= 30 * k; i++) { const t = i / 30; const x = x0 + (x1 - x0) * t, yy = y + Math.sin(t * 9 + pass) * 6 * S.u + (hash(i + jit + pass * 50) - 0.5) * 4 * S.u; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }
  if (k > 0.95) { ctx.lineWidth = 8 * S.u; arrowHead(ctx, x1, y, 0, 55 * S.u); }
});
def('Arrows', 'el-arrow-spin', 'Spinning Pointer', { colors: ['#1fd1b9', '#ffffff'], dur: 4 }, (ctx, S) => {
  const a = ease.outBack(clamp(S.t / 0.8)), out = ease.inCubic(clamp((S.t - (S.d - 0.35)) / 0.35)); if (a <= 0) return;
  const bob = Math.sin(S.t * 5) * 10 * S.u, s = 80 * S.u * Math.max(0, a - out);
  ctx.save(); ctx.translate(S.W / 2 + bob, S.H / 2 - bob); ctx.rotate((1 - Math.min(1, a)) * Math.PI * 2 + Math.PI / 4);
  ctx.fillStyle = col(S, 0); ctx.strokeStyle = col(S, 1); ctx.lineWidth = 6 * S.u; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(s * 1.2, 0); ctx.lineTo(-s * 0.4, -s * 0.9); ctx.lineTo(-s * 0.05, 0); ctx.lineTo(-s * 0.4, s * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
});
def('Arrows', 'el-arrow-chevrons', 'Chevron Flow', { colors: ['#ffffff', '#1fd1b9'], dur: 4 }, (ctx, S) => {
  const vis = phase(S, 0.3, 0.3).vis; if (vis <= 0) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 16 * S.u; const g = 70 * S.u, s = 45 * S.u;
  for (let i = 0; i < 3; i++) {
    const a = 0.25 + 0.75 * Math.max(0, Math.sin(S.t * 5 - i * 0.9)), x = S.W / 2 + (i - 1) * g;
    ctx.strokeStyle = rgba(i === 2 ? col(S, 1) : col(S, 0), a * vis);
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, S.H / 2 - s); ctx.lineTo(x + s * 0.5, S.H / 2); ctx.lineTo(x - s * 0.5, S.H / 2 + s); ctx.stroke();
  }
});

// basic explainer arrows (draw on, then hold; rotate with the clip's Rotate setting)
const drawOn = (S, dur = 0.6) => inout(S, 0, dur, 0.35, ease.inOutCubic);
const strokeStyle = (ctx, S, c, w) => { ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = w * S.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
def('Arrows', 'el-arrow-straight', 'Straight Arrow', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S); if (k <= 0) return;
  const x0 = S.W * 0.34, x1 = S.W * 0.66, y = S.H / 2, xe = x0 + (x1 - x0) * k;
  strokeStyle(ctx, S, col(S, 0), 12); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xe, y); ctx.stroke();
  arrowHead(ctx, xe, y, 0, 50 * S.u * Math.min(1, k * 2));
});
def('Arrows', 'el-arrow-double', 'Double Arrow', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S); if (k <= 0) return;
  const cx = S.W / 2, half = S.W * 0.17 * k, y = S.H / 2;
  strokeStyle(ctx, S, col(S, 0), 12); ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke();
  arrowHead(ctx, cx + half, y, 0, 46 * S.u); arrowHead(ctx, cx - half, y, Math.PI, 46 * S.u);
});
def('Arrows', 'el-arrow-block', 'Block Arrow', { colors: ['#3a86ff', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.5, 0.35, ease.outBack); if (k <= 0) return;
  const L = 300 * S.u * k, T = 60 * S.u, Hd = 130 * S.u, hl = 120 * S.u, x0 = S.W / 2 - 210 * S.u, y = S.H / 2;
  ctx.fillStyle = col(S, 0); ctx.strokeStyle = col(S, 1); ctx.lineWidth = 6 * S.u; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y - T / 2); ctx.lineTo(x0 + L, y - T / 2); ctx.lineTo(x0 + L, y - Hd / 2); ctx.lineTo(x0 + L + hl, y); ctx.lineTo(x0 + L, y + Hd / 2); ctx.lineTo(x0 + L, y + T / 2); ctx.lineTo(x0, y + T / 2); ctx.closePath();
  ctx.fill(); ctx.stroke();
});
def('Arrows', 'el-arrow-elbow', 'Elbow Arrow', { colors: ['#ffd60a'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S, 0.8); if (k <= 0) return;
  const p = [[S.W * 0.38, S.H * 0.32], [S.W * 0.38, S.H * 0.62], [S.W * 0.64, S.H * 0.62]];
  const l1 = p[1][1] - p[0][1], l2 = p[2][0] - p[1][0], d = (l1 + l2) * k;
  strokeStyle(ctx, S, col(S, 0), 12); ctx.beginPath(); ctx.moveTo(...p[0]);
  let end, ang;
  if (d <= l1) { end = [p[0][0], p[0][1] + d]; ang = Math.PI / 2; } else { ctx.lineTo(...p[1]); end = [p[1][0] + (d - l1), p[1][1]]; ang = 0; }
  ctx.lineTo(...end); ctx.stroke(); arrowHead(ctx, end[0], end[1], ang, 48 * S.u);
});
def('Arrows', 'el-arrow-uturn', 'U-Turn Arrow', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S, 0.8); if (k <= 0) return;
  const r = 90 * S.u, cx = S.W / 2, cy = S.H / 2, len = 160 * S.u;
  const total = len * 2 + Math.PI * r, d = total * k;
  strokeStyle(ctx, S, col(S, 0), 12); ctx.beginPath(); ctx.moveTo(cx - len, cy - r);
  let end, ang;
  if (d <= len) { end = [cx - len + d, cy - r]; ang = 0; ctx.lineTo(...end); }
  else if (d <= len + Math.PI * r) { ctx.lineTo(cx, cy - r); const a = -Math.PI / 2 + (d - len) / r; ctx.arc(cx, cy, r, -Math.PI / 2, a); end = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; ang = a + Math.PI / 2; }
  else { ctx.lineTo(cx, cy - r); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); end = [cx - (d - len - Math.PI * r), cy + r]; ang = Math.PI; ctx.lineTo(...end); }
  ctx.stroke(); arrowHead(ctx, end[0], end[1], ang, 48 * S.u);
});
def('Arrows', 'el-arrow-circular', 'Rotate Arrow', { colors: ['#1fd1b9'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S, 0.8); if (k <= 0) return;
  const r = 110 * S.u, cx = S.W / 2, cy = S.H / 2, a0 = -Math.PI * 0.4 + S.t * 0.6, a1 = a0 + Math.PI * 1.6 * k;
  strokeStyle(ctx, S, col(S, 0), 14); ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  arrowHead(ctx, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, a1 + Math.PI / 2, 50 * S.u);
});
// fun arrows
def('Arrows', 'el-arrow-dashed', 'Marching Path', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const vis = phase(S, 0.3, 0.3).vis; if (vis <= 0) return;
  ctx.globalAlpha = vis; strokeStyle(ctx, S, col(S, 0), 10);
  const p0 = [S.W * 0.32, S.H * 0.62], c1 = [S.W * 0.45, S.H * 0.25], c2 = [S.W * 0.55, S.H * 0.8], p1 = [S.W * 0.68, S.H * 0.42];
  ctx.setLineDash([26 * S.u, 22 * S.u]); ctx.lineDashOffset = -S.t * 120 * S.u;
  ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...c1, ...c2, ...p1); ctx.stroke(); ctx.setLineDash([]);
  arrowHead(ctx, p1[0], p1[1], Math.atan2(p1[1] - c2[1], p1[0] - c2[0]), 50 * S.u); ctx.globalAlpha = 1;
});
def('Arrows', 'el-arrow-neon', 'Neon Arrow', { colors: ['#ff2bd6', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = drawOn(S, 0.5); if (k <= 0) return;
  const on = S.t < 0.6 ? (hash(Math.floor(S.t * 25)) > 0.4 ? 1 : 0.2) : (hash(Math.floor(S.t * 8)) > 0.96 ? 0.4 : 1);
  const x0 = S.W * 0.36, x1 = S.W * 0.64, y = S.H / 2;
  ctx.save(); ctx.globalAlpha = on; ctx.shadowColor = col(S, 0); ctx.shadowBlur = 30 * S.u;
  for (const [c, w] of [[col(S, 0), 18], [col(S, 1), 6]]) { strokeStyle(ctx, S, c, w); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * k, y); ctx.stroke(); if (k > 0.9) arrowHead(ctx, x1, y, 0, 60 * S.u); }
  ctx.restore();
});
def('Arrows', 'el-arrow-rainbow', 'Rainbow Arrow', { colors: ['#ffffff'], dur: 4 }, (ctx, S) => {
  const k = inout(S, 0, 0.6, 0.35, ease.outBack); if (k <= 0) return;
  const wob = Math.sin(S.t * 4) * 0.08, pal = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#2dc653', '#3a86ff', '#9d4edd'];
  ctx.save(); ctx.translate(S.W / 2, S.H / 2); ctx.rotate(wob); ctx.scale(k, k); ctx.lineCap = 'round';
  pal.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 12 * S.u; const off = (i - 2.5) * 12 * S.u; ctx.beginPath(); ctx.moveTo(-200 * S.u, off); ctx.quadraticCurveTo(0, off - 40 * S.u + Math.sin(S.t * 3 + i * 0.4) * 10 * S.u, 120 * S.u, off); ctx.stroke(); });
  ctx.fillStyle = col(S, 0); ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * S.u; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(110 * S.u, -70 * S.u); ctx.lineTo(220 * S.u, 0); ctx.lineTo(110 * S.u, 70 * S.u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
});
def('Arrows', 'el-arrow-comet', 'Sparkle Trail', { colors: ['#ffd60a', '#ffffff'], dur: 4 }, (ctx, S) => {
  const k = ease.inOutCubic(clamp(S.t / 1.3)), out = phase(S, 0.01, 0.35).vis; if (out <= 0) return;
  const pt = (t) => [S.W * (0.25 + 0.5 * t), S.H * (0.62 - Math.sin(t * Math.PI) * 0.22)];
  ctx.globalAlpha = out;
  for (let i = 0; i < 26; i++) { const t = k - i * 0.02; if (t < 0) break; const [x, y] = pt(t), r = (10 - i * 0.35) * S.u, tw = 0.5 + 0.5 * Math.sin(S.t * 10 + i);
    ctx.fillStyle = rgba(i % 3 ? col(S, 0) : col(S, 1), (1 - i / 26) * tw); ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
  const [x, y] = pt(k), [xb, yb] = pt(Math.max(0, k - 0.02));
  strokeStyle(ctx, S, col(S, 1), 12); arrowHead(ctx, x, y, Math.atan2(y - yb, x - xb), 50 * S.u); ctx.globalAlpha = 1;
});

// ---- Shapes used by intro/outro packs ----
def('Shapes', 'el-rings', 'Pulse Rings', { colors: ['#ffffff', '#1fd1b9'], dur: 5 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = Math.min(S.W, S.H) * 0.42 * (S.scale || 1);
  const vis = phase(S, 0.3, 0.5).vis;
  for (let i = 0; i < 4; i++) {
    const t = ((S.t * 0.45 + i / 4) % 1);
    ctx.strokeStyle = rgba(i % 2 ? col(S, 1) : col(S, 0), (1 - t) * 0.6 * vis);
    ctx.lineWidth = (2 + (1 - t) * 6) * S.u;
    ctx.beginPath(); ctx.arc(cx, cy, R * (0.25 + t * 0.9), 0, 7); ctx.stroke();
  }
});
def('Shapes', 'el-light-sweep', 'Light Streak', { colors: ['#ffffff', '#7bdff2'], dur: 3 }, (ctx, S) => {
  const k = clamp(S.t / Math.min(1.6, S.d * 0.8));
  if (k <= 0 || k >= 1) return;
  const x = -S.W * 0.3 + k * S.W * 1.6;
  ctx.save(); ctx.translate(x, S.H / 2); ctx.rotate(-0.35);
  const g = ctx.createLinearGradient(-S.W * 0.12, 0, S.W * 0.12, 0);
  g.addColorStop(0, rgba(col(S, 1), 0)); g.addColorStop(0.5, rgba(col(S, 0), 0.85)); g.addColorStop(1, rgba(col(S, 1), 0));
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-S.W * 0.12, -S.H, S.W * 0.24, S.H * 2);
  ctx.restore();
});
def('Shapes', 'el-logo-badge', 'Logo Badge', { colors: ['#ffffff', '#1fd1b9'], dur: 5 }, (ctx, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = 150 * S.u * (S.scale || 1);
  const k = inout(S, 0, 0.8, 0.5, ease.outBack);
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate((1 - Math.min(1, k)) * -1.5);
  ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 6 * S.u; ctx.beginPath(); ctx.arc(0, 0, R * 0.86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(S.t / 1.2)); ctx.stroke();
  ctx.fillStyle = col(S, 0); ctx.font = fontStr(S.params?.font || 'Montserrat', 900, R * 0.8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((S.params?.initials || 'AB').slice(0, 3).toUpperCase(), 0, R * 0.05);
  ctx.restore();
});
def('Shapes', 'el-bars', 'Sliding Bars', { colors: ['#1fd1b9', '#ff4d6d'], dur: 4 }, (ctx, S) => {
  const pal = [col(S, 0), col(S, 1), '#ffd60a', '#3a86ff'];
  for (let i = 0; i < 4; i++) {
    const a = ease.outExpo(clamp((S.t - i * 0.08) / 0.7)), b = ease.inExpo(clamp((S.t - (S.d - 0.7) - i * 0.06) / 0.6));
    const y = S.H * (0.12 + i * 0.07), h = S.H * 0.05;
    const x0 = -S.W + a * S.W * (0.55 - i * 0.07) + b * S.W * 2;
    ctx.fillStyle = pal[i]; ctx.fillRect(x0, y, S.W, h);
  }
});
def('Shapes', 'el-endcards', 'End Screen Boxes', { colors: ['#ffffff', '#1fd1b9'], dur: 8 }, (ctx, S) => {
  const k = inout(S, 0.2, 0.6, 0.5, ease.outBack);
  if (k <= 0) return;
  const bw = S.W * 0.28, bh = bw * 9 / 16, y = S.H * 0.5;
  [[S.W * 0.5 - bw - S.W * 0.03, 'Watch next'], [S.W * 0.5 + S.W * 0.03, 'Best of']].forEach(([x, label], i) => {
    ctx.save(); ctx.translate(x + bw / 2, y + bh / 2); ctx.scale(k, k); ctx.translate(-bw / 2, -bh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, 0, 0, bw, bh, 16 * S.u); ctx.fill();
    ctx.setLineDash([14 * S.u, 10 * S.u]); ctx.lineDashOffset = -S.t * 40 * S.u;
    ctx.strokeStyle = i ? col(S, 1) : col(S, 0); ctx.lineWidth = 4 * S.u; roundRect(ctx, 0, 0, bw, bh, 16 * S.u); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col(S, 0); ctx.font = fontStr('Poppins', 700, 34 * S.u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(S.params?.labels?.[i] || label, bw / 2, bh / 2);
    ctx.restore();
  });
});
def('Shapes', 'el-corner-frame', 'Corner Accents', { colors: ['#ffffff'], dur: 5 }, (ctx, S) => {
  const k = inout(S, 0, 0.7, 0.5, ease.outCubic), m = 60 * S.u, L = 140 * S.u * k;
  ctx.strokeStyle = col(S, 0); ctx.lineWidth = 6 * S.u; ctx.lineCap = 'round';
  [[m, m, 1, 1], [S.W - m, m, -1, 1], [m, S.H - m, 1, -1], [S.W - m, S.H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + L * sy); ctx.lineTo(x, y); ctx.lineTo(x + L * sx, y); ctx.stroke(); });
});

export const ELEMENTS = EL;
export const ELEMENT_CATS = [...new Set(EL.map((e) => e.cat))];
export const elementById = (id) => EL.find((e) => e.id === id);

// =================== Backgrounds ===================
const BG = [];
const bg = (cat, id, name, colors, draw) => BG.push({ id, name, cat, colors, dur: 5, draw });
const SOLIDS = [['Black', '#000000'], ['White', '#ffffff'], ['Charcoal', '#22252b'], ['Red', '#e63946'], ['Orange', '#f77f00'], ['Yellow', '#ffd60a'], ['Green', '#2dc653'], ['Teal', '#00a6a6'], ['Blue', '#3a86ff'], ['Navy', '#14213d'], ['Purple', '#7b2ff7'], ['Pink', '#ff4d9d'], ['Green Screen', '#00ff00'], ['Blue Screen', '#0047ff']];
SOLIDS.forEach(([n, c]) => bg('Solid Colors', `bg-${n.toLowerCase().replace(/\W+/g, '-')}`, n, [c], (ctx, S) => { ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); }));
const GRADS = [['Sunset', '#ff7e5f', '#feb47b'], ['Ocean', '#2193b0', '#6dd5ed'], ['Purple Haze', '#7b2ff7', '#f107a3'], ['Mint', '#00b09b', '#96c93d'], ['Night Sky', '#0f2027', '#2c5364'], ['Peach', '#ffecd2', '#fcb69f'], ['Fire', '#f12711', '#f5af19'], ['Steel', '#485563', '#29323c']];
GRADS.forEach(([n, a, b]) => bg('Gradients', `bg-g-${n.toLowerCase().replace(/\W+/g, '-')}`, n, [a, b], (ctx, S) => {
  const g = ctx.createLinearGradient(0, 0, S.W, S.H); g.addColorStop(0, col(S, 0)); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
}));
bg('Animated', 'bg-flow', 'Gradient Flow', ['#7b2ff7', '#00c6ff'], (ctx, S) => {
  const a = S.t * 0.4; const g = ctx.createLinearGradient(S.W / 2 + Math.cos(a) * S.W, S.H / 2 + Math.sin(a) * S.H, S.W / 2 - Math.cos(a) * S.W, S.H / 2 - Math.sin(a) * S.H);
  g.addColorStop(0, col(S, 0)); g.addColorStop(0.5, shade(col(S, 1), -0.2)); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
});
bg('Animated', 'bg-aurora', 'Aurora', ['#0b132b', '#2dc653'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 3; b++) {
    const g = ctx.createLinearGradient(0, S.H * 0.2, 0, S.H * 0.8); const c = [col(S, 1), '#4cc9f0', '#b5179e'][b];
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, 0.35)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath();
    for (let x = 0; x <= S.W; x += S.W / 40) ctx.lineTo(x, S.H * (0.35 + b * 0.08) + Math.sin(x / S.W * 6 + S.t * (0.5 + b * 0.2) + b) * S.H * 0.08);
    for (let x = S.W; x >= 0; x -= S.W / 40) ctx.lineTo(x, S.H * (0.6 + b * 0.05) + Math.sin(x / S.W * 4 + S.t * 0.4 + b * 2) * S.H * 0.08);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
});
bg('Animated', 'bg-stars', 'Starfield', ['#05070f', '#ffffff'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const cx = S.W / 2, cy = S.H / 2;
  for (let i = 0; i < 300; i++) {
    const z = ((hash(i) - S.t * 0.15) % 1 + 1) % 1; const x = cx + (hash(i + 1) - 0.5) * S.W / (z + 0.05) * 0.4, y = cy + (hash(i + 2) - 0.5) * S.H / (z + 0.05) * 0.4;
    const r = (1 - z) * 3 * S.u; ctx.fillStyle = rgba(col(S, 1), 1 - z); ctx.beginPath(); ctx.arc(x, y, Math.max(0.3, r), 0, 7); ctx.fill();
  }
});
bg('Animated', 'bg-bokeh', 'Bokeh', ['#1a1423', '#ffb703'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = hash(i) * S.W + Math.sin(S.t * 0.3 + i) * 50 * S.u, y = hash(i + 7) * S.H + Math.cos(S.t * 0.25 + i) * 40 * S.u, r = (30 + hash(i + 3) * 90) * S.u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = i % 3 ? col(S, 1) : '#fb8500';
    g.addColorStop(0, rgba(c, 0.25)); g.addColorStop(0.8, rgba(c, 0.18)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
});
bg('Animated', 'bg-synth', 'Synthwave Grid', ['#12002b', '#ff2bd6'], (ctx, S) => {
  const hz = S.H * 0.55; const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, col(S, 0)); g.addColorStop(1, '#5a189a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, hz); ctx.fillStyle = col(S, 0); ctx.fillRect(0, hz, S.W, S.H - hz);
  const sg = ctx.createLinearGradient(0, hz - S.H * 0.35, 0, hz); sg.addColorStop(0, '#ffd60a'); sg.addColorStop(1, '#ff2bd6'); ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(S.W / 2, hz, S.H * 0.28, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 2 * S.u;
  for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(S.W / 2 + i * 20 * S.u, hz); ctx.lineTo(S.W / 2 + i * 160 * S.u, S.H); ctx.stroke(); }
  for (let j = 0; j < 14; j++) { const z = ((j + (S.t * 1.5) % 1) / 14); const y = hz + (S.H - hz) * z * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S.W, y); ctx.stroke(); }
});
bg('Animated', 'bg-waves', 'Waves', ['#023e8a', '#48cae4'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  for (let l = 0; l < 5; l++) {
    ctx.fillStyle = rgba(col(S, 1), 0.15 + l * 0.08); ctx.beginPath(); ctx.moveTo(0, S.H);
    for (let x = 0; x <= S.W; x += S.W / 60) ctx.lineTo(x, S.H * (0.45 + l * 0.11) + Math.sin(x / S.W * (4 + l) + S.t * (1 + l * 0.3)) * 30 * S.u);
    ctx.lineTo(S.W, S.H); ctx.fill();
  }
});
bg('Animated', 'bg-particles', 'Network', ['#0d1b2a', '#4cc9f0'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  const pts = []; for (let i = 0; i < 60; i++) pts.push([((hash(i) + S.t * 0.02 * (hash(i + 5) - 0.5)) % 1 + 1) % 1 * S.W, ((hash(i + 1) + S.t * 0.02 * (hash(i + 6) - 0.5)) % 1 + 1) % 1 * S.H]);
  ctx.lineWidth = 1.5 * S.u; const maxD = 220 * S.u;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < maxD) { ctx.strokeStyle = rgba(col(S, 1), (1 - d / maxD) * 0.5); ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[j]); ctx.stroke(); } }
  ctx.fillStyle = col(S, 1); pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4 * S.u, 0, 7); ctx.fill(); });
});
bg('Animated', 'bg-leader', 'Film Leader', ['#c8c2b4', '#222222'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const cx = S.W / 2, cy = S.H / 2, R = S.H * 0.38;
  const n = Math.max(1, 5 - Math.floor(S.t)); const f = S.t % 1;
  ctx.fillStyle = shade(col(S, 0), -0.25); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, Math.hypot(S.W, S.H), -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col(S, 1); ctx.lineWidth = 6 * S.u; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(S.W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, S.H); ctx.stroke();
  ctx.fillStyle = col(S, 1); ctx.font = fontStr('Oswald', 700, S.H * 0.45); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), cx, cy + S.H * 0.02);
});
bg('Patterns', 'bg-dots', 'Polka Dots', ['#ffe5ec', '#ff8fab'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 1); const g = 80 * S.u;
  for (let y = 0; y < S.H + g; y += g) for (let x = ((y / g) % 2) * g / 2; x < S.W + g; x += g) { ctx.beginPath(); ctx.arc(x, y, 14 * S.u, 0, 7); ctx.fill(); }
});
bg('Patterns', 'bg-stripes', 'Diagonal Stripes', ['#ffd60a', '#111111'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 1); const w = 60 * S.u, off = (S.t * 60 * S.u) % (w * 2);
  for (let x = -S.H - w * 2 + off; x < S.W + S.H; x += w * 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + S.H, S.H); ctx.lineTo(x + S.H, S.H); ctx.fill(); }
});
bg('Patterns', 'bg-grid-paper', 'Grid Paper', ['#fdfcf7', '#a9c6e8'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.strokeStyle = col(S, 1); ctx.lineWidth = 1.5 * S.u; const g = 50 * S.u;
  for (let x = 0; x < S.W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S.H); ctx.stroke(); }
  for (let y = 0; y < S.H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S.W, y); ctx.stroke(); }
});

// ---- more gradients ----
[['Cotton Candy', '#ff9a9e', '#fad0c4'], ['Lime Punch', '#a8e063', '#56ab2f'], ['Royal', '#141e30', '#243b55'], ['Cherry', '#eb3349', '#f45c43'], ['Lagoon', '#43cea2', '#185a9d'],
  ['Lavender', '#c471f5', '#fa71cd'], ['Citrus', '#f7971e', '#ffd200'], ['Graphite', '#232526', '#414345'], ['Rose Gold', '#b76e79', '#f4c4a1'], ['Electric', '#4776e6', '#8e54e9']]
  .forEach(([n, a, b]) => bg('Gradients', `bg-g-${n.toLowerCase().replace(/\W+/g, '-')}`, n, [a, b], (ctx, S) => {
    const g = ctx.createLinearGradient(0, S.H, S.W, 0); g.addColorStop(0, col(S, 0)); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  }));
[['Teal Glow', '#1fd1b9', '#04201c'], ['Purple Glow', '#9d4edd', '#10002b'], ['Warm Glow', '#ffb36b', '#2b1205'], ['Studio Grey', '#8a8f99', '#15171b'], ['Red Glow', '#ff4d6d', '#21040a'], ['Blue Glow', '#4cc9f0', '#03122b']]
  .forEach(([n, a, b]) => bg('Radial Glows', `bg-r-${n.toLowerCase().replace(/\W+/g, '-')}`, n, [a, b], (ctx, S) => {
    const g = ctx.createRadialGradient(S.W / 2, S.H / 2, 0, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * 0.6); g.addColorStop(0, col(S, 0)); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  }));
[['Sunrise Mesh', ['#ff7e5f', '#feb47b', '#6a3093', '#ffd56b']], ['Ocean Mesh', ['#00c6ff', '#0072ff', '#00f5d4', '#14213d']], ['Berry Mesh', ['#f107a3', '#7b2ff7', '#ff4d6d', '#2b0a3d']], ['Forest Mesh', ['#2dc653', '#0b3d20', '#a7c957', '#1b4332']]]
  .forEach(([n, c]) => bg('Gradients', `bg-m-${n.toLowerCase().replace(/\W+/g, '-')}`, n, c, (ctx, S) => {
    ctx.fillStyle = col(S, 3); ctx.fillRect(0, 0, S.W, S.H);
    [[0.15, 0.2, 0], [0.85, 0.25, 1], [0.5, 0.95, 2]].forEach(([x, y, i]) => {
      const px = S.W * (x + 0.04 * Math.sin(S.t * 0.4 + i)), py = S.H * (y + 0.04 * Math.cos(S.t * 0.3 + i));
      const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(S.W, S.H) * 0.7); g.addColorStop(0, col(S, i)); g.addColorStop(1, rgba(col(S, i), 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
    });
  }));

// ---- more animated ----
bg('Animated', 'bg-lava', 'Lava Lamp', ['#2b0a3d', '#ff4d6d'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.filter = `blur(${30 * S.u}px)`;
  for (let i = 0; i < 7; i++) { const x = S.W * (0.15 + 0.7 * hash(i)) + Math.sin(S.t * 0.5 + i) * S.W * 0.08, y = S.H * (0.5 + 0.45 * Math.sin(S.t * 0.3 + i * 1.7)), r = (90 + hash(i + 3) * 120) * S.u; ctx.fillStyle = i % 2 ? col(S, 1) : '#ffb703'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  ctx.filter = 'none';
});
bg('Animated', 'bg-code-rain', 'Code Rain', ['#020a04', '#2dc653'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const fs = 22 * S.u; ctx.font = fontStr('Liberation Mono', 700, fs); ctx.textAlign = 'center';
  const cols = Math.ceil(S.W / fs);
  for (let c = 0; c < cols; c++) { const sp = 3 + hash(c) * 5, head = ((S.t * sp + hash(c + 9) * 40) % 40) * fs;
    for (let j = 0; j < 18; j++) { const y = head - j * fs; if (y < -fs || y > S.H + fs) continue; ctx.fillStyle = j ? rgba(col(S, 1), 1 - j / 18) : '#d8ffe0'; ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(hash(c * 31 + j + Math.floor(S.t * 6)) * 90)), c * fs + fs / 2, y); } }
});
bg('Animated', 'bg-fireflies', 'Fireflies', ['#06140f', '#ffe066'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  for (let i = 0; i < 70; i++) { const x = S.W * hash(i) + Math.sin(S.t * (0.3 + hash(i + 1)) + i) * 60 * S.u, y = S.H * hash(i + 2) + Math.cos(S.t * (0.25 + hash(i + 3)) + i) * 40 * S.u, a = 0.5 + 0.5 * Math.sin(S.t * 2 + i * 1.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18 * S.u); g.addColorStop(0, rgba(col(S, 1), a)); g.addColorStop(1, rgba(col(S, 1), 0)); ctx.fillStyle = g; ctx.fillRect(x - 18 * S.u, y - 18 * S.u, 36 * S.u, 36 * S.u); }
});
bg('Animated', 'bg-sunburst', 'Sunburst', ['#ffd60a', '#ff9f1c'], (ctx, S) => {
  ctx.fillStyle = col(S, 1); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 0); const R = Math.hypot(S.W, S.H), n = 18;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + S.t * 0.2; ctx.beginPath(); ctx.moveTo(S.W / 2, S.H / 2); ctx.arc(S.W / 2, S.H / 2, R, a, a + Math.PI / n); ctx.fill(); }
});
bg('Animated', 'bg-pulse', 'Gradient Pulse', ['#ff4d6d', '#3a86ff'], (ctx, S) => {
  const k = 0.5 + 0.5 * Math.sin(S.t * 1.5); const g = ctx.createRadialGradient(S.W / 2, S.H / 2, 0, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * (0.35 + 0.25 * k));
  g.addColorStop(0, col(S, 0)); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
});
bg('Animated', 'bg-snowfall', 'Snowfall', ['#1d3557', '#ffffff'], (ctx, S) => {
  const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, col(S, 0)); g.addColorStop(1, shade(col(S, 0), 0.25)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  ctx.fillStyle = col(S, 1); for (let i = 0; i < 160; i++) { const sp = 0.05 + hash(i) * 0.1, y = ((hash(i + 1) + S.t * sp) % 1.05) * S.H, x = S.W * hash(i + 2) + Math.sin(S.t + i) * 20 * S.u; ctx.globalAlpha = 0.5 + hash(i + 3) * 0.5; ctx.beginPath(); ctx.arc(x, y, (1.5 + hash(i + 4) * 3.5) * S.u, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
});
bg('Animated', 'bg-liquid', 'Liquid Stripes', ['#f72585', '#4361ee'], (ctx, S) => {
  const n = 9; for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? col(S, 0) : col(S, 1); ctx.beginPath(); ctx.moveTo(0, S.H);
    for (let x = 0; x <= S.W; x += S.W / 40) ctx.lineTo(x, S.H * (i / n) + Math.sin(x / S.W * 5 + S.t + i * 0.6) * 25 * S.u); ctx.lineTo(S.W, S.H); ctx.fill(); }
});
bg('Animated', 'bg-confetti-fall', 'Confetti Fall', ['#14213d', '#ffd60a'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const pal = [col(S, 1), '#ff4d6d', '#4cc9f0', '#2dc653', '#ffffff'];
  for (let i = 0; i < 120; i++) { const y = ((hash(i) + S.t * (0.08 + hash(i + 1) * 0.1)) % 1.1) * S.H - 20, x = S.W * hash(i + 2) + Math.sin(S.t * 2 + i) * 30 * S.u;
    ctx.save(); ctx.translate(x, y); ctx.rotate(S.t * 3 + i); ctx.scale(1, Math.sin(S.t * 5 + i)); ctx.fillStyle = pal[i % pal.length]; ctx.fillRect(-7 * S.u, -4 * S.u, 14 * S.u, 8 * S.u); ctx.restore(); }
});
bg('Animated', 'bg-tunnel', 'Tunnel Rings', ['#05070f', '#9d4edd'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.lineWidth = 3 * S.u;
  for (let i = 0; i < 16; i++) { const z = ((i / 16 + S.t * 0.15) % 1), r = Math.pow(z, 2.2) * Math.hypot(S.W, S.H) * 0.6; ctx.strokeStyle = rgba(i % 2 ? col(S, 1) : '#4cc9f0', z); ctx.beginPath(); ctx.arc(S.W / 2, S.H / 2, r, 0, 7); ctx.stroke(); }
});
bg('Animated', 'bg-clouds', 'Drifting Clouds', ['#74b9ff', '#ffffff'], (ctx, S) => {
  const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, shade(col(S, 0), -0.2)); g.addColorStop(1, shade(col(S, 0), 0.4)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  ctx.fillStyle = rgba(col(S, 1), 0.9);
  for (let i = 0; i < 8; i++) { const w = (180 + hash(i) * 220) * S.u, x = ((hash(i + 1) * (S.W + w) + S.t * (10 + hash(i + 2) * 20) * S.u) % (S.W + w * 2)) - w, y = S.H * (0.1 + hash(i + 3) * 0.6);
    for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(x + j * w * 0.2, y - Math.sin(j / 4 * Math.PI) * w * 0.12, w * 0.18, w * 0.13, 0, 0, 7); ctx.fill(); } }
});
bg('Animated', 'bg-hex-pulse', 'Hexagon Pulse', ['#0b132b', '#1fd1b9'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const r = 40 * S.u, hw = r * Math.sqrt(3);
  for (let row = -1; row < S.H / (r * 1.5) + 1; row++) for (let c = -1; c < S.W / hw + 1; c++) {
    const x = c * hw + (row % 2 ? hw / 2 : 0), y = row * r * 1.5, d = Math.hypot(x - S.W / 2, y - S.H / 2) / S.W, a = 0.15 + 0.6 * Math.max(0, Math.sin(S.t * 2 - d * 12));
    ctx.strokeStyle = rgba(col(S, 1), a); ctx.lineWidth = 2 * S.u; ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(x + Math.cos(an) * r * 0.92, y + Math.sin(an) * r * 0.92); } ctx.closePath(); ctx.stroke();
  }
});

// ---- more patterns ----
bg('Patterns', 'bg-checkers', 'Checkers', ['#111111', '#ffffff'], (ctx, S) => {
  const g = 90 * S.u; for (let y = 0; y < S.H; y += g) for (let x = 0; x < S.W; x += g) { ctx.fillStyle = (Math.round(x / g) + Math.round(y / g)) % 2 ? col(S, 0) : col(S, 1); ctx.fillRect(x, y, g + 1, g + 1); }
});
bg('Patterns', 'bg-chevron', 'Chevron', ['#2a9d8f', '#e9f5db'], (ctx, S) => {
  ctx.fillStyle = col(S, 1); ctx.fillRect(0, 0, S.W, S.H); ctx.strokeStyle = col(S, 0); ctx.lineWidth = 22 * S.u; const g = 80 * S.u;
  for (let y = -g; y < S.H + g; y += g) { ctx.beginPath(); for (let x = 0, i = 0; x <= S.W + g; x += g / 2, i++) ctx.lineTo(x, y + (i % 2 ? g * 0.35 : 0)); ctx.stroke(); }
});
bg('Patterns', 'bg-halftone', 'Halftone Fade', ['#ffffff', '#ff4d6d'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 1); const g = 36 * S.u;
  for (let y = 0; y < S.H + g; y += g) for (let x = 0; x < S.W + g; x += g) { const r = g * 0.48 * (y / S.H); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
});
bg('Patterns', 'bg-triangles', 'Triangles', ['#264653', '#e76f51'], (ctx, S) => {
  const g = 120 * S.u, pal = [col(S, 0), col(S, 1), shade(col(S, 0), 0.2), shade(col(S, 1), -0.2)];
  for (let r = 0; r * g < S.H + g; r++) for (let c = -1; c * g < S.W + g; c++) for (let k = 0; k < 2; k++) {
    ctx.fillStyle = pal[Math.floor(hash(r * 97 + c * 13 + k) * 4)]; ctx.beginPath(); const x = c * g + (r % 2) * g / 2, y = r * g;
    if (k) { ctx.moveTo(x, y); ctx.lineTo(x + g, y); ctx.lineTo(x + g / 2, y + g); } else { ctx.moveTo(x + g / 2, y + g); ctx.lineTo(x + g * 1.5, y + g); ctx.lineTo(x + g, y); } ctx.fill(); }
});
bg('Patterns', 'bg-plaid', 'Plaid', ['#8d0801', '#1b1b1b'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); const g = 120 * S.u;
  ctx.fillStyle = rgba(col(S, 1), 0.5); for (let x = 0; x < S.W; x += g) ctx.fillRect(x, 0, g * 0.35, S.H); for (let y = 0; y < S.H; y += g) ctx.fillRect(0, y, S.W, g * 0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = g * 0.6; x < S.W; x += g) ctx.fillRect(x, 0, 3 * S.u, S.H); for (let y = g * 0.6; y < S.H; y += g) ctx.fillRect(0, y, S.W, 3 * S.u);
});
bg('Patterns', 'bg-bricks', 'Bricks', ['#9c4a33', '#d9cbb5'], (ctx, S) => {
  ctx.fillStyle = col(S, 1); ctx.fillRect(0, 0, S.W, S.H); const bw = 120 * S.u, bh = 50 * S.u, m = 6 * S.u;
  for (let r = 0; r * bh < S.H; r++) for (let x = (r % 2 ? -bw / 2 : 0); x < S.W; x += bw) { ctx.fillStyle = shade(col(S, 0), (hash(r * 31 + x) - 0.5) * 0.25); ctx.fillRect(x + m / 2, r * bh + m / 2, bw - m, bh - m); }
});
bg('Patterns', 'bg-hearts', 'Hearts', ['#ffe5ec', '#ff4d6d'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 1); const g = 110 * S.u, off = (S.t * 20 * S.u) % g;
  for (let y = -g; y < S.H + g; y += g) for (let x = -g; x < S.W + g; x += g) { const cx = x + ((y / g) % 2 ? g / 2 : 0), cy = y + off, s = 16 * S.u;
    ctx.beginPath(); ctx.moveTo(cx, cy + s); ctx.bezierCurveTo(cx - s * 2, cy - s * 0.5, cx - s, cy - s * 1.8, cx, cy - s * 0.6); ctx.bezierCurveTo(cx + s, cy - s * 1.8, cx + s * 2, cy - s * 0.5, cx, cy + s); ctx.fill(); }
});
bg('Patterns', 'bg-stars-pattern', 'Stars', ['#14213d', '#ffd60a'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H); ctx.fillStyle = col(S, 1); const g = 120 * S.u;
  for (let y = 0; y < S.H + g; y += g) for (let x = 0; x < S.W + g; x += g) { const cx = x + ((y / g) % 2 ? g / 2 : 0), r = 18 * S.u * (0.8 + 0.2 * Math.sin(S.t * 3 + x + y));
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
});

// ---- scenes & textures ----
bg('Scenes & Textures', 'bg-paper', 'Paper', ['#f4efe4', '#d8cfbd'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = rgba(col(S, 1), 0.15 + hash(i) * 0.25); ctx.fillRect(hash(i + 1) * S.W, hash(i + 2) * S.H, (1 + hash(i + 3) * 18) * S.u, 1.2 * S.u); }
  const g = ctx.createRadialGradient(S.W / 2, S.H / 2, S.H * 0.3, S.W / 2, S.H / 2, S.W * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,20,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
});
bg('Scenes & Textures', 'bg-chalkboard', 'Chalkboard', ['#2f3e36', '#ffffff'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  for (let i = 0; i < 60; i++) { ctx.strokeStyle = rgba(col(S, 1), 0.03 + hash(i) * 0.04); ctx.lineWidth = (20 + hash(i + 1) * 60) * S.u; ctx.beginPath(); const y = hash(i + 2) * S.H; ctx.moveTo(hash(i + 3) * S.W * 0.5, y); ctx.lineTo(S.W * (0.5 + hash(i + 4) * 0.5), y + (hash(i + 5) - 0.5) * 80 * S.u); ctx.stroke(); }
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 30 * S.u; ctx.strokeRect(0, 0, S.W, S.H);
});
bg('Scenes & Textures', 'bg-night-city', 'Night City', ['#0b1026', '#ffd166'], (ctx, S) => {
  const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, col(S, 0)); g.addColorStop(1, '#3a1c71'); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 80; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(S.t + i)); ctx.fillRect(hash(i) * S.W, hash(i + 1) * S.H * 0.45, 2 * S.u, 2 * S.u); } ctx.globalAlpha = 1;
  for (let i = 0; i < 26; i++) { const w = (50 + hash(i) * 70) * S.u, hgt = S.H * (0.2 + hash(i + 7) * 0.45), x = (i / 26) * S.W * 1.05 - 20 * S.u; ctx.fillStyle = '#070a18'; ctx.fillRect(x, S.H - hgt, w, hgt);
    ctx.fillStyle = col(S, 1); for (let wy = S.H - hgt + 12 * S.u; wy < S.H - 10 * S.u; wy += 22 * S.u) for (let wx = x + 8 * S.u; wx < x + w - 10 * S.u; wx += 16 * S.u) if (hash(wx * 3 + wy) > 0.55) ctx.fillRect(wx, wy, 6 * S.u, 9 * S.u); }
});
bg('Scenes & Textures', 'bg-mountains', 'Mountain Sunset', ['#ff9a5a', '#3b2c55'], (ctx, S) => {
  const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, col(S, 0)); g.addColorStop(0.6, '#ffd08a'); g.addColorStop(1, col(S, 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(S.W * 0.65, S.H * (0.5 + 0.02 * Math.sin(S.t * 0.3)), S.H * 0.09, 0, 7); ctx.fill();
  [['#7b4f7e', 0.55, 3], ['#4e3360', 0.68, 5], ['#2a1d3d', 0.8, 7]].forEach(([c, base, n], li) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, S.H);
    for (let i = 0; i <= n * 2; i++) ctx.lineTo((i / (n * 2)) * S.W, S.H * (base - (i % 2 ? 0.12 + hash(i + li * 9) * 0.1 : 0))); ctx.lineTo(S.W, S.H); ctx.fill(); });
});
bg('Scenes & Textures', 'bg-beach', 'Beach Day', ['#8ecae6', '#f6d6a8'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H * 0.55); ctx.fillStyle = '#219ebc'; ctx.fillRect(0, S.H * 0.55, S.W, S.H * 0.2);
  ctx.fillStyle = col(S, 1); ctx.beginPath(); ctx.moveTo(0, S.H); for (let x = 0; x <= S.W; x += S.W / 30) ctx.lineTo(x, S.H * 0.74 + Math.sin(x / S.W * 8 + S.t) * 8 * S.u); ctx.lineTo(S.W, S.H); ctx.fill();
  ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(S.W * 0.8, S.H * 0.18, S.H * 0.07, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * S.u; for (let i = 0; i < 5; i++) { const y = S.H * (0.6 + i * 0.03); ctx.beginPath(); ctx.moveTo(((S.t * 30 * S.u + i * 200 * S.u) % S.W), y); ctx.lineTo(((S.t * 30 * S.u + i * 200 * S.u) % S.W) + 80 * S.u, y); ctx.stroke(); }
});
bg('Scenes & Textures', 'bg-concrete', 'Concrete', ['#9a9a9a', '#6b6b6b'], (ctx, S) => {
  ctx.fillStyle = col(S, 0); ctx.fillRect(0, 0, S.W, S.H);
  for (let i = 0; i < 3000; i++) { ctx.fillStyle = rgba(hash(i) > 0.5 ? col(S, 1) : '#c8c8c8', 0.25); const r = (0.5 + hash(i + 1) * 2.5) * S.u; ctx.fillRect(hash(i + 2) * S.W, hash(i + 3) * S.H, r, r); }
});

export const BACKGROUNDS = BG;
export const BACKGROUND_CATS = [...new Set(BG.map((b) => b.cat))];
export const backgroundById = (id) => BG.find((b) => b.id === id);
