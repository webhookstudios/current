// Education mid-rolls: short full-screen pieces for the middle of a lesson (a key term, a quick quiz,
// a recap...). Every word is editable text, every part can be moved, and each works in 16:9, 9:16 and 1:1.
import {
  tx, col, kin, kend, lerp, frame, TY, sized, stack, pill, card, checkBadge, glyph, iconDisc, countUp, numOf, listOf,
  wrapO, measure, animText, drawText, piece, line, roundRect, growRect, traceRect, ease, clamp, rgba,
  K, area, fo, header, para, column,
} from './scenekit.js';

const L = [];
const seq = (id, name, theme, o, draw) => L.push({ id, name, cat: 'Education', dur: 6, bg: TH[theme].bg, colors: TH[theme].c, ...o, draw });

// Colour sets: [text, accent, second accent, muted text, card, text on the accent]. Text, card and
// muted colours are neutral, so a brand kit only swaps the two accents.
const TH = {
  paper: { bg: ['bg-white', '#fbf8f1'], c: ['#1c2026', '#2563eb', '#f59e0b', '#6b7280', '#ffffff', '#ffffff'] },
  chalk: { bg: ['bg-chalkboard', '#2f3e36'], c: ['#f8fafc', '#fde68a', '#93c5fd', '#d4d8dd', '#ffffff', '#1c2026'] },
  navy: { bg: ['bg-navy', '#0f1e36'], c: ['#ffffff', '#ffb703', '#4cc9f0', '#aab4c0', '#ffffff', '#111827'] },
  mint: { bg: ['bg-white', '#eefaf4'], c: ['#12201b', '#059669', '#f97316', '#5f6b66', '#ffffff', '#ffffff'] },
  lilac: { bg: ['bg-white', '#f4f2fd'], c: ['#17141f', '#7c3aed', '#ec4899', '#6b6880', '#ffffff', '#ffffff'] },
  sun: { bg: ['bg-white', '#fff8e6'], c: ['#1f1a10', '#e85d04', '#2563eb', '#6f6655', '#ffffff', '#ffffff'] },
};

// ---------- the scenes ----------

// Key Term: the word with a highlighter swipe under it, its kind, and the meaning.
function keyTerm(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const to = sized(TY.big, f.tall ? 110 : 130);
  const mT = measure(ctx, S, tx(S, 1), to), fit = Math.min(1, cw / mT.w), tH = mT.h * fit;
  const mD = para(ctx, S, tx(S, 3), 0, 0, sized(TY.body, 44), k.ink, mw * 0.92, { draw: false });
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), x0, y + 27 * u, { bg: k.acc, ink: k.on, delay: 0.1 })],
    [tH, (y) => {
      const hw = mT.w * fit;
      growRect(ctx, x0 - 10 * u, y + tH * 0.52, hw + 20 * u, tH * 0.4, kin(S, 0.7, 0.6, ease.inOutCubic), 'l', rgba(k.acc2, 0.45), 6 * u, fo(S));
      animText(ctx, S, tx(S, 1), x0, y + tH / 2, { ...to, color: k.ink, align: 'left', maxWidth: mw, anim: 'up', delay: 0.25, inDur: 0.5, stagger: 0.012 });
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 20 * u, { ...sized(TY.body, 36), font: 'Playfair Display', weight: 400, color: k.muted, align: 'left', anim: 'fade', delay: 0.9, maxWidth: mw })],
    [mD.h, (y) => para(ctx, S, tx(S, 3), x0, y, sized(TY.body, 44), k.ink, mw * 0.92, { delay: 1.2, top: true })],
  ], 26 * u);
}

// Quick Quiz: a question and four answers; after a moment the right one lights up with a tick.
function quickQuiz(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const right = 'ABCD'.indexOf(String(tx(S, 6)).trim().toUpperCase()[0]);
  const reveal = 3.6;
  const grid = !f.tall;
  const gap = 24 * u, ch = 104 * u;
  const colW = grid ? (cw - gap) / 2 : cw;
  const hH = header(ctx, S, f, k, { icon: 'question', tag: tx(S, 0), title: tx(S, 1), x: x0, y: 0, maxW: cw / f.W, size: f.tall ? 62 : 66, draw: false });
  const gridH = grid ? ch * 2 + gap : ch * 4 + gap * 3;
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon: 'question', tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: cw / f.W, size: f.tall ? 62 : 66 })],
    [gridH, (y) => {
      for (let i = 0; i < 4; i++) {
        const cx = x0 + (grid ? (i % 2) * (colW + gap) : 0), cy = y + (grid ? Math.floor(i / 2) : i) * (ch + gap);
        const d = 0.9 + i * 0.15, isRight = i === right;
        const lit = kin(S, reveal, 0.35), dim = isRight ? 0 : lit;
        card(ctx, S, { x: cx, y: cy, w: colW, h: ch }, { color: k.surf, border: rgba(k.ink, 0.12), delay: d, r: 18, inner: (c) => {
          c.globalAlpha *= 1 - dim * 0.55;
          if (isRight && lit > 0) { c.fillStyle = rgba(k.acc2, lit); roundRect(c, cx, cy, colW, ch, 18 * u); c.fill(); }
          const r = 30 * u, bx = cx + 26 * u + r, by = cy + ch / 2;
          if (isRight && lit > 0.5) checkBadge(c, bx, by, r, 1, '#ffffff', k.acc2, u);
          else { c.fillStyle = k.acc; c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill(); drawText(c, S, 'ABCD'[i], bx, by + u, { ...sized(TY.num, 30), color: k.on, align: 'center', anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 }); }
        } });
        animText(ctx, S, tx(S, 2 + i), cx + 26 * u + 60 * u + 24 * u, cy + ch / 2, { ...TY.strong, size: 40, color: isRight && kin(S, reveal, 0.35) > 0.5 ? '#ffffff' : k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (colW - 26 * u - 60 * u - 24 * u - 30 * u) / f.W, alpha: 1 - dim * 0.55 });
      }
    }],
  ], 48 * u);
}

// True or False: a statement, two big answers, the right one lights up, then why.
function trueFalse(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const ans = String(tx(S, 4)).trim().toLowerCase(), rightI = ans === String(tx(S, 3)).trim().toLowerCase() ? 1 : 0;
  const reveal = 3.2, lit = kin(S, reveal, 0.35);
  const mS = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 60 : 68), k.ink, mw, { draw: false });
  const mE = para(ctx, S, tx(S, 5), 0, 0, TY.body, k.muted, mw, { draw: false });
  const bw = Math.min((cw - 30 * u) / 2, 420 * u), bh = 110 * u;
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { bg: k.acc, ink: k.on, align: 'center', delay: 0.1 })],
    [mS.h, (y) => para(ctx, S, tx(S, 1), f.W / 2, y, sized(TY.title, f.tall ? 60 : 68), k.ink, mw, { align: 'center', delay: 0.3, anim: 'up', top: true })],
    [bh, (y) => [0, 1].forEach((i) => {
      const bx = f.W / 2 + (i ? 15 * u : -15 * u - bw), on = i === rightI;
      const color = i === 0 ? '#16a34a' : '#e11d48';
      card(ctx, S, { x: bx, y, w: bw, h: bh }, { color: on ? rgba(color, 0.15 + 0.85 * lit) : k.surf, border: rgba(color, 0.8), delay: 1.0 + i * 0.15, r: bh / 2, inner: (c) => { c.globalAlpha *= on ? 1 : 1 - lit * 0.6; } });
      animText(ctx, S, tx(S, 2 + i), bx + bw / 2, y + bh / 2, { ...sized(TY.title, 52), color: on && lit > 0.5 ? '#ffffff' : color, anim: 'pop', delay: 1.15 + i * 0.15, stagger: 0, maxWidth: (bw - 60 * u) / f.W, alpha: on ? 1 : 1 - lit * 0.6 });
    })],
    [mE.h, (y) => para(ctx, S, tx(S, 5), f.W / 2, y, TY.body, k.muted, mw, { align: 'center', delay: reveal + 0.4, top: true })],
  ], 40 * u);
}

// Pause and Think: a big pause sign inside a ring that runs down, and the question.
function pauseThink(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = (f.tall ? cw : cw * 0.8) / f.W;
  const R = (f.tall ? 120 : 110) * u;
  const mQ = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 62 : 70), k.ink, mw, { draw: false });
  column(f, [
    [R * 2, (y) => piece(ctx, { x: f.W / 2 - R, y, w: R * 2, h: R * 2 }, (c) => {
      const kk = ease.outBack(clamp((S.t - 0.1) / 0.5));
      if (kk <= 0) return;
      const cx = f.W / 2, cy = y + R;
      c.globalAlpha = fo(S);
      c.fillStyle = rgba(k.acc, 0.14); c.beginPath(); c.arc(cx, cy, R * kk, 0, Math.PI * 2); c.fill();
      const left = 1 - clamp((S.t - 0.8) / Math.max(1, S.d - 1.6));
      c.strokeStyle = k.acc; c.lineWidth = 10 * u; c.lineCap = 'round';
      c.beginPath(); c.arc(cx, cy, R * 0.86 * kk, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); c.stroke();
      glyph(c, 'pause', cx, cy, R * 0.5, k.acc, kk, u);
    })],
    [54 * u, (y) => pill(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { bg: k.acc, ink: k.on, align: 'center', delay: 0.4 })],
    [mQ.h, (y) => para(ctx, S, tx(S, 1), f.W / 2, y, sized(TY.title, f.tall ? 62 : 70), k.ink, mw, { align: 'center', delay: 0.6, anim: 'up', top: true })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.2, maxWidth: mw })],
  ], 32 * u);
}

