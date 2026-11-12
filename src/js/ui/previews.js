// Library card previews: sample scenes, template thumbnails and hover animations.
import { Compositor } from '../engine/renderer.js';
import { previewColors, previewFont } from '../brand.js';
import { titleById } from '../templates/titles.js';
import { elementById, backgroundById } from '../templates/elements.js';
import { packById } from '../templates/packs.js';
import { drawTemplateTo } from '../engine/renderer.js';

const PW = 320, PH = 180;

function scene(kind) {
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const x = c.getContext('2d');
  if (kind === 'a') {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.55, '#ffcf7a'); g.addColorStop(0.56, '#3b2c55'); g.addColorStop(1, '#1b1630');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(PW * 0.68, PH * 0.48, 26, 0, 7); x.fill();
    x.fillStyle = '#5a3d6e'; x.beginPath(); x.moveTo(0, PH * 0.62); x.lineTo(70, PH * 0.38); x.lineTo(140, PH * 0.6); x.lineTo(210, PH * 0.32); x.lineTo(PW, PH * 0.6); x.lineTo(PW, PH); x.lineTo(0, PH); x.fill();
    x.fillStyle = '#2a1f3d'; x.beginPath(); x.moveTo(0, PH * 0.8); x.quadraticCurveTo(PW * 0.4, PH * 0.6, PW, PH * 0.78); x.lineTo(PW, PH); x.lineTo(0, PH); x.fill();
    x.fillStyle = '#e04f6a'; x.fillRect(40, PH * 0.66, 22, 22); x.fillStyle = '#ffd166'; x.beginPath(); x.arc(250, 140, 12, 0, 7); x.fill();
  } else {
    const g = x.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, '#0f4c81'); g.addColorStop(1, '#43c6ac');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.fillStyle = '#ffffffcc'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(40 + i * 80, 40 + (i % 2) * 14, 30, 10, 0, 0, 7); x.fill(); }
    x.fillStyle = '#123a5a'; for (let i = 0; i < 9; i++) { const h = 40 + ((i * 37) % 60); x.fillRect(10 + i * 34, PH - 40 - h, 26, h + 40); }
    x.fillStyle = '#ffe08a'; for (let i = 0; i < 40; i++) x.fillRect(14 + (i % 9) * 34 + (i % 3) * 7, PH - 30 - ((i * 13) % 70), 4, 5);
    x.fillStyle = '#0b2540'; x.fillRect(0, PH - 26, PW, 26);
  }
  return c;
}
export const sampleA = scene('a');
export const sampleB = scene('b');

let glc = null;
function gl() {
  if (!glc) {
    const cv = document.createElement('canvas');
    glc = new Compositor(cv);
    glc.setSize(PW, PH);
  }
  return glc;
}

export function makeThumbCanvas() {
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  return c;
}

// Draw one frame of a library item into a 2D canvas.
export function drawPreview(canvas, kind, id, t, dur, texts) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  if (kind === 'transition') {
    const g = gl();
    const p = Math.min(1, Math.max(0, (t % 2.4) / 1.8));
    g.previewTransition(id, sampleA, sampleB, p);
    ctx.drawImage(g.canvas, 0, 0, PW, PH);
    return;
  }
  if (kind === 'effect' || kind === 'filter') {
    const g = gl();
    g.previewEffect(kind, id, sampleA, t);
    ctx.drawImage(g.canvas, 0, 0, PW, PH);
    return;
  }
  if (kind === 'pack') { drawPack(ctx, packById(id), t, texts); return; }
  const tpl = kind === 'title' ? titleById(id) : kind === 'element' ? elementById(id) : backgroundById(id);
  if (!tpl) return;
  if (kind === 'background') ctx.clearRect(0, 0, PW, PH);
  else { ctx.drawImage(sampleA, 0, 0); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, PW, PH); }
  const d = dur || tpl.dur || 5;
  const S = { W: PW, H: PH, u: PH / 1080, t, d, texts: tpl.texts || [], colors: previewColors(tpl.colors || [], kind, id), font: kind === 'title' ? previewFont() : null, scale: 1, params: {} };
  if (kind === 'element') { zoomedSticker(ctx, tpl, S); return; }
  ctx.save();
  try { tpl.draw(ctx, S); } catch (e) { console.error(e); }
  ctx.restore();
}

export const PREVIEW_W = PW;
export const PREVIEW_H = PH;

// Composite every visual layer of an intro/outro pack, with its placement.
let layerCv = null;
function drawPack(ctx, pk, t, texts) {
  let firstTitle = true;
  if (!pk) return;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, PW, PH);
  layerCv ||= document.createElement('canvas');
  layerCv.width = PW; layerCv.height = PH;
  const lc = layerCv.getContext('2d');
  for (const L of pk.layers) {
    if (L.kind === 'audio') continue;
    const at = L.at || 0, dur = L.dur ?? pk.dur - at;
    if (t < at || t >= at + dur) continue;
    const tpl = L.kind === 'title' ? titleById(L.id) : L.kind === 'element' ? elementById(L.id) : backgroundById(L.id);
    if (!tpl) continue;
    const override = L.kind === 'title' && firstTitle && texts;
    if (L.kind === 'title') firstTitle = false;
    const params = { texts: override || L.texts || tpl.texts, colors: previewColors(L.colors || tpl.colors, L.kind, L.id), ...(L.params || {}) };
    if (L.kind === 'title' && previewFont()) params.font = previewFont();
    drawTemplateTo(lc, { type: L.kind, template: L.id, params, start: at, duration: dur }, PW, PH, t);
    ctx.save();
    ctx.translate(PW / 2 + (L.x || 0) * PW, PH / 2 + (L.y || 0) * PH);
    ctx.scale(L.scale || 1, L.scale || 1);
    ctx.drawImage(layerCv, -PW / 2, -PH / 2);
    ctx.restore();
  }
}

// Stickers are often small; enlarge the drawn part so the card shows it clearly.
let stickerCv = null;
const stickerZoom = new Map(); // id -> [x, y, w, h] crop, measured once at mid-animation
function zoomedSticker(ctx, tpl, S) {
  stickerCv ||= document.createElement('canvas');
  stickerCv.width = PW; stickerCv.height = PH;
  const sc = stickerCv.getContext('2d', { willReadFrequently: true });
  const draw = (t) => { sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, PW, PH); sc.save(); try { tpl.draw(sc, { ...S, t }); } catch (e) { console.error(e); } sc.restore(); };
  if (!stickerZoom.has(tpl.id)) {
    let x0 = PW, y0 = PH, x1 = -1, y1 = -1;
    for (const f of [0.35, 0.55, 0.75]) {
      draw(S.d * f);
      const px = sc.getImageData(0, 0, PW, PH).data;
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (px[(y * PW + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    let box = [0, 0, PW, PH];
    if (x1 > x0) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const z = Math.min(3, Math.max(1, Math.min(PW * 0.75 / (x1 - x0 + 1), PH * 0.75 / (y1 - y0 + 1))));
      const w = PW / z, hh = PH / z;
      box = [Math.min(Math.max(0, cx - w / 2), PW - w), Math.min(Math.max(0, cy - hh / 2), PH - hh), w, hh];
    }
    stickerZoom.set(tpl.id, box);
  }
  draw(S.t);
  const [bx, by, bw, bh] = stickerZoom.get(tpl.id);
  ctx.drawImage(stickerCv, bx, by, bw, bh, 0, 0, PW, PH);
}
