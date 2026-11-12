// Gaming sequences: intros, mid-rolls and outros for let's-plays, streams and game channels. Every
// word is editable, every part can be moved, and each works in 16:9, 9:16 and 1:1. Game, team and
// player names are made-up placeholders.
import {
  tx, kin, lerp, frame, TY, sized, pill, card, checkBadge, glyph, iconDisc, countUp, numOf, wrapO, measure, animText, drawText, piece, line,
  roundRect, growRect, ease, clamp, rgba, K, area, fo, para, column, block, beside,
} from './scenekit.js';

const L = [];
const seq = (id, name, role, theme, o, draw) => L.push({ id, name, cat: 'Gaming', role, dur: role === 'intro' ? 5 : 6, bg: TH[theme].bg, colors: TH[theme].c, ...o, draw });

// Colour sets: [text, accent, second accent, muted text, card, text on the accent].
const TH = {
  neon: { bg: ['bg-synth', '#12002b', '#ff2bd6'], c: ['#ffffff', '#ff2bd6', '#22d3ee', '#b4b4c8', '#ffffff', '#ffffff'] },
  arcade: { bg: ['bg-black', '#0a0a0f'], c: ['#ffffff', '#facc15', '#f43f5e', '#a1a1aa', '#ffffff', '#111111'] },
  terminal: { bg: ['bg-code-rain', '#020a04', '#2dc653'], c: ['#f5f5f5', '#22c55e', '#a3e635', '#9ca3af', '#ffffff', '#052e16'] },
  esports: { bg: ['bg-charcoal', '#111318'], c: ['#ffffff', '#f97316', '#3b82f6', '#9ca3af', '#ffffff', '#111111'] },
  pastel: { bg: ['bg-white', '#f5f3ff'], c: ['#1e1b2e', '#8b5cf6', '#ec4899', '#6b6880', '#ffffff', '#ffffff'] },
  tunnel: { bg: ['bg-tunnel', '#05070f', '#9d4edd'], c: ['#ffffff', '#c084fc', '#22d3ee', '#a1a1aa', '#ffffff', '#111111'] },
  neonFlat: { bg: ['bg-black', '#16012f'], c: ['#ffffff', '#ff2bd6', '#22d3ee', '#b4b4c8', '#ffffff', '#ffffff'] },
  termFlat: { bg: ['bg-black', '#04110a'], c: ['#f5f5f5', '#22c55e', '#a3e635', '#9ca3af', '#ffffff', '#052e16'] },
  hex: { bg: ['bg-hex-pulse', '#0b132b', '#1fd1b9'], c: ['#ffffff', '#1fd1b9', '#facc15', '#9ca3af', '#ffffff', '#0b132b'] },
};
const still0 = { anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 };
const PIX = { font: 'Press Start 2P', fontFixed: true, weight: 400 };
const ORB = { font: 'Orbitron', fontFixed: true, weight: 900 };
const label = (text, k, delay = 0.1, extra = {}) => ({ text, o: TY.label, color: k.acc, anim: 'fade', delay, ...extra });

// Yellow-and-black hazard stripes in a band that slides along.
function hazard(ctx, S, x, y, w, h, color, delay, dir = 1) {
  const u = S.u;
  piece(ctx, { x, y, w, h }, (c) => {
    const kk = kin(S, delay, 0.4, ease.outExpo); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.beginPath(); c.rect(x, y, w * kk, h); c.clip();
    c.fillStyle = '#111111'; c.fillRect(x, y, w, h);
    c.fillStyle = color; const st = 46 * u, off = ((S.t * 60 * u * dir) % (st * 2) + st * 2) % (st * 2);
    for (let sx = x - h - st * 2 + off; sx < x + w + h; sx += st * 2) { c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + st, y + h); c.lineTo(sx + st + h, y); c.lineTo(sx + h, y); c.closePath(); c.fill(); }
    c.restore();
  });
}
// A heart made of squares, filled or empty.
function pixelHeart(c, x, y, s, color, full, u) {
  const M = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  M.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== 'x') return; c.fillStyle = full ? color : rgba(color, 0.22); c.fillRect(x + (i - 3.5) * s, y + (j - 3) * s, s - u, s - u); }));
}
// A keyboard key with its label.
const keyW = (ctx, S, text, h) => Math.max(h, measure(ctx, S, text, sized(TY.strong, 34)).w + 50 * S.u);
function keycap(ctx, S, text, x, y, h, k, delay) {
  const u = S.u, o = sized(TY.strong, 34), w = keyW(ctx, S, text, h);
  piece(ctx, { x, y: y - h / 2, w, h: h + 8 * u }, (c) => {
    const kk = ease.outBack(clamp((S.t - delay) / 0.35)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(x + w / 2, y); c.scale(kk, kk);
    c.fillStyle = rgba(k.ink, 0.35); roundRect(c, -w / 2, -h / 2 + 8 * u, w, h, 14 * u); c.fill();
    c.fillStyle = k.dark ? '#2a2d36' : '#ffffff'; roundRect(c, -w / 2, -h / 2, w, h, 14 * u); c.fill();
    drawText(c, S, text, 0, 2 * u, { ...o, color: k.dark ? '#ffffff' : '#111827', align: 'center', maxWidth: (w - 30 * u) / S.W, ...still0, alpha: Math.min(1, kk) });
    c.restore();
  });
  return w;
}
// ================= intros (the matching outros reuse them with closing words) =================

// Press Start: a pixel title, the episode, and a blinking PRESS START, over scanlines.
function pressStart(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  piece(ctx, { x: 0, y: 0, w: f.W, h: f.H }, (c) => { c.globalAlpha = fo(S) * 0.12; c.fillStyle = '#ffffff'; for (let y = 0; y < f.H; y += 6 * u) c.fillRect(0, y, f.W, 2 * u); });
  const to = { ...PIX, size: f.tall ? 72 : 96 }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.acc, anim: 'drop', delay: 0.2, stagger: 0.05, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 20 * u, { ...PIX, size: 30, color: k.ink, anim: 'fade', delay: 1.0, maxWidth: mw })],
    [40 * u, (y) => piece(ctx, { x: f.W / 2 - cw / 2, y, w: cw, h: 40 * u }, (c) => {
      if (S.t < 1.4 || Math.floor(S.t * 2.2) % 2) return;
      c.globalAlpha = fo(S); drawText(c, S, tx(S, 2), f.W / 2, y + 20 * u, { ...PIX, size: 28, upper: true, color: k.acc2, align: 'center', maxWidth: mw, ...still0 });
    })],
  ], 50 * u);
}

// Neon Grid: a glowing title over the moving grid, with an episode tag and a line.
function neonGrid(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const to = { ...ORB, size: f.tall ? 96 : 130 }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 2), f.W / 2, y + 27 * u, { o: sized(TY.label, 26), bg: k.acc2, ink: '#111111', align: 'center', delay: 0.9 })],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: '#ffffff', anim: 'zoom', delay: 0.2, stagger: 0.03, maxWidth: mw, glow: k.acc })],
    [40 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 20 * u, { ...sized(TY.strong, 40), color: k.ink, anim: 'fade', delay: 1.1, maxWidth: mw })],
  ], 36 * u, f.H * 0.4);
}

// Level Up: LEVEL UP! pops, an XP bar fills, the level ticks over, then the channel name.
function levelUp(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const bw = Math.min(cw, 900 * u), bh = 44 * u;
  const to = { ...sized(TY.big, f.tall ? 120 : 150), font: 'Bangers', fontFixed: true, weight: 400 }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.acc, anim: 'pop', delay: 1.2, stagger: 0.04, maxWidth: mw })],
    [bh + 60 * u, (y) => {
      const bx = f.W / 2 - bw / 2;
      card(ctx, S, { x: bx, y, w: bw, h: bh }, { color: rgba(k.ink, 0.12), delay: 0.1, r: bh / 2, rise: 0 });
      growRect(ctx, bx + 6 * u, y + 6 * u, bw - 12 * u, bh - 12 * u, kin(S, 0.3, 0.9, ease.inOutCubic), 'l', k.acc2, (bh - 12 * u) / 2, fo(S));
      animText(ctx, S, tx(S, 2), bx, y + bh + 34 * u, { ...sized(TY.num, 32), color: k.acc2, align: 'left', anim: 'pop', delay: 1.2, maxWidth: (bw / 2) / f.W });
      animText(ctx, S, 'XP', bx + bw, y + bh + 34 * u, { ...sized(TY.num, 28), color: k.muted, align: 'right', anim: 'fade', delay: 0.3 });
    }],
    [50 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 25 * u, { ...sized(TY.head, 48), color: k.ink, anim: 'up', delay: 1.6, maxWidth: mw })],
  ], 40 * u);
}