// Did You Know?: a light bulb lights up and the fact appears beside it (under it on tall frames).
function didYouKnow(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const R = 110 * u, side = !f.tall;
  const tw = side ? cw - R * 2 - 70 * u : cw, mw = tw / f.W;
  const bulb = (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5));
    if (kk <= 0) return;
    c.globalAlpha = fo(S);
    const glow = 0.5 + 0.5 * Math.sin(S.t * 3);
    for (let i = 3; i >= 1; i--) { c.fillStyle = rgba(k.acc, 0.07 * i * (0.7 + 0.3 * glow) * clamp((S.t - 0.4) * 2)); c.beginPath(); c.arc(cx, cy, R * (0.6 + i * 0.13) * kk, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = k.acc; c.beginPath(); c.arc(cx, cy, R * 0.6 * kk, 0, Math.PI * 2); c.fill();
    glyph(c, 'bulb', cx, cy, R * 0.36, k.on, kk, u);
  });
  const mF = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 64 : 70), k.ink, mw, { draw: false });
  const textH = 54 * u + 28 * u + mF.h;
  const drawText_ = (x, y, align) => {
    pill(ctx, S, tx(S, 0), x, y + 27 * u, { bg: k.acc, ink: k.on, align, delay: 0.5 });
    para(ctx, S, tx(S, 1), x, y + 54 * u + 28 * u, sized(TY.title, f.tall ? 64 : 70), k.ink, mw, { align, delay: 0.75, anim: 'up', top: true });
  };
  if (side) {
    bulb(x0 + R, f.H / 2);
    drawText_(x0 + R * 2 + 70 * u, f.H / 2 - textH / 2, 'left');
  } else column(f, [[R * 2, (y) => bulb(f.W / 2, y + R)], [textH, (y) => drawText_(f.W / 2, y, 'center')]], 40 * u);
}

// Fun Fact: a sticky note, slightly turned, with a strip of tape, on the board.
function funFact(ctx, S) {
  const f = frame(S), u = f.u, k = K(S);
  const nw = Math.min(f.cw, (f.tall ? 900 : 1000) * u), pad = 60 * u, mw = (nw - pad * 2) / f.W;
  const ho = sized(TY.hand, 66), bo = sized(TY.hand, f.tall ? 64 : 70);
  const fact = wrapO(ctx, S, tx(S, 1), bo, mw);
  const mh = measure(ctx, S, tx(S, 0), ho), mf = measure(ctx, S, fact, bo);
  const nh = pad * 1.6 + mh.h + 24 * u + mf.h;
  const x = f.W / 2 - nw / 2, y = f.H / 2 - nh / 2, rot = -0.04;
  piece(ctx, { x, y, w: nw, h: nh }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.55));
    if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.translate(f.W / 2, f.H / 2); c.rotate(rot * kk); c.scale(kk, kk); c.translate(-f.W / 2, -f.H / 2);
    c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 30 * u; c.shadowOffsetY = 12 * u;
    c.fillStyle = k.acc; c.fillRect(x, y, nw, nh);
    c.shadowColor = 'transparent';
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(f.W / 2 - 90 * u, y - 22 * u, 180 * u, 46 * u);
    drawText(c, S, tx(S, 0), x + pad, y + pad * 0.8 + mh.h / 2, { ...ho, color: k.on, align: 'left', maxWidth: mw, anim: 'fade', delay: 0.5, inDur: 0.4 });
    drawText(c, S, fact, x + pad, y + pad * 0.8 + mh.h + 24 * u + mf.h / 2, { ...bo, color: k.on, align: 'left', maxWidth: mw, anim: 'fade', delay: 0.8, inDur: 0.5 });
  });
}

// Step by Step: three numbered cards joined by arrows, across (down on tall frames).
function stepByStep(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const across = !f.tall, n = 3, gap = 60 * u;
  const cwid = across ? (cw - gap * (n - 1)) / n : cw, pad = 34 * u, r = 34 * u;
  const so = sized(TY.strong, f.tall ? 40 : 38);
  const texts = [1, 2, 3].map((i) => wrapO(ctx, S, tx(S, i), so, (cwid - pad * 2 - (across ? 0 : r * 2 + 24 * u)) / f.W));
  const th = Math.max(...texts.map((t) => measure(ctx, S, t, so).h));
  const chh = across ? pad * 2 + r * 2 + 24 * u + th : Math.max(pad * 2 + th, r * 2 + pad * 1.4);
  const hH = header(ctx, S, f, k, { title: tx(S, 0), x: x0, y: 0, maxW: cw / f.W, size: 72, draw: false });
  const gridH = across ? chh : chh * n + gap * (n - 1);
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { title: tx(S, 0), x: across ? x0 : x0, y, maxW: cw / f.W, size: 72 })],
    [gridH, (y) => texts.forEach((t, i) => {
      const bx = across ? x0 + i * (cwid + gap) : x0, by = across ? y : y + i * (chh + gap), d = 0.5 + i * 0.35;
      card(ctx, S, { x: bx, y: by, w: cwid, h: chh }, { color: k.surf, delay: d, r: 22, shadow: k.dark ? 0 : 24, inner: (c) => {
        const cx = across ? bx + pad + r : bx + pad + r, cy = across ? by + pad + r : by + chh / 2;
        c.fillStyle = k.acc; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        drawText(c, S, String(i + 1), cx, cy + u, { ...sized(TY.num, 36), color: k.on, align: 'center', anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 });
      } });
      const tx0 = across ? bx + pad : bx + pad + r * 2 + 24 * u, ty = across ? by + pad + r * 2 + 24 * u + th / 2 : by + chh / 2;
      animText(ctx, S, t, tx0, ty, { ...so, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (cwid - (tx0 - bx) - pad) / f.W });
      if (i < n - 1) piece(ctx, across ? { x: bx + cwid, y: by + chh / 2 - 20 * u, w: gap, h: 40 * u } : { x: bx + cwid / 2 - 20 * u, y: by + chh, w: 40 * u, h: gap }, (c) => {
        const kk = kin(S, d + 0.3, 0.3);
        if (kk <= 0) return;
        c.globalAlpha = fo(S) * kk;
        if (across) glyph(c, 'arrow', bx + cwid + gap / 2, by + chh / 2, 22 * u, k.acc, 1, u);
        else { c.save(); c.translate(bx + cwid / 2, by + chh + gap / 2); c.rotate(Math.PI / 2); glyph(c, 'arrow', 0, 0, 22 * u, k.acc, 1, u); c.restore(); }
      });
    })],
  ], 50 * u);
}

// Common Mistake: the wrong way, crossed out, and the right way with a tick, then why.
function commonMistake(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const bad = '#e11d48', good = '#16a34a', rowH = 120 * u, r = 30 * u;
  const so = sized(TY.title, f.tall ? 52 : 58);
  const hH = header(ctx, S, f, k, { icon: 'cross', tag: tx(S, 0), x: x0, y: 0, maxW: mw, draw: false, tagBg: bad });
  const mE = para(ctx, S, tx(S, 3), 0, 0, TY.body, k.muted, mw, { draw: false });
  const row = (y, text, isBad, d) => {
    card(ctx, S, { x: x0, y, w: cw, h: rowH }, { color: k.surf, delay: d, r: 20, border: rgba(isBad ? bad : good, 0.5), inner: (c) => {
      const kk = ease.outBack(clamp((S.t - d - 0.2) / 0.4));
      if (isBad) { c.fillStyle = bad; c.beginPath(); c.arc(x0 + 30 * u + r, y + rowH / 2, r * kk, 0, Math.PI * 2); c.fill(); glyph(c, 'cross', x0 + 30 * u + r, y + rowH / 2, r * 0.8, '#ffffff', kk, u); }
      else checkBadge(c, x0 + 30 * u + r, y + rowH / 2, r, kk, good, '#ffffff', u);
    } });
    const tx0 = x0 + 30 * u + r * 2 + 28 * u, tmw = (cw - (tx0 - x0) - 34 * u) / f.W;
    const m = measure(ctx, S, text, so), tw = Math.min(m.w, tmw * f.W);
    piece(ctx, { x: tx0, y: y + rowH / 2 - m.h / 2, w: tw, h: m.h }, (c) => {
      drawText(c, S, text, tx0, y + rowH / 2, { ...so, color: isBad ? rgba(k.ink, 0.75) : k.ink, align: 'left', anim: 'fade', delay: d + 0.25, inDur: 0.7, maxWidth: tmw });
      const ks = isBad ? kin(S, d + 0.9, 0.5, ease.inOutCubic) : 0;
      if (ks > 0) { c.globalAlpha = fo(S); c.strokeStyle = bad; c.lineWidth = 6 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx0 - 6 * u, y + rowH / 2 + 2 * u); c.lineTo(tx0 - 6 * u + (tw + 12 * u) * ks, y + rowH / 2 + 2 * u); c.stroke(); }
    });
  };
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon: 'cross', tag: tx(S, 0), x: x0, y, maxW: mw, tagBg: bad })],
    [rowH, (y) => row(y, tx(S, 1), true, 0.5)],
    [rowH, (y) => row(y, tx(S, 2), false, 1.7)],
    [mE.h, (y) => para(ctx, S, tx(S, 3), x0, y, TY.body, k.muted, mw, { delay: 2.4, top: true })],
  ], 30 * u);
}

// Tip: a card with an accent edge and a target icon, and the tip in large type.
function proTip(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const pad = 56 * u, edge = 14 * u, mw = (cw - pad * 2 - edge) / f.W;
  const to = sized(TY.title, f.tall ? 58 : 64);
  const t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const ch = pad * 2 + 64 * u + 30 * u + mt.h, y = f.H / 2 - ch / 2;
  card(ctx, S, { x: x0, y, w: cw, h: ch }, { color: k.surf, delay: 0.1, r: 26, shadow: k.dark ? 0 : 30, inner: (c) => { c.save(); roundRect(c, x0, y, cw, ch, 26 * u); c.clip(); c.fillStyle = k.acc; c.fillRect(x0, y, edge, ch); c.restore(); } });
  header(ctx, S, f, k, { icon: 'target', tag: tx(S, 0), x: x0 + edge + pad, y: y + pad, maxW: mw, delay: 0.3 });
  animText(ctx, S, t, x0 + edge + pad, y + pad + 64 * u + 30 * u + mt.h / 2, { ...to, color: k.ink, align: 'left', maxWidth: mw, anim: 'up', delay: 0.6, inDur: 0.5, stagger: 0.006 });
}

// Formula: an outline draws round the formula as it types in, with a label above and a note below.
function formula(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const fo2 = sized({ font: 'Space Grotesk', fontFixed: true, weight: 700, size: f.tall ? 110 : 140 });
  const mF = measure(ctx, S, tx(S, 1), fo2), fit = Math.min(1, (cw - 120 * u) / mF.w);
  const bw = Math.min(cw, mF.w * fit + 140 * u), bh = mF.h * fit + 90 * u;
  const mN = para(ctx, S, tx(S, 2), 0, 0, TY.body, k.muted, cw / f.W, { draw: false });
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { bg: k.acc, ink: k.on, align: 'center', delay: 0.1 })],
    [bh, (y) => {
      piece(ctx, { x: f.W / 2 - bw / 2, y, w: bw, h: bh }, (c) => { const kk = kin(S, 0.3, 1.0, ease.inOutCubic); if (kk <= 0) return; c.globalAlpha = fo(S); c.strokeStyle = k.acc2; c.lineWidth = 4 * u; traceRect(c, f.W / 2 - bw / 2, y, bw, bh, kk); });
      animText(ctx, S, tx(S, 1), f.W / 2, y + bh / 2, { ...fo2, color: k.ink, anim: 'type', delay: 0.6, stagger: 0.07, cursor: false, maxWidth: (bw - 100 * u) / f.W });
    }],
    [mN.h, (y) => para(ctx, S, tx(S, 2), f.W / 2, y, TY.body, k.muted, cw / f.W, { align: 'center', delay: 1.6, top: true })],
  ], 40 * u);
}

