// Transition library. Each entry is the body of `vec4 tr(vec2 uv, float p)` mixing clip A (outgoing)
// into clip B (incoming) as progress p goes 0 to 1. uv is 0..1 with y pointing up.

export const TRANSITION_HEADER = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uP;
uniform vec2 uRes;
in vec2 vUv;
out vec4 o;
#define PI 3.14159265359
vec4 A(vec2 uv){ return texture(uA, uv); }
vec4 B(vec2 uv){ return texture(uB, uv); }
float inside(vec2 uv){ return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
vec4 Ab(vec2 uv){ return texture(uA, uv) * inside(uv); }
vec4 Bb(vec2 uv){ return texture(uB, uv) * inside(uv); }
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(rand(i), rand(i+vec2(1,0)), f.x), mix(rand(i+vec2(0,1)), rand(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.0; a *= 0.5; } return v; }
float aspect(){ return uRes.x / uRes.y; }
float eio(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
vec4 tr(vec2 uv, float p);
void main(){ o = tr(vUv, clamp(uP, 0.0, 1.0)); }
`;

const T = [];
const add = (cat, id, name, body) => T.push({ id, name, cat, glsl: `vec4 tr(vec2 uv, float p){\n${body}\n}` });

// ---- Basic ----
add('Basic', 'dissolve', 'Dissolve', 'return mix(A(uv), B(uv), p);');
add('Basic', 'fade-black', 'Dip to Black', 'return p < 0.5 ? A(uv) * (1.0 - p*2.0) : B(uv) * (p*2.0 - 1.0);');
add('Basic', 'fade-white', 'Dip to White', `vec4 w = vec4(1.0);
  return p < 0.5 ? mix(A(uv), w, p*2.0) : mix(w, B(uv), p*2.0 - 1.0);`);
add('Basic', 'flash', 'Flash', `float f = exp(-pow((p - 0.5) * 7.0, 2.0));
  vec4 c = mix(A(uv), B(uv), smoothstep(0.4, 0.6, p));
  return c + vec4(f);`);
add('Basic', 'noise-dissolve', 'Noise Dissolve', `float n = fbm(uv * 8.0);
  return mix(A(uv), B(uv), smoothstep(n - 0.1, n + 0.1, p * 1.2 - 0.1));`);
add('Basic', 'luma', 'Luma Fade', `vec4 b = B(uv); float l = dot(b.rgb, vec3(0.299, 0.587, 0.114));
  return mix(A(uv), b, smoothstep(l - 0.15, l + 0.15, p * 1.3 - 0.15));`);
add('Basic', 'blur-dissolve', 'Blur Dissolve', `float r = sin(p * PI) * 0.025; vec4 a = vec4(0), b = vec4(0);
  for (int i = 0; i < 16; i++){ float ang = float(i) * 2.39996; float rr = r * sqrt(float(i) / 16.0);
    vec2 o2 = vec2(cos(ang), sin(ang) * aspect()) * rr; a += A(uv + o2); b += B(uv + o2); }
  return mix(a, b, smoothstep(0.3, 0.7, p)) / 16.0;`);
add('Basic', 'color-fade', 'Color Burn Fade', `vec4 a = A(uv), b = B(uv);
  float k = sin(p * PI); vec4 tint = vec4(1.0, 0.45, 0.1, 1.0);
  return mix(mix(a, b, p), tint * max(a, b), k * 0.6);`);

// ---- Slide ----
add('Slide', 'push-left', 'Push Left', `float e = eio(p); return Ab(uv + vec2(e, 0.0)) + Bb(uv + vec2(e - 1.0, 0.0));`);
add('Slide', 'push-right', 'Push Right', `float e = eio(p); return Ab(uv - vec2(e, 0.0)) + Bb(uv - vec2(e - 1.0, 0.0));`);
add('Slide', 'push-up', 'Push Up', `float e = eio(p); return Ab(uv - vec2(0.0, e)) + Bb(uv - vec2(0.0, e - 1.0));`);
add('Slide', 'push-down', 'Push Down', `float e = eio(p); return Ab(uv + vec2(0.0, e)) + Bb(uv + vec2(0.0, e - 1.0));`);
add('Slide', 'slide-in-left', 'Slide In', `float e = eio(p); vec4 b = Bb(uv + vec2(1.0 - e, 0.0));
  return b + A(uv) * (1.0 - b.a);`);
add('Slide', 'slide-out', 'Slide Out', `float e = eio(p); vec4 a = Ab(uv - vec2(e, 0.0));
  return a + B(uv) * (1.0 - a.a);`);
add('Slide', 'whip-pan', 'Whip Pan', `float e = eio(p); vec4 c = vec4(0); float blur = sin(p * PI) * 0.12;
  for (int i = 0; i < 20; i++){ float s = (float(i) / 19.0 - 0.5) * blur;
    vec2 q = uv + vec2(e + s, 0.0); c += Ab(q) + Bb(q - vec2(1.0, 0.0)); }
  return c / 20.0;`);
add('Slide', 'whip-vertical', 'Whip Up', `float e = eio(p); vec4 c = vec4(0); float blur = sin(p * PI) * 0.12;
  for (int i = 0; i < 20; i++){ float s = (float(i) / 19.0 - 0.5) * blur;
    vec2 q = uv - vec2(0.0, e + s); c += Ab(q) + Bb(q + vec2(0.0, 1.0)); }
  return c / 20.0;`);
add('Slide', 'split-slide', 'Split Slide', `float e = eio(p); float top = step(0.5, uv.y);
  vec2 q = uv + vec2(mix(e, -e, top), 0.0);
  vec4 a = Ab(q); return a + B(uv) * (1.0 - a.a);`);
add('Slide', 'bounce-in', 'Bounce In', `float t = p; float b = 1.0 - abs(cos(t * PI * 2.5)) * (1.0 - t) * (1.0 - t);
  b = t < 0.4 ? pow(t / 0.4, 2.0) : b; vec4 bb = Bb(uv + vec2(0.0, 1.0 - clamp(b, 0.0, 1.2)));
  return bb + A(uv) * (1.0 - bb.a);`);

// ---- Wipe ----
add('Wipe', 'wipe-right', 'Wipe Right', 'return mix(A(uv), B(uv), smoothstep(uv.x - 0.02, uv.x + 0.02, p * 1.04 - 0.02));');
add('Wipe', 'wipe-left', 'Wipe Left', 'return mix(A(uv), B(uv), smoothstep(1.0 - uv.x - 0.02, 1.0 - uv.x + 0.02, p * 1.04 - 0.02));');
add('Wipe', 'wipe-up', 'Wipe Up', 'return mix(A(uv), B(uv), smoothstep(uv.y - 0.02, uv.y + 0.02, p * 1.04 - 0.02));');
add('Wipe', 'wipe-down', 'Wipe Down', 'return mix(A(uv), B(uv), smoothstep(1.0 - uv.y - 0.02, 1.0 - uv.y + 0.02, p * 1.04 - 0.02));');
add('Wipe', 'wipe-diagonal', 'Diagonal Wipe', `float d = (uv.x + uv.y) * 0.5;
  return mix(A(uv), B(uv), smoothstep(d - 0.04, d + 0.04, p * 1.08 - 0.04));`);
add('Wipe', 'barn-door-h', 'Barn Door', `float d = abs(uv.x - 0.5) * 2.0;
  return mix(A(uv), B(uv), step(d, p));`);
add('Wipe', 'barn-door-v', 'Barn Door Vertical', `float d = abs(uv.y - 0.5) * 2.0;
  return mix(A(uv), B(uv), step(d, p));`);
add('Wipe', 'clock', 'Clock Wipe', `vec2 c = (uv - 0.5) * vec2(aspect(), 1.0);
  float a = atan(c.x, c.y) / (2.0 * PI) + 0.5;
  return mix(A(uv), B(uv), step(a, p));`);
add('Wipe', 'radial', 'Radial Sweep', `vec2 c = (uv - 0.5) * vec2(aspect(), 1.0);
  float a = abs(atan(c.x, -c.y)) / PI;
  return mix(A(uv), B(uv), smoothstep(a - 0.03, a + 0.03, p * 1.06 - 0.03));`);
add('Wipe', 'blinds-h', 'Blinds', `float s = fract(uv.y * 10.0); return mix(A(uv), B(uv), step(s, p));`);
add('Wipe', 'blinds-v', 'Venetian', `float s = fract(uv.x * 12.0); return mix(A(uv), B(uv), step(s, p));`);
add('Wipe', 'checker', 'Checkerboard', `vec2 g = floor(uv * vec2(8.0 * aspect(), 8.0));
  float off = mod(g.x + g.y, 2.0) * 0.5; float q = clamp(p * 2.0 - off, 0.0, 1.0);
  return mix(A(uv), B(uv), step(fract(uv.x * 8.0 * aspect()), q));`);
add('Wipe', 'stripes', 'Stripes', `float row = floor(uv.y * 8.0); float dir = mod(row, 2.0);
  float x = mix(uv.x, 1.0 - uv.x, dir); float q = clamp(p * 1.5 - row * 0.06, 0.0, 1.0);
  return mix(A(uv), B(uv), step(x, q));`);
add('Wipe', 'soft-wipe', 'Soft Wipe', 'return mix(A(uv), B(uv), smoothstep(uv.x - 0.25, uv.x + 0.25, p * 1.5 - 0.25));');
add('Wipe', 'wave-wipe', 'Wave Wipe', `float edge = uv.x + sin(uv.y * 18.0 + p * 6.0) * 0.04;
  return mix(A(uv), B(uv), smoothstep(edge - 0.01, edge + 0.01, p * 1.2 - 0.1));`);

// ---- Shape ----
add('Shape', 'circle-open', 'Circle Open', `float d = length((uv - 0.5) * vec2(aspect(), 1.0));
  float r = p * length(vec2(aspect(), 1.0)) * 0.55;
  return mix(A(uv), B(uv), smoothstep(r + 0.01, r - 0.01, d));`);
add('Shape', 'circle-close', 'Circle Close', `float d = length((uv - 0.5) * vec2(aspect(), 1.0));
  float r = (1.0 - p) * length(vec2(aspect(), 1.0)) * 0.55;
  return mix(B(uv), A(uv), smoothstep(r + 0.01, r - 0.01, d));`);
add('Shape', 'diamond', 'Diamond', `vec2 c = abs(uv - 0.5) * vec2(aspect(), 1.0);
  float d = c.x + c.y; return mix(A(uv), B(uv), step(d, p * (aspect() * 0.5 + 0.5)));`);
add('Shape', 'heart', 'Heart', `vec2 q = (uv - vec2(0.5, 0.42)) * vec2(aspect(), 1.0) / max(p * 1.6, 0.0001);
  q.y -= sqrt(abs(q.x)) * 0.5; float d = length(q);
  return mix(A(uv), B(uv), step(d, 0.42));`);
add('Shape', 'star', 'Star', `vec2 q = (uv - 0.5) * vec2(aspect(), 1.0);
  float a = atan(q.y, q.x); float r = length(q);
  float s = 0.6 + 0.4 * cos(a * 5.0 - PI * 0.5);
  return mix(A(uv), B(uv), step(r, p * s * 1.4));`);
add('Shape', 'iris', 'Iris Squares', `vec2 c = abs(uv - 0.5) * vec2(aspect(), 1.0);
  float d = max(c.x, c.y); return mix(A(uv), B(uv), step(d, p * aspect() * 0.52));`);
add('Shape', 'circles-grid', 'Bubbles', `vec2 g = uv * vec2(10.0 * aspect(), 10.0); vec2 f = fract(g) - 0.5;
  float delay = rand(floor(g)) * 0.5; float r = clamp((p - delay) * 2.0, 0.0, 1.0) * 0.75;
  return mix(A(uv), B(uv), step(length(f), r));`);
add('Shape', 'triangles', 'Triangle Reveal', `vec2 g = uv * vec2(6.0 * aspect(), 6.0); vec2 f = fract(g);
  float tri = step(f.x, f.y); float id = rand(floor(g) + tri);
  return mix(A(uv), B(uv), step(id, p));`);

// ---- Zoom ----
add('Zoom', 'zoom-in', 'Zoom In', `float e = eio(p);
  vec2 qa = (uv - 0.5) / (1.0 + e * 1.5) + 0.5; vec2 qb = (uv - 0.5) / (0.4 + e * 0.6) + 0.5;
  return mix(Ab(qa), Bb(qb), smoothstep(0.35, 0.65, p));`);
add('Zoom', 'zoom-out', 'Zoom Out', `float e = eio(p);
  vec2 qa = (uv - 0.5) * (1.0 + e) + 0.5; vec2 qb = (uv - 0.5) * (2.0 - e) + 0.5;
  return mix(Ab(qa), Bb(qb), smoothstep(0.35, 0.65, p));`);
add('Zoom', 'cross-zoom', 'Cross Zoom', `float s = sin(p * PI) * 0.35; vec2 c = vec2(0.5);
  vec4 a = vec4(0), b = vec4(0);
  for (int i = 0; i < 24; i++){ float k = float(i) / 23.0; vec2 q = c + (uv - c) * (1.0 - s * k);
    a += A(q); b += B(q); }
  return mix(a, b, smoothstep(0.3, 0.7, p)) / 24.0;`);
add('Zoom', 'spin', 'Spin', `float e = eio(p); float ang = e * 2.0 * PI; float z = 1.0 + sin(p * PI) * 1.5;
  vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q * z;
  q = q / vec2(aspect(), 1.0) + 0.5;
  return mix(Ab(q), Bb(q), step(0.5, p));`);
add('Zoom', 'punch', 'Punch Zoom', `float z = p < 0.5 ? 1.0 - pow(p * 2.0, 3.0) * 0.6 : 0.4 + (1.0 - pow(1.0 - (p - 0.5) * 2.0, 3.0)) * 0.6;
  vec2 q = (uv - 0.5) * z + 0.5; return p < 0.5 ? A(q) : B(q);`);
add('Zoom', 'swirl', 'Swirl', `vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); float r = length(q);
  float ang = sin(p * PI) * 6.0 * (1.0 - smoothstep(0.0, 0.8, r));
  q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q; q = q / vec2(aspect(), 1.0) + 0.5;
  return mix(A(q), B(q), smoothstep(0.3, 0.7, p));`);
add('Zoom', 'tunnel', 'Tunnel', `vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); float r = length(q);
  float z = 1.0 + sin(p * PI) * 2.0 * r; vec2 s = q * z / vec2(aspect(), 1.0) + 0.5;
  return mix(Ab(s), Bb(s), smoothstep(0.4, 0.6, p));`);

// ---- 3D ----
add('3D', 'cube-left', 'Cube', `float e = eio(p); float persp = 0.6;
  // outgoing face rotates to the left, incoming face comes from the right
  vec2 qa = uv; qa.x = (uv.x) / max(1.0 - e, 0.0001);
  float sa = 1.0 + persp * e * (qa.x); qa.y = (uv.y - 0.5) * (1.0 + persp * e * (1.0 - qa.x)) + 0.5;
  vec2 qb = uv; qb.x = (uv.x - (1.0 - e)) / max(e, 0.0001);
  qb.y = (uv.y - 0.5) * (1.0 + persp * (1.0 - e) * qb.x) + 0.5;
  vec4 c = uv.x < 1.0 - e ? Ab(vec2(qa.x, qa.y)) : Bb(qb);
  return c * (0.75 + 0.25 * (uv.x < 1.0 - e ? 1.0 - e : e));`);
add('3D', 'flip', 'Flip', `float e = eio(p); float ang = e * PI; float c = cos(ang);
  float w = abs(c); vec2 q = vec2((uv.x - 0.5) / max(w, 0.0001) + 0.5, uv.y);
  float sh = 1.0 + 0.3 * sin(ang) * (q.x - 0.5) * (c > 0.0 ? 1.0 : -1.0);
  q.y = (uv.y - 0.5) * sh + 0.5;
  vec4 col = c > 0.0 ? Ab(q) : Bb(vec2(1.0 - q.x, q.y));
  return col * (0.6 + 0.4 * w);`);
add('3D', 'doorway', 'Doorway', `float e = eio(p);
  vec2 q = vec2(uv.x < 0.5 ? uv.x + e * 0.5 : uv.x - e * 0.5, uv.y);
  bool door = uv.x < 0.5 - e * 0.5 || uv.x > 0.5 + e * 0.5;
  vec4 a = vec4(0); if (door){ vec2 qa = uv.x < 0.5 ? vec2(uv.x / max(1.0 - e, 0.001), uv.y) : vec2(1.0 - (1.0 - uv.x) / max(1.0 - e, 0.001), uv.y); a = Ab(qa); }
  vec2 qb = (uv - 0.5) * (1.5 - e * 0.5) + 0.5;
  return door ? a : Bb(qb);`);
add('3D', 'page-turn', 'Page Turn', `float e = eio(p); float x = 1.0 - e * 1.2; float d = uv.x - x + (uv.y) * 0.2 * e;
  if (d < 0.0) return A(uv);
  vec2 back = vec2(x - d, uv.y); if (d < 0.12 && back.x > 0.0){ vec4 a = A(back); return mix(a, vec4(0.9), 0.55) * (1.0 - d * 2.0); }
  return B(uv) * (0.7 + 0.3 * smoothstep(0.0, 0.3, d));`);
add('3D', 'rotate-scale', 'Rotate Away', `float e = eio(p); float ang = e * PI * 0.5; float z = 1.0 - e * 0.5;
  vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q / max(z, 0.001);
  q = q / vec2(aspect(), 1.0) + 0.5; vec4 a = Ab(q) * (1.0 - e);
  return a + B(uv) * (1.0 - a.a);`);

// ---- Distort ----
add('Distort', 'ripple', 'Ripple', `vec2 d = uv - 0.5; float r = length(d);
  vec2 off = d / max(r, 0.001) * sin(r * 40.0 - p * 20.0) * 0.03 * sin(p * PI);
  return mix(A(uv + off), B(uv + off), smoothstep(0.3, 0.7, p));`);
add('Distort', 'pixelate', 'Pixelate', `float s = max(1.0, sin(p * PI) * 60.0); vec2 cells = uRes / s;
  vec2 q = (floor(uv * cells) + 0.5) / cells; return mix(A(q), B(q), step(0.5, p));`);
add('Distort', 'mosaic', 'Mosaic', `vec2 g = floor(uv * vec2(16.0 * aspect(), 16.0)); float r = rand(g);
  return mix(A(uv), B(uv), step(r, p));`);
add('Distort', 'wind', 'Wind', `float r = rand(vec2(0.0, uv.y * 80.0)); float m = smoothstep(0.0, -0.2, uv.x * 0.8 + 0.2 * r - (p * 1.2));
  return mix(A(uv), B(uv), m);`);
add('Distort', 'squeeze', 'Squeeze', `float e = eio(p);
  if (uv.y > e){ vec2 q = vec2(uv.x, (uv.y - e) / max(1.0 - e, 0.001)); return A(q); }
  return B(vec2(uv.x, uv.y / max(e, 0.001)));`);
add('Distort', 'stretch', 'Stretch', `float s = sin(p * PI); vec2 q = vec2(0.5 + (uv.x - 0.5) / (1.0 + s * 3.0), uv.y);
  return mix(A(q), B(q), smoothstep(0.4, 0.6, p));`);
add('Distort', 'liquid', 'Liquid', `float n = fbm(uv * 4.0 + p * 2.0); vec2 off = vec2(n - 0.5) * 0.15 * sin(p * PI);
  return mix(A(uv + off), B(uv - off), smoothstep(n - 0.2, n + 0.2, p * 1.4 - 0.2));`);
add('Distort', 'kaleido', 'Kaleidoscope', `vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); float a = atan(q.y, q.x); float r = length(q);
  float seg = PI / 3.0; float k = sin(p * PI);
  a = mix(a, abs(mod(a, seg * 2.0) - seg), k); vec2 s = vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.0) + 0.5;
  return mix(A(s), B(s), smoothstep(0.35, 0.65, p));`);

// ---- Glitch ----
add('Glitch', 'glitch', 'Glitch', `float k = sin(p * PI); float band = floor(uv.y * 24.0);
  float sh = (rand(vec2(band, floor(p * 18.0))) - 0.5) * 0.25 * k * step(0.55, rand(vec2(band * 3.1, floor(p * 12.0))));
  vec2 q = uv + vec2(sh, 0.0); vec4 src = p < 0.5 ? A(q) : B(q);
  float r = (p < 0.5 ? A(q + vec2(0.02 * k, 0.0)) : B(q + vec2(0.02 * k, 0.0))).r;
  float b = (p < 0.5 ? A(q - vec2(0.02 * k, 0.0)) : B(q - vec2(0.02 * k, 0.0))).b;
  return vec4(r, src.g, b, src.a);`);
add('Glitch', 'rgb-split', 'RGB Split', `float k = sin(p * PI) * 0.06; vec4 a = mix(A(uv), B(uv), smoothstep(0.4, 0.6, p));
  float r = mix(A(uv + vec2(k, 0)).r, B(uv + vec2(k, 0)).r, smoothstep(0.4, 0.6, p));
  float b = mix(A(uv - vec2(k, 0)).b, B(uv - vec2(k, 0)).b, smoothstep(0.4, 0.6, p));
  return vec4(r, a.g, b, a.a);`);
add('Glitch', 'digital', 'Digital Blocks', `vec2 g = floor(uv * vec2(20.0, 12.0)); float r = rand(g + floor(p * 10.0));
  float m = step(r, p * 1.2 - 0.1); vec2 off = (vec2(rand(g), rand(g + 1.0)) - 0.5) * 0.1 * sin(p * PI);
  return mix(A(uv + off), B(uv), m);`);
add('Glitch', 'static', 'TV Static', `float k = sin(p * PI); float n = rand(uv * uRes * 0.5 + floor(p * 40.0));
  vec4 c = mix(A(uv), B(uv), step(0.5, p)); return mix(c, vec4(vec3(n), 1.0), smoothstep(0.1, 0.9, k));`);
add('Glitch', 'scan', 'Scanline Sweep', `float line = smoothstep(0.0, 0.01, abs(uv.y - p)) ;
  vec4 c = uv.y < p ? B(uv) : A(uv); float glow = exp(-abs(uv.y - p) * 60.0);
  return c * line + vec4(0.4, 0.9, 1.0, 1.0) * glow;`);

// ---- Light ----
add('Light', 'film-burn', 'Film Burn', `float n = fbm(uv * 3.0 + vec2(p * 2.0, 0.0)); float k = sin(p * PI);
  vec3 burn = vec3(1.0, 0.55, 0.15) * smoothstep(0.3, 0.9, n + k * 0.5) * k * 2.0;
  vec4 c = mix(A(uv), B(uv), smoothstep(0.35, 0.65, p)); return vec4(c.rgb + burn, c.a);`);
add('Light', 'light-leak', 'Light Leak', `float k = sin(p * PI); vec2 c = vec2(0.2 + p * 0.6, 0.6);
  float l = exp(-length((uv - c) * vec2(1.0, 1.6)) * 3.0) * k * 1.6;
  vec4 m = mix(A(uv), B(uv), smoothstep(0.3, 0.7, p));
  return vec4(m.rgb + vec3(1.0, 0.6, 0.3) * l + vec3(1.0, 0.2, 0.5) * l * 0.4 * uv.y, m.a);`);
add('Light', 'lens-flash', 'Lens Flash', `float k = exp(-pow((p - 0.5) * 6.0, 2.0)); vec2 d = (uv - 0.5) * vec2(aspect(), 1.0);
  float streak = exp(-abs(d.y) * 40.0) * k; float glow = exp(-length(d) * 4.0) * k;
  vec4 m = mix(A(uv), B(uv), smoothstep(0.45, 0.55, p));
  return vec4(m.rgb + vec3(0.7, 0.85, 1.0) * (streak * 1.5 + glow * 1.2), m.a);`);
add('Light', 'shine-sweep', 'Shine Sweep', `float x = uv.x + uv.y * 0.3; float pos = p * 1.6 - 0.3;
  float band = exp(-pow((x - pos) * 8.0, 2.0)); vec4 m = x < pos ? B(uv) : A(uv);
  return vec4(m.rgb + vec3(band), m.a);`);
add('Light', 'bokeh-fade', 'Bokeh Fade', `float k = sin(p * PI); vec3 add = vec3(0);
  for (int i = 0; i < 14; i++){ vec2 c = vec2(rand(vec2(float(i), 1.0)), rand(vec2(float(i), 7.0)));
    float r = 0.04 + 0.06 * rand(vec2(float(i), 3.0)); float d = length((uv - c) * vec2(aspect(), 1.0));
    add += mix(vec3(1.0, 0.7, 0.4), vec3(0.6, 0.8, 1.0), rand(vec2(float(i), 9.0))) * smoothstep(r, r * 0.8, d) * 0.5; }
  vec4 m = mix(A(uv), B(uv), smoothstep(0.3, 0.7, p)); return vec4(m.rgb + add * k, m.a);`);

// ---- Creative ----
add('Creative', 'ink', 'Ink Bleed', `float n = fbm(uv * 5.0); float d = length((uv - 0.5) * vec2(aspect(), 1.0)) - n * 0.3;
  float r = p * 1.2 - 0.1; return mix(A(uv), B(uv), smoothstep(r + 0.02, r - 0.02, d));`);
add('Creative', 'paint-splash', 'Paint Splash', `vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); float a = atan(q.y, q.x);
  float s = 0.25 + 0.12 * sin(a * 7.0) + 0.08 * sin(a * 13.0 + 1.0) + 0.1 * fbm(vec2(a * 3.0, 0.0));
  return mix(A(uv), B(uv), step(length(q), s * p * 3.0));`);
add('Creative', 'shatter', 'Shatter', `vec2 g = uv * vec2(7.0 * aspect(), 7.0); vec2 id = floor(g);
  float r = rand(id); float t = clamp((p - r * 0.4) * 2.0, 0.0, 1.0);
  vec2 dir = vec2(rand(id + 3.0) - 0.5, -0.6 - rand(id + 5.0)); vec2 q = uv - dir * t * t * 0.8;
  vec2 cell = floor(q * vec2(7.0 * aspect(), 7.0)); vec4 a = (cell == id) ? Ab(q) * (1.0 - t) : vec4(0);
  return a + B(uv) * (1.0 - a.a);`);
add('Creative', 'curtain', 'Curtain', `float e = eio(p); float wave = sin(uv.y * 30.0) * 0.01 * (1.0 - e);
  float l = 0.5 - e * 0.5 + wave, r = 0.5 + e * 0.5 - wave;
  if (uv.x < l){ return A(vec2(uv.x + e * 0.5, uv.y)); } if (uv.x > r){ return A(vec2(uv.x - e * 0.5, uv.y)); }
  return B(uv);`);
add('Creative', 'zigzag', 'Zig Zag', `float edge = p * 1.3 - 0.15 + abs(fract(uv.y * 8.0) - 0.5) * 0.15;
  return mix(A(uv), B(uv), step(uv.x, edge));`);
add('Creative', 'dreamy', 'Dreamy', `vec2 off = vec2(0.0, sin(uv.x * 10.0 + p * 10.0) * 0.03 * sin(p * PI));
  vec4 m = mix(A(uv + off), B(uv + off), p); return m + vec4(0.15, 0.1, 0.2, 0.0) * sin(p * PI);`);
add('Creative', 'polka', 'Polka Dots', `vec2 g = uv * vec2(12.0 * aspect(), 12.0); float d = length(fract(g) - 0.5);
  return mix(A(uv), B(uv), step(d, p * 0.75));`);
add('Creative', 'hexagon', 'Hexagons', `vec2 s = vec2(1.0, 1.732); vec2 q = uv * vec2(aspect(), 1.0) * 10.0;
  vec2 a = mod(q, s) - s * 0.5, b = mod(q - s * 0.5, s) - s * 0.5; vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = q - gv; float delay = length(id / 10.0 - vec2(aspect(), 1.0) * 0.5) / aspect();
  float t = clamp(p * 2.0 - delay, 0.0, 1.0); float hx = max(abs(gv.x) * 0.866 + abs(gv.y) * 0.5, abs(gv.y));
  return mix(A(uv), B(uv), step(hx, t * 0.6));`);

add('Slide', 'slide-diagonal', 'Diagonal Push', `float e = eio(p); vec2 d = vec2(e, e); return Ab(uv + d) + Bb(uv + d - vec2(1.0));`);
add('Wipe', 'iris-wipe', 'Horizontal Iris', `float d = abs(uv.y - 0.5) * 2.0; float w = smoothstep(d - 0.03, d + 0.03, p * 1.06);
  return mix(A(uv), B(uv), w);`);
add('Zoom', 'zoom-rotate', 'Zoom Twist', `float e = eio(p); float ang = sin(p * PI) * 0.6; float z = 1.0 + sin(p * PI) * 0.8;
  vec2 q = (uv - 0.5) * vec2(aspect(), 1.0); q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q / z; q = q / vec2(aspect(), 1.0) + 0.5;
  return mix(Ab(q), Bb(q), smoothstep(0.4, 0.6, p));`);
add('Light', 'flash-zoom', 'Flash Zoom', `float f = exp(-pow((p - 0.5) * 8.0, 2.0)); float z = 1.0 + f * 0.3; vec2 q = (uv - 0.5) / z + 0.5;
  vec4 c = p < 0.5 ? A(q) : B(q); return c + vec4(f * 1.2);`);
add('Creative', 'swipe-reveal', 'Color Swipe', `float e1 = eio(clamp(p * 1.6, 0.0, 1.0)), e2 = eio(clamp(p * 1.6 - 0.6, 0.0, 1.0));
  vec4 band = vec4(0.12, 0.82, 0.73, 1.0);
  if (uv.x < e2) return B(uv); if (uv.x < e1) return band; return A(uv);`);
add('Distort', 'sliced', 'Sliced', `float row = floor(uv.y * 12.0); float dir = mod(row, 2.0) * 2.0 - 1.0; float e = eio(clamp(p * 1.3 - row * 0.02, 0.0, 1.0));
  vec2 qa = uv + vec2(dir * e, 0.0), qb = uv + vec2(dir * (e - 1.0), 0.0); return Ab(qa) + Bb(qb);`);

export const TRANSITIONS = T;
export const TRANSITION_CATS = [...new Set(T.map((t) => t.cat))];
export const transitionById = (id) => T.find((t) => t.id === id) || T[0];
