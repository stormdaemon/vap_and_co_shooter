// Procedural PBR texture generation + photo texture loading.
// Everything is produced on canvases at load time so the game stays fully static.
import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- tiny value noise (tileable) ----------
function makeNoise(seed = 1) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  const P = 256, perm = new Uint8Array(P * 2), grad = new Float32Array(P * 2);
  for (let i = 0; i < P; i++) { perm[i] = i; grad[i] = rnd(); }
  for (let i = P - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < P; i++) { perm[i + P] = perm[i]; grad[i + P] = grad[i]; }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  // tileable value noise over period px,py (in noise cells)
  function noise(x, y, px = P, py = P) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
    const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = grad[perm[perm[x0] + y0]], b = grad[perm[perm[x1] + y0]];
    const c = grad[perm[perm[x0] + y1]], d = grad[perm[perm[x1] + y1]];
    const u = fade(xf), v = fade(yf);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  function fbm(x, y, oct = 5, px = 8, py = 8, lac = 2, gain = 0.5) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * noise(x * f, y * f, px * f, py * f); norm += amp; amp *= gain; f *= lac; }
    return sum / norm;
  }
  return { noise, fbm, rnd };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function tex(c, { srgb = true, repeat = [1, 1], aniso = 8, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// height field (Float32 0..1) -> normal map canvas
function normalFromHeight(h, w, hh, strength = 2) {
  const c = canvas(w, hh), ctx = c.getContext('2d'), img = ctx.createImageData(w, hh), d = img.data;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
    const u = h[((y - 1 + hh) % hh) * w + x], dn = h[((y + 1) % hh) * w + x];
    const nx = (l - r) * strength, ny = (u - dn) * strength;
    const len = Math.hypot(nx, ny, 1);
    const i = (y * w + x) * 4;
    d[i] = (nx / len * 0.5 + 0.5) * 255; d[i + 1] = (ny / len * 0.5 + 0.5) * 255; d[i + 2] = (1 / len * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function grayCanvas(v, w, h, mul = 255) {
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) { const g = clamp(v[i] * mul, 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}

// ---------- material generators ----------
// Wood planks (vertical), used for slat counters, wall cladding, gazebo. Light pine.
export function genWood({ size = 1024, planks = 6, base = [196, 152, 104], dark = [120, 82, 46], seed = 7, gap = 0.012, horizontal = false } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h), rough = new Float32Array(w * h);
  const plankW = 1 / planks;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let u = x / w, v = y / h; if (horizontal) { const t = u; u = v; v = t; }
    const pi = Math.floor(u / plankW), pu = (u - pi * plankW) / plankW;
    const off = N.rnd; // unused
    const shift = (pi * 37.13) % 1;
    // grain: stretched noise along plank
    const g = N.fbm(u * 60 + shift * 40, v * 3 + pi * 11, 4, 60, 3);
    const rings = Math.sin((g * 2 + v * 0.5 + pu * 0.6) * 22 + pi) * 0.5 + 0.5;
    const fine = N.fbm(u * 400, v * 30, 2, 400, 30);
    let shade = 0.72 + 0.22 * rings + 0.14 * (fine - 0.5) + (N.fbm(pi * 0.37, 0.5, 1, 8, 8) - 0.5) * 0.25;
    // knots
    const kn = N.noise(u * 3 + pi, v * 6, 3, 6);
    if (kn > 0.86) shade *= 0.75;
    const edge = Math.min(pu, 1 - pu);
    const inGap = edge < gap;
    if (inGap) shade *= 0.35;
    const bevel = clamp((edge - gap) / 0.02, 0, 1);
    const i = (y * w + x) * 4;
    const t = clamp(shade, 0, 1.3);
    d[i] = clamp(base[0] * t + dark[0] * (1 - t) * 0.2, 0, 255);
    d[i + 1] = clamp(base[1] * t + dark[1] * (1 - t) * 0.2, 0, 255);
    d[i + 2] = clamp(base[2] * t + dark[2] * (1 - t) * 0.2, 0, 255);
    d[i + 3] = 255;
    height[y * w + x] = (inGap ? 0 : 0.35 + 0.55 * bevel) + (rings * 0.06 + fine * 0.08);
    rough[y * w + x] = 0.55 + 0.25 * (1 - rings) + (inGap ? 0.3 : 0);
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col), normalMap: tex(normalFromHeight(height, w, h, 2.2), { srgb: false }), roughnessMap: tex(grayCanvas(rough, w, h), { srgb: false }) };
}

// Grey washed floor planks (from the shop photos: light grey oak-look laminate).
export function genFloor({ size = 2048, seed = 3 } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h), rough = new Float32Array(w * h);
  const rows = 8, plankLen = 0.5; // planks: 8 across, staggered
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const row = Math.floor(v * rows), rv = (v * rows) - row;
    const stagger = (row * 0.37) % 1;
    const uu = (u + stagger) / plankLen, seg = Math.floor(uu), su = uu - seg;
    const id = row * 13 + seg * 7;
    const tone = 0.78 + (N.noise(id * 0.11, 3.7, 64, 64) - 0.5) * 0.28;
    const grain = N.fbm(u * 6 + seg * 3.1, v * 90 + row * 5, 4, 6, 90);
    const swirl = Math.sin((grain * 3 + su * 4) * 9) * 0.5 + 0.5;
    const speck = N.fbm(u * 500, v * 500, 2, 500, 500);
    let shade = tone * (0.86 + 0.16 * swirl) + (speck - 0.5) * 0.12;
    const eg = Math.min(rv, 1 - rv), eu = Math.min(su, 1 - su);
    const gap = eg < 0.012 || eu < 0.006;
    if (gap) shade *= 0.55;
    const i = (y * w + x) * 4;
    const c = clamp(shade * 210, 0, 255);
    d[i] = c * 0.99; d[i + 1] = c * 0.97; d[i + 2] = c * 0.93; d[i + 3] = 255;
    height[y * w + x] = (gap ? 0.1 : 0.6) + swirl * 0.05 + speck * 0.05;
    rough[y * w + x] = 0.45 + swirl * 0.15 + (gap ? 0.3 : 0);
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col, { aniso: 16 }), normalMap: tex(normalFromHeight(height, w, h, 1.6), { srgb: false, aniso: 16 }), roughnessMap: tex(grayCanvas(rough, w, h), { srgb: false }) };
}