// Glitch Mode: the title glitches in with colour-split copies, with a tag and a line.
function glitchLogo(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = { ...sized(TY.big, f.tall ? 110 : 140), font: 'Rubik Mono One', fontFixed: true, weight: 400 }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 2), x0, y + 27 * u, { o: sized(TY.label, 26), bg: k.acc, ink: k.on, delay: 1.0, r: 4 })],
    [mt.h, (y) => {
      const j = S.t < 1.6 ? Math.sin(S.t * 90) * 10 * u : Math.sin(S.t * 3) > 0.97 ? 8 * u : 0;
      piece(ctx, { x: x0 - 20 * u, y, w: cw + 40 * u, h: mt.h }, (c) => {
        if (S.t < 0.2) return;
        c.globalAlpha = fo(S) * 0.7;
        drawText(c, S, t, x0 - j, y + mt.h / 2, { ...to, color: k.acc2, align: 'left', maxWidth: mw, ...still0 });
        drawText(c, S, t, x0 + j, y + mt.h / 2 + j * 0.3, { ...to, color: k.acc, align: 'left', maxWidth: mw, ...still0 });
      });
      animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'glitch', delay: 0.2, maxWidth: mw });
    }],
    [44 * u, (y) => animText(ctx, S, tx(S, 1), x0, y + 22 * u, { ...sized(TY.strong, 42), color: k.ink, align: 'left', anim: 'fade', delay: 1.2, maxWidth: mw })],
  ], 34 * u);
}

// Versus: two slanted team panels slide in from the sides, with VS (or a score) between them.
function versus(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), side = !f.tall;
  const ph = side ? f.H * 0.42 : f.H * 0.22, pw = side ? f.W * 0.5 : f.W, R = (side ? 110 : 100) * u;
  const no = { ...sized(TY.big, side ? (f.square ? 72 : 96) : 88), font: 'Bebas Neue', fontFixed: true, weight: 400 };
  [0, 1].forEach((i) => {
    const kk = kin(S, 0.1 + i * 0.12, 0.6, ease.outExpo), col = i ? k.acc2 : k.acc;
    const cy = side ? f.H / 2 : f.H / 2 + (i ? 1 : -1) * (ph / 2 + 70 * u), sl = 80 * u;
    piece(ctx, { x: 0, y: cy - ph / 2, w: f.W, h: ph }, (c) => {
      if (kk <= 0) return;
      c.globalAlpha = fo(S); c.fillStyle = col;
      if (side) {
        const off = (1 - kk) * pw * (i ? 1 : -1), x1 = i ? f.W / 2 + off : off;
        c.beginPath();
        if (!i) { c.moveTo(x1, cy - ph / 2); c.lineTo(x1 + pw + sl / 2, cy - ph / 2); c.lineTo(x1 + pw - sl / 2, cy + ph / 2); c.lineTo(x1, cy + ph / 2); }
        else { c.moveTo(x1 + sl / 2, cy - ph / 2); c.lineTo(x1 + pw, cy - ph / 2); c.lineTo(x1 + pw, cy + ph / 2); c.lineTo(x1 - sl / 2, cy + ph / 2); }
        c.closePath(); c.fill();
      } else { const off = (1 - kk) * f.W * (i ? 1 : -1); c.fillRect(off, cy - ph / 2, f.W, ph); }
    });
    const tx0 = side ? (i ? f.W * 0.75 + 20 * u : f.W * 0.25 - 20 * u) : f.W / 2, tw = side ? f.W * 0.5 - R - 120 * u : cw;
    animText(ctx, S, tx(S, i), tx0, cy, { ...no, color: k.on, anim: i ? 'left' : 'right', delay: 0.5 + i * 0.12, maxWidth: tw / f.W });
  });
  const cy = f.H / 2, vo = { ...sized(TY.big, 64), font: 'Bebas Neue', fontFixed: true, weight: 400 };
  piece(ctx, { x: f.W / 2 - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.8) / 0.4)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.fillStyle = '#111111'; c.beginPath(); c.arc(f.W / 2, cy, R * kk, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 6 * u; c.beginPath(); c.arc(f.W / 2, cy, (R - 3 * u) * kk, 0, Math.PI * 2); c.stroke();
    drawText(c, S, tx(S, 2), f.W / 2, cy + 4 * u, { ...vo, color: '#ffffff', align: 'center', maxWidth: (R * 1.4) / S.W, ...still0, alpha: Math.min(1, kk) });
  });
  const by = side ? f.H / 2 + ph / 2 + 70 * u : f.H / 2 + ph + 150 * u;
  animText(ctx, S, tx(S, 3), f.W / 2, Math.min(by, f.H - f.my), { ...sized(TY.strong, 38), color: k.ink, anim: 'fade', delay: 1.2, maxWidth: cw / f.W });
}

// Let's Play: a big gamepad bounces in above the title, the game and the time.
function letsPlay(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 170 : f.square ? 120 : 150) * u;
  beside(ctx, S, f, { vw: R * 2.2, vh: R * 2, gap: 80 }, () => [
    { text: tx(S, 0), o: { ...sized(TY.big, f.tall ? 110 : f.square ? 88 : 120), font: 'Bangers', fontFixed: true, weight: 400 }, color: k.acc, delay: 0.5, anim: 'pop', stagger: 0.03 },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 52 : 56), color: k.ink, gap: 20, delay: 0.9 },
    { pill: tx(S, 2), o: sized(TY.strong, 32), bg: k.acc2, ink: k.on, h: 58, gap: 24, delay: 1.2 },
  ], (cx, cy) => piece(ctx, { x: cx - R * 1.1, y: cy - R, w: R * 2.2, h: R * 2 }, (c) => {
    const kk = ease.outBounce(clamp((S.t - 0.05) / 0.8)); if (S.t < 0.05) return;
    c.globalAlpha = fo(S);
    c.fillStyle = rgba(k.acc, 0.14); c.beginPath(); c.arc(cx, cy, R * Math.min(1, kk + 0.1), 0, Math.PI * 2); c.fill();
    glyph(c, 'gamepad', cx, cy - (1 - kk) * R * 1.5 + Math.sin(S.t * 2.5) * 6 * u, R * 0.95, k.acc, 1, u);
  }));
}

// Retro Hearts: a row of pixel hearts fills one by one over the pixel title.
function hearts(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, n = 5, s = (f.tall ? 13 : 14) * u, hw = s * 8;
  const to = { ...PIX, size: f.tall ? 62 : 80 }, t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [40 * u, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + 20 * u, { ...PIX, size: 26, color: k.muted, anim: 'fade', delay: 0.1, maxWidth: mw })],
    [s * 7, (y) => piece(ctx, { x: f.W / 2 - (n * hw) / 2, y, w: n * hw, h: s * 7 }, (c) => {
      c.globalAlpha = fo(S);
      for (let i = 0; i < n; i++) { const kk = clamp((S.t - 0.3 - i * 0.18) / 0.15); if (kk <= 0) continue; pixelHeart(c, f.W / 2 - (n * hw) / 2 + hw * (i + 0.5), y + s * 3.5, s, k.acc2, S.t > 1.4 + i * 0.12, u); }
    })],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 1.0, stagger: 0.03, maxWidth: mw })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...sized(TY.strong, 36), color: k.acc, anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 50 * u);
}

// Loading: the title, a loading bar and percentage, and a tip under it.
function loading(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W, bh = 30 * u;
  const p = kin(S, 0.4, 2.6, ease.inOutCubic);
  const to = { ...ORB, size: f.tall ? 84 : 110 }, t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const tip = wrapO(ctx, S, tx(S, 2), TY.body, mw), mtp = measure(ctx, S, tip, TY.body);
  column(f, [
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.1, stagger: 0.02, maxWidth: mw })],
    [bh + 50 * u, (y) => {
      card(ctx, S, { x: x0, y, w: cw, h: bh }, { color: rgba(k.ink, 0.12), delay: 0.2, r: 4, rise: 0 });
      growRect(ctx, x0, y, cw, bh, p, 'l', k.acc, 4 * u, fo(S));
      animText(ctx, S, tx(S, 0), x0, y + bh + 30 * u, { ...sized(TY.num, 28), color: k.muted, align: 'left', anim: 'fade', delay: 0.3, maxWidth: (cw * 0.6) / f.W });
      animText(ctx, S, `${Math.round(p * 100)}%`, x0 + cw, y + bh + 30 * u, { ...sized(TY.num, 28), color: k.acc, align: 'right', anim: 'fade', delay: 0.3 });
    }],
    [mtp.h, (y) => animText(ctx, S, tip, x0, y + mtp.h / 2, { ...TY.body, color: k.muted, align: 'left', anim: 'fade', delay: 1.0, maxWidth: mw })],
  ], 44 * u);
}

