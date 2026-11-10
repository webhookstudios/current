// Video effects (GLSL passes) and color filters (presets for the grade shader).

export const EFFECT_HEADER = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uAmt;
in vec2 vUv;
out vec4 o;
#define PI 3.14159265359
vec4 S(vec2 uv){ return texture(uTex, uv); }
float inside(vec2 uv){ return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(rand(i), rand(i+vec2(1,0)), f.x), mix(rand(i+vec2(0,1)), rand(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.0; a *= 0.5; } return v; }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float aspect(){ return uRes.x / uRes.y; }
vec4 fx(vec2 uv);
void main(){ o = fx(vUv); }
`;

const E = [];
const add = (cat, id, name, body, def = 0.7) => E.push({ id, name, cat, def, glsl: `vec4 fx(vec2 uv){\n${body}\n}` });

// ---- Blur & Lens ----
add('Blur & Lens', 'blur', 'Blur', `float r = uAmt * 0.02; vec4 c = vec4(0);
  for (int i = 0; i < 32; i++){ float a = float(i) * 2.39996; float rr = r * sqrt(float(i) / 32.0);
    c += S(uv + vec2(cos(a), sin(a) * aspect()) * rr); }
  return c / 32.0;`, 0.5);
add('Blur & Lens', 'zoom-blur', 'Zoom Blur', `vec4 c = vec4(0); vec2 d = uv - 0.5;
  for (int i = 0; i < 24; i++){ c += S(0.5 + d * (1.0 - uAmt * 0.15 * float(i) / 23.0)); }
  return c / 24.0;`, 0.5);
add('Blur & Lens', 'motion-blur', 'Motion Blur', `vec4 c = vec4(0);
  for (int i = 0; i < 20; i++){ c += S(uv + vec2((float(i) / 19.0 - 0.5) * uAmt * 0.05, 0.0)); }
  return c / 20.0;`, 0.5);
add('Blur & Lens', 'tilt-shift', 'Tilt Shift', `float k = smoothstep(0.1, 0.45, abs(uv.y - 0.5)) * uAmt * 0.012; vec4 c = vec4(0);
  for (int i = 0; i < 24; i++){ float a = float(i) * 2.39996; float rr = k * sqrt(float(i) / 24.0);
    c += S(uv + vec2(cos(a), sin(a) * aspect()) * rr); }
  c /= 24.0; return vec4(mix(vec3(luma(c.rgb)), c.rgb, 1.0 + uAmt * 0.4), c.a);`);
add('Blur & Lens', 'fisheye', 'Fisheye', `vec2 d = (uv - 0.5) * vec2(aspect(), 1.0); float r = length(d);
  float k = 1.0 + uAmt * 0.9; vec2 q = d * pow(r, k - 1.0) / pow(0.7, k - 1.0);
  q = q / vec2(aspect(), 1.0) + 0.5; return S(q) * inside(q);`);
add('Blur & Lens', 'pinch', 'Bulge', `vec2 d = uv - 0.5; float r = length(d * vec2(aspect(), 1.0));
  float f = 1.0 - uAmt * 0.6 * smoothstep(0.6, 0.0, r); return S(0.5 + d * f);`);
add('Blur & Lens', 'vignette', 'Vignette', `vec4 c = S(uv); float d = length((uv - 0.5) * vec2(1.0, 1.0 / aspect()) * 1.4);
  return vec4(c.rgb * (1.0 - smoothstep(0.35, 1.0, d) * uAmt), c.a);`);
add('Blur & Lens', 'spotlight', 'Spotlight', `vec4 c = S(uv); float d = length((uv - 0.5) * vec2(aspect(), 1.0));
  return vec4(c.rgb * mix(1.0, smoothstep(0.55, 0.15, d) * 1.2, uAmt), c.a);`);
add('Blur & Lens', 'sharpen', 'Sharpen', `vec2 px = 1.0 / uRes; vec4 c = S(uv);
  vec4 n = S(uv + vec2(px.x, 0)) + S(uv - vec2(px.x, 0)) + S(uv + vec2(0, px.y)) + S(uv - vec2(0, px.y));
  return vec4(c.rgb + (c.rgb * 4.0 - n.rgb) * uAmt * 1.5, c.a);`);
add('Blur & Lens', 'bokeh', 'Bokeh Lights', `vec4 c = S(uv); vec3 a = vec3(0);
  for (int i = 0; i < 18; i++){ float fi = float(i); vec2 p = vec2(rand(vec2(fi, 1.0)), fract(rand(vec2(fi, 2.0)) + uTime * 0.03 * (0.5 + rand(vec2(fi, 4.0)))));
    float r = 0.03 + 0.07 * rand(vec2(fi, 3.0)); float d = length((uv - p) * vec2(aspect(), 1.0));
    a += mix(vec3(1.0, 0.75, 0.45), vec3(0.55, 0.75, 1.0), rand(vec2(fi, 6.0))) * smoothstep(r, r * 0.7, d) * (0.25 + 0.2 * sin(uTime + fi)); }
  return vec4(c.rgb + a * uAmt, c.a);`);

// ---- Retro ----
add('Retro', 'vhs', 'VHS', `float t = uTime; float j = (rand(vec2(floor(t * 20.0), floor(uv.y * 40.0))) - 0.5) * 0.004 * uAmt;
  vec2 q = uv + vec2(j + sin(uv.y * 3.0 + t * 2.0) * 0.002 * uAmt, 0.0);
  float r = S(q + vec2(0.004 * uAmt, 0.0)).r, g = S(q).g, b = S(q - vec2(0.004 * uAmt, 0.0)).b;
  vec3 c = vec3(r, g, b); c *= 0.9 + 0.1 * sin(uv.y * uRes.y * 1.5);
  float band = smoothstep(0.0, 0.02, abs(fract(uv.y * 0.5 - t * 0.15) - 0.5)); c = mix(c * 1.15 + 0.05, c, band);
  c += (rand(uv * 900.0 + t) - 0.5) * 0.12 * uAmt; c = mix(c, c * vec3(1.05, 0.95, 1.1), uAmt);
  return vec4(c, S(uv).a);`);
add('Retro', 'old-film', 'Old Film', `float t = floor(uTime * 18.0); vec4 s = S(uv + vec2(0.0, (rand(vec2(t)) - 0.5) * 0.004 * uAmt));
  float l = luma(s.rgb); vec3 c = mix(s.rgb, vec3(l) * vec3(1.07, 0.95, 0.78), uAmt);
  float scratch = step(0.997, rand(vec2(floor(uv.x * 300.0), t))) * uAmt * 0.5;
  float dust = step(0.9993, rand(floor(uv * uRes / 3.0) + t)) * uAmt;
  float flicker = 1.0 + (rand(vec2(t, 2.0)) - 0.5) * 0.12 * uAmt;
  float v = 1.0 - smoothstep(0.4, 1.0, length(uv - 0.5) * 1.3) * uAmt * 0.7;
  return vec4((c * flicker + scratch - dust * 0.6) * v, s.a);`);
add('Retro', 'film-grain', 'Film Grain', `vec4 c = S(uv); float n = rand(uv * uRes + fract(uTime) * 100.0) - 0.5;
  return vec4(c.rgb + n * 0.25 * uAmt, c.a);`, 0.5);
add('Retro', 'crt', 'CRT Screen', `vec2 d = uv - 0.5; vec2 q = uv + d * dot(d, d) * 0.3 * uAmt; vec4 s = S(q) * inside(q);
  float scan = 0.75 + 0.25 * sin(q.y * uRes.y * 1.2); vec3 mask = vec3(1.0 + 0.15 * sin(q.x * uRes.x * 2.1), 1.0 + 0.15 * sin(q.x * uRes.x * 2.1 + 2.0), 1.0 + 0.15 * sin(q.x * uRes.x * 2.1 + 4.0));
  vec3 c = mix(s.rgb, s.rgb * scan * mask * 1.15, uAmt); return vec4(c, s.a);`);
add('Retro', 'scanlines', 'Scanlines', `vec4 c = S(uv); float s = 0.5 + 0.5 * sin(uv.y * uRes.y * 0.7);
  return vec4(c.rgb * (1.0 - s * 0.5 * uAmt), c.a);`, 0.6);
add('Retro', 'pixelate', 'Pixelate', `float s = 2.0 + uAmt * 40.0; vec2 cells = uRes / s; vec2 q = (floor(uv * cells) + 0.5) / cells; return S(q);`, 0.4);
add('Retro', 'posterize', 'Posterize', `vec4 c = S(uv); float n = mix(16.0, 3.0, uAmt); return vec4(floor(c.rgb * n + 0.5) / n, c.a);`);
add('Retro', 'halftone', 'Halftone', `float s = mix(140.0, 40.0, uAmt); vec2 g = uv * vec2(s * aspect(), s); vec2 cell = (floor(g) + 0.5) / vec2(s * aspect(), s);
  vec4 c = S(cell); float r = sqrt(1.0 - luma(c.rgb)) * 0.6; float d = length(fract(g) - 0.5);
  vec3 dot1 = mix(c.rgb * 1.1, vec3(0.05), smoothstep(r, r - 0.08, d)); return vec4(mix(S(uv).rgb, dot1, uAmt), S(uv).a);`);
add('Retro', 'gameboy', '8-bit Green', `vec2 cells = uRes / 4.0; vec2 q = (floor(uv * cells) + 0.5) / cells; float l = luma(S(q).rgb);
  vec3 p0 = vec3(0.06, 0.22, 0.06), p1 = vec3(0.19, 0.38, 0.19), p2 = vec3(0.55, 0.67, 0.06), p3 = vec3(0.61, 0.74, 0.06);
  vec3 c = l < 0.25 ? p0 : l < 0.5 ? p1 : l < 0.75 ? p2 : p3; return vec4(mix(S(uv).rgb, c, uAmt), S(uv).a);`, 1.0);

// ---- Distort ----
add('Distort', 'glitch', 'Glitch', `float t = floor(uTime * 12.0); float band = floor(uv.y * 30.0);
  float on = step(1.0 - uAmt * 0.35, rand(vec2(band, t)));
  vec2 q = uv + vec2((rand(vec2(t, band)) - 0.5) * 0.15 * on, 0.0);
  float sh = 0.01 * uAmt * (0.5 + rand(vec2(t, 3.0)));
  return vec4(S(q + vec2(sh, 0)).r, S(q).g, S(q - vec2(sh, 0)).b, S(q).a);`);
add('Distort', 'rgb-split', 'Chromatic Split', `vec2 d = (uv - 0.5) * uAmt * 0.03;
  return vec4(S(uv + d).r, S(uv).g, S(uv - d).b, S(uv).a);`, 0.5);
add('Distort', 'wave', 'Wave', `vec2 q = uv + vec2(sin(uv.y * 20.0 + uTime * 3.0), cos(uv.x * 14.0 + uTime * 2.0)) * 0.012 * uAmt; return S(q);`);
add('Distort', 'swirl', 'Swirl', `vec2 d = (uv - 0.5) * vec2(aspect(), 1.0); float r = length(d);
  float a = uAmt * 4.0 * smoothstep(0.7, 0.0, r); d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
  return S(d / vec2(aspect(), 1.0) + 0.5);`, 0.5);
add('Distort', 'shake', 'Camera Shake', `float t = uTime * 14.0; vec2 off = vec2(noise(vec2(t, 0.0)) - 0.5, noise(vec2(0.0, t)) - 0.5) * 0.04 * uAmt;
  float a = (noise(vec2(t, t)) - 0.5) * 0.04 * uAmt; vec2 d = (uv - 0.5) / 1.06; d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
  return S(d + 0.5 + off);`);
add('Distort', 'zoom-pulse', 'Zoom Pulse', `float b = pow(fract(uTime * 2.0), 3.0); float z = 1.0 - (1.0 - b) * 0.08 * uAmt;
  return S((uv - 0.5) * z + 0.5);`);
add('Distort', 'water', 'Underwater', `vec2 q = uv + vec2(fbm(uv * 5.0 + uTime * 0.4) - 0.5, fbm(uv * 5.0 - uTime * 0.3) - 0.5) * 0.04 * uAmt;
  vec4 c = S(q); return vec4(mix(c.rgb, c.rgb * vec3(0.6, 0.9, 1.1) + vec3(0.0, 0.05, 0.1), uAmt), c.a);`);
add('Distort', 'heat', 'Heat Haze', `vec2 q = uv + vec2(0.0, (noise(vec2(uv.x * 30.0, uv.y * 10.0 - uTime * 4.0)) - 0.5) * 0.012 * uAmt); return S(q);`);

// ---- Stylize ----
add('Stylize', 'mirror-h', 'Mirror', `vec2 q = vec2(uv.x < 0.5 ? uv.x : 1.0 - uv.x, uv.y); return mix(S(uv), S(q), step(0.01, uAmt));`, 1.0);
add('Stylize', 'mirror-v', 'Mirror Vertical', `vec2 q = vec2(uv.x, uv.y > 0.5 ? uv.y : 1.0 - uv.y); return mix(S(uv), S(q), step(0.01, uAmt));`, 1.0);
add('Stylize', 'kaleido', 'Kaleidoscope', `vec2 d = (uv - 0.5) * vec2(aspect(), 1.0); float a = atan(d.y, d.x) + uTime * 0.2; float r = length(d);
  float n = floor(mix(3.0, 10.0, uAmt)); float seg = PI / n; a = abs(mod(a, seg * 2.0) - seg);
  return S(vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0) + 0.5);`, 0.5);
add('Stylize', 'tile', 'Split Screen 2×2', `float n = uAmt > 0.5 ? 3.0 : 2.0; return S(fract(uv * n));`, 0.3);
add('Stylize', 'sketch', 'Sketch', `vec2 px = 1.0 / uRes; float tl = luma(S(uv + px * vec2(-1, 1)).rgb), tr = luma(S(uv + px).rgb), bl = luma(S(uv - px).rgb), br = luma(S(uv + px * vec2(1, -1)).rgb);
  float e = length(vec2(tr + br - tl - bl, tl + tr - bl - br)) * 4.0; vec3 c = vec3(1.0 - clamp(e, 0.0, 1.0));
  return vec4(mix(S(uv).rgb, c, uAmt), S(uv).a);`, 1.0);
add('Stylize', 'neon-edges', 'Neon Edges', `vec2 px = 1.5 / uRes; vec3 c0 = S(uv).rgb;
  float gx = luma(S(uv + vec2(px.x, 0)).rgb) - luma(S(uv - vec2(px.x, 0)).rgb); float gy = luma(S(uv + vec2(0, px.y)).rgb) - luma(S(uv - vec2(0, px.y)).rgb);
  float e = clamp(length(vec2(gx, gy)) * 6.0, 0.0, 1.0); vec3 neon = e * (0.5 + 0.5 * cos(uTime + uv.xyx * 4.0 + vec3(0, 2, 4)));
  return vec4(mix(c0, neon + c0 * 0.15, uAmt), S(uv).a);`);
add('Stylize', 'emboss', 'Emboss', `vec2 px = 1.0 / uRes; vec3 c = S(uv - px).rgb - S(uv + px).rgb; float l = luma(c) * 2.0 + 0.5;
  return vec4(mix(S(uv).rgb, vec3(l), uAmt), S(uv).a);`);
add('Stylize', 'oil', 'Oil Paint', `float r = 2.0 + uAmt * 4.0; vec2 px = r / uRes; vec3 m = vec3(0);
  for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++){ vec3 s = S(uv + vec2(x, y) * px).rgb; m += s; }
  m /= 25.0; return vec4(mix(S(uv).rgb, floor(m * 8.0 + 0.5) / 8.0, uAmt), S(uv).a);`);
add('Stylize', 'letterbox', 'Cinema Bars', `vec4 c = S(uv); float target = 1.0 / 2.39 * aspect(); float bar = (1.0 - min(target, 1.0)) * 0.5 * (uAmt / 0.7);
  return mix(c, vec4(0, 0, 0, 1), step(uv.y, bar) + step(1.0 - bar, uv.y));`, 0.7);
add('Stylize', 'border', 'White Border', `float b = uAmt * 0.06; vec2 q = (uv - 0.5) / (1.0 - b * 2.0) + 0.5; vec4 c = S(q);
  return inside(q) > 0.5 ? c : vec4(1.0);`, 0.5);

// ---- Color FX ----
add('Color FX', 'invert', 'Invert', `vec4 c = S(uv); return vec4(mix(c.rgb, c.a - c.rgb, uAmt), c.a);`, 1.0);
add('Color FX', 'thermal', 'Thermal', `vec4 c = S(uv); float l = luma(c.rgb);
  vec3 t = l < 0.33 ? mix(vec3(0, 0, 0.4), vec3(0.6, 0, 0.6), l * 3.0) : l < 0.66 ? mix(vec3(0.6, 0, 0.6), vec3(1, 0.5, 0), (l - 0.33) * 3.0) : mix(vec3(1, 0.5, 0), vec3(1, 1, 0.6), (l - 0.66) * 3.0);
  return vec4(mix(c.rgb, t, uAmt), c.a);`, 1.0);
add('Color FX', 'night-vision', 'Night Vision', `vec4 c = S(uv); float l = luma(c.rgb) * 1.6 + (rand(uv * uRes + uTime) - 0.5) * 0.2;
  float v = 1.0 - smoothstep(0.3, 0.75, length((uv - 0.5) * vec2(aspect(), 1.0)) * 0.9);
  return vec4(mix(c.rgb, vec3(0.1, 1.0, 0.2) * l * v, uAmt), c.a);`, 1.0);
add('Color FX', 'duotone', 'Duotone', `vec4 c = S(uv); float l = luma(c.rgb); vec3 d = mix(vec3(0.15, 0.05, 0.4), vec3(1.0, 0.55, 0.45), l);
  return vec4(mix(c.rgb, d, uAmt), c.a);`, 1.0);
add('Color FX', 'rainbow', 'Rainbow Shift', `vec4 c = S(uv); vec3 r = 0.5 + 0.5 * cos(uTime * 1.5 + uv.x * 3.0 + vec3(0, 2, 4));
  return vec4(mix(c.rgb, c.rgb * r * 1.6, uAmt * 0.7), c.a);`, 0.6);
add('Color FX', 'color-pop', 'Color Pop (Red)', `vec4 c = S(uv); float l = luma(c.rgb); float redness = smoothstep(0.08, 0.25, c.r - max(c.g, c.b));
  return vec4(mix(c.rgb, mix(vec3(l), c.rgb * 1.1, redness), uAmt), c.a);`, 1.0);
add('Color FX', 'strobe', 'Strobe Flash', `vec4 c = S(uv); float f = step(0.8, fract(uTime * 4.0)); return vec4(c.rgb + f * uAmt * 0.6, c.a);`, 0.5);

// ---- Weather & Light ----
add('Weather & Light', 'light-leak', 'Light Leak', `vec4 c = S(uv); float t = uTime * 0.3;
  vec2 p1 = vec2(0.15 + 0.2 * sin(t), 0.7 + 0.1 * cos(t * 1.3)), p2 = vec2(0.85 + 0.1 * cos(t * 0.7), 0.3);
  vec3 l = vec3(1.0, 0.45, 0.15) * exp(-length((uv - p1) * vec2(1.0, 1.5)) * 3.0) + vec3(1.0, 0.25, 0.5) * exp(-length(uv - p2) * 4.0);
  return vec4(c.rgb + l * uAmt * (1.0 - c.rgb * 0.5), c.a);`, 0.7);
add('Weather & Light', 'sun-rays', 'Sun Rays', `vec4 c = S(uv); vec2 src = vec2(0.8, 1.05); vec2 d = uv - src; float a = atan(d.y, d.x);
  float rays = pow(0.5 + 0.5 * sin(a * 24.0 + uTime * 0.5) * sin(a * 7.0 - uTime * 0.3), 3.0) * smoothstep(1.2, 0.0, length(d));
  return vec4(c.rgb + vec3(1.0, 0.9, 0.7) * rays * uAmt * 0.6, c.a);`);
add('Weather & Light', 'rain', 'Rain', `vec4 c = S(uv); vec2 q = vec2(uv.x * 80.0 + uv.y * 8.0, uv.y * 4.0 + uTime * 6.0);
  float col = floor(q.x); float drop = step(0.92, rand(vec2(col, floor(q.y + rand(vec2(col)) * 10.0)))) * smoothstep(0.0, 0.6, fract(q.y + rand(vec2(col)) * 10.0));
  float s = drop * smoothstep(0.5, 0.0, abs(fract(q.x) - 0.5) * 3.0);
  return vec4(c.rgb * (1.0 - 0.25 * uAmt) + vec3(0.7, 0.8, 0.9) * s * uAmt * 0.7, c.a);`);
add('Weather & Light', 'snow', 'Snow', `vec4 c = S(uv); vec3 add = vec3(0);
  for (int l = 0; l < 3; l++){ float fl = float(l); float sc = 12.0 + fl * 10.0; vec2 q = uv * vec2(sc * aspect(), sc);
    q.y += uTime * (1.0 + fl * 0.5); q.x += sin(uTime * 0.7 + q.y * 0.4) * 0.3; vec2 id = floor(q); vec2 f = fract(q) - 0.5;
    vec2 off = vec2(rand(id), rand(id + 1.0)) - 0.5; float d = length(f - off * 0.6);
    add += vec3(smoothstep(0.08 - fl * 0.015, 0.0, d)) * step(0.5, rand(id + 9.0)); }
  return vec4(c.rgb + add * uAmt, c.a);`);
add('Weather & Light', 'fog', 'Fog', `vec4 c = S(uv); float f = fbm(uv * 3.0 + vec2(uTime * 0.05, 0.0)) * (1.2 - uv.y);
  return vec4(mix(c.rgb, vec3(0.85, 0.88, 0.9), clamp(f * uAmt, 0.0, 0.9)), c.a);`, 0.5);
add('Weather & Light', 'sparkles', 'Sparkles', `vec4 c = S(uv); vec3 a = vec3(0);
  for (int i = 0; i < 30; i++){ float fi = float(i); vec2 p = vec2(rand(vec2(fi, 11.0)), rand(vec2(fi, 13.0)));
    float tw = pow(0.5 + 0.5 * sin(uTime * (2.0 + rand(vec2(fi)) * 4.0) + fi), 8.0); vec2 d = (uv - p) * vec2(aspect(), 1.0);
    float s = (0.0015 / (abs(d.x) + 0.001) * 0.002 / (abs(d.y) + 0.002) + 0.0004 / dot(d, d)) * tw; a += vec3(1.0, 0.95, 0.8) * min(s, 2.0) * 0.04; }
  return vec4(c.rgb + a * uAmt, c.a);`);

add('Stylize', 'comic', 'Comic Book', `vec2 px = 1.0 / uRes; vec3 c = S(uv).rgb; float e = length(vec2(luma(S(uv + vec2(px.x, 0)).rgb) - luma(S(uv - vec2(px.x, 0)).rgb), luma(S(uv + vec2(0, px.y)).rgb) - luma(S(uv - vec2(0, px.y)).rgb))) * 5.0;
  vec3 post = floor(c * 5.0 + 0.5) / 5.0; vec3 o2 = mix(post * 1.15, vec3(0.0), smoothstep(0.3, 0.6, e)); return vec4(mix(c, o2, uAmt), S(uv).a);`, 1.0);
add('Blur & Lens', 'radial-blur', 'Spin Blur', `vec2 d = (uv - 0.5) * vec2(aspect(), 1.0); vec4 c = vec4(0);
  for (int i = 0; i < 24; i++){ float a = (float(i) / 23.0 - 0.5) * uAmt * 0.12; vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * d; c += S(q / vec2(aspect(), 1.0) + 0.5); }
  return c / 24.0;`, 0.4);
add('Distort', 'pixel-sort', 'Data Moshing', `float t = floor(uTime * 8.0); float band = floor(uv.y * 60.0); float on = step(1.0 - uAmt * 0.5, rand(vec2(band, t)));
  float shift = rand(vec2(band * 1.7, t)) * 0.2 * on; vec4 c = S(vec2(uv.x - shift * smoothstep(0.0, 1.0, uv.x), uv.y));
  return vec4(mix(c.rgb, c.rgb * vec3(1.1, 0.9, 1.2), on * 0.5), c.a);`);
add('Weather & Light', 'god-glow', 'Dreamy Glow', `vec4 c = S(uv); vec4 b = vec4(0);
  for (int i = 0; i < 16; i++){ float a = float(i) * 2.39996; float r = 0.015 * sqrt(float(i) / 16.0); b += S(uv + vec2(cos(a), sin(a) * aspect()) * r); }
  b /= 16.0; vec3 glow = max(b.rgb - 0.55, 0.0) * 2.2; return vec4(c.rgb + glow * uAmt + (1.0 - c.rgb) * b.rgb * 0.15 * uAmt, c.a);`, 0.7);
add('Retro', 'cassette', 'Camcorder Look', `vec2 q = uv + vec2(sin(uv.y * 400.0 + uTime * 30.0) * 0.0006 * uAmt, 0.0); vec4 c = S(q);
  vec3 col = c.rgb; col = mix(col, vec3(luma(col)), 0.2 * uAmt); col *= vec3(1.06, 1.0, 0.92); col += (rand(uv * uRes + uTime) - 0.5) * 0.08 * uAmt;
  float v = 1.0 - smoothstep(0.5, 1.0, length(uv - 0.5) * 1.4) * 0.5 * uAmt; return vec4(col * v, c.a);`, 0.8);

export const EFFECTS = E;
export const EFFECT_CATS = [...new Set(E.map((e) => e.cat))];
export const effectById = (id) => E.find((e) => e.id === id);

// ---- Color grade shader (manual color + filter preset) ----
export const GRADE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float exposure, brightness, contrast, saturation, temperature, tint, hue, highlights, shadows, vignette, sharpen;
uniform float fade, grain, splitAmt, bw, sepia, vibrance;
uniform vec3 shadowCol, highCol;
in vec2 vUv;
out vec4 o;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
void main(){
  vec4 s = texture(uTex, vUv);
  if (s.a <= 0.0) { o = s; return; }
  vec3 c = s.rgb / s.a;
  if (sharpen > 0.0) {
    vec2 px = 1.0 / uRes;
    vec3 n = texture(uTex, vUv + vec2(px.x, 0)).rgb + texture(uTex, vUv - vec2(px.x, 0)).rgb + texture(uTex, vUv + vec2(0, px.y)).rgb + texture(uTex, vUv - vec2(0, px.y)).rgb;
    c += (c * 4.0 - n / max(s.a, 0.001)) * sharpen;
  }
  c *= pow(2.0, exposure);
  c += brightness * 0.5;
  c.r += temperature * 0.12; c.b -= temperature * 0.12; c.g += tint * 0.1;
  float l = luma(c);
  c += (highlights * 0.4) * smoothstep(0.5, 1.0, l) + (shadows * 0.4) * (1.0 - smoothstep(0.0, 0.5, l));
  c = (c - 0.5) * (1.0 + contrast) + 0.5;
  l = luma(c);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + saturation + vibrance * (1.0 - (mx - mn)));
  if (hue != 0.0) c = hueShift(c, hue * 3.14159);
  l = clamp(luma(c), 0.0, 1.0);
  c = mix(c, c + shadowCol * (1.0 - l) + highCol * l, splitAmt);
  c = mix(c, vec3(luma(c)), bw);
  c = mix(c, vec3(luma(c)) * vec3(1.12, 0.98, 0.78), sepia);
  c = c * (1.0 - fade * 0.25) + fade * 0.12;
  c += (rand(vUv * uRes + fract(uTime) * 91.0) - 0.5) * grain * 0.2;
  float d = length((vUv - 0.5) * 1.42);
  c *= 1.0 - smoothstep(0.4, 1.05, d) * vignette;
  o = vec4(clamp(c, 0.0, 1.0) * s.a, s.a);
}`;