// Painted concrete block wall (upper walls in the photos are white/grey blocks).
export function genBlockWall({ size = 1024, seed = 11, tint = [212, 210, 204] } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h), rough = new Float32Array(w * h);
  const bw = 1 / 4, bh = 1 / 8;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const row = Math.floor(v / bh), rv = (v - row * bh) / bh;
    const uu = (u + (row % 2) * 0.5) / bw, seg = Math.floor(uu), su = uu - seg;
    const eg = Math.min(rv, 1 - rv), eu = Math.min(su, 1 - su);
    const mortar = eg < 0.03 || eu < 0.015;
    const grit = N.fbm(u * 300, v * 300, 3, 300, 300);
    const blotch = N.fbm(u * 5 + seg, v * 5 + row, 3, 5, 5);
    let shade = 0.9 + (grit - 0.5) * 0.18 + (blotch - 0.5) * 0.12;
    if (mortar) shade *= 0.78;
    const i = (y * w + x) * 4;
    d[i] = clamp(tint[0] * shade, 0, 255); d[i + 1] = clamp(tint[1] * shade, 0, 255); d[i + 2] = clamp(tint[2] * shade, 0, 255); d[i + 3] = 255;
    height[y * w + x] = (mortar ? 0.2 : 0.7) + grit * 0.12;
    rough[y * w + x] = 0.85 + grit * 0.1;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col), normalMap: tex(normalFromHeight(height, w, h, 2.5), { srgb: false }), roughnessMap: tex(grayCanvas(rough, w, h), { srgb: false }) };
}