// Starting Soon: big words with dots ticking after them, the channel and a line.
function startingSoon(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const to = { ...sized(TY.big, f.tall ? 100 : 130), font: 'Righteous', fontFixed: true, weight: 400 }, t = wrapO(ctx, S, tx(S, 0), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.1, stagger: 0.02, maxWidth: mw, glow: k.acc })],
    [24 * u, (y) => piece(ctx, { x: f.W / 2 - 80 * u, y, w: 160 * u, h: 24 * u }, (c) => { const kk = kin(S, 0.6, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; for (let i = 0; i < 4; i++) { const on = Math.floor(S.t * 3) % 4 === i; c.fillStyle = on ? k.acc : rgba(k.ink, 0.3); c.beginPath(); c.arc(f.W / 2 + (i - 1.5) * 40 * u, y + 12 * u, (on ? 12 : 9) * u, 0, Math.PI * 2); c.fill(); } })],
    [56 * u, (y) => pill(ctx, S, tx(S, 1), f.W / 2, y + 28 * u, { o: sized(TY.strong, 34), bg: k.acc2, ink: '#111111', align: 'center', delay: 0.8, h: 60 })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.1, maxWidth: mw })],
  ], 36 * u);
}

// Boss Warning: hazard stripes slide along the top and bottom, WARNING flashes, the boss's name and a full health bar.
function bossWarning(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, hh = (f.tall ? 70 : 64) * u;
  hazard(ctx, S, 0, f.my * 0.6, f.W, hh, k.acc, 0.05, 1);
  hazard(ctx, S, 0, f.H - f.my * 0.6 - hh, f.W, hh, k.acc, 0.05, -1);
  const wo = { ...sized(TY.big, 64), font: 'Bebas Neue', fontFixed: true, weight: 400, upper: true, spacing: 0.3 };
  const to = { ...sized(TY.big, f.tall ? 110 : 140), font: 'Bebas Neue', fontFixed: true, weight: 400 }, t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const bw = Math.min(cw, 1000 * u), bh = 34 * u;
  column(f, [
    [60 * u, (y) => piece(ctx, { x: f.W / 2 - cw / 2, y, w: cw, h: 60 * u }, (c) => { if (S.t < 0.3 || (S.t < 1.6 && Math.floor(S.t * 5) % 2)) return; c.globalAlpha = fo(S); drawText(c, S, tx(S, 0), f.W / 2, y + 30 * u, { ...wo, color: k.acc2, align: 'center', maxWidth: mw, ...still0 }); })],
    [mt.h, (y) => animText(ctx, S, t, f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'zoom', delay: 1.0, stagger: 0.02, maxWidth: mw })],
    [bh, (y) => {
      card(ctx, S, { x: f.W / 2 - bw / 2, y, w: bw, h: bh }, { color: rgba(k.ink, 0.15), delay: 1.2, r: 6, rise: 0 });
      growRect(ctx, f.W / 2 - bw / 2 + 5 * u, y + 5 * u, bw - 10 * u, bh - 10 * u, kin(S, 1.4, 1.0, ease.inOutCubic), 'l', k.acc2, 4 * u, fo(S));
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...sized(TY.strong, 36), color: k.muted, anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 34 * u);
}

// ================= mid-rolls =================

// Achievement Unlocked: a toast drops in with a trophy, the achievement and what it was for.
function achievement(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, 1100 * u), R = 66 * u, pad = 40 * u;
  const tw = w - pad * 3 - R * 2, to = sized(TY.head, f.tall ? 52 : 58), b = block(ctx, S, [
    { text: tx(S, 0), o: sized(TY.label, 24), color: k.acc, anim: 'fade', delay: 0.5 },
    { text: tx(S, 1), o: to, color: k.ink, gap: 12, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.body, 32), color: k.muted, gap: 12, anim: 'fade', delay: 0.9 },
  ], tw);
  const h = Math.max(R * 2, b.h) + pad * 2, x = f.W / 2 - w / 2, y = f.H / 2 - h / 2;
  card(ctx, S, { x, y, w, h }, { color: k.dark ? '#1c1f29' : '#ffffff', delay: 0.1, r: h / 2 > 90 * u ? 36 : h / 2 / u, border: rgba(k.acc, 0.6), shadow: 30 });
  piece(ctx, { x: x + pad, y: y + h / 2 - R, w: R * 2, h: R * 2 }, (c) => {
    const kt = ease.outBack(clamp((S.t - 0.35) / 0.45)); if (kt <= 0) return;
    c.globalAlpha = fo(S); c.fillStyle = k.acc; c.beginPath(); c.arc(x + pad + R, y + h / 2, R * kt, 0, Math.PI * 2); c.fill();
    glyph(c, 'trophy', x + pad + R, y + h / 2, R * 0.62, k.on, Math.min(1, kt), u);
    const ring = kin(S, 0.6, 0.8); if (ring > 0 && ring < 1) { c.globalAlpha = fo(S) * (1 - ring); c.strokeStyle = k.acc; c.lineWidth = 4 * u; c.beginPath(); c.arc(x + pad + R, y + h / 2, R * (1 + ring * 0.6), 0, Math.PI * 2); c.stroke(); }
  });
  b.draw(x + pad * 2 + R * 2, y + h / 2 - b.h / 2, 'left');
}

// Patch Notes: a version tag and changes, each marked new (+), fixed (−) or changed (~).
function patchNotes(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 4, rowH = (f.tall ? 96 : 84) * u, mk = 48 * u;
  const tone = (t) => (/^\s*\+/.test(t) ? ['+', '#22c55e'] : /^\s*[-−–]/.test(t) ? ['−', '#f43f5e'] : /^\s*~/.test(t) ? ['~', '#facc15'] : ['•', k.acc]);
  const hb = block(ctx, S, [{ text: tx(S, 0), o: { ...ORB, size: f.tall ? 64 : 72 }, color: k.ink, delay: 0.1 }, { pill: tx(S, 1), o: sized(TY.num, 26), bg: k.acc, ink: k.on, h: 50, r: 6, gap: 20, delay: 0.3 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const raw = tx(S, 2 + i), [m, col] = tone(raw), text = raw.replace(/^\s*[+\-−–~•]\s*/, ''), yy = y + rowH * i + rowH / 2, d = 0.5 + i * 0.2;
      piece(ctx, { x: x0, y: yy - mk / 2, w: mk, h: mk }, (c) => { const kk = ease.outBack(clamp((S.t - d) / 0.35)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = rgba(col, 0.2); roundRect(c, x0 + (mk / 2) * (1 - kk), yy - (mk / 2) * kk, mk * kk, mk * kk, 10 * u); c.fill(); drawText(c, S, m, x0 + mk / 2, yy + 2 * u, { ...sized(TY.num, 30), color: col, align: 'center', ...still0, alpha: Math.min(1, kk) }); });
      animText(ctx, S, text, x0 + mk + 26 * u, yy, { ...sized(TY.strong, 38), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (cw - mk - 26 * u) / f.W });
    } }],
  ], 40 * u);
}

// Tier List: rows of tiers, each with its letter on a coloured block and the picks beside it.
function tierList(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 4, rowH = (f.tall ? 130 : f.square ? 112 : 118) * u, lb = rowH - 14 * u;
  const cols = ['#f43f5e', '#f97316', '#facc15', '#22c55e'];
  const hb = block(ctx, S, [label(tx(S, 0), k), { text: tx(S, 1), o: sized(TY.title, f.tall ? 60 : 66), color: k.ink, gap: 14, delay: 0.2 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const yy = y + rowH * i, d = 0.4 + i * 0.2;
      card(ctx, S, { x: x0, y: yy, w: cw, h: lb }, { color: k.surf, delay: d, r: 14, rise: 0 });
      card(ctx, S, { x: x0, y: yy, w: lb, h: lb }, { color: cols[i], delay: d, r: 14, rise: 0, inner: (c, kk) => drawText(c, S, tx(S, 2 + i * 2), x0 + lb / 2, yy + lb / 2 + 3 * u, { ...sized(TY.big, 54), font: 'Bebas Neue', fontFixed: true, weight: 400, color: '#111111', align: 'center', maxWidth: (lb * 0.75) / S.W, ...still0, alpha: kk }) });
      let cx = x0 + lb + 24 * u;
      const picks = String(tx(S, 3 + i * 2)).split(',').map((s) => s.trim()).filter(Boolean), room = x0 + cw - 20 * u;
      picks.forEach((p, j) => { if (cx > room - 80 * u) return; const w = pill(ctx, S, p, cx, yy + lb / 2, { o: sized(TY.strong, 30), bg: rgba(k.ink, 0.12), ink: k.ink, h: 56, delay: d + 0.15 + j * 0.1, maxW: room - cx }).w; cx += w + 14 * u; });
    } }],
  ], 34 * u);
}