// Worked Example: the problem, then each step on its own line, the answer in a box.
function workedExample(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const so = { font: 'Space Grotesk', fontFixed: true, weight: 500, size: f.tall ? 58 : 64 };
  const steps = [2, 3, 4].map((i) => tx(S, i)), rowH = measure(ctx, S, 'Ag', so).h + 26 * u;
  const hH = header(ctx, S, f, k, { tag: tx(S, 0), title: tx(S, 1), x: x0, y: 0, maxW: mw, size: f.tall ? 64 : 72, draw: false });
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: mw, size: f.tall ? 64 : 72 })],
    [rowH * 3, (y) => steps.forEach((t, i) => {
      const yy = y + rowH * i + rowH / 2, d = 0.9 + i * 0.6, last = i === steps.length - 1;
      piece(ctx, { x: x0, y: yy - 18 * u, w: 36 * u, h: 36 * u }, (c) => { const kk = kin(S, d, 0.3); if (kk <= 0) return; c.globalAlpha = fo(S) * kk; glyph(c, 'arrow', x0 + 18 * u, yy, 18 * u, k.acc, 1, u); });
      const m = measure(ctx, S, t, so), fit = Math.min(1, (cw - 70 * u - 40 * u) / m.w);
      if (last) piece(ctx, { x: x0 + 56 * u, y: yy - rowH / 2 + 4 * u, w: m.w * fit + 40 * u, h: rowH - 8 * u }, (c) => { const kk = kin(S, d + 0.3, 0.4, ease.outExpo); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = rgba(k.acc2, 0.25); roundRect(c, x0 + 56 * u, yy - rowH / 2 + 4 * u, (m.w * fit + 40 * u) * kk, rowH - 8 * u, 12 * u); c.fill(); });
      animText(ctx, S, t, x0 + 76 * u, yy, { ...so, color: k.ink, align: 'left', anim: 'type', delay: d, stagger: 0.03, cursor: false, maxWidth: (cw - 70 * u - 40 * u) / f.W });
    })],
  ], 36 * u);
}

// Your Turn: a pencil, the task, and how long there is to do it.
function yourTurn(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = (f.tall ? cw : cw * 0.8) / f.W;
  const R = 90 * u;
  const mT = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 60 : 68), k.ink, mw, { draw: false });
  column(f, [
    [R * 2, (y) => iconDisc(ctx, S, 'pencil', f.W / 2, y + R, R, k.acc, k.on, 0.1)],
    [54 * u, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { ...sized(TY.title, 56), color: k.acc, anim: 'up', delay: 0.35, maxWidth: mw })],
    [mT.h, (y) => para(ctx, S, tx(S, 1), f.W / 2, y, sized(TY.title, f.tall ? 60 : 68), k.ink, mw, { align: 'center', delay: 0.6, anim: 'up', top: true })],
    [64 * u, (y) => {
      const m = measure(ctx, S, tx(S, 2), TY.strong), pw = m.w + 64 * u + 48 * u;
      growRect(ctx, f.W / 2 - pw / 2, y, pw, 64 * u, kin(S, 1.2, 0.4, ease.outExpo), 'c', rgba(k.acc2, 0.18), 32 * u, fo(S));
      iconDisc(ctx, S, 'clock', f.W / 2 - pw / 2 + 36 * u, y + 32 * u, 22 * u, k.acc2, '#ffffff', 1.35);
      animText(ctx, S, tx(S, 2), f.W / 2 - pw / 2 + 70 * u, y + 32 * u, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: 1.45, maxWidth: (pw - 100 * u) / f.W });
    }],
  ], 30 * u);
}

// Activity Timer: a large ring runs down round the time, with the activity above it.
function activityTimer(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = cw / f.W;
  const R = (f.tall ? 230 : 190) * u;
  const mT = measure(ctx, S, tx(S, 0), sized(TY.title, 72));
  const mC = para(ctx, S, tx(S, 2), 0, 0, TY.body, k.muted, mw, { draw: false });
  column(f, [
    [mT.h, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + mT.h / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: mw })],
    [R * 2, (y) => {
      const cx = f.W / 2, cy = y + R;
      piece(ctx, { x: cx - R, y, w: R * 2, h: R * 2 }, (c) => {
        const kk = kin(S, 0.3, 0.6, ease.outCubic);
        if (kk <= 0) return;
        c.globalAlpha = fo(S);
        c.lineWidth = 22 * u; c.lineCap = 'round';
        c.strokeStyle = rgba(k.ink, 0.1); c.beginPath(); c.arc(cx, cy, R - 11 * u, 0, Math.PI * 2); c.stroke();
        const left = kk * (1 - clamp((S.t - 1.0) / Math.max(1, S.d - 1.6)) * 0.85);
        c.strokeStyle = k.acc; c.beginPath(); c.arc(cx, cy, R - 11 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); c.stroke();
      });
      animText(ctx, S, tx(S, 1), cx, cy, { ...sized(TY.num, f.tall ? 120 : 104), color: k.ink, anim: 'pop', delay: 0.5, stagger: 0, maxWidth: (R * 1.4) / f.W });
    }],
    [mC.h, (y) => para(ctx, S, tx(S, 2), f.W / 2, y, TY.body, k.muted, mw, { align: 'center', delay: 0.9, top: true })],
  ], 40 * u);
}

// Vocabulary: a word card, then its meaning card turning over beside it.
function vocabulary(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, gap = 50 * u;
  const cwid = side ? (cw - gap) / 2 : cw, chh = (f.tall ? 300 : 320) * u, pad = 40 * u;
  const hH = 54 * u;
  const totalH = hH + 40 * u + (side ? chh : chh * 2 + gap);
  let y = f.H / 2 - totalH / 2;
  pill(ctx, S, tx(S, 0), side ? x0 : x0, y + 27 * u, { bg: k.acc, ink: k.on, delay: 0.1 });
  y += hH + 40 * u;
  [0, 1].forEach((i) => {
    const bx = side ? x0 + i * (cwid + gap) : x0, by = side ? y : y + i * (chh + gap), d = 0.3 + i * 0.9;
    const word = tx(S, 1 + i), lang = tx(S, 3 + i);
    piece(ctx, { x: bx, y: by, w: cwid, h: chh }, (c) => {
      const kk = kin(S, d, 0.55, ease.outBack);
      if (kk <= 0) return;
      c.globalAlpha = fo(S);
      c.translate(bx + cwid / 2, by + chh / 2); c.scale(i ? Math.max(0.001, kk) : 1, i ? 1 : kk); c.translate(-(bx + cwid / 2), -(by + chh / 2));
      c.fillStyle = i ? k.acc : k.surf; roundRect(c, bx, by, cwid, chh, 28 * u); c.fill();
      if (!i && !k.dark) { c.strokeStyle = rgba(k.ink, 0.1); c.lineWidth = 3 * u; roundRect(c, bx, by, cwid, chh, 28 * u); c.stroke(); }
      const ink = i ? k.on : k.ink;
      drawText(c, S, lang, bx + cwid / 2, by + pad + 18 * u, { ...TY.label, color: i ? ink : k.acc, align: 'center', maxWidth: (cwid - pad * 2) / f.W, anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 });
      drawText(c, S, word, bx + cwid / 2, by + chh / 2 + 20 * u, { ...sized(TY.title, f.tall ? 84 : 76), color: ink, align: 'center', maxWidth: (cwid - pad * 2) / f.W, anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001 });
    });
  });
}

// Compare Two: two columns with coloured headings and three points each, and "vs" between them.
function compareTwo(ctx, S, prosCons = false) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, gap = side ? 90 * u : 40 * u;
  const cwid = side ? (cw - gap) / 2 : cw, pad = 36 * u, rowH = 70 * u;
  const heads = prosCons ? [tx(S, 1), tx(S, 2)] : [tx(S, 0), tx(S, 1)];
  const items = prosCons ? [[3, 4, 5], [6, 7, 8]] : [[2, 3, 4], [5, 6, 7]];
  const colors = prosCons ? ['#16a34a', '#e11d48'] : [k.acc, k.acc2];
  const titleH = prosCons ? measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h : 0;
  const chh = 70 * u + 24 * u + rowH * 3 + pad;
  const total = (titleH ? titleH + 40 * u : 0) + (side ? chh : chh * 2 + gap);
  let y = f.H / 2 - total / 2;
  if (prosCons) { animText(ctx, S, tx(S, 0), x0, y + titleH / 2, { ...sized(TY.title, 72), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W }); y += titleH + 40 * u; }
  [0, 1].forEach((i) => {
    const bx = side ? x0 + i * (cwid + gap) : x0, by = side ? y : y + i * (chh + gap), d = 0.3 + i * 0.5;
    card(ctx, S, { x: bx, y: by, w: cwid, h: chh }, { color: k.surf, delay: d, r: 24, shadow: k.dark ? 0 : 24, inner: (c) => { c.save(); roundRect(c, bx, by, cwid, chh, 24 * u); c.clip(); c.fillStyle = colors[i]; c.fillRect(bx, by, cwid, 70 * u); c.restore(); } });
    animText(ctx, S, heads[i], bx + cwid / 2, by + 35 * u, { ...sized(TY.head, 38), color: '#ffffff', anim: 'fade', delay: d + 0.2, maxWidth: (cwid - pad * 2) / f.W });
    items[i].forEach((ti, j) => {
      const ry = by + 70 * u + 24 * u + rowH * j + rowH / 2, dd = d + 0.5 + j * 0.2;
      piece(ctx, { x: bx + pad, y: ry - 16 * u, w: 32 * u, h: 32 * u }, (c) => {
        const kk = ease.outBack(clamp((S.t - dd) / 0.35));
        if (kk <= 0) return;
        c.globalAlpha = fo(S);
        c.fillStyle = rgba(colors[i], 0.18); c.beginPath(); c.arc(bx + pad + 16 * u, ry, 16 * u * kk, 0, Math.PI * 2); c.fill();
        glyph(c, prosCons ? (i ? 'minus' : 'plus') : 'check', bx + pad + 16 * u, ry, 13 * u, colors[i], kk, u);
      });
      animText(ctx, S, tx(S, ti), bx + pad + 50 * u, ry, { ...TY.body, color: k.ink, align: 'left', anim: 'fade', delay: dd + 0.1, maxWidth: (cwid - pad * 2 - 50 * u) / f.W });
    });
  });
  if (!prosCons && side) {
    const vx = x0 + cwid + gap / 2, vy = y + chh / 2, r = 38 * u;
    piece(ctx, { x: vx - r, y: vy - r, w: r * 2, h: r * 2 }, (c) => { const kk = ease.outBack(clamp((S.t - 1.0) / 0.4)); if (kk <= 0) return; c.globalAlpha = fo(S); c.fillStyle = k.ink; c.beginPath(); c.arc(vx, vy, r * kk, 0, Math.PI * 2); c.fill(); drawText(c, S, 'vs', vx, vy - 2 * u, { ...sized(TY.num, 30), color: k.dark ? '#111827' : '#ffffff', align: 'center', anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001, alpha: Math.min(1, kk) }); });
  }
}