export const GRADE_KEYS = ['exposure', 'brightness', 'contrast', 'saturation', 'temperature', 'tint', 'hue', 'highlights', 'shadows', 'vignette', 'sharpen', 'fade', 'grain', 'splitAmt', 'bw', 'sepia', 'vibrance'];

// Filter presets. Values add on top of the clip's own color adjustments, scaled by the filter amount.
const F = [];
const fl = (cat, id, name, v) => F.push({ id, name, cat, v });
fl('Popular', 'vivid', 'Vivid', { contrast: 0.15, saturation: 0.35, vibrance: 0.2 });
fl('Popular', 'warm', 'Warm', { temperature: 0.5, saturation: 0.08, highlights: 0.05 });
fl('Popular', 'cool', 'Cool', { temperature: -0.5, tint: 0.03, contrast: 0.05 });
fl('Popular', 'bright', 'Bright & Airy', { exposure: 0.35, contrast: -0.12, saturation: -0.05, fade: 0.25, shadows: 0.2 });
fl('Popular', 'punchy', 'Punchy', { contrast: 0.35, saturation: 0.25, shadows: -0.1, vignette: 0.25 });
fl('Popular', 'soft', 'Soft Glow', { contrast: -0.15, fade: 0.35, highlights: 0.15, saturation: -0.05 });
fl('Cinematic', 'teal-orange', 'Teal & Orange', { contrast: 0.2, saturation: 0.1, splitAmt: 0.7, shadowCol: [-0.08, 0.04, 0.12], highCol: [0.12, 0.04, -0.08], vignette: 0.25 });
fl('Cinematic', 'blockbuster', 'Blockbuster', { contrast: 0.3, saturation: -0.1, splitAmt: 0.9, shadowCol: [-0.06, 0.03, 0.1], highCol: [0.1, 0.05, -0.04], vignette: 0.35 });
fl('Cinematic', 'moody', 'Moody', { exposure: -0.25, contrast: 0.2, saturation: -0.3, temperature: -0.15, vignette: 0.45, shadows: -0.15 });
fl('Cinematic', 'noir-blue', 'Night Blue', { exposure: -0.2, temperature: -0.6, saturation: -0.2, contrast: 0.2, vignette: 0.4 });
fl('Cinematic', 'golden-hour', 'Golden Hour', { temperature: 0.6, tint: 0.05, highlights: 0.1, splitAmt: 0.5, highCol: [0.12, 0.06, -0.06], shadowCol: [0.03, 0, -0.02] });
fl('Cinematic', 'arctic', 'Arctic', { temperature: -0.4, saturation: -0.35, exposure: 0.15, fade: 0.2, contrast: 0.05 });
fl('Cinematic', 'desert', 'Desert', { temperature: 0.45, saturation: -0.15, contrast: 0.15, fade: 0.15, splitAmt: 0.5, highCol: [0.08, 0.05, -0.02] });
fl('Cinematic', 'matrix', 'Code Green', { tint: -0.35, saturation: -0.2, contrast: 0.25, splitAmt: 0.6, shadowCol: [-0.04, 0.08, -0.02], highCol: [0, 0.06, 0] });
fl('Film', 'film-200', 'Film 200', { contrast: 0.08, saturation: 0.05, fade: 0.2, grain: 0.35, splitAmt: 0.5, highCol: [0.06, 0.04, -0.02], shadowCol: [-0.02, 0.02, 0.04] });
fl('Film', 'film-400', 'Film 400', { contrast: 0.12, saturation: -0.08, fade: 0.25, grain: 0.5, temperature: 0.12 });
fl('Film', 'portra', 'Portrait Film', { exposure: 0.1, contrast: -0.05, saturation: -0.1, temperature: 0.15, fade: 0.15, grain: 0.25, highlights: -0.08 });
fl('Film', 'slide-film', 'Slide Film', { contrast: 0.3, saturation: 0.4, vignette: 0.2, grain: 0.2 });
fl('Film', 'cross-process', 'Cross Process', { contrast: 0.25, saturation: 0.2, splitAmt: 1.0, shadowCol: [0, 0.05, 0.15], highCol: [0.1, 0.1, -0.12] });
fl('Vintage', 'retro', 'Retro', { fade: 0.4, saturation: -0.2, temperature: 0.25, contrast: -0.05, grain: 0.3, vignette: 0.35 });
fl('Vintage', '70s', '1970s', { temperature: 0.4, tint: 0.08, fade: 0.35, saturation: -0.1, splitAmt: 0.6, shadowCol: [0.06, 0.02, -0.05], grain: 0.25 });
fl('Vintage', 'polaroid', 'Instant Photo', { exposure: 0.15, fade: 0.4, contrast: -0.1, temperature: 0.1, splitAmt: 0.5, shadowCol: [0, 0.04, 0.08], vignette: 0.2 });
fl('Vintage', 'sepia', 'Sepia', { sepia: 0.9, fade: 0.15, vignette: 0.3, contrast: 0.05 });
fl('Vintage', 'faded', 'Faded', { fade: 0.6, contrast: -0.2, saturation: -0.25 });
fl('Vintage', 'lomo', 'Lomo', { contrast: 0.35, saturation: 0.3, vignette: 0.75, splitAmt: 0.4, shadowCol: [0, 0.04, 0.1] });
fl('Black & White', 'bw', 'Classic B&W', { bw: 1, contrast: 0.15 });
fl('Black & White', 'noir', 'Noir', { bw: 1, contrast: 0.5, exposure: -0.15, vignette: 0.5 });
fl('Black & White', 'silver', 'Silver', { bw: 1, contrast: -0.05, exposure: 0.15, fade: 0.2, grain: 0.2 });
fl('Black & White', 'high-key', 'High Key', { bw: 1, exposure: 0.5, contrast: 0.2, shadows: 0.3 });
fl('Black & White', 'grit', 'Grit', { bw: 1, contrast: 0.45, grain: 0.7, sharpen: 0.4, vignette: 0.35 });
fl('Mood', 'dreamy', 'Dreamy', { exposure: 0.2, fade: 0.3, saturation: -0.05, tint: 0.12, temperature: 0.08, highlights: 0.15 });
fl('Mood', 'cyberpunk', 'Neon Night', { contrast: 0.25, saturation: 0.35, tint: 0.3, temperature: -0.3, splitAmt: 0.8, shadowCol: [0.08, -0.04, 0.16], highCol: [0.1, 0, 0.08] });
fl('Mood', 'pastel', 'Pastel', { exposure: 0.25, contrast: -0.25, saturation: -0.2, fade: 0.35, tint: 0.05 });
fl('Mood', 'autumn', 'Autumn', { temperature: 0.45, saturation: 0.15, hue: -0.02, splitAmt: 0.5, highCol: [0.1, 0.03, -0.06] });
fl('Mood', 'spring', 'Fresh Spring', { exposure: 0.1, saturation: 0.2, tint: -0.12, temperature: 0.05, vibrance: 0.3 });
fl('Mood', 'horror', 'Horror', { saturation: -0.6, tint: -0.15, contrast: 0.35, exposure: -0.3, vignette: 0.6, grain: 0.3 });
fl('Food & Travel', 'food', 'Delicious', { saturation: 0.25, temperature: 0.2, contrast: 0.12, highlights: 0.08, sharpen: 0.2 });
fl('Food & Travel', 'tropical', 'Tropical', { saturation: 0.4, vibrance: 0.3, tint: -0.06, contrast: 0.12, exposure: 0.08 });
fl('Food & Travel', 'city', 'City Lights', { contrast: 0.25, saturation: -0.1, temperature: -0.15, splitAmt: 0.6, highCol: [0.08, 0.05, 0], vignette: 0.3 });
fl('Food & Travel', 'mountain', 'Alpine', { contrast: 0.2, saturation: 0.1, temperature: -0.2, highlights: -0.15, shadows: 0.15, sharpen: 0.25 });