// Controls: keys on the left, what each one does beside it.
function controls(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 4, rowH = (f.tall ? 130 : 110) * u, kh = 80 * u, kcol = Math.min(cw * 0.5, 480 * u);
  const tH = measure(ctx, S, tx(S, 0), { ...ORB, size: 72 }).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...ORB, size: 72, color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const yy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.2;
      let kx = x0;
      String(tx(S, 1 + i * 2)).split(/\s+/).filter(Boolean).forEach((key, j) => { if (kx + keyW(ctx, S, key, kh) <= x0 + kcol) kx += keycap(ctx, S, key, kx, yy, kh, k, d + j * 0.06) + 12 * u; else kx = Infinity; });
      animText(ctx, S, tx(S, 2 + i * 2), x0 + kcol + 30 * u, yy, { ...sized(TY.head, 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (cw - kcol - 30 * u) / f.W });
    } }],
  ], 40 * u);
}

// Loadout: three slots with an icon, the slot name and what is in it.
function loadout(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), across = !f.tall, gap = 26 * u, n = 3;
  const pw = across ? (cw - gap * 2) / 3 : cw, ph = across ? 330 * u : 170 * u, R = 54 * u, icons = ['bolt', 'target', 'shield'];
  const tH = measure(ctx, S, tx(S, 0), { ...ORB, size: 72 }).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...ORB, size: 72, color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? ph : ph * 3 + gap * 2, (y) => { for (let i = 0; i < n; i++) {
      const bx = across ? x0 + i * (pw + gap) : x0, by = across ? y : y + i * (ph + gap), d = 0.3 + i * 0.2;
      card(ctx, S, { x: bx, y: by, w: pw, h: ph }, { color: k.surf, delay: d, r: 20, border: rgba(k.acc, 0.5) });
      const ix = across ? bx + pw / 2 : bx + 40 * u + R, iy = across ? by + 40 * u + R : by + ph / 2;
      iconDisc(ctx, S, icons[i], ix, iy, R, i === 0 ? k.acc : i === 1 ? k.acc2 : rgba(k.ink, 0.85), i === 2 ? (k.dark ? '#111111' : '#ffffff') : k.on, d + 0.15);
      const tx0 = across ? bx + pw / 2 : bx + 40 * u + R * 2 + 30 * u, al = across ? 'center' : 'left', tw = (across ? pw - 40 * u : pw - (tx0 - bx) - 30 * u) / f.W;
      animText(ctx, S, tx(S, 1 + i * 2), tx0, across ? by + ph - 110 * u : by + ph / 2 - 24 * u, { ...sized(TY.label, 24), color: k.muted, align: al, anim: 'fade', delay: d + 0.25, maxWidth: tw });
      animText(ctx, S, tx(S, 2 + i * 2), tx0, across ? by + ph - 62 * u : by + ph / 2 + 24 * u, { ...sized(TY.head, 42), color: k.ink, align: al, anim: 'fade', delay: d + 0.3, maxWidth: tw });
    } }],
  ], 40 * u);
}

// Player Card: initials, gamer tag and rank, then three stats that count up.
function playerCard(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), R = 90 * u, across = !f.tall;
  const hb = block(ctx, S, [
    label(tx(S, 0), k, 0.3),
    { text: tx(S, 1), o: { ...ORB, size: f.tall ? 64 : 76 }, color: k.ink, gap: 12, delay: 0.4 },
    { pill: tx(S, 2), o: sized(TY.strong, 30), bg: k.acc2, ink: '#111111', h: 54, gap: 16, delay: 0.7 },
  ], cw - R * 2 - 40 * u);
  const sw = across ? cw / 3 : cw, sh = across ? 170 * u : 130 * u;
  column(f, [
    [Math.max(R * 2, hb.h), (y) => {
      const h = Math.max(R * 2, hb.h);
      piece(ctx, { x: x0, y: y + h / 2 - R, w: R * 2, h: R * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.acc; c.beginPath(); c.arc(x0 + R, y + h / 2, R * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, tx(S, 3), x0 + R, y + h / 2 + 3 * u, { ...sized(TY.num, 52), color: k.on, align: 'center', maxWidth: (R * 1.3) / S.W, ...still0, alpha: Math.min(1, kk) }); });
      hb.draw(x0 + R * 2 + 40 * u, y + h / 2 - hb.h / 2, 'left');
    }],
    [across ? sh : sh * 3, (y) => { for (let i = 0; i < 3; i++) {
      const bx = across ? x0 + sw * i : x0, by = across ? y : y + sh * i, d = 0.8 + i * 0.2, cx = across ? bx + sw / 2 : bx;
      card(ctx, S, { x: bx + (across ? 10 * u : 0), y: by + (across ? 0 : 8 * u), w: sw - (across ? 20 * u : 0), h: sh - (across ? 0 : 16 * u) }, { color: k.surf, delay: d, r: 18 });
      animText(ctx, S, countUp(tx(S, 4 + i * 2), kin(S, d, 1.2, ease.outQuart)), across ? cx : bx + 40 * u, across ? by + sh / 2 - 18 * u : by + sh / 2, { ...{ ...ORB, size: 56 }, color: k.acc, align: across ? 'center' : 'left', anim: 'fade', delay: d, maxWidth: (across ? sw - 60 * u : sw * 0.5) / f.W });
      animText(ctx, S, tx(S, 5 + i * 2), across ? cx : bx + sw - 40 * u, across ? by + sh / 2 + 44 * u : by + sh / 2, { ...sized(TY.label, 24), color: k.muted, align: across ? 'center' : 'right', anim: 'fade', delay: d + 0.2, maxWidth: (across ? sw - 60 * u : sw * 0.4) / f.W });
    } }],
  ], 40 * u);
}

// Boss Fight: a stripe of hazard tape, BOSS FIGHT, the boss's name, a segmented health bar and its weak spot.
function bossFight(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W, segs = 10, bh = 46 * u;
  const to = { ...sized(TY.big, f.tall ? 100 : 124), font: 'Bebas Neue', fontFixed: true, weight: 400 }, t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [50 * u, (y) => hazard(ctx, S, x0, y, Math.min(cw, 520 * u), 50 * u, k.acc, 0.1)],
    [44 * u, (y) => animText(ctx, S, tx(S, 0), x0, y + 22 * u, { ...sized(TY.label, 34), color: k.acc2, align: 'left', anim: 'fade', delay: 0.3, maxWidth: mw })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'zoom', delay: 0.4, stagger: 0.02, maxWidth: mw })],
    [bh, (y) => piece(ctx, { x: x0, y, w: cw, h: bh }, (c) => {
      c.globalAlpha = fo(S); const sw = (cw - (segs - 1) * 8 * u) / segs;
      for (let i = 0; i < segs; i++) { const kk = clamp((S.t - 0.8 - i * 0.05) / 0.2); if (kk <= 0) continue; c.fillStyle = i < segs - 1 ? k.acc2 : rgba(k.acc2, 0.5); c.fillRect(x0 + i * (sw + 8 * u), y + bh * (1 - kk), sw, bh * kk); }
    })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 20 * u, { ...sized(TY.strong, 38), color: k.muted, align: 'left', anim: 'fade', delay: 1.5, maxWidth: mw })],
  ], 28 * u);
}

// Pro Tip: a bulb, then the tip typing into a retro dialogue box with a double border.
function proTip(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 54 * u, R = 44 * u;
  const bo = sized(TY.title, f.tall ? 50 : 56), t = wrapO(ctx, S, tx(S, 1), bo, (cw - pad * 2) / f.W), mt = measure(ctx, S, t, bo), bh = mt.h + pad * 2;
  column(f, [
    [R * 2, (y) => { iconDisc(ctx, S, 'bulb', x0 + R, y + R, R, k.acc, k.on, 0.1); animText(ctx, S, tx(S, 0), x0 + R * 2 + 24 * u, y + R, { ...PIX, size: 30, color: k.acc, align: 'left', anim: 'fade', delay: 0.3, maxWidth: (cw - R * 2) / f.W }); }],
    [bh, (y) => {
      card(ctx, S, { x: x0, y, w: cw, h: bh }, { color: k.dark ? '#14161f' : '#ffffff', delay: 0.3, r: 10, border: k.ink, inner: (c) => { c.strokeStyle = rgba(k.ink, 0.5); c.lineWidth = 3 * u; roundRect(c, x0 + 12 * u, y + 12 * u, cw - 24 * u, bh - 24 * u, 6 * u); c.stroke(); } });
      animText(ctx, S, t, x0 + pad, y + bh / 2, { ...bo, color: k.ink, align: 'left', anim: 'type', cursor: false, delay: 0.6, inDur: 1.4, maxWidth: (cw - pad * 2) / f.W });
    }],
  ], 30 * u);
}