// Timeline: dates in chips along a line, each with what happened (down the side on tall frames).
function historyTimeline(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const n = 4, ev = Array.from({ length: n }, (_, i) => [tx(S, 2 + i * 2), tx(S, 3 + i * 2)]);
  const hH = header(ctx, S, f, k, { tag: tx(S, 0), title: tx(S, 1), x: x0, y: 0, maxW: mw, size: 72, draw: false });
  if (!f.tall) {
    const bodyH = 260 * u;
    column(f, [
      [hH, (y) => header(ctx, S, f, k, { tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: mw, size: 72 })],
      [bodyH, (y) => {
        const ly = y + 90 * u, slot = cw / n;
        growRect(ctx, x0, ly - 2 * u, cw, 4 * u, kin(S, 0.6, 1.6, ease.inOutCubic), 'l', rgba(k.ink, 0.25), 2 * u, fo(S));
        ev.forEach(([date, what], i) => {
          const x = x0 + slot * (i + 0.5), d = 0.6 + ((i + 0.5) / n) * 1.6;
          pill(ctx, S, date, x, ly, { bg: k.acc, ink: k.on, align: 'center', delay: d, o: sized(TY.num, 34), h: 64, maxW: slot * 0.9 });
          const t = wrapO(ctx, S, what, TY.body, (slot * 0.9) / f.W);
          animText(ctx, S, t, x, ly + 70 * u + measure(ctx, S, t, TY.body).h / 2, { ...TY.body, color: k.ink, anim: 'fade', delay: d + 0.2, maxWidth: (slot * 0.9) / f.W });
        });
      }],
    ], 60 * u);
  } else {
    const rowH = 170 * u;
    column(f, [
      [hH, (y) => header(ctx, S, f, k, { tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: mw, size: 72 })],
      [rowH * n, (y) => {
        const lx = x0 + 6 * u;
        growRect(ctx, lx - 2 * u, y, 4 * u, rowH * n, kin(S, 0.6, 1.6, ease.inOutCubic), 'd', rgba(k.ink, 0.25), 2 * u, fo(S));
        ev.forEach(([date, what], i) => {
          const yy = y + rowH * i + rowH / 2, d = 0.6 + ((i + 0.5) / n) * 1.6;
          pill(ctx, S, date, lx - 6 * u, yy - 30 * u, { bg: k.acc, ink: k.on, delay: d, o: sized(TY.num, 34), h: 60, maxW: cw });
          animText(ctx, S, what, lx + 10 * u, yy + 34 * u, { ...TY.body, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.2, maxWidth: (cw - 20 * u) / f.W });
        });
      }],
    ], 50 * u);
  }
}

// Points in cards: a title, then three cards, each with a tick or a big number (Recap, Summary).
function pointCards(ctx, S, mode) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const across = !f.tall && mode === 'recap', n = 3, gap = 30 * u, pad = 36 * u;
  const cwid = across ? (cw - gap * 2) / 3 : cw;
  const bo = sized(TY.strong, 40), lead = mode === 'recap' ? 0 : 110 * u;
  const tw = across ? cwid - pad * 2 : cwid - pad * 2 - (mode === 'recap' ? 70 * u : lead);
  const texts = [1, 2, 3].map((i) => wrapO(ctx, S, tx(S, i), bo, tw / f.W));
  const th = Math.max(...texts.map((t) => measure(ctx, S, t, bo).h));
  const chh = across ? pad * 2 + 70 * u + th : Math.max(pad * 2 + th, 120 * u);
  const hH = measure(ctx, S, tx(S, 0), sized(TY.title, 76)).h;
  column(f, [
    [hH, (y) => animText(ctx, S, tx(S, 0), x0, y + hH / 2, { ...sized(TY.title, 76), color: k.ink, align: 'left', anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [across ? chh : chh * 3 + gap * 2, (y) => texts.forEach((t, i) => {
      const bx = across ? x0 + i * (cwid + gap) : x0, by = across ? y : y + i * (chh + gap), d = 0.4 + i * 0.3;
      card(ctx, S, { x: bx, y: by, w: cwid, h: chh }, { color: k.surf, delay: d, r: 22, shadow: k.dark ? 0 : 22, inner: (c) => {
        if (mode === 'recap') checkBadge(c, bx + pad + 26 * u, across ? by + pad + 26 * u : by + chh / 2, 26 * u, ease.outBack(clamp((S.t - d - 0.3) / 0.4)), k.acc, k.on, u);
      } });
      if (mode !== 'recap') animText(ctx, S, String(i + 1).padStart(2, '0'), bx + pad, by + chh / 2, { ...sized(TY.num, 64), color: k.acc, align: 'left', anim: 'up', delay: d + 0.15, stagger: 0 });
      const tx0 = across ? bx + pad : bx + pad + (mode === 'recap' ? 70 * u : lead);
      animText(ctx, S, t, tx0, across ? by + pad + 70 * u + th / 2 : by + chh / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.25, maxWidth: tw / f.W });
    })],
  ], 40 * u);
}

// Up Next: "Up next" with an arrow sliding in, the next topic large, and dots showing the part.
function upNext(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const [part, of] = (String(tx(S, 2)).match(/\d+/g) || ['3', '5']).map(Number);
  const to = sized(TY.big, f.tall ? 96 : 120);
  const t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  column(f, [
    [60 * u, (y) => {
      piece(ctx, { x: x0, y, w: 60 * u, h: 60 * u }, (c) => { const kk = kin(S, 0.1, 0.5, ease.outBack); if (kk <= 0) return; c.globalAlpha = fo(S); glyph(c, 'arrow', x0 + 30 * u - (1 - kk) * 60 * u, y + 30 * u, 30 * u, k.acc, 1, u); });
      animText(ctx, S, tx(S, 0), x0 + 84 * u, y + 30 * u, { ...sized(TY.label, 34), color: k.acc, align: 'left', anim: 'fade', delay: 0.3, maxWidth: (cw - 84 * u) / f.W });
    }],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.45, inDur: 0.55, stagger: 0.01, maxWidth: mw })],
    [40 * u, (y) => {
      const n = Math.max(1, Math.min(12, of || 5)), r = 11 * u, gap = 34 * u;
      piece(ctx, { x: x0, y: y + 20 * u - r, w: gap * (n - 1) + r * 2, h: r * 2 }, (c) => {
        c.globalAlpha = fo(S);
        for (let i = 0; i < n; i++) {
          const kk = ease.outBack(clamp((S.t - 1.0 - i * 0.07) / 0.3));
          if (kk <= 0) continue;
          c.fillStyle = i < part ? k.acc : rgba(k.ink, 0.18);
          c.beginPath(); c.arc(x0 + r + gap * i, y + 20 * u, r * kk * (i === part - 1 ? 1.35 : 1), 0, Math.PI * 2); c.fill();
        }
      });
      animText(ctx, S, tx(S, 2), x0 + gap * (n - 1) + r * 2 + 30 * u, y + 20 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: 1.3, maxWidth: (cw * 0.5) / f.W });
    }],
  ], 34 * u);
}

// Section Break: a coloured block with a huge part number beside the section name (above it on tall).
function sectionBreak(ctx, S) {
  const f = frame(S), u = f.u, k = K(S);
  const tall = f.tall, bw = tall ? f.W : f.W * 0.38, bh = tall ? f.H * 0.42 : f.H;
  growRect(ctx, 0, 0, bw, bh, kin(S, 0, 0.7, ease.outExpo), tall ? 'd' : 'l', k.acc, 0, fo(S));
  const no = { ...sized(TY.big, tall ? 300 : 340), fontFixed: true };
  animText(ctx, S, tx(S, 1), bw / 2, bh / 2 + 10 * u, { ...no, color: k.on, anim: 'up', delay: 0.35, stagger: 0, maxWidth: (bw * 0.8) / f.W });
  const x = tall ? f.mx : bw + Math.max(f.W * 0.06, 70 * u), mw = (f.W - x - f.mx) / f.W;
  const mid = tall ? bh + (f.H - bh) / 2 : f.H / 2;
  const items = [
    { text: tx(S, 0), o: sized(TY.label, 32), color: k.acc, anim: 'fade', delay: 0.5 },
    { text: wrapO(ctx, S, tx(S, 2), sized(TY.title, 92), mw), o: sized(TY.title, 92), color: k.ink, gap: 20, delay: 0.6 },
    { text: tx(S, 3), o: TY.body, color: k.muted, gap: 18, anim: 'fade', delay: 0.95 },
  ];
  const h = stack(ctx, S, items, x, 0, { maxW: mw, draw: false });
  stack(ctx, S, items, x, mid - h / 2, { maxW: mw });
}

