// WebGL2 compositor: places each clip into a frame-sized layer (transform, crop, chroma key),
// grades it, runs its effects, mixes transitions and blends layers bottom to top.
import { TRANSITION_HEADER, transitionById } from '../templates/transitions.js';
import { EFFECT_HEADER, GRADE_SHADER, GRADE_KEYS, effectById, filterById } from '../templates/effects.js';
import { titleById } from '../templates/titles.js';
import { elementById, backgroundById } from '../templates/elements.js';
import { animDelta } from '../templates/anims.js';
import { beginParts, endParts } from '../templates/textfx.js';
import { visualStack, sortedByTrack, localTime, zoomAt } from './scene.js';
import { hexToRgb } from '../util.js';

const VS_QUAD = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

const VS_PLACE = `#version 300 es
in vec2 aPos;
uniform mat3 uM; uniform vec2 uRes; uniform vec4 uCrop; uniform vec2 uFlip;
out vec2 vUv; out vec2 vQuad;
void main(){
  vQuad = aPos;
  vec2 local = mix(uCrop.xy, vec2(1.0) - uCrop.zw, aPos);
  vec3 p = uM * vec3(local, 1.0);
  vec2 c = p.xy / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  vUv = vec2(uFlip.x > 0.5 ? 1.0 - local.x : local.x, uFlip.y > 0.5 ? 1.0 - local.y : local.y);
}`;