// Match Up: two player tags slide in from the sides with VS between, and what the match is.
function matchUp(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), side = !f.tall, R = 70 * u, gap = R * 2 + 40 * u;
  const pw = side ? (cw - gap) / 2 : cw, ph = 150 * u, no = { ...ORB, size: f.tall ? 54 : 58 };
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 64)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 64), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? ph : ph * 2 + gap, (y) => {
      [0, 1].forEach((i) => {
        const bx = side ? x0 + i * (pw + gap) : x0, by = side ? y : y + i * (ph + gap), d = 0.3 + i * 0.15, col = i ? k.acc2 : k.acc;
        const kk = kin(S, d, 0.5, ease.outExpo), off = (1 - kk) * (i ? 1 : -1) * 200 * u;
        piece(ctx, { x: bx, y: by, w: pw, h: ph }, (c) => { if (kk <= 0) return; c.globalAlpha = fo(S) * kk; c.fillStyle = col; roundRect(c, bx + off, by, pw, ph, 20 * u); c.fill(); });
        animText(ctx, S, tx(S, 1 + i), bx + pw / 2, by + ph / 2, { ...no, color: k.on, anim: 'fade', delay: d + 0.3, maxWidth: (pw - 60 * u) / f.W });
      });
      const cx = side ? f.W / 2 : f.W / 2, cy = side ? y + ph / 2 : y + ph + gap / 2;
      piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 0.8) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.dark ? '#ffffff' : '#111111'; c.beginPath(); c.arc(cx, cy, R * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, tx(S, 3), cx, cy + 3 * u, { ...sized(TY.big, 56), font: 'Bebas Neue', fontFixed: true, weight: 400, color: k.dark ? '#111111' : '#ffffff', align: 'center', maxWidth: (R * 1.4) / S.W, ...still0, alpha: Math.min(1, kk) }); });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 4), f.W / 2, y + 20 * u, { ...sized(TY.strong, 36), color: k.muted, anim: 'fade', delay: 1.2, maxWidth: cw / f.W })],
  ], 40 * u);
}

// Quest Log: objectives with boxes; the number in the last line says how many are done.
function questLog(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 3, rowH = (f.tall ? 110 : 96) * u, bx = 44 * u;
  const done = Math.max(0, Math.min(n, Math.round(numOf(tx(S, 5), 2))));
  const tH = measure(ctx, S, tx(S, 0), { ...ORB, size: 68 }).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...ORB, size: 68, color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const yy = y + rowH * i + rowH / 2, d = 0.4 + i * 0.3, isDone = i < done;
      piece(ctx, { x: x0, y: yy - bx / 2, w: bx, h: bx }, (c) => {
        const kk = ease.outBack(clamp((S.t - d) / 0.35)); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.strokeStyle = isDone ? k.acc : rgba(k.ink, 0.5); c.lineWidth = 4 * u; roundRect(c, x0 + (bx / 2) * (1 - kk), yy - (bx / 2) * kk, bx * kk, bx * kk, 8 * u); c.stroke();
        if (isDone) { const kc = clamp((S.t - d - 0.4) / 0.3); if (kc > 0) glyph(c, 'check', x0 + bx / 2, yy, bx * 0.5, k.acc, kc, u); }
      });
      // a done objective is struck through inside its own piece, so the line moves with the words
      const ho = sized(TY.head, 42), tx1 = x0 + bx + 26 * u, room = cw - bx - 26 * u, mt = measure(ctx, S, tx(S, 1 + i), ho), tw = Math.min(room, mt.w);
      piece(ctx, { x: tx1, y: yy - mt.h / 2, w: tw, h: mt.h }, (c) => {
        drawText(c, S, tx(S, 1 + i), tx1, yy, { ...ho, color: isDone ? k.muted : k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: room / f.W });
        const ks = isDone ? kin(S, d + 0.5, 0.4) : 0;
        if (ks > 0) { c.globalAlpha = fo(S); c.strokeStyle = rgba(k.ink, 0.5); c.lineWidth = 3 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx1, yy + 2 * u); c.lineTo(tx1 + tw * ks, yy + 2 * u); c.stroke(); }
      });
    } }],
    [56 * u, (y) => pill(ctx, S, tx(S, 4), x0, y + 28 * u, { o: sized(TY.strong, 32), bg: k.acc2, ink: '#111111', h: 56, delay: 1.5, maxW: cw })],
  ], 36 * u);
}

// Speedrun: the run's time big in the middle, a pace tag, and the splits under it.
function speedrun(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), n = 3, rowH = 70 * u;
  const to = { ...ORB, size: f.tall ? 110 : 140 }, mt = measure(ctx, S, tx(S, 8), to);
  const hb = block(ctx, S, [label(tx(S, 0), k), { text: tx(S, 1), o: sized(TY.strong, 36), color: k.muted, gap: 10, anim: 'fade', delay: 0.2 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [mt.h, (y) => animText(ctx, S, tx(S, 8), x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'fade', delay: 0.3, maxWidth: cw / f.W })],
    [56 * u, (y) => pill(ctx, S, tx(S, 9), x0, y + 28 * u, { o: sized(TY.strong, 30), bg: '#22c55e', ink: '#ffffff', h: 56, delay: 0.8, maxW: cw })],
    [rowH * n, (y) => { for (let i = 0; i < n; i++) {
      const yy = y + rowH * i + rowH / 2, d = 0.9 + i * 0.2;
      line(ctx, x0, yy + rowH / 2, x0 + cw, yy + rowH / 2, kin(S, d, 0.4) * fo(S), rgba(k.ink, 0.14), 2 * u);
      animText(ctx, S, tx(S, 2 + i * 2), x0, yy, { ...sized(TY.strong, 38), color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (cw * 0.6) / f.W });
      animText(ctx, S, tx(S, 3 + i * 2), x0 + cw, yy, { ...sized(TY.num, 36), color: k.acc, align: 'right', anim: 'fade', delay: d + 0.1, maxWidth: (cw * 0.35) / f.W });
    } }],
  ], 26 * u);
}

// New Item: a card with a glowing edge, a gem, the rarity, the item's name and what it does.
function newItem(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), w = Math.min(cw, f.tall ? cw : 760 * u), pad = 50 * u, R = 90 * u;
  const b = block(ctx, S, [
    { pill: tx(S, 1), o: sized(TY.label, 26), bg: k.acc, ink: k.on, h: 52, delay: 0.7 },
    { text: tx(S, 2), o: { ...ORB, size: f.tall ? 60 : 64 }, color: k.ink, gap: 22, delay: 0.8 },
    { text: tx(S, 3), o: sized(TY.body, 34), color: k.muted, gap: 16, anim: 'fade', delay: 1.1 },
  ], w - pad * 2);
  const h = pad + R * 2 + 30 * u + b.h + pad, x = f.W / 2 - w / 2, y = f.H / 2 - (h + 70 * u) / 2 + 70 * u;
  animText(ctx, S, tx(S, 0), f.W / 2, y - 40 * u, { ...PIX, size: 26, color: k.acc, anim: 'fade', delay: 0.1, maxWidth: cw / f.W });
  piece(ctx, { x: x - 20 * u, y: y - 20 * u, w: w + 40 * u, h: h + 40 * u }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.2) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(f.W / 2, y + h / 2); c.scale(kk, kk); c.translate(-f.W / 2, -(y + h / 2));
    c.shadowColor = k.acc; c.shadowBlur = (30 + Math.sin(S.t * 3) * 12) * u;
    c.fillStyle = k.dark ? '#151824' : '#ffffff'; roundRect(c, x, y, w, h, 28 * u); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = k.acc; c.lineWidth = 4 * u; roundRect(c, x, y, w, h, 28 * u); c.stroke();
    c.fillStyle = rgba(k.acc, 0.16); c.beginPath(); c.arc(f.W / 2, y + pad + R, R, 0, Math.PI * 2); c.fill();
    glyph(c, 'gem', f.W / 2, y + pad + R + Math.sin(S.t * 2) * 6 * u, R * 0.7, k.acc, 1, u);
    c.restore();
  });
  b.draw(f.W / 2, y + pad + R * 2 + 30 * u, 'center');
}