// Learning Objectives / Checklist / Lab: a heading, then rows that each get a mark.
function markRows(ctx, S, { icon, mark, first = 2, rows = 3, intro = 1, boxed = false }) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const rowH = 96 * u, pad = 40 * u;
  const hH = header(ctx, S, f, k, { icon, tag: tx(S, 0), title: intro != null ? tx(S, intro) : '', x: x0, y: 0, maxW: mw, size: f.tall ? 56 : 60, draw: false });
  const listH = rowH * rows + (boxed ? pad * 2 : 0);
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon, tag: tx(S, 0), title: intro != null ? tx(S, intro) : '', x: x0, y, maxW: mw, size: f.tall ? 56 : 60 })],
    [listH, (y) => {
      if (boxed) card(ctx, S, { x: x0, y, w: cw, h: listH }, { color: k.surf, delay: 0.3, r: 24, shadow: k.dark ? 0 : 24 });
      const lx = x0 + (boxed ? pad : 0), ly = y + (boxed ? pad : 0);
      for (let i = 0; i < rows; i++) {
        const yy = ly + rowH * i + rowH / 2, d = 0.6 + i * 0.35, r = 26 * u;
        piece(ctx, { x: lx, y: yy - r, w: r * 2, h: r * 2 }, (c) => {
          c.globalAlpha = fo(S);
          if (mark === 'box') {
            const kb = kin(S, d - 0.2, 0.3); if (kb <= 0) return;
            c.globalAlpha *= kb; c.strokeStyle = k.acc; c.lineWidth = 4 * u; roundRect(c, lx + 4 * u, yy - r + 4 * u, r * 2 - 8 * u, r * 2 - 8 * u, 8 * u); c.stroke();
            const kt = kin(S, d + 0.6, 0.3); if (kt > 0) { c.fillStyle = k.acc; roundRect(c, lx + 4 * u, yy - r + 4 * u, r * 2 - 8 * u, r * 2 - 8 * u, 8 * u); c.fill(); glyph(c, 'check', lx + r, yy, r * 0.75, k.on, kt, u); }
            return;
          }
          const kk = ease.outBack(clamp((S.t - d) / 0.35));
          if (kk <= 0) return;
          c.fillStyle = mark === 'dot' ? k.acc2 : k.acc; c.beginPath(); c.arc(lx + r, yy, (mark === 'dot' ? r * 0.45 : r) * kk, 0, Math.PI * 2); c.fill();
          if (mark !== 'dot') glyph(c, mark, lx + r, yy, r * 0.7, k.on, kk, u);
        });
        animText(ctx, S, tx(S, first + i), lx + 26 * u * 2 + 28 * u, yy, { ...sized(TY.strong, 42), color: k.ink, align: 'left', anim: 'fade', delay: d + 0.1, maxWidth: (cw - (boxed ? pad * 2 : 0) - 26 * u * 2 - 28 * u) / f.W });
      }
    }],
  ], 40 * u);
}

// Quote: big quotation marks, the words, and who said them.
function quote(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const qo = { font: 'Playfair Display', fontFixed: true, weight: 700, size: f.tall ? 66 : 74 };
  const t = wrapO(ctx, S, tx(S, 0), qo, mw), mq = measure(ctx, S, t, qo);
  column(f, [
    [110 * u, (y) => piece(ctx, { x: x0, y, w: 150 * u, h: 110 * u }, (c) => {
      const kk = ease.outBack(clamp((S.t - 0.1) / 0.5));
      if (kk <= 0) return;
      c.globalAlpha = fo(S); c.fillStyle = k.acc;
      for (const dx of [0, 76 * u]) {
        const cx = x0 + 34 * u + dx, cy = y + 40 * u;
        c.beginPath(); c.arc(cx, cy, 30 * u * kk, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(cx - 26 * u * kk, cy + 10 * u); c.quadraticCurveTo(cx - 24 * u, cy + 70 * u * kk, cx + 18 * u, cy + 80 * u * kk); c.quadraticCurveTo(cx + 2 * u, cy + 50 * u * kk, cx + 26 * u * kk, cy + 14 * u); c.closePath(); c.fill();
      }
    })],
    [mq.h, (y) => animText(ctx, S, t, x0, y + mq.h / 2, { ...qo, color: k.ink, align: 'left', anim: 'fade', delay: 0.4, inDur: 0.8, maxWidth: mw })],
    [40 * u, (y) => {
      line(ctx, x0, y + 20 * u, x0 + 60 * u, y + 20 * u, kin(S, 1.2, 0.4) * fo(S), k.acc, 4 * u);
      animText(ctx, S, tx(S, 1), x0 + 84 * u, y + 20 * u, { ...sized(TY.label, 30), color: k.muted, align: 'left', anim: 'fade', delay: 1.3, maxWidth: (cw - 84 * u) / f.W });
    }],
  ], 40 * u);
}

// Diagram Labels: a simple cell-like shape in the middle with four labels joined to it by lines.
function diagram(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 70)).h;
  animText(ctx, S, tx(S, 0), f.W / 2, f.my + tH / 2, { ...sized(TY.title, 70), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W });
  const cx = f.W / 2, cy = f.my + tH + (f.H - f.my * 2 - tH) / 2 + 20 * u;
  const R = Math.min(f.tall ? f.W * 0.28 : f.H * 0.24, 300 * u), Ry = R * 0.78;
  piece(ctx, { x: cx - R, y: cy - Ry, w: R * 2, h: Ry * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.3) / 0.6));
    if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.fillStyle = rgba(k.acc, 0.16); c.strokeStyle = k.acc; c.lineWidth = 6 * u;
    c.beginPath(); c.ellipse(cx, cy, R * kk, Ry * kk, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = k.acc; c.beginPath(); c.arc(cx - R * 0.12, cy - Ry * 0.05, R * 0.26 * kk, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.acc2;
    for (const [dx, dy, a] of [[0.45, -0.35, 0.5], [0.5, 0.35, -0.3], [-0.55, 0.38, 0.2]]) { c.save(); c.translate(cx + R * dx * kk, cy + Ry * dy * kk); c.rotate(a); c.beginPath(); c.ellipse(0, 0, R * 0.14 * kk, R * 0.07 * kk, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  });
  // anchors on the shape and where each label sits
  const spots = f.tall
    ? [[-0.12, -0.05, -0.55, -1.75], [0.98, 0.1, 0.55, -1.75], [0.5, 0.35, 0.55, 1.75], [-0.55, 0.38, -0.55, 1.75]]
    : [[-0.12, -0.05, -1.75, -0.9], [0.98, -0.15, 1.75, -0.9], [0.5, 0.35, 1.75, 0.95], [-0.55, 0.38, -1.75, 0.95]];
  spots.forEach(([ax, ay, lx, ly], i) => {
    const px = cx + R * ax, py = cy + Ry * ay, qx = clamp(cx + R * lx, x0 + 120 * u, x0 + cw - 120 * u), qy = cy + Ry * ly;
    const d = 0.9 + i * 0.25;
    line(ctx, px, py, qx, qy, kin(S, d, 0.4, ease.inOutCubic) * fo(S), rgba(k.ink, 0.6), 3 * u);
    pill(ctx, S, tx(S, 1 + i), qx, qy, { bg: k.ink, ink: k.dark ? '#111827' : '#ffffff', align: 'center', delay: d + 0.3, o: sized(TY.strong, 30, { weight: 700 }), h: 56, maxW: cw * 0.42 });
  });
}

// Location: a map grid, a pin dropping onto it with rings, and the place name on a card.
function location(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall;
  const mapW = side ? cw * 0.5 : cw, mapH = side ? Math.min(f.ch, 560 * u) : f.H * 0.38;
  const mx = side ? x0 + cw - mapW : x0, my = side ? f.H / 2 - mapH / 2 : f.H * 0.12;
  card(ctx, S, { x: mx, y: my, w: mapW, h: mapH }, { color: k.surf, delay: 0.1, r: 28, border: rgba(k.ink, 0.1), inner: (c) => {
    c.save(); roundRect(c, mx, my, mapW, mapH, 28 * u); c.clip();
    c.strokeStyle = rgba(k.ink, 0.08); c.lineWidth = 2 * u;
    for (let gx = mx; gx < mx + mapW; gx += 60 * u) { c.beginPath(); c.moveTo(gx, my); c.lineTo(gx, my + mapH); c.stroke(); }
    for (let gy = my; gy < my + mapH; gy += 60 * u) { c.beginPath(); c.moveTo(mx, gy); c.lineTo(mx + mapW, gy); c.stroke(); }
    c.strokeStyle = rgba(k.acc2, 0.5); c.lineWidth = 10 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(mx - 20 * u, my + mapH * 0.7); c.bezierCurveTo(mx + mapW * 0.3, my + mapH * 0.5, mx + mapW * 0.55, my + mapH * 0.9, mx + mapW + 20 * u, my + mapH * 0.6); c.stroke();
    c.restore();
  } });
  const px = mx + mapW * 0.55, py = my + mapH * 0.48;
  piece(ctx, { x: px - 60 * u, y: py - 130 * u, w: 120 * u, h: 170 * u }, (c) => {
    const drop = ease.outBounce(clamp((S.t - 0.6) / 0.7));
    if (S.t < 0.6) return;
    c.globalAlpha = fo(S);
    for (let i = 0; i < 2; i++) { const p = ((S.t - 1.2 - i * 0.6) % 1.6 + 1.6) % 1.6 / 1.6; if (S.t > 1.2) { c.strokeStyle = rgba(k.acc, (1 - p) * 0.6); c.lineWidth = 3 * u; c.beginPath(); c.ellipse(px, py + 20 * u, 50 * u * p, 18 * u * p, 0, 0, Math.PI * 2); c.stroke(); } }
    glyph(c, 'pin', px, py - 30 * u - (1 - drop) * 200 * u, 52 * u, k.acc, 1, u);
  });
  const tmw = side ? (cw - mapW - 70 * u) / f.W : cw / f.W;
  const items = [
    { text: tx(S, 0), o: TY.label, color: k.acc, anim: 'fade', delay: 0.4 },
    { text: wrapO(ctx, S, tx(S, 1), sized(TY.title, 88), tmw), o: sized(TY.title, 88), color: k.ink, gap: 22, delay: 1.0 },
    { text: tx(S, 2), o: TY.body, color: k.muted, gap: 16, anim: 'fade', delay: 1.3 },
  ];
  const h = stack(ctx, S, items, x0, 0, { maxW: tmw, draw: false });
  stack(ctx, S, items, x0, side ? f.H / 2 - h / 2 : my + mapH + (f.H - my - mapH) / 2 - h / 2, { maxW: tmw });
}

// Big Statistic: a huge number counts up beside ten dots that fill to match.
function bigStat(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const no = { ...sized(TY.big, f.tall ? 220 : 240), fontFixed: true };
  const mN = measure(ctx, S, tx(S, 0), no), fit = Math.min(1, cw / mN.w), nH = mN.h * fit * 0.85;
  const pct = clamp(numOf(tx(S, 0), 70) / 100), filled = Math.round(pct * 10);
  const mC = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 56 : 60), k.ink, mw, { draw: false });
  const r = 22 * u, gap = 62 * u;
  column(f, [
    [nH, (y) => animText(ctx, S, countUp(tx(S, 0), kin(S, 0.2, 1.6, ease.outQuart)), x0, y + nH / 2, { ...no, color: k.acc, align: 'left', anim: 'up', delay: 0.1, stagger: 0, maxWidth: mw })],
    [r * 2, (y) => piece(ctx, { x: x0, y, w: gap * 9 + r * 2, h: r * 2 }, (c) => {
      c.globalAlpha = fo(S);
      for (let i = 0; i < 10; i++) {
        const kk = ease.outBack(clamp((S.t - 0.4 - i * 0.12) / 0.3));
        if (kk <= 0) continue;
        c.fillStyle = i < filled ? k.acc : rgba(k.ink, 0.15);
        c.beginPath(); c.arc(x0 + r + Math.min(gap, (cw - r * 2) / 9) * i, y + r, r * kk, 0, Math.PI * 2); c.fill();
      }
    })],
    [mC.h, (y) => para(ctx, S, tx(S, 1), x0, y, sized(TY.title, f.tall ? 56 : 60), k.ink, mw, { delay: 1.0, anim: 'up', top: true })],
    [34 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 17 * u, { ...TY.small, color: k.muted, align: 'left', anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 34 * u);
}

// Module Progress: where the lesson is in the course, as a bar of segments filling up.
function moduleProgress(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const [cur, total] = (String(tx(S, 0)).match(/\d+/g) || ['2', '5']).map(Number);
  const n = Math.max(2, Math.min(10, total || 5)), at = Math.max(1, Math.min(n, cur || 1));
  const to = sized(TY.big, f.tall ? 96 : 112), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const segH = 26 * u, gap = 14 * u, segW = (cw - gap * (n - 1)) / n;
  column(f, [
    [54 * u, (y) => pill(ctx, S, tx(S, 0), x0, y + 27 * u, { bg: k.acc, ink: k.on, delay: 0.1 })],
    [mt.h, (y) => animText(ctx, S, t, x0, y + mt.h / 2, { ...to, color: k.ink, align: 'left', anim: 'up', delay: 0.3, stagger: 0.01, maxWidth: mw })],
    [segH, (y) => {
      for (let i = 0; i < n; i++) {
        const bx = x0 + i * (segW + gap);
        growRect(ctx, bx, y, segW, segH, kin(S, 0.6 + i * 0.05, 0.3), 'l', rgba(k.ink, 0.12), segH / 2, fo(S));
        const fill = i < at - 1 ? kin(S, 0.9 + i * 0.15, 0.35, ease.inOutCubic) : i === at - 1 ? kin(S, 0.9 + i * 0.15, 0.9, ease.inOutCubic) * 0.6 : 0;
        growRect(ctx, bx, y, segW, segH, fill, 'l', k.acc, segH / 2, fo(S));
      }
    }],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), x0, y + 20 * u, { ...TY.body, color: k.muted, align: 'left', anim: 'fade', delay: 1.6, maxWidth: mw })],
  ], 36 * u);
}