// Brushed metal roughness/ color
export function genMetal({ size = 512, seed = 5, tint = [170, 172, 176] } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const rough = new Float32Array(w * h), height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const brush = N.fbm(u * 2, v * 400, 3, 2, 400);
    const scuff = N.fbm(u * 20, v * 20, 3, 20, 20);
    const s = 0.9 + (brush - 0.5) * 0.25 + (scuff - 0.5) * 0.1;
    const i = (y * w + x) * 4;
    d[i] = clamp(tint[0] * s, 0, 255); d[i + 1] = clamp(tint[1] * s, 0, 255); d[i + 2] = clamp(tint[2] * s, 0, 255); d[i + 3] = 255;
    rough[y * w + x] = 0.3 + brush * 0.25 + (scuff > 0.62 ? 0.3 : 0);
    height[y * w + x] = brush * 0.3;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col), roughnessMap: tex(grayCanvas(rough, w, h), { srgb: false }), normalMap: tex(normalFromHeight(height, w, h, 0.6), { srgb: false }) };
}

// Corrugated/insulated ceiling panels
export function genCeiling({ size = 1024, seed = 9 } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const rib = Math.sin(u * Math.PI * 2 * 24) * 0.5 + 0.5;
    const grime = N.fbm(u * 8, v * 8, 4, 8, 8);
    const s = 0.72 + rib * 0.18 + (grime - 0.5) * 0.2;
    const i = (y * w + x) * 4;
    d[i] = clamp(200 * s, 0, 255); d[i + 1] = clamp(202 * s, 0, 255); d[i + 2] = clamp(206 * s, 0, 255); d[i + 3] = 255;
    height[y * w + x] = rib;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col), normalMap: tex(normalFromHeight(height, w, h, 1.2), { srgb: false }) };
}

// Fabric / carpet-like noise (bar stools, sofa)
export function genFabric({ size = 512, seed = 21, tint = [40, 44, 52] } = {}) {
  const N = makeNoise(seed), w = size, h = size;
  const col = canvas(w, h), ctx = col.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const weave = (Math.sin(u * Math.PI * 2 * 120) * Math.sin(v * Math.PI * 2 * 120)) * 0.5 + 0.5;
    const n = N.fbm(u * 30, v * 30, 3, 30, 30);
    const s = 0.8 + weave * 0.25 + (n - 0.5) * 0.2;
    const i = (y * w + x) * 4;
    d[i] = clamp(tint[0] * s, 0, 255); d[i + 1] = clamp(tint[1] * s, 0, 255); d[i + 2] = clamp(tint[2] * s, 0, 255); d[i + 3] = 255;
    height[y * w + x] = weave * 0.5 + n * 0.3;
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(col), normalMap: tex(normalFromHeight(height, w, h, 1.5), { srgb: false }) };
}

// ---------- text / sign canvases ----------
export function genNeon({ text = 'Vap&Co', color = '#ff4fa3', w = 1024, h = 512, font = 'italic 900 220px Georgia, serif', sub = '' } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.shadowColor = color; ctx.shadowBlur = 60; ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 - (sub ? 30 : 0));
  ctx.shadowBlur = 20; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.85;
  ctx.fillText(text, w / 2, h / 2 - (sub ? 30 : 0));
  if (sub) { ctx.globalAlpha = 1; ctx.font = 'bold 60px Inter, Arial, sans-serif'; ctx.fillStyle = color; ctx.shadowBlur = 30; ctx.fillText(sub, w / 2, h / 2 + 150); }
  const t = tex(c, { wrap: false }); return t;
}

export function genSign({ lines = ['CAISSE'], bg = '#1a1f1b', fg = '#f4f1e6', w = 1024, h = 384, border = '#f4f1e6', fonts = ['900 150px Inter, Arial, sans-serif', 'bold 52px Inter, Arial, sans-serif'] } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 10; ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg;
  const n = lines.length;
  lines.forEach((l, i) => { ctx.font = fonts[Math.min(i, fonts.length - 1)]; ctx.fillText(l, w / 2, h / 2 + (i - (n - 1) / 2) * (h / (n + 0.6))); });
  return tex(c, { wrap: false });
}