fl('Popular', 'clean', 'Clean & Crisp', { contrast: 0.1, saturation: 0.08, sharpen: 0.3, highlights: -0.05, shadows: 0.08 });
fl('Popular', 'golden', 'Glow Up', { exposure: 0.12, temperature: 0.2, highlights: 0.12, fade: 0.1, vibrance: 0.15 });
fl('Cinematic', 'western', 'Western', { temperature: 0.55, saturation: -0.25, contrast: 0.3, fade: 0.1, vignette: 0.45, grain: 0.25 });
fl('Cinematic', 'scifi', 'Sci-Fi', { temperature: -0.45, tint: -0.1, contrast: 0.3, saturation: -0.15, splitAmt: 0.7, shadowCol: [-0.02, 0.06, 0.12], highCol: [0, 0.05, 0.06] });
fl('Film', 'bleach', 'Bleach Bypass', { saturation: -0.55, contrast: 0.45, highlights: 0.1, sharpen: 0.2 });
fl('Vintage', '90s', '1990s', { saturation: 0.1, temperature: 0.08, fade: 0.2, contrast: 0.1, grain: 0.3, tint: 0.05 });
fl('Black & White', 'cyanotype', 'Cyanotype', { bw: 1, splitAmt: 1, shadowCol: [-0.05, 0.05, 0.25], highCol: [0, 0.05, 0.12], contrast: 0.15 });
fl('Mood', 'sunny', 'Sunny Day', { exposure: 0.15, temperature: 0.3, saturation: 0.2, vibrance: 0.2, highlights: 0.05 });
fl('Mood', 'winter', 'Winter', { temperature: -0.55, saturation: -0.25, exposure: 0.2, fade: 0.15, highlights: 0.15 });
fl('Food & Travel', 'desert-rose', 'Desert Rose', { temperature: 0.3, tint: 0.15, saturation: 0.05, fade: 0.2, splitAmt: 0.5, highCol: [0.1, 0.03, 0.04] });

export const FILTERS = F;
export const FILTER_CATS = [...new Set(F.map((f) => f.cat))];
export const filterById = (id) => F.find((f) => f.id === id);