// Homework / Reading: a big icon on a card, a tag, the task and a dated pill.
function taskCard(ctx, S, icon) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, R = 120 * u;
  const tw = side ? cw - R * 2 - 80 * u : cw, mw = tw / f.W;
  const to = sized(TY.title, f.tall ? 64 : 72), t = wrapO(ctx, S, tx(S, 1), to, mw), mt = measure(ctx, S, t, to);
  const textH = 54 * u + 26 * u + mt.h + 30 * u + 64 * u;
  const drawIcon = (cx, cy) => piece(ctx, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, (c) => {
    const kk = ease.outBack(clamp((S.t - 0.1) / 0.5));
    if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.save(); c.translate(cx, cy); c.rotate(-0.06 * kk); c.fillStyle = k.surf; c.shadowColor = 'rgba(0,0,0,0.15)'; c.shadowBlur = k.dark ? 0 : 30 * u;
    roundRect(c, -R * kk, -R * kk, R * 2 * kk, R * 2 * kk, 34 * u); c.fill(); c.restore();
    glyph(c, icon, cx, cy, R * 0.55, k.acc, kk, u);
  });
  const drawBody = (x, y, align) => {
    pill(ctx, S, tx(S, 0), x, y + 27 * u, { bg: k.acc, ink: k.on, align, delay: 0.3 });
    animText(ctx, S, t, x, y + 54 * u + 26 * u + mt.h / 2, { ...to, color: k.ink, align, anim: 'up', delay: 0.5, stagger: 0.006, maxWidth: mw });
    const m = measure(ctx, S, tx(S, 2), TY.strong), pw = m.w + 100 * u, py = y + 54 * u + 26 * u + mt.h + 30 * u;
    const px = align === 'center' ? x - pw / 2 : x;
    growRect(ctx, px, py, pw, 64 * u, kin(S, 1.1, 0.4, ease.outExpo), 'l', rgba(k.acc2, 0.18), 32 * u, fo(S));
    iconDisc(ctx, S, icon === 'book' ? 'bars' : 'calendar', px + 34 * u, py + 32 * u, 22 * u, k.acc2, '#ffffff', 1.25);
    animText(ctx, S, tx(S, 2), px + 68 * u, py + 32 * u, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: 1.35, maxWidth: (pw - 90 * u) / f.W });
  };
  if (side) { drawIcon(x0 + R, f.H / 2); drawBody(x0 + R * 2 + 80 * u, f.H / 2 - textH / 2, 'left'); }
  else column(f, [[R * 2, (y) => drawIcon(f.W / 2, y + R)], [textH, (y) => drawBody(f.W / 2, y, 'center')]], 50 * u);
}

// Discuss: two speech bubbles, then the question and how to talk it over.
function discuss(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f), mw = (f.tall ? cw : cw * 0.82) / f.W;
  const bub = 140 * u;
  const mQ = para(ctx, S, tx(S, 1), 0, 0, sized(TY.title, f.tall ? 62 : 70), k.ink, mw, { draw: false });
  column(f, [
    [bub * 1.2, (y) => piece(ctx, { x: f.W / 2 - bub * 1.2, y, w: bub * 2.4, h: bub * 1.2 }, (c) => {
      c.globalAlpha = fo(S);
      const k1 = ease.outBack(clamp((S.t - 0.1) / 0.45)), k2 = ease.outBack(clamp((S.t - 0.35) / 0.45));
      if (k1 > 0) glyph(c, 'chat', f.W / 2 - bub * 0.42, y + bub * 0.5, bub * 0.62, k.acc, k1, u);
      if (k2 > 0) { c.save(); c.translate(f.W / 2 + bub * 0.45, y + bub * 0.62); c.scale(-1, 1); glyph(c, 'chat', 0, 0, bub * 0.52, k.acc2, k2, u); c.restore(); }
    })],
    [54 * u, (y) => pill(ctx, S, tx(S, 0), f.W / 2, y + 27 * u, { bg: k.ink, ink: k.dark ? '#111827' : '#ffffff', align: 'center', delay: 0.5 })],
    [mQ.h, (y) => para(ctx, S, tx(S, 1), f.W / 2, y, sized(TY.title, f.tall ? 62 : 70), k.ink, mw, { align: 'center', delay: 0.7, anim: 'up', top: true })],
    [40 * u, (y) => animText(ctx, S, tx(S, 2), f.W / 2, y + 20 * u, { ...TY.body, color: k.muted, anim: 'fade', delay: 1.3, maxWidth: mw })],
  ], 30 * u);
}

// Quick Poll: a question and three answers whose bars fill to their share as the numbers count.
function poll(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f), mw = cw / f.W;
  const vals = listOf(tx(S, 5), [48, 32, 20]).slice(0, 3), top = Math.max(...vals), sum = vals.reduce((a, b) => a + b, 0) || 1;
  const rowH = 118 * u, barH = 54 * u;
  const hH = header(ctx, S, f, k, { icon: 'bars', tag: tx(S, 0), title: tx(S, 1), x: x0, y: 0, maxW: mw, size: f.tall ? 60 : 66, draw: false });
  column(f, [
    [hH, (y) => header(ctx, S, f, k, { icon: 'bars', tag: tx(S, 0), title: tx(S, 1), x: x0, y, maxW: mw, size: f.tall ? 60 : 66 })],
    [rowH * 3, (y) => vals.forEach((v, i) => {
      const yy = y + rowH * i, d = 0.8 + i * 0.2, kk = kin(S, d + 0.2, 1.0, ease.outCubic);
      const pctTxt = `${Math.round((v / sum) * 100)}%`;
      animText(ctx, S, tx(S, 2 + i), x0, yy + 20 * u, { ...TY.strong, color: k.ink, align: 'left', anim: 'fade', delay: d, maxWidth: (cw - 140 * u) / f.W });
      animText(ctx, S, countUp(pctTxt, kk), x0 + cw, yy + 20 * u, { ...sized(TY.num, 36), color: i === 0 ? k.acc : k.muted, align: 'right', anim: 'fade', delay: d + 0.2 });
      growRect(ctx, x0, yy + 48 * u, cw, barH, kin(S, d, 0.3), 'l', rgba(k.ink, 0.08), barH / 2, fo(S));
      growRect(ctx, x0, yy + 48 * u, Math.max(barH, cw * (v / top)), barH, kk, 'l', i === 0 ? k.acc : rgba(k.ink, 0.32), barH / 2, fo(S));
    })],
  ], 44 * u);
}