// Next Objective: a little map, a dotted route drawing itself to a marker, the place and how far.
function mapMarker(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = f.tall ? cw : Math.min(cw * 0.48, 680 * u), mh = mw * (f.tall ? 0.62 : 0.72);
  beside(ctx, S, f, { vw: mw, vh: mh, gap: 70 }, () => [
    label(tx(S, 0), k, 0.6),
    { text: tx(S, 1), o: { ...ORB, size: f.tall ? 64 : f.square ? 52 : 70 }, color: k.ink, gap: 16, delay: 0.7 },
    { text: tx(S, 2), o: sized(TY.strong, 36), color: k.muted, gap: 18, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - mw / 2, y: cy - mh / 2, w: mw, h: mh }, (c) => {
    const kk = kin(S, 0.1, 0.5); if (kk <= 0) return;
    const x = cx - mw / 2, y = cy - mh / 2;
    c.globalAlpha = fo(S) * kk; c.fillStyle = k.dark ? 'rgba(34,211,238,0.10)' : 'rgba(14,116,144,0.10)'; roundRect(c, x, y, mw, mh, 26 * u); c.fill();
    c.fillStyle = k.dark ? 'rgba(163,230,53,0.22)' : 'rgba(22,163,74,0.18)';
    for (const [ex, ey, rx, ry] of [[0.28, 0.35, 0.2, 0.22], [0.66, 0.62, 0.24, 0.26], [0.75, 0.25, 0.12, 0.12]]) { c.beginPath(); c.ellipse(x + mw * ex, y + mh * ey, mw * rx, mh * ry, 0.3, 0, Math.PI * 2); c.fill(); }
    const P = [[0.14, 0.82], [0.3, 0.6], [0.48, 0.66], [0.6, 0.42], [0.8, 0.3]].map(([a, b]) => [x + mw * a, y + mh * b]);
    const p = kin(S, 0.4, 1.4, ease.inOutCubic) * (P.length - 1);
    c.fillStyle = k.ink;
    for (let s = 0; s < p; s += 0.12) { const i = Math.floor(s), t = s - i, a = P[i], b = P[Math.min(i + 1, P.length - 1)]; c.beginPath(); c.arc(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 5 * u, 0, Math.PI * 2); c.fill(); }
    const e = P[P.length - 1], km = ease.outBack(clamp((S.t - 1.8) / 0.4));
    if (km > 0) { c.strokeStyle = k.acc2; c.lineWidth = 10 * u; c.lineCap = 'round'; const s = 22 * u * km; c.beginPath(); c.moveTo(e[0] - s, e[1] - s); c.lineTo(e[0] + s, e[1] + s); c.moveTo(e[0] + s, e[1] - s); c.lineTo(e[0] - s, e[1] + s); c.stroke(); }
  }));
}

// Chat Highlights: three messages pop up like chat, each with a coloured name.
function chatHighlights(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), pad = 30 * u, gap = 22 * u, cols = [k.acc, k.acc2, '#22c55e'];
  const mo = sized(TY.body, f.tall ? 38 : 40), no = sized(TY.strong, 32), tw = cw - pad * 2;
  const msgs = [0, 1, 2].map((i) => { const t = wrapO(ctx, S, tx(S, 2 + i * 2), mo, tw / f.W); return { t, h: pad * 2 + 36 * u + 10 * u + measure(ctx, S, t, mo).h }; });
  const tH = measure(ctx, S, tx(S, 0), { ...ORB, size: 64 }).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), x0, y + tH / 2, { ...ORB, size: 64, color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [msgs.reduce((a, m) => a + m.h, 0) + gap * 2, (y) => { let yy = y; msgs.forEach((m, i) => {
      const d = 0.4 + i * 0.45;
      card(ctx, S, { x: x0, y: yy, w: cw, h: m.h }, { color: k.surf, delay: d, r: 22, rise: 40, border: k.dark ? null : rgba(k.ink, 0.07) });
      animText(ctx, S, tx(S, 1 + i * 2), x0 + pad, yy + pad + 18 * u, { ...no, color: cols[i], align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: tw / f.W });
      animText(ctx, S, m.t, x0 + pad, yy + pad + 36 * u + 10 * u + (m.h - pad * 2 - 46 * u) / 2, { ...mo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: tw / f.W });
      yy += m.h + gap;
    }); }],
  ], 34 * u);
}

// Clip of the Week: a frame with a play button, the clip's name and who played it.
function clipOfWeek(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), vw = f.tall ? cw : Math.min(cw * (f.square ? 0.42 : 0.5), 720 * u), vh = vw * 0.5625;
  beside(ctx, S, f, { vw, vh, gap: 70 }, () => [
    { pill: tx(S, 0), o: sized(TY.label, 26), bg: k.acc, ink: k.on, h: 52, delay: 0.5 },
    { text: tx(S, 1), o: { ...sized(TY.big, f.tall ? 80 : f.square ? 60 : 84), font: 'Bebas Neue', fontFixed: true, weight: 400 }, color: k.ink, gap: 20, delay: 0.6 },
    { text: tx(S, 2), o: sized(TY.strong, 36), color: k.acc2, gap: 16, anim: 'fade', delay: 1.0 },
  ], (cx, cy) => piece(ctx, { x: cx - vw / 2 - 12 * u, y: cy - vh / 2 - 12 * u, w: vw + 24 * u, h: vh + 24 * u }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.rotate((1 - Math.min(1, kk)) * -0.1 - 0.02); c.scale(kk, kk);
    c.fillStyle = k.acc2; roundRect(c, -vw / 2 - 12 * u, -vh / 2 - 12 * u, vw + 24 * u, vh + 24 * u, 26 * u); c.fill();
    const g = c.createLinearGradient(-vw / 2, -vh / 2, vw / 2, vh / 2); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#4c1d95');
    c.fillStyle = g; roundRect(c, -vw / 2, -vh / 2, vw, vh, 18 * u); c.fill();
    const pr = Math.min(vh * 0.2, 64 * u); c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.arc(0, 0, pr, 0, Math.PI * 2); c.fill(); glyph(c, 'play', 4 * u, 0, pr * 0.62, '#111827', 1, u);
    c.restore();
  }));
}

// Rank Up: a shield badge with chevrons stacking up, the new rank and a line about it.
function rankUp(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 170 : f.square ? 120 : 160) * u;
  beside(ctx, S, f, { vw: R * 2, vh: R * 2.2, gap: 80 }, () => [
    label(tx(S, 0), k, 0.8),
    { text: tx(S, 1), o: { ...ORB, size: f.tall ? 72 : f.square ? 60 : 84 }, color: k.ink, gap: 16, delay: 0.9 },
    { text: tx(S, 2), o: TY.body, color: k.muted, gap: 18, anim: 'fade', delay: 1.2 },
  ], (cx, cy) => piece(ctx, { x: cx - R, y: cy - R * 1.1, w: R * 2, h: R * 2.2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
    c.globalAlpha = fo(S); c.save(); c.translate(cx, cy); c.scale(kk, kk);
    glyph(c, 'shield', 0, 0, R * 1.25, k.acc, 1, u);
    c.strokeStyle = k.on; c.lineWidth = R * 0.12; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 3; i++) { const kc = clamp((S.t - 0.5 - i * 0.18) / 0.25); if (kc <= 0) continue; const yy = R * (0.35 - i * 0.3) + (1 - kc) * 20 * u; c.globalAlpha = fo(S) * kc; c.beginPath(); c.moveTo(-R * 0.38, yy + R * 0.12); c.lineTo(0, yy - R * 0.12); c.lineTo(R * 0.38, yy + R * 0.12); c.stroke(); }
    c.restore();
  }));
}