// Chalkboard menu / price board
export function genChalkboard({ w = 1024, h = 768, title = 'E-LIQUIDES', items = [] } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#1e2422'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  ctx.strokeStyle = '#8b6a45'; ctx.lineWidth = 26; ctx.strokeRect(13, 13, w - 26, h - 26);
  ctx.fillStyle = '#f3ead6'; ctx.textAlign = 'center'; ctx.font = '900 84px Georgia, serif';
  ctx.fillText(title, w / 2, 130);
  ctx.strokeStyle = '#f3ead6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(120, 170); ctx.lineTo(w - 120, 170); ctx.stroke();
  ctx.font = '46px Georgia, serif'; ctx.textAlign = 'left';
  items.forEach((it, i) => { const y = 250 + i * 72; ctx.fillStyle = '#f3ead6'; ctx.fillText(it[0], 100, y); ctx.textAlign = 'right'; ctx.fillStyle = '#d7f06a'; ctx.fillText(it[1], w - 100, y); ctx.textAlign = 'left'; });
  return tex(c, { wrap: false });
}

// Crazy zinzin face texture. mood: 0 calm, 1 angry, 2 deranged, 3 boss
export function genFace({ skin = '#e6b89c', mood = 2, seed = 1, size = 256, hair = '#2b1d14', beard = false, glasses = false } = {}) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const r = (a, b) => a + (b - a) * ((Math.sin(seed * 12.9898 + a * 78.233) * 43758.5453) % 1 + 1) % 1;
  ctx.fillStyle = skin; ctx.fillRect(0, 0, size, size);
  // subtle skin noise
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(120,60,40,${Math.random() * 0.08})`; ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  // hair top
  ctx.fillStyle = hair; ctx.fillRect(0, 0, size, size * 0.16);
  // eyes
  const ey = size * 0.42, ex = size * 0.3, er = size * (0.07 + (mood >= 2 ? 0.04 : 0));
  for (const sx of [-1, 1]) {
    const x = size / 2 + sx * ex;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, ey, er * (mood === 2 ? 1.3 : 1), er, 0, 0, Math.PI * 2); ctx.fill();
    if (mood >= 1) { ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x, ey); ctx.lineTo(x + Math.cos(k * 1.1 + seed) * er * 1.2, ey + Math.sin(k * 1.1 + seed) * er); ctx.stroke(); } }
    const px = mood === 2 ? (sx > 0 ? -er * 0.4 : er * 0.3) : 0, py = mood === 2 ? (sx > 0 ? -er * 0.3 : er * 0.2) : 0;
    ctx.fillStyle = mood === 3 ? '#ff2a7f' : '#1a1a2a'; ctx.beginPath(); ctx.arc(x + px, ey + py, er * (mood === 2 ? 0.35 : 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + px - er * 0.15, ey + py - er * 0.15, er * 0.12, 0, Math.PI * 2); ctx.fill();
    // brows
    ctx.strokeStyle = hair; ctx.lineWidth = size * 0.035; ctx.beginPath();
    const tilt = mood >= 1 ? sx * size * 0.05 : 0;
    ctx.moveTo(x - er * 1.4, ey - er * 1.8 + (sx > 0 ? -tilt : tilt)); ctx.lineTo(x + er * 1.4, ey - er * 1.8 + (sx > 0 ? tilt : -tilt)); ctx.stroke();
  }
  if (glasses) { ctx.strokeStyle = '#111'; ctx.lineWidth = size * 0.02; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(size / 2 + sx * ex, ey, er * 1.6, 0, Math.PI * 2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(size / 2 - ex + er * 1.6, ey); ctx.lineTo(size / 2 + ex - er * 1.6, ey); ctx.stroke(); }
  // nose
  ctx.strokeStyle = 'rgba(90,50,40,.5)'; ctx.lineWidth = size * 0.02; ctx.beginPath(); ctx.moveTo(size / 2, ey + er); ctx.lineTo(size / 2 - size * 0.04, size * 0.6); ctx.lineTo(size / 2 + size * 0.03, size * 0.61); ctx.stroke();
  // mouth
  ctx.fillStyle = '#5a1f2a'; ctx.beginPath();
  const my = size * 0.74;
  if (mood === 0) { ctx.ellipse(size / 2, my, size * 0.12, size * 0.02, 0, 0, Math.PI * 2); }
  else if (mood === 1) { ctx.moveTo(size * 0.34, my + size * 0.04); ctx.quadraticCurveTo(size / 2, my - size * 0.05, size * 0.66, my + size * 0.04); ctx.quadraticCurveTo(size / 2, my + size * 0.01, size * 0.34, my + size * 0.04); }
  else { ctx.ellipse(size / 2, my, size * 0.19, size * 0.12, 0, 0, Math.PI * 2); }
  ctx.fill();
  if (mood >= 2) { ctx.fillStyle = '#fff'; for (let k = 0; k < 6; k++) ctx.fillRect(size * 0.34 + k * size * 0.055, my - size * 0.1, size * 0.045, size * 0.06); ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.ellipse(size / 2, my + size * 0.06, size * 0.08, size * 0.045, 0, 0, Math.PI * 2); ctx.fill(); }
  if (beard) { ctx.fillStyle = hair; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(size / 2, size * 0.86, size * 0.3, size * 0.14, 0, 0, Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
  const t = tex(c, { wrap: false }); t.magFilter = THREE.LinearFilter; return t;
}

// T-shirt print texture for zinzins
export function genShirt({ color = '#3355aa', text = 'VAPE', seed = 1, size = 256 } = {}) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${size * 0.2}px Inter, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(text, size / 2, size * 0.42);
  return tex(c, { wrap: false });
}

// Bottle label sheet: uses photo labels atlas (8x4). Returns texture plus a function giving offset/repeat for label i.
export function labelUV(i) { return { offset: [(i % 8) / 8, 1 - (Math.floor(i / 8) + 1) / 4], repeat: [1 / 8, 1 / 4] }; }

// Bunting flags strip
export function genBunting({ w = 1024, h = 128 } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const cols = ['#ff4fa3', '#5ef2ff', '#d7f06a', '#ffb347', '#ffffff', '#b58cff'];
  const n = 10, fw = w / n;
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(w, 8); ctx.stroke();
  for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(i * fw + 4, 8); ctx.lineTo((i + 1) * fw - 4, 8); ctx.lineTo(i * fw + fw / 2, h - 4); ctx.closePath(); ctx.fill(); }
  const t = tex(c, { wrap: true }); return t;
}

// Poster (canvas-made)
export function genPoster({ w = 512, h = 768, title = 'VAP&CO', sub = '10% DE REMISE', bg1 = '#1b2a6b', bg2 = '#ff4fa3' } = {}) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg1); g.addColorStop(1, bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 90, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 96px Inter, Arial, sans-serif'; ctx.shadowColor = '#000'; ctx.shadowBlur = 20;
  ctx.fillText(title, w / 2, h * 0.4);
  ctx.font = '800 54px Inter, Arial, sans-serif'; ctx.fillStyle = '#d7f06a'; ctx.fillText(sub, w / 2, h * 0.55);
  ctx.font = '500 28px Inter, Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('sur présentation de cette affiche', w / 2, h * 0.63);
  ctx.fillText('(sauf les zinzins)', w / 2, h * 0.68);
  return tex(c, { wrap: false });
}

// Load photo crops from the legacy atlas.
export function loadPhoto(url, { srgb = true, repeat = [1, 1], wrap = false, aniso = 8 } = {}) {
  return new Promise((res, rej) => {
    new THREE.TextureLoader().load(url, t => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso; res(t);
    }, undefined, rej);
  });
}

export async function buildTextureLibrary(quality, onProgress) {
  const hi = quality === 'high', lo = quality === 'low';
  const S = lo ? 512 : hi ? 2048 : 1024;
  const lib = {};
  const steps = [
    ['Sol en chêne gris…', () => { lib.floor = genFloor({ size: lo ? 1024 : 2048 }); }],
    ['Lattes de pin…', () => { lib.wood = genWood({ size: S, planks: 6 }); lib.woodH = genWood({ size: S, planks: 8, horizontal: true, seed: 12 }); }],
    ['Bois sombre…', () => { lib.darkwood = genWood({ size: S, planks: 3, base: [96, 66, 40], dark: [40, 24, 12], seed: 31, gap: 0.006 }); }],
    ['Murs en parpaings…', () => { lib.wall = genBlockWall({ size: S }); }],
    ['Métal brossé…', () => { lib.metal = genMetal({ size: 512 }); lib.metalDark = genMetal({ size: 512, tint: [58, 60, 64], seed: 8 }); }],
    ['Plafond…', () => { lib.ceiling = genCeiling({ size: S }); lib.fabric = genFabric(); }],
    ['Enseignes…', () => {
      lib.neonVap = genNeon({ text: 'Vap&Co', color: '#ff4fa3' });
      lib.neonCbd = genNeon({ text: 'CBD', color: '#5ef2ff', sub: 'AND CO' });
      lib.neonOpen = genNeon({ text: 'OUVERT', color: '#d7f06a', font: '900 200px Inter, Arial, sans-serif', w: 1024, h: 384 });
      lib.signCash = genSign({ lines: ['CAISSE', 'NE VAPOTEZ PAS ICI'] });
      lib.signStaff = genSign({ lines: ['RÉSERVE', 'ACCÈS ÉQUIPE'], bg: '#2a1f1a' });
      lib.signWelcome = genSign({ lines: ['BIENVENUE', 'CHEZ VAP&CO'], bg: '#17301c', fg: '#d7f06a', border: '#d7f06a' });
      lib.signEasy = genSign({ lines: ['EASY DROP', 'VOTRE ESPACE RECHARGE'], bg: '#5cb8b0', fg: '#0f2a28', border: '#0f2a28' });
      lib.signZinzin = genSign({ lines: ['ZONE ZINZIN', 'ENTRÉE À VOS RISQUES'], bg: '#3a0e22', fg: '#ff4fa3', border: '#ff4fa3' });
      lib.board = genChalkboard({ title: 'E-LIQUIDES', items: [['Fresh · 10 ml', '5,90 €'], ['Citrus · 50 ml', '19,90 €'], ['Botanic · 50 ml', '19,90 €'], ['Velours · 10 ml', '6,90 €'], ['Classic · 50 ml', '18,90 €'], ['Solaire · 50 ml', '21,90 €'], ['Zinzin · 100 ml', 'GRATUIT ?!']] });
      lib.bunting = genBunting();
      lib.poster1 = genPoster({});
      lib.poster2 = genPoster({ title: 'CBD', sub: 'LE COMPTOIR VÉGÉTAL', bg1: '#123a22', bg2: '#5ef2ff' });
    }],
    ['Photos de référence…', async () => {
      const p = (n, o) => loadPhoto(`assets/tex/${n}.jpg`, o);
      const [logo, cbd, shelf, shelf2, poster, cart, cabinet, labels, screen, cloth, price, flag] = await Promise.all([
        p('logo'), p('cbdlogo'), p('shelfphoto'), p('shelfphoto2'), p('poster'), p('cartphoto'), p('cabinetphoto'), p('labels'), p('screen'), p('cloth', { wrap: true }), p('price'), p('flag', { wrap: true })]);
      Object.assign(lib, { logo, cbd, shelf, shelf2, poster, cart, cabinet, labels, screen, cloth, price, flag });
    }],
  ];
  for (let i = 0; i < steps.length; i++) {
    onProgress?.(steps[i][0], i / steps.length);
    await new Promise(r => setTimeout(r, 0));
    await steps[i][1]();
  }
  onProgress?.('Textures prêtes', 1);
  return lib;
}