// Fill in the Blank: a sentence with a gap, and after a beat the answer drops into it.
function fillBlank(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw } = area(f);
  const so = sized(TY.title, f.tall ? 64 : 78);
  const [before, after] = String(tx(S, 1)).split(/_{2,}/).concat(['']).slice(0, 2);
  const ans = tx(S, 2);
  const mb = measure(ctx, S, before, so), ma = measure(ctx, S, after, so), mans = measure(ctx, S, ans, so);
  const gapW = mans.w + 50 * u, total = mb.w + gapW + ma.w;
  const fit = Math.min(1, cw / total), lh = mb.h;
  const hy = f.H / 2 - lh / 2 - 90 * u;
  pill(ctx, S, tx(S, 0), f.W / 2, hy - 27 * u, { bg: k.acc, ink: k.on, align: 'center', delay: 0.1 });
  const sx = f.W / 2 - (total * fit) / 2, y = f.H / 2 + 10 * u;
  piece(ctx, { x: sx, y: y - lh * fit / 2, w: total * fit, h: lh * fit }, (c) => {
    c.globalAlpha = fo(S);
    c.translate(sx, y); c.scale(fit, fit); c.translate(-sx, -y);
    drawText(c, S, before, sx, y, { ...so, color: k.ink, align: 'left', anim: 'fade', delay: 0.3, inDur: 0.5 });
    drawText(c, S, after, sx + mb.w + gapW, y, { ...so, color: k.ink, align: 'left', anim: 'fade', delay: 0.3, inDur: 0.5 });
    const kl = kin(S, 0.6, 0.4); if (kl > 0) { c.strokeStyle = rgba(k.ink, 0.7 * kl); c.lineWidth = 5 * u; c.beginPath(); c.moveTo(sx + mb.w + 10 * u, y + lh * 0.38); c.lineTo(sx + mb.w + gapW - 10 * u, y + lh * 0.38); c.stroke(); }
    const kd = ease.outBounce(clamp((S.t - 2.2) / 0.6));
    if (S.t > 2.2) drawText(c, S, ans, sx + mb.w + gapW / 2, y - (1 - kd) * 160 * u, { ...so, color: k.acc, align: 'center', anim: 'still', delay: 0, inDur: 0.001, outDur: 0.001, alpha: clamp((S.t - 2.2) * 5) });
  });
}

// Myth vs Fact: the myth on a card gets crossed out, then the fact card slides up under it.
function mythFact(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const pad = 40 * u, bad = '#e11d48', good = '#16a34a', bo = sized(TY.title, f.tall ? 54 : 58);
  const mw = (cw - pad * 2) / f.W;
  const t1 = wrapO(ctx, S, tx(S, 1), bo, mw), t2 = wrapO(ctx, S, tx(S, 3), bo, mw);
  const h1 = pad * 2 + 54 * u + 24 * u + measure(ctx, S, t1, bo).h, h2 = pad * 2 + 54 * u + 24 * u + measure(ctx, S, t2, bo).h;
  const gap = 36 * u, y1 = f.H / 2 - (h1 + gap + h2) / 2, y2 = y1 + h1 + gap;
  [[y1, h1, t1, 0, bad, 0.1], [y2, h2, t2, 2, good, 2.0]].forEach(([y, h, t, ti, c0, d]) => {
    card(ctx, S, { x: x0, y, w: cw, h }, { color: k.surf, delay: d, r: 24, border: rgba(c0, 0.6), rise: 60 });
    pill(ctx, S, tx(S, ti), x0 + pad, y + pad + 27 * u, { bg: c0, ink: '#ffffff', delay: d + 0.2 });
    const m = measure(ctx, S, t, bo), ty = y + pad + 54 * u + 24 * u + m.h / 2, tw = Math.min(m.w, mw * f.W);
    piece(ctx, { x: x0 + pad, y: ty - m.h / 2, w: tw, h: m.h }, (c) => {
      drawText(c, S, t, x0 + pad, ty, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.35, inDur: 0.7, maxWidth: mw, alpha: ti === 0 ? 1 - kin(S, 1.6, 0.4) * 0.45 : 1 });
      const ks = ti === 0 ? kin(S, 1.2, 0.5, ease.inOutCubic) : 0;
      if (ks > 0) {
        // one stroke through the middle of each line of the myth
        const lines = String(t).split('\n'), lh = m.h / lines.length;
        c.globalAlpha = fo(S); c.strokeStyle = bad; c.lineWidth = 6 * u; c.lineCap = 'round';
        lines.forEach((ln, i) => { const lw = Math.min(measure(ctx, S, ln, bo).w, mw * f.W), ly = ty - m.h / 2 + lh * (i + 0.5); c.beginPath(); c.moveTo(x0 + pad - 6 * u, ly); c.lineTo(x0 + pad - 6 * u + (lw + 12 * u) * ks, ly); c.stroke(); });
      }
    });
  });
}

// Cause and Effect: two cards with an arrow drawing from the cause to the effect.
function causeEffect(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, gap = side ? 140 * u : 110 * u, pad = 40 * u;
  const cwid = side ? (cw - gap) / 2 : cw, bo = sized(TY.title, f.tall ? 56 : 54);
  const ts = [2, 4].map((i) => wrapO(ctx, S, tx(S, i), bo, (cwid - pad * 2) / f.W));
  const chh = pad * 2 + 54 * u + 24 * u + Math.max(...ts.map((t) => measure(ctx, S, t, bo).h));
  const tH = measure(ctx, S, tx(S, 0), sized(TY.title, 72)).h;
  column(f, [
    [tH, (y) => animText(ctx, S, tx(S, 0), f.W / 2, y + tH / 2, { ...sized(TY.title, 72), color: k.ink, anim: 'up', delay: 0.1, maxWidth: cw / f.W })],
    [side ? chh : chh * 2 + gap, (y) => {
      [0, 1].forEach((i) => {
        const bx = side ? x0 + i * (cwid + gap) : x0, by = side ? y : y + i * (chh + gap), d = 0.4 + i * 1.0, c0 = i ? k.acc2 : k.acc;
        card(ctx, S, { x: bx, y: by, w: cwid, h: chh }, { color: k.surf, delay: d, r: 24, border: rgba(c0, 0.55) });
        pill(ctx, S, tx(S, 1 + i * 2), bx + pad, by + pad + 27 * u, { bg: c0, ink: i ? '#ffffff' : k.on, delay: d + 0.15 });
        animText(ctx, S, ts[i], bx + pad, by + pad + 54 * u + 24 * u + measure(ctx, S, ts[i], bo).h / 2, { ...bo, color: k.ink, align: 'left', anim: 'fade', delay: d + 0.3, maxWidth: (cwid - pad * 2) / f.W });
      });
      const ak = kin(S, 1.0, 0.45, ease.inOutCubic) * fo(S);
      if (side) piece(ctx, { x: x0 + cwid + 20 * u, y: y + chh / 2 - 30 * u, w: gap - 40 * u, h: 60 * u }, (c) => { if (ak <= 0) return; c.strokeStyle = k.ink; c.lineWidth = 6 * u; c.lineCap = 'round'; c.lineJoin = 'round'; const x1 = x0 + cwid + 24 * u, x2 = x1 + (gap - 48 * u) * ak; c.beginPath(); c.moveTo(x1, y + chh / 2); c.lineTo(x2, y + chh / 2); c.moveTo(x2 - 18 * u, y + chh / 2 - 16 * u); c.lineTo(x2, y + chh / 2); c.lineTo(x2 - 18 * u, y + chh / 2 + 16 * u); c.stroke(); });
      else piece(ctx, { x: f.W / 2 - 30 * u, y: y + chh + 20 * u, w: 60 * u, h: gap - 40 * u }, (c) => { if (ak <= 0) return; c.strokeStyle = k.ink; c.lineWidth = 6 * u; c.lineCap = 'round'; c.lineJoin = 'round'; const y1 = y + chh + 24 * u, y2 = y1 + (gap - 48 * u) * ak; c.beginPath(); c.moveTo(f.W / 2, y1); c.lineTo(f.W / 2, y2); c.moveTo(f.W / 2 - 16 * u, y2 - 18 * u); c.lineTo(f.W / 2, y2); c.lineTo(f.W / 2 + 16 * u, y2 - 18 * u); c.stroke(); });
    }],
  ], 50 * u);
}

// Question of the Day: a calendar page with the day, and the question beside it.
function questionDay(ctx, S) {
  const f = frame(S), u = f.u, k = K(S), { cw, x0 } = area(f);
  const side = !f.tall, cwd = 240 * u, chd = 270 * u;
  const tw = side ? cw - cwd - 70 * u : cw, mw = tw / f.W;
  const qo = sized(TY.title, f.tall ? 64 : 70), t = wrapO(ctx, S, tx(S, 1), qo, mw), mq = measure(ctx, S, t, qo);
  const page = (x, y) => {
    card(ctx, S, { x, y, w: cwd, h: chd }, { color: k.surf, delay: 0.1, r: 26, shadow: k.dark ? 0 : 30, border: k.dark ? rgba(k.ink, 0.2) : null, inner: (c) => { c.save(); roundRect(c, x, y, cwd, chd, 26 * u); c.clip(); c.fillStyle = k.acc; c.fillRect(x, y, cwd, 76 * u); c.restore(); } });
    animText(ctx, S, tx(S, 2), x + cwd / 2, y + 38 * u, { ...sized(TY.label, 30), color: k.on, anim: 'fade', delay: 0.35, maxWidth: (cwd - 60 * u) / f.W });
    animText(ctx, S, tx(S, 3), x + cwd / 2, y + 76 * u + (chd - 76 * u) / 2, { ...sized(TY.num, 120), color: k.ink, anim: 'pop', delay: 0.45, stagger: 0, maxWidth: (cwd - 60 * u) / f.W });
  };
  const body = (x, y, align) => {
    pill(ctx, S, tx(S, 0), x, y + 27 * u, { bg: k.acc2, ink: '#ffffff', align, delay: 0.5 });
    animText(ctx, S, t, x, y + 54 * u + 28 * u + mq.h / 2, { ...qo, color: k.ink, align, anim: 'up', delay: 0.7, stagger: 0.006, maxWidth: mw });
  };
  const bh = 54 * u + 28 * u + mq.h;
  if (side) { page(x0, f.H / 2 - chd / 2); body(x0 + cwd + 70 * u, f.H / 2 - bh / 2, 'left'); }
  else column(f, [[chd, (y) => page(f.W / 2 - cwd / 2, y)], [bh, (y) => body(f.W / 2, y, 'center')]], 50 * u);
}