// Respawning: a ring runs down while the seconds left count to zero, with a line under it.
function respawn(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, R = (f.tall ? 200 : 170) * u;
  const T = Math.max(1, S.d - 1.6), left = T - clamp(S.t - 0.6, 0, T);
  const to = { ...ORB, size: f.tall ? 72 : 84 }, mt = measure(ctx, S, tx(S, 0), to);
  column(f, [
    [mt.h, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + mt.h / 2, { ...to, color: k.ink, anim: 'up', delay: 0.1, maxWidth: mw })],
    [R * 2, (y) => {
      const cx = f.W / 2, cy = y + R;
      piece(ctx, { x: cx - R, y, w: R * 2, h: R * 2 }, (c) => {
        const kk = kin(S, 0.2, 0.5); if (kk <= 0) return;
        c.globalAlpha = fo(S); c.lineWidth = 18 * u; c.lineCap = 'round';
        c.strokeStyle = rgba(k.ink, 0.12); c.beginPath(); c.arc(cx, cy, R - 9 * u, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = k.acc; c.beginPath(); c.arc(cx, cy, R - 9 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk * (left / T)); c.stroke();
      });
      animText(ctx, S, String(Math.ceil(left - 1e-6)), cx, cy, { ...ORB, size: f.tall ? 130 : 120, color: k.ink, anim: 'pop', delay: 0.3, maxWidth: (R * 1.3) / f.W });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 1), f.W / 2, y + 20 * u, { ...sized(TY.strong, 40), color: k.ink, anim: 'fade', delay: 0.6, maxWidth: mw })],
    [36 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 18 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 0.9, maxWidth: mw })],
  ], 34 * u);
}

// Question for Chat: the question, three lettered choices, and how to answer.
function chatQuestion(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), across = !f.tall && !f.square, n = 3, gap = 24 * u, ch = 120 * u, r = 34 * u;
  const pw = across ? (cw - gap * 2) / 3 : cw, cols = [k.acc, k.acc2, '#22c55e'];
  const hb = block(ctx, S, [label(tx(S, 0), k), { text: tx(S, 1), o: sized(TY.title, f.tall ? 62 : 70), color: k.ink, gap: 16, delay: 0.2 }], cw);
  column(f, [
    [hb.h, (y) => hb.draw(x0, y, 'left')],
    [across ? ch : ch * n + gap * (n - 1), (y) => { for (let i = 0; i < n; i++) {
      const bx = across ? x0 + i * (pw + gap) : x0, by = across ? y : y + i * (ch + gap), d = 0.6 + i * 0.2;
      card(ctx, S, { x: bx, y: by, w: pw, h: ch }, { color: k.surf, delay: d, r: 22, border: rgba(cols[i], 0.6), inner: (c, kk) => { c.fillStyle = cols[i]; c.beginPath(); c.arc(bx + 30 * u + r, by + ch / 2, r, 0, Math.PI * 2); c.fill(); drawText(c, S, 'ABC'[i], bx + 30 * u + r, by + ch / 2 + 2 * u, { ...sized(TY.num, 32), color: '#111111', align: 'center', ...still0, alpha: kk }); } });
      animText(ctx, S, tx(S, 2 + i), bx + 30 * u + r * 2 + 22 * u, by + ch / 2, { ...sized(TY.head, 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.15, maxWidth: (pw - 30 * u - r * 2 - 52 * u) / f.W });
    } }],
    [40 * u, (y) => animText(ctx, S, tx(S, 5), x0, y + 20 * u, { ...sized(TY.strong, 38), color: k.acc, align: 'left', anim: 'fade', delay: 1.4, maxWidth: cw / f.W })],
  ], 36 * u);
}

// Checkpoint: a flag runs up its pole, then CHECKPOINT, Progress saved with a turning save mark, and where.
function checkpoint(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), R = (f.tall ? 170 : f.square ? 120 : 150) * u;
  beside(ctx, S, f, { vw: R * 1.6, vh: R * 2.2, gap: 80 }, () => [
    { text: tx(S, 0), o: { ...PIX, size: f.tall ? 44 : f.square ? 36 : 48 }, color: k.acc, delay: 0.7, anim: 'fade' },
    { text: tx(S, 1), o: sized(TY.title, f.tall ? 64 : f.square ? 56 : 72), color: k.ink, gap: 24, delay: 0.9 },
    { text: tx(S, 2), o: TY.body, color: k.muted, gap: 18, anim: 'fade', delay: 1.2 },
  ], (cx, cy) => piece(ctx, { x: cx - R * 0.8, y: cy - R * 1.1, w: R * 1.6, h: R * 2.2 }, (c) => {
    const kk = kin(S, 0.05, 0.4); if (kk <= 0) return;
    c.globalAlpha = fo(S); const px = cx - R * 0.45, top = cy - R, base = cy + R;
    c.fillStyle = rgba(k.ink, 0.8); c.fillRect(px - 5 * u, top + (base - top) * (1 - kk), 10 * u, (base - top) * kk);
    c.fillRect(px - 50 * u, base - 4 * u, 100 * u, 14 * u);
    const kf = kin(S, 0.4, 0.8, ease.outBack), fy = lerp(base - R * 0.7, top + 10 * u, Math.min(1, kf));
    if (kf > 0) { c.fillStyle = k.acc; c.beginPath(); c.moveTo(px + 5 * u, fy); for (let s = 0; s <= 10; s++) { const xx = px + 5 * u + (R * 1.1 * s) / 10; c.lineTo(xx, fy + Math.sin(s * 0.8 + S.t * 6) * 8 * u); } for (let s = 10; s >= 0; s--) { const xx = px + 5 * u + (R * 1.1 * s) / 10; c.lineTo(xx, fy + R * 0.6 + Math.sin(s * 0.8 + S.t * 6) * 8 * u); } c.closePath(); c.fill(); }
  }));
}

// Loot: a coin spins in, the count goes up, then what it is and a NEW RECORD tag.
function loot(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W, R = 80 * u;
  const no = { ...ORB, size: f.tall ? 120 : 150 }, mN = measure(ctx, S, tx(S, 1), no), nH = mN.h * Math.min(1, cw / mN.w);
  column(f, [
    [R * 2, (y) => piece(ctx, { x: f.W / 2 - R, y, w: R * 2, h: R * 2 }, (c) => {
      const kk = ease.outBack(clamp((S.t - 0.1) / 0.5)); if (kk <= 0) return;
      const sx = Math.abs(Math.cos(S.t * 4)) * 0.8 + 0.2;
      c.globalAlpha = fo(S); c.save(); c.translate(f.W / 2, y + R); c.scale(sx * kk, kk);
      c.fillStyle = '#facc15'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ca8a04'; c.lineWidth = 8 * u; c.beginPath(); c.arc(0, 0, R * 0.72, 0, Math.PI * 2); c.stroke();
      c.restore();
    })],
    [nH, (y) => animText(ctx, S, countUp(tx(S, 1), kin(S, 0.4, 1.4, ease.outQuart)), f.W / 2, y + nH / 2, { ...no, color: k.ink, anim: 'fade', delay: 0.3, maxWidth: mw })],
    [44 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 22 * u, { ...sized(TY.strong, 40), color: k.muted, anim: 'fade', delay: 0.8, maxWidth: mw })],
    [56 * u, (y) => pill(ctx, S, tx(S, 3), f.W / 2, y + 28 * u, { o: { ...PIX, size: 22 }, bg: k.acc2, ink: '#111111', align: 'center', h: 56, delay: 1.8, maxW: cw })],
  ], 30 * u);
}