const FS_PLACE = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uOpacity; uniform float uPremult;
uniform int uKey; uniform vec3 uKeyCol; uniform float uSim, uSmooth, uSpill;
uniform int uShape; uniform float uAspect; uniform float uBorderW; uniform vec3 uBorderCol;
in vec2 vUv; in vec2 vQuad; out vec4 o;
// Signed distance to the clip's shape, in units of its height (negative inside).
float shapeDist(){
  vec2 q = (vQuad - 0.5) * vec2(uAspect, 1.0);
  if (uShape == 2) return length(q) - 0.5 * min(uAspect, 1.0);
  vec2 hb = vec2(0.5 * uAspect, 0.5);
  float r = uShape == 1 ? 0.12 * min(uAspect, 1.0) : 0.0;
  vec2 d = abs(q) - hb + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
vec2 cbcr(vec3 c){ return vec2(-0.168736*c.r - 0.331264*c.g + 0.5*c.b, 0.5*c.r - 0.418688*c.g - 0.081312*c.b); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec4 c = texture(uTex, vUv);
  if (uPremult < 0.5) c.rgb *= c.a;
  if (uKey == 1) {
    vec3 rgb = c.a > 0.0 ? c.rgb / c.a : c.rgb;
    float d = distance(cbcr(rgb), cbcr(uKeyCol));
    float a = smoothstep(uSim, uSim + uSmooth, d);
    float sp = 1.0 - smoothstep(uSim, uSim + uSmooth + 0.25, d);
    vec3 desat = vec3(luma(rgb));
    // suppress the key colour's dominant channel bleeding onto edges
    vec3 k = uKeyCol;
    if (k.g >= k.r && k.g >= k.b) rgb.g = mix(rgb.g, min(rgb.g, max(rgb.r, rgb.b)), uSpill * sp * 2.0);
    else if (k.b >= k.r) rgb.b = mix(rgb.b, min(rgb.b, max(rgb.r, rgb.g)), uSpill * sp * 2.0);
    else rgb = mix(rgb, desat, uSpill * sp);
    c = vec4(rgb * c.a * a, c.a * a);
  }
  if (uShape > 0 || uBorderW > 0.0) {
    float d = shapeDist();
    float aa = max(fwidth(d), 1e-4);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    if (uBorderW > 0.0) {
      float ring = smoothstep(-uBorderW - aa, -uBorderW + aa, d);
      c = mix(c, vec4(uBorderCol, 1.0), ring);
    }
    c *= inside;
  }
  o = c * uOpacity;
}`;

const FS_COPY = `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 o;
void main(){ o = texture(uTex, vUv); }`;

const FS_BLEND = `#version 300 es
precision highp float;
uniform sampler2D uBase; uniform sampler2D uTop; uniform int uMode;
in vec2 vUv; out vec4 o;
vec3 ov(vec3 b, vec3 t){ return mix(2.0*b*t, 1.0 - 2.0*(1.0-b)*(1.0-t), step(0.5, b)); }
void main(){
  vec4 B = texture(uBase, vUv), T = texture(uTop, vUv);
  if (T.a <= 0.0) { o = B; return; }
  vec3 b = B.a > 0.0 ? B.rgb / B.a : vec3(0.0), t = T.rgb / T.a;
  vec3 m;
  if (uMode == 1) m = b * t;
  else if (uMode == 2) m = 1.0 - (1.0 - b) * (1.0 - t);
  else if (uMode == 3) m = ov(b, t);
  else if (uMode == 4) m = min(b + t, 1.0);
  else if (uMode == 5) m = min(b, t);
  else if (uMode == 6) m = max(b, t);
  else if (uMode == 7) m = abs(b - t);
  else if (uMode == 8) m = ov(t, b);
  else m = t;
  vec3 mixed = mix(t, m, B.a);
  o = vec4(mixed * T.a + B.rgb * (1.0 - T.a), T.a + B.a * (1.0 - T.a));
}`;

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'add', 'darken', 'lighten', 'difference', 'soft light'];

function ortho3(tx, ty, rot, sx, sy) {
  // pixel transform: translate(tx,ty) * rotate(rot) * scale(sx,sy) * translate(-0.5,-0.5); column-major mat3
  const c = Math.cos(rot), s = Math.sin(rot);
  const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  const e = tx - 0.5 * a - 0.5 * cc, f = ty - 0.5 * b - 0.5 * d;
  return new Float32Array([a, b, 0, cc, d, 0, e, f, 1]);
}

export class Compositor {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available.');
    this.gl = gl;
    this.programs = new Map();
    this.free = [];
    this.textures = new Map(); // key -> { tex, w, h, stamp }
    this.canvases = new Map(); // clipId -> canvas for template clips
    this.W = 0; this.H = 0;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.pPlace = this.program(VS_PLACE, FS_PLACE);
    this.pCopy = this.program(VS_QUAD, FS_COPY);
    this.pBlend = this.program(VS_QUAD, FS_BLEND);
    this.pGrade = this.program(VS_QUAD, GRADE_SHADER);
    this.errors = [];
  }

  program(vs, fs) {
    const key = vs.length + ':' + fs;
    if (this.programs.has(key)) return this.programs.get(key);
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(-12).join('\n'));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const prog = { p, u: new Map() };
    prog.loc = (n) => { if (!prog.u.has(n)) prog.u.set(n, gl.getUniformLocation(p, n)); return prog.u.get(n); };
    this.programs.set(key, prog);
    return prog;
  }

  safeProgram(vs, fs, label) {
    try { return this.program(vs, fs); } catch (e) {
      if (!this.errors.includes(label)) { this.errors.push(label); console.error('Shader failed:', label, e.message); }
      return null;
    }
  }

  setSize(w, h) {
    w = Math.max(2, Math.round(w / 2) * 2); h = Math.max(2, Math.round(h / 2) * 2);
    if (w === this.W && h === this.H) return;
    this.W = w; this.H = h;
    this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl;
    for (const t of this.free) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    this.free = [];
  }

  target() {
    const gl = this.gl;
    const t = this.free.pop();
    if (t && t.w === this.W && t.h === this.H) return t;
    if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this.W, this.H);
    this.texParams(gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w: this.W, h: this.H };
  }
  release(t) { if (t) this.free.push(t); }
  texParams(filter) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  bindTarget(t) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, this.W, this.H);
  }
  clear(t, r = 0, g = 0, b = 0, a = 0) {
    const gl = this.gl;
    this.bindTarget(t);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  draw() { this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4); }

  // Upload an element/canvas to a cached texture.
  upload(key, el, w, h, always) {
    const gl = this.gl;
    let e = this.textures.get(key);
    if (!e) {
      e = { tex: gl.createTexture(), w: 0, h: 0, ok: false };
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      this.texParams(gl.LINEAR);
      this.textures.set(key, e);
    }
    e.used = true;
    if (!always && e.ok && e.src === el) return e;
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      e.ok = true; e.w = w; e.h = h; e.src = el;
    } catch { /* not ready */ }
    return e;
  }
  dropTexture(key) {
    const e = this.textures.get(key);
    if (e) { this.gl.deleteTexture(e.tex); this.textures.delete(key); }
  }

  // Full-frame canvas for template-drawn clips.
  clipCanvas(id) {
    let c = this.canvases.get(id);
    if (!c) { c = document.createElement('canvas'); this.canvases.set(id, c); }
    if (c.width !== this.W || c.height !== this.H) { c.width = this.W; c.height = this.H; }
    return c;
  }

  drawTemplate(clip, t) {
    const cv = this.clipCanvas(clip.id);
    return drawTemplateTo(cv.getContext('2d'), clip, cv.width, cv.height, t) ? cv : null;
  }

  /*
   * Render the project at time t into the canvas (or keep result for readPixels).
   * src(clip) returns { el, w, h, live } for video/image clips.
   */
  render(project, t, src, opts = {}) {
    const gl = this.gl;
    for (const e of this.textures.values()) e.used = false;
    const [br, bg, bb] = hexToRgb(project.background || '#000000');
    let acc = this.target();
    this.clear(acc, br, bg, bb, 1);
    const byTrack = opts.byTrack || sortedByTrack(project);
    const stack = visualStack(project, t, byTrack);
    for (const { state } of stack) {
      if (opts.skip && ((state.a && opts.skip(state.a)) || (state.b && opts.skip(state.b)))) continue; // e.g. captions saved as a file only
      const single = state.a && !state.tr ? state.a : null;
      if (single && single.type === 'adjust') { acc = this.adjust(acc, single, t); continue; }
      let layer;
      if (single) layer = this.layer(single, t, src, project);
      else {
        const A = state.a && state.a.type !== 'adjust' ? this.layer(state.a, t, src, project) : null;
        const B = state.b && state.b.type !== 'adjust' ? this.layer(state.b, t, src, project) : null;
        layer = this.transition(A, B, state.p, state.tr.id);
        this.release(A); this.release(B);
      }
      if (!layer) continue;
      const blend = (single || state.b || state.a).blend || 'normal';
      acc = this.composite(acc, layer, blend);
      this.release(layer);
    }
    this.result = acc;
    if (!opts.offscreen) {
      this.bindTarget(null);
      gl.useProgram(this.pCopy.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, acc.tex);
      gl.uniform1i(this.pCopy.loc('uTex'), 0);
      gl.disable(gl.BLEND);
      this.draw();
    }
    this.release(acc);
    // forget textures of clips that are gone
    if (!opts.keepTextures) for (const [k, e] of this.textures) if (!e.used && k.startsWith('c:') && Math.random() < 0.02) this.dropTexture(k);
  }

  readPixels(out) {
    const gl = this.gl;
    this.bindTarget(this.result);
    out ||= new Uint8Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  layer(clip, t, src, project) {
    const gl = this.gl;
    let tex, sw, sh, premult = 0;
    if (clip.type === 'video' || clip.type === 'image') {
      const s = src(clip);
      if (!s || !s.el) return null;
      const key = clip.type === 'image' ? 'm:' + clip.mediaId : 'c:' + clip.id;
      const e = this.upload(key, s.el, s.w, s.h, clip.type === 'video');
      if (!e.ok) return null;
      tex = e.tex; sw = s.w; sh = s.h;
    } else if (clip.type === 'title' || clip.type === 'element' || clip.type === 'background') {
      const cv = this.drawTemplate(clip, t);
      if (!cv) return null;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      const e = this.upload('c:' + clip.id, cv, cv.width, cv.height, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      tex = e.tex; sw = cv.width; sh = cv.height; premult = 1;
    } else return null;

    const W = this.W, H = this.H;
    const tf = clip.transform || {};
    const ad = animDelta(clip, localTime(clip, t));
    const fit = Math.min(W / sw, H / sh);
    const sc = (tf.scale ?? 1) * ad.scale;
    let w = sw * fit * sc * ad.scaleX, h = sh * fit * sc;
    let cx = W / 2 + ((tf.x || 0) + ad.x) * W, cy = H / 2 + ((tf.y || 0) + ad.y) * H;
    // zoom to area: move the chosen rectangle of the frame toward the middle and scale it up to fill it
    const z = zoomAt(clip, localTime(clip, t));
    if (z) {
      const s = 1 + (Math.min(1 / z.w, 1 / z.h) - 1) * z.k;
      const rx = (z.x + z.w / 2) * W, ry = (z.y + z.h / 2) * H;
      cx = (cx - rx) * s + rx + (W / 2 - rx) * z.k;
      cy = (cy - ry) * s + ry + (H / 2 - ry) * z.k;
      w *= s; h *= s;
    }
    const rot = (((tf.rotation || 0) + ad.rotation) * Math.PI) / 180;
    const out = this.target();
    this.clear(out);
    const P = this.pPlace;
    gl.useProgram(P.p);
    gl.uniformMatrix3fv(P.loc('uM'), false, ortho3(cx, cy, rot, w, h));
    gl.uniform2f(P.loc('uRes'), W, H);
    const cr = clip.crop || { l: 0, t: 0, r: 0, b: 0 };
    gl.uniform4f(P.loc('uCrop'), cr.l, cr.t, cr.r, cr.b);
    gl.uniform2f(P.loc('uFlip'), tf.flipH ? 1 : 0, tf.flipV ? 1 : 0);
    gl.uniform1f(P.loc('uOpacity'), (tf.opacity ?? 1) * ad.opacity);
    gl.uniform1f(P.loc('uPremult'), premult);
    const shape = { rounded: 1, circle: 2 }[clip.shape] || 0;
    const qw = Math.abs(w) * (1 - (cr.l || 0) - (cr.r || 0)), qh = Math.abs(h) * (1 - (cr.t || 0) - (cr.b || 0));
    gl.uniform1i(P.loc('uShape'), shape);
    gl.uniform1f(P.loc('uAspect'), qh > 0 ? qw / qh : 1);
    gl.uniform1f(P.loc('uBorderW'), clip.border?.width > 0 && qh > 0 ? (clip.border.width * (H / 1080)) / qh : 0);
    gl.uniform3fv(P.loc('uBorderCol'), hexToRgb(clip.border?.color || '#ffffff'));
    const ck = clip.chroma;
    gl.uniform1i(P.loc('uKey'), ck?.on ? 1 : 0);
    if (ck?.on) {
      gl.uniform3fv(P.loc('uKeyCol'), hexToRgb(ck.color));
      gl.uniform1f(P.loc('uSim'), ck.similarity * 0.35);
      gl.uniform1f(P.loc('uSmooth'), Math.max(0.002, ck.smooth * 0.3));
      gl.uniform1f(P.loc('uSpill'), ck.spill);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(P.loc('uTex'), 0);
    this.draw();
    return this.postProcess(out, clip, t);
  }

  // Grade + effects on a frame-sized texture. Consumes `inp`, returns a target.
  postProcess(inp, clip, t) {
    let cur = inp;
    const g = gradeParams(clip);
    if (g) cur = this.grade(cur, g, t);
    for (const fx of clip.effects || []) {
      const E = effectById(fx.id);
      if (!E) continue;
      const prog = this.safeProgram(VS_QUAD, EFFECT_HEADER + E.glsl, 'effect ' + E.id);
      if (!prog) continue;
      cur = this.pass(cur, prog, (gl) => {
        gl.uniform1f(prog.loc('uAmt'), fx.amount ?? E.def);
        gl.uniform1f(prog.loc('uTime'), localTime(clip, t));
      });
    }
    return cur;
  }

  pass(inp, prog, setU) {
    const gl = this.gl;
    const out = this.target();
    this.clear(out);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inp.tex);
    gl.uniform1i(prog.loc('uTex'), 0);
    gl.uniform2f(prog.loc('uRes'), this.W, this.H);
    setU?.(gl);
    this.draw();
    this.release(inp);
    return out;
  }

  grade(inp, g, t) {
    const P = this.pGrade;
    return this.pass(inp, P, (gl) => {
      for (const k of GRADE_KEYS) gl.uniform1f(P.loc(k), g[k] || 0);
      gl.uniform3fv(P.loc('shadowCol'), g.shadowCol || [0, 0, 0]);
      gl.uniform3fv(P.loc('highCol'), g.highCol || [0, 0, 0]);
      gl.uniform1f(P.loc('uTime'), t);
    });
  }

  // Adjustment clip: apply its filter/effects to everything below.
  adjust(acc, clip, t) {
    return this.postProcess(acc, clip, t);
  }

  transition(A, B, p, id) {
    const gl = this.gl;
    const tr = transitionById(id);
    const prog = this.safeProgram(VS_QUAD, TRANSITION_HEADER + tr.glsl, 'transition ' + tr.id);
    const empty = (!A || !B) ? this.target() : null;
    if (empty) this.clear(empty);
    const a = A || empty, b = B || empty;
    const out = this.target();
    this.clear(out);
    if (prog) {
      gl.useProgram(prog.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(prog.loc('uA'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.uniform1i(prog.loc('uB'), 1);
      gl.uniform1f(prog.loc('uP'), p);
      gl.uniform2f(prog.loc('uRes'), this.W, this.H);
      this.draw();
      gl.activeTexture(gl.TEXTURE0);
    }
    this.release(empty);
    return out;
  }

  composite(base, top, mode) {
    const gl = this.gl;
    const out = this.target();
    this.bindTarget(out);
    const P = this.pBlend;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, base.tex); gl.uniform1i(P.loc('uBase'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, top.tex); gl.uniform1i(P.loc('uTop'), 1);
    gl.uniform1i(P.loc('uMode'), Math.max(0, BLEND_MODES.indexOf(mode)));
    this.draw();
    gl.activeTexture(gl.TEXTURE0);
    this.release(base);
    return out;
  }

  // Render a single transition/effect/filter preview between two images (library thumbnails).
  previewTransition(id, imgA, imgB, p) {
    const a = this.imageTarget('pa', imgA), b = this.imageTarget('pb', imgB);
    const out = this.transition(a, b, p, id);
    this.release(a); this.release(b);
    this.show(out);
  }
  previewEffect(kind, id, img, t, amount) {
    let cur = this.imageTarget('pa', img);
    if (kind === 'filter') {
      const g = gradeParams({ filter: { id, amount: amount ?? 1 } });
      if (g) cur = this.grade(cur, g, t);
    } else cur = this.postProcess(cur, { effects: [{ id, amount }], duration: 10, start: 0 }, t);
    this.show(cur);
  }
  imageTarget(key, img) {
    const gl = this.gl;
    const e = this.upload('p:' + key + (img.__pid ||= Math.random()), img, img.width, img.height, false);
    const out = this.target();
    this.clear(out);
    const P = this.pPlace;
    gl.useProgram(P.p);
    gl.uniformMatrix3fv(P.loc('uM'), false, ortho3(this.W / 2, this.H / 2, 0, this.W, this.H));
    gl.uniform2f(P.loc('uRes'), this.W, this.H);
    gl.uniform4f(P.loc('uCrop'), 0, 0, 0, 0);
    gl.uniform2f(P.loc('uFlip'), 0, 0);
    gl.uniform1f(P.loc('uOpacity'), 1);
    gl.uniform1f(P.loc('uPremult'), 0);
    gl.uniform1i(P.loc('uKey'), 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, e.tex); gl.uniform1i(P.loc('uTex'), 0);
    this.draw();
    return out;
  }
  show(t) {
    const gl = this.gl;
    this.bindTarget(null);
    gl.useProgram(this.pCopy.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(this.pCopy.loc('uTex'), 0);
    this.draw();
    this.release(t);
  }
}

export const templateOf = (clip) => (clip.type === 'title' ? titleById(clip.template) : clip.type === 'element' ? elementById(clip.template) : backgroundById(clip.template));

// Draw a title/element/background clip at timeline time t into a W x H 2D context.
export function drawTemplateTo(ctx, clip, W, H, t, rec) {
  const tpl = templateOf(clip);
  if (!tpl) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  const p = clip.params || {};
  const S = {
    W, H, u: Math.min(W, H) / 1080,
    t: localTime(clip, t), d: clip.duration,
    texts: p.texts || tpl.texts || [], colors: p.colors || tpl.colors || [], font: p.font || null, scale: p.size || 1, params: p, rec,
  };
  beginParts(S);
  try { tpl.draw(ctx, S); } catch (e) { console.error('template', tpl.id, e); } finally { endParts(); }
  return true;
}

// Combine manual color adjustments and the filter preset into grade uniforms, or null if neutral.
export function gradeParams(clip) {
  const g = {};
  let any = false;
  const c = clip.color;
  if (c) {
    for (const k of Object.keys(c)) {
      const v = c[k] / 100;
      if (!v) continue;
      any = true;
      if (k === 'exposure') g.exposure = v * 2;
      else if (k === 'hue') g.hue = v;
      else g[k] = v;
    }
  }
  const f = clip.filter && filterById(clip.filter.id);
  if (f) {
    any = true;
    const a = clip.filter.amount ?? 1;
    for (const [k, v] of Object.entries(f.v)) {
      if (Array.isArray(v)) g[k] = v.map((x, i) => (g[k]?.[i] || 0) + x);
      else g[k] = (g[k] || 0) + v * (k === 'bw' || k === 'sepia' || k === 'splitAmt' ? a : a);
    }
    if (f.v.splitAmt) g.splitAmt = f.v.splitAmt * a;
  }
  return any ? g : null;
}