// Remember This: a note pinned to the board, in handwriting.
function rememberNote(ctx, S) {
  const f = frame(S), u = f.u, k = K(S);
  const nw = Math.min(f.cw, (f.tall ? 900 : 1100) * u), pad = 64 * u, mw = (nw - pad * 2) / f.W;
  const lo = sized(TY.label, 34), bo = sized(TY.hand, f.tall ? 72 : 80);
  const t = wrapO(ctx, S, tx(S, 1), bo, mw), mt = measure(ctx, S, t, bo);
  const nh = pad * 2 + 40 * u + 30 * u + mt.h, x = f.W / 2 - nw / 2, y = f.H / 2 - nh / 2 + 20 * u;
  piece(ctx, { x, y: y - 50 * u, w: nw, h: nh + 50 * u }, (c) => {
    const kk = kin(S, 0.05, 0.5, ease.outBack);
    if (kk <= 0) return;
    c.globalAlpha = fo(S);
    c.translate(0, (1 - kk) * -60 * u);
    c.translate(f.W / 2, y); c.rotate(0.025); c.translate(-f.W / 2, -y);
    c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 30 * u; c.shadowOffsetY = 14 * u;
    c.fillStyle = k.surf; c.fillRect(x, y, nw, nh); c.shadowColor = 'transparent';
    c.fillStyle = rgba(k.acc, 0.85); c.fillRect(x, y, nw, 14 * u);
    glyph(c, 'pin', f.W / 2, y - 6 * u, 44 * u, k.acc, Math.min(1, kin(S, 0.4, 0.3, ease.outBack)), u);
    drawText(c, S, tx(S, 0), x + pad, y + pad + 20 * u, { ...lo, color: k.acc, align: 'left', maxWidth: mw, anim: 'fade', delay: 0.5 });
    drawText(c, S, t, x + pad, y + pad + 40 * u + 30 * u + mt.h / 2, { ...bo, color: k.dark ? '#1c2026' : k.ink, align: 'left', maxWidth: mw, anim: 'fade', delay: 0.7, inDur: 0.6 });
  });
}

// ---------- the list ----------
const ding = [['sfx-ding', 0.4]], pop = [['sfx-pop', 0.15]], swipe = [['sfx-swipe', 0.1]];
seq('term', 'Key Term', 'paper', { sfx: swipe, texts: ['Key term', 'Photosynthesis', 'noun', 'How plants turn light, water and air into the food they need to grow.'] }, keyTerm);
seq('quiz', 'Quick Quiz', 'lilac', { dur: 7, sfx: [['sfx-pop', 0.1], ['sfx-success', 3.6]], texts: ['Quick quiz', 'Which planet is closest to the Sun?', 'Venus', 'Mercury', 'Mars', 'Earth', 'B'] }, quickQuiz);
seq('true-false', 'True or False', 'navy', { dur: 7, sfx: [['sfx-swipe', 0.1], ['sfx-ding', 3.2]], texts: ['True or false?', 'Lightning never strikes the same place twice.', 'True', 'False', 'False', 'It often does: tall buildings are hit many times a year.'] }, trueFalse);
seq('pause', 'Pause and Think', 'mint', { sfx: [['sfx-tick', 0.8]], texts: ['Pause and think', 'What would happen if all the bees disappeared?', 'Take a moment before you go on'] }, pauseThink);
seq('did-you-know', 'Did You Know?', 'sun', { sfx: pop, texts: ['Did you know?', 'Octopuses have three hearts and blue blood.'] }, didYouKnow);
seq('fun-fact', 'Fun Fact', 'chalk', { sfx: pop, texts: ['Fun fact!', 'A day on Venus is longer than its whole year.'] }, funFact);
seq('steps', 'Step by Step', 'paper', { dur: 7, sfx: swipe, texts: ['How to solve it', 'Read the problem twice', 'Write down what you know', 'Choose a strategy, then check'] }, stepByStep);
seq('mistake', 'Common Mistake', 'paper', { dur: 7, sfx: [['sfx-error', 0.6], ['sfx-ding', 1.9]], texts: ['Common mistake', 'Their going to the park.', 'They’re going to the park.', '“They’re” is short for “they are”.'] }, commonMistake);
seq('tip', 'Tip', 'navy', { sfx: swipe, texts: ['Tip', 'Read the questions first, then the passage: you’ll know what to look for.'] }, proTip);
seq('formula', 'Formula', 'chalk', { sfx: [['sfx-typing', 0.6]], texts: ['Formula', 'a² + b² = c²', 'The Pythagorean theorem, for any right triangle'] }, formula);
seq('example', 'Worked Example', 'mint', { dur: 7, texts: ['Example', 'Solve 3x + 5 = 20', '3x = 20 − 5', '3x = 15', 'x = 5'] }, workedExample);
seq('your-turn', 'Your Turn', 'sun', { sfx: pop, texts: ['Your turn', 'Try the three practice questions on page 42.', '5 minutes'] }, yourTurn);
seq('timer', 'Activity Timer', 'navy', { sfx: [['sfx-tick', 0.5]], texts: ['Group activity', '03:00', 'Discuss with the people next to you'] }, activityTimer);
seq('vocab', 'Vocabulary', 'lilac', { sfx: [['sfx-swipe', 0.3], ['sfx-swipe', 1.2]], texts: ['Vocabulary', 'la biblioteca', 'the library', 'Spanish', 'English'] }, vocabulary);
seq('compare', 'Compare Two', 'mint', { dur: 7, sfx: swipe, texts: ['Plant cells', 'Animal cells', 'Cell wall', 'Chloroplasts', 'One large vacuole', 'No cell wall', 'No chloroplasts', 'Small vacuoles'] }, (c, S) => compareTwo(c, S, false));
seq('pros-cons', 'Pros and Cons', 'paper', { dur: 7, sfx: swipe, texts: ['Pros and cons', 'Pros', 'Cons', 'Cheap to run', 'Easy to learn', 'Works offline', 'Slow with big files', 'Few templates', 'No phone app'] }, (c, S) => compareTwo(c, S, true));
seq('timeline', 'Timeline', 'navy', { dur: 7, sfx: swipe, texts: ['Timeline', 'The race to the Moon', '1957', 'Sputnik 1 in orbit', '1961', 'First person in space', '1966', 'First soft landing', '1969', 'Apollo 11 lands'] }, historyTimeline);
seq('so-far', 'Recap So Far', 'lilac', { dur: 7, sfx: ding, texts: ['So far', 'Atoms are made of protons, neutrons and electrons', 'The number of protons decides the element', 'Electrons take part in reactions'] }, (c, S) => pointCards(c, S, 'recap'));
seq('up-next', 'Up Next', 'sun', { sfx: [['sfx-whoosh', 0.1]], texts: ['Up next', 'Fractions and Decimals', 'Part 3 of 5'] }, upNext);
seq('section', 'Section Break', 'mint', { sfx: [['sfx-whoosh', 0.05]], texts: ['Part', '2', 'The Water Cycle', 'Evaporation, clouds and rain'] }, sectionBreak);
seq('objectives', 'Learning Objectives', 'paper', { dur: 7, sfx: swipe, texts: ['Learning objectives', 'By the end of this lesson you will be able to:', 'Name the parts of a flower', 'Explain how pollination works', 'Plant and care for a seed'] }, (c, S) => markRows(c, S, { icon: 'target', mark: 'target' }));
seq('checklist', 'Checklist', 'mint', { dur: 7, sfx: [['sfx-click', 1.2], ['sfx-click', 1.55], ['sfx-click', 1.9], ['sfx-click', 2.25]], texts: ['Before you start', 'Notebook and pencil', 'Calculator', 'Printed worksheet', 'A quiet place to work'] }, (c, S) => markRows(c, S, { mark: 'box', first: 1, rows: 4, intro: null, boxed: true }));
seq('quote', 'Quote', 'navy', { texts: ['The important thing is not to stop questioning.', 'Albert Einstein'] }, quote);
seq('diagram', 'Diagram Labels', 'lilac', { dur: 7, sfx: pop, texts: ['Parts of a cell', 'Nucleus', 'Cell membrane', 'Mitochondria', 'Cytoplasm'] }, diagram);
seq('location', 'Location', 'sun', { sfx: [['sfx-drop', 0.6]], texts: ['Where in the world?', 'Machu Picchu', 'Peru · 13.16° S, 72.55° W'] }, location);
seq('stat', 'Big Statistic', 'navy', { sfx: [['sfx-riser', 0.1]], texts: ['71%', 'of the Earth’s surface is covered by water', 'Source: NOAA'] }, bigStat);
seq('progress', 'Module Progress', 'mint', { sfx: ding, texts: ['Module 2 of 5', 'Working with Data', 'You’re almost halfway there'] }, moduleProgress);
seq('homework', 'Homework', 'paper', { sfx: pop, texts: ['Homework', 'Write a one-page summary of chapter 4.', 'Due Friday'] }, (c, S) => taskCard(c, S, 'pencil'));
seq('reading', 'Reading', 'lilac', { sfx: pop, texts: ['Reading', 'Chapter 7: The Great Migration', 'Pages 112–130'] }, (c, S) => taskCard(c, S, 'book'));
seq('discuss', 'Discuss', 'sun', { sfx: [['sfx-bubble', 0.1], ['sfx-bubble', 0.35]], texts: ['Discuss', 'Should homework be optional? Why or why not?', 'Talk it over with a partner for two minutes'] }, discuss);
seq('poll', 'Quick Poll', 'navy', { dur: 7, sfx: swipe, texts: ['Quick poll', 'Which topic should we cover next?', 'Volcanoes', 'Oceans', 'Space', '48 32 20'] }, poll);
seq('blank', 'Fill in the Blank', 'chalk', { dur: 7, sfx: [['sfx-pop', 2.3]], texts: ['Fill in the blank', 'The capital of France is ___.', 'Paris'] }, fillBlank);
seq('myth', 'Myth vs Fact', 'paper', { dur: 7, sfx: [['sfx-error', 1.2], ['sfx-ding', 2.1]], texts: ['Myth', 'We only use 10% of our brains.', 'Fact', 'We use almost all of our brain, just not all at once.'] }, mythFact);
seq('cause', 'Cause and Effect', 'mint', { dur: 7, sfx: swipe, texts: ['Cause and effect', 'Cause', 'A week of heavy rain', 'Effect', 'Rivers flood the valley'] }, causeEffect);
seq('qotd', 'Question of the Day', 'lilac', { sfx: pop, texts: ['Question of the day', 'If you could invent one thing, what would it be?', 'Mon', '14'] }, questionDay);
seq('summary', 'In Summary', 'navy', { dur: 7, sfx: swipe, texts: ['In summary', 'Energy can’t be made or destroyed', 'It changes from one form to another', 'Some is always lost as heat'] }, (c, S) => pointCards(c, S, 'summary'));
seq('lab', 'Lab Activity', 'mint', { dur: 7, sfx: pop, texts: ['Lab activity', 'Make a simple volcano', 'Baking soda', 'Vinegar', 'Food colouring'] }, (c, S) => markRows(c, S, { icon: 'flask', mark: 'dot', boxed: true }));
seq('remember', 'Remember This', 'sun', { sfx: pop, texts: ['Remember', 'Always show your working, even when the answer seems obvious.'] }, rememberNote);

export const EDU_SEQS = L;