// ================= the list =================
const sw = [['sfx-swipe', 0.1]], pop = [['sfx-pop', 0.15]], coin = [['sfx-coin', 0.3]];
seq('press-start', 'Press Start', 'intro', 'arcade', { sfx: [['sfx-coin', 0.2], ['sfx-level-up', 1.3]], texts: ['Pixel Quest', 'Episode 7', 'Press start'] }, pressStart);
seq('press-start-end', 'Game Over', 'outro', 'arcade', { sfx: [['sfx-coin', 0.2]], texts: ['Game Over', 'Thanks for playing along', 'Continue?'] }, pressStart);
seq('neon-grid', 'Neon Grid', 'intro', 'neon', { sfx: [['sfx-riser', 0.0], ['sfx-boom', 0.6]], texts: ['Night Run', 'A new series starts now', 'Episode 1'] }, neonGrid);
seq('neon-grid-end', 'Neon Grid Sign-off', 'outro', 'neon', { texts: ['See You Next Run', 'New episodes every Friday', 'Episode 1'] }, neonGrid);
seq('level-up', 'Level Up', 'intro', 'esports', { sfx: [['sfx-level-up', 1.15]], texts: ['Level Up!', 'GameNight with Alex', 'LV 25'] }, levelUp);
seq('level-up-end', 'Level Up Sign-off', 'outro', 'esports', { sfx: [['sfx-level-up', 1.15]], texts: ['GG!', 'Thanks for watching', 'LV 26'] }, levelUp);
seq('glitch', 'Glitch Mode', 'intro', 'terminal', { sfx: [['sfx-glitch', 0.2]], texts: ['Glitch Mode', 'Weekly highlights', 'S2 · E14'] }, glitchLogo);
seq('glitch-end', 'Signal Lost', 'outro', 'terminal', { sfx: [['sfx-glitch', 0.2]], texts: ['Signal Lost', 'Thanks for watching', 'S2 · E14'] }, glitchLogo);
seq('versus', 'Versus', 'intro', 'esports', { sfx: [['sfx-whoosh', 0.1], ['sfx-boom', 0.8]], texts: ['Team Nova', 'Team Blaze', 'VS', 'Grand Final · Best of 5'] }, versus);
seq('versus-end', 'Final Score', 'outro', 'esports', { sfx: [['sfx-applause', 0.8]], texts: ['Team Nova', 'Team Blaze', '3–2', 'Team Nova win the final'] }, versus);
seq('lets-play', 'Let’s Play', 'intro', 'pastel', { sfx: [['sfx-boing', 0.3], ['sfx-pop', 0.6]], texts: ['Let’s Play!', 'Tonight: Island Builders', 'Live at 8 pm'] }, letsPlay);
seq('lets-play-end', 'Thanks for Playing', 'outro', 'pastel', { sfx: [['sfx-boing', 0.3]], texts: ['Thanks for Playing!', 'Next time: Island Builders, part 2', 'Every Friday at 8 pm'] }, letsPlay);
seq('hearts', 'Retro Hearts', 'intro', 'tunnel', { sfx: [['sfx-coin', 0.3], ['sfx-coin', 0.5], ['sfx-coin', 0.7]], texts: ['Lives: 5', 'Retro Saturday', 'Classic games, every week'] }, hearts);
seq('hearts-end', 'Retro Hearts Sign-off', 'outro', 'tunnel', { texts: ['Lives: 5', 'See You Next Week', 'Retro Saturday'] }, hearts);
seq('loading', 'Loading Screen', 'intro', 'hex', { sfx: [['sfx-riser', 0.3]], texts: ['Loading…', 'Survival Season', 'Tip: build your shelter before night falls'] }, loading);
seq('loading-end', 'Saving Screen', 'outro', 'hex', { texts: ['Saving…', 'See you next episode', 'Tip: subscribe so you never miss a day'] }, loading);
seq('starting', 'Starting Soon', 'intro', 'neonFlat', { sfx: [['sfx-notify', 0.1]], texts: ['Starting Soon', 'GameNight with Alex', 'Grab a snack, we’re live in a moment'] }, startingSoon);
seq('starting-end', 'Stream Ending', 'outro', 'neonFlat', { sfx: [['sfx-notify', 0.1]], texts: ['Stream Ending', 'Thanks for hanging out', 'Same time next week'] }, startingSoon);
seq('boss', 'Boss Warning', 'intro', 'arcade', { sfx: [['sfx-heartbeat', 0.0], ['sfx-boom', 1.0]], texts: ['Warning', 'The Iron Golem', 'Final boss · Episode 12'] }, bossWarning);
seq('boss-end', 'Victory', 'outro', 'arcade', { sfx: [['sfx-success', 1.0]], texts: ['Victory', 'The Iron Golem is defeated', 'Next: the Shadow Keep'] }, bossWarning);
// Mid-rolls
seq('achievement', 'Achievement Unlocked', 'mid', 'esports', { sfx: [['sfx-success', 0.35]], texts: ['Achievement unlocked', 'Master Builder', 'Build 100 houses in one world'] }, achievement);
seq('patch', 'Patch Notes', 'mid', 'termFlat', { dur: 7, sfx: sw, texts: ['Patch notes', 'Version 2.4', '+ New desert map', '+ Two new characters', '− Long loading times fixed', '~ Faster matchmaking'] }, patchNotes);
seq('tier', 'Tier List', 'mid', 'pastel', { dur: 7, sfx: pop, texts: ['Tier list', 'Best starter characters', 'S', 'Rook, Ivy', 'A', 'Bolt, Mara, Finn', 'B', 'Juno', 'C', 'Echo, Pax'] }, tierList);
seq('controls', 'Controls', 'mid', 'hex', { dur: 7, sfx: [['sfx-click', 0.4], ['sfx-click', 0.6], ['sfx-click', 0.8], ['sfx-click', 1.0]], texts: ['Controls', 'W A S D', 'Move', 'Space', 'Jump', 'E', 'Use', 'Shift', 'Sprint'] }, controls);
seq('loadout', 'Loadout', 'mid', 'esports', { sfx: pop, texts: ['Loadout', 'Primary', 'Storm Rifle', 'Secondary', 'Arc Pistol', 'Gadget', 'Shield Drone'] }, loadout);
seq('player', 'Player Card', 'mid', 'neonFlat', { dur: 7, sfx: [['sfx-whoosh', 0.1]], texts: ['Player card', 'NovaStrike', 'Diamond rank', 'NS', '312', 'wins', '4.2', 'K/D', '86h', 'played'] }, playerCard);
seq('boss-fight', 'Boss Fight', 'mid', 'arcade', { sfx: [['sfx-boom', 0.4]], texts: ['Boss fight', 'The Iron Golem', 'Weak spot: the glowing core'] }, bossFight);
seq('tip', 'Pro Tip', 'mid', 'tunnel', { dur: 7, sfx: [['sfx-typing', 0.6]], texts: ['Pro tip', 'Hold jump to glide over the lava pits.'] }, proTip);
seq('match', 'Match Up', 'mid', 'esports', { sfx: [['sfx-hit', 0.8]], texts: ['Next match', 'NovaStrike', 'BlazeQueen', 'VS', 'Semi-final · Best of 3'] }, matchUp);
seq('quest', 'Quest Log', 'mid', 'pastel', { dur: 7, sfx: [['sfx-ding', 0.9], ['sfx-ding', 1.2]], texts: ['Quest log', 'Find the lost map', 'Cross the frozen river', 'Light the beacon', 'Reward: Golden Compass', '2'] }, questLog);
seq('speedrun', 'Speedrun Splits', 'mid', 'hex', { dur: 7, sfx: [['sfx-tick', 0.3]], texts: ['Speedrun', 'Any% · current run', 'Forest', '1:42', 'Castle', '4:05', 'Final boss', '7:31', '7:31.42', 'On world-record pace'] }, speedrun);
seq('new-item', 'New Item', 'mid', 'tunnel', { sfx: [['sfx-magic', 0.2]], texts: ['New item!', 'Legendary', 'Starfall Blade', '+40 attack · glows in the dark'] }, newItem);
seq('map', 'Next Objective', 'mid', 'termFlat', { dur: 7, sfx: [['sfx-ding', 1.8]], texts: ['Next objective', 'Sunken Temple', '2.4 km north-east'] }, mapMarker);
seq('chat', 'Chat Highlights', 'mid', 'neonFlat', { dur: 7, sfx: [['sfx-bubble', 0.4], ['sfx-bubble', 0.85], ['sfx-bubble', 1.3]], texts: ['Chat highlights', 'PixelPanda', 'That jump was unbelievable!', 'Mo_Plays', 'Do the secret level next', 'Gigi', 'GG everyone'] }, chatHighlights);
seq('clip', 'Clip of the Week', 'mid', 'pastel', { sfx: [['sfx-whoosh', 0.1]], texts: ['Clip of the week', 'The Impossible Comeback', 'Played by BlazeQueen'] }, clipOfWeek);
seq('rank-up', 'Rank Up', 'mid', 'hex', { sfx: [['sfx-level-up', 0.5]], texts: ['Rank up', 'Platinum III', 'Top 5% of players this season'] }, rankUp);
seq('respawn', 'Respawning', 'mid', 'arcade', { sfx: [['sfx-tick', 0.6]], texts: ['Respawning', 'Back in a moment', 'Hang tight and grab a drink'] }, respawn);
seq('question', 'Question for Chat', 'mid', 'esports', { dur: 7, sfx: pop, texts: ['Question for chat', 'Which class should I play next?', 'Knight', 'Ranger', 'Mage', 'Vote in the chat!'] }, chatQuestion);
seq('checkpoint', 'Checkpoint', 'mid', 'pastel', { sfx: [['sfx-success', 0.9]], texts: ['Checkpoint', 'Progress saved', 'Chapter 3: The Ice Caves'] }, checkpoint);
seq('loot', 'Loot Collected', 'mid', 'tunnel', { sfx: [...coin, ['sfx-coin', 0.6], ['sfx-coin', 0.9], ['sfx-success', 1.8]], texts: ['Loot', '1,250', 'coins collected this run', 'New record!'] }, loot);

export const GAME_SEQS = L;
