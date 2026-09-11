// Visual effects: particles (points), vapor puffs (sprites), tracers, decals, debris, lights, floating text.
import * as THREE from 'three';

function softDisc(size = 64, inner = 0.0) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, inner * size / 2, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); return t;
}
function puffTex(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) { const r = size * (0.12 + Math.random() * 0.18); const x = size / 2 + (Math.random() - 0.5) * size * 0.45, y = size / 2 + (Math.random() - 0.5) * size * 0.45; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene, camera, world, quality) {
    this.scene = scene; this.camera = camera; this.world = world; this.q = quality;
    this.t = 0;
    // ----- particles (points)
    const N = this.N = quality === 'low' ? 1500 : 4000;
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pSize = new Float32Array(N); this.pAlpha = new Float32Array(N);
    this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N); this.pMax = new Float32Array(N); this.pGrav = new Float32Array(N); this.pDrag = new Float32Array(N); this.pBounce = new Uint8Array(N); this.pShrink = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: softDisc() }, scale: { value: window.innerHeight } },
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.3, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vC * 1.6, t.a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    this.pMat = mat; this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points); this.pNext = 0;
    g.setDrawRange(0, N);
    // ----- puffs (sprites) for vapor
    this.puffTex = puffTex(); this.puffs = []; this.puffPool = [];
    const PN = quality === 'low' ? 56 : quality === 'med' ? 96 : 160;
    for (let i = 0; i < PN; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff })); s.visible = false; scene.add(s); this.puffPool.push(s); }
    // ----- tracers
    this.tracers = []; const TN = 48; this.tracerPool = [];
    const tg = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 0.5);
    for (let i = 0; i < TN; i++) { const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.frustumCulled = false; scene.add(m); this.tracerPool.push(m); }
    // ----- decals (impact marks)
    this.decals = []; this.decalPool = []; const DN = quality === 'low' ? 40 : 120;
    const dTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(20,18,16,.95)'); gr.addColorStop(0.5, 'rgba(20,18,16,.5)'); gr.addColorStop(1, 'rgba(20,18,16,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 12; i++) { x.strokeStyle = 'rgba(10,10,10,.8)'; x.beginPath(); x.moveTo(32, 32); const a = Math.random() * 6.28; x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); x.stroke(); } return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < DN; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); m.visible = false; scene.add(m); this.decalPool.push(m); }
    // ----- debris (instanced cubes with physics)
    const BN = this.BN = quality === 'low' ? 80 : 220;
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }), BN);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.debris.castShadow = false; this.debris.frustumCulled = false; scene.add(this.debris);
    this.dData = []; for (let i = 0; i < BN; i++) { this.dData.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), s: 0.05 }); const m = new THREE.Matrix4().makeScale(0, 0, 0); this.debris.setMatrixAt(i, m); this.debris.setColorAt(i, new THREE.Color(1, 1, 1)); }
    this.debris.instanceMatrix.needsUpdate = true; this.dNext = 0;
    // ----- lights (pooled point lights for muzzle flashes / explosions)
    this.lightPool = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 2); scene.add(l); this.lightPool.push({ l, life: 0, max: 0, intensity: 0 }); }
    // ----- shockwave rings
    this.rings = []; this.ringPool = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); this.ringPool.push(m); }
    // ----- floating text (DOM)
    this.textPool = []; this.texts = []; const host = document.createElement('div'); host.id = 'floatText'; host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden'; document.body.appendChild(host);
    for (let i = 0; i < 28; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;font:900 20px Inter,Arial,sans-serif;color:#fff;text-shadow:0 2px 6px #000,0 0 12px #ff4fa3;white-space:nowrap;transform:translate(-50%,-50%);opacity:0;will-change:transform,opacity'; host.appendChild(d); this.textPool.push(d); }
    this.shake = 0; this.flash = 0; this.flashColor = new THREE.Color(1, 1, 1);
    this._v = new THREE.Vector3();
  }
  // ---------------------------------------------------------- emitters
  particle(x, y, z, vx, vy, vz, { life = 0.6, size = 0.06, color = [1, 1, 1], grav = 0, drag = 0, bounce = 0, shrink = 1, alpha = 1 } = {}) {
    const i = this.pNext; this.pNext = (i + 1) % this.N;
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z; this.pVel[i * 3] = vx; this.pVel[i * 3 + 1] = vy; this.pVel[i * 3 + 2] = vz;
    this.pCol[i * 3] = color[0]; this.pCol[i * 3 + 1] = color[1]; this.pCol[i * 3 + 2] = color[2];
    this.pAlive = Math.max(this.pAlive || 0, 1); this.pLife[i] = life; this.pMax[i] = life; this.pSize[i] = size; this.pAlpha[i] = alpha; this.pGrav[i] = grav; this.pDrag[i] = drag; this.pBounce[i] = bounce ? 1 : 0; this.pShrink[i] = shrink;
  }
  burst(p, n, { speed = 3, spread = 1, color = [1, 0.8, 0.4], life = 0.5, size = 0.05, grav = 6, drag = 1, dir = null, bounce = 1, shrink = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      let vx = (Math.random() - 0.5) * 2, vy = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2; const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
      if (dir) { vx = vx * spread + dir.x; vy = vy * spread + dir.y; vz = vz * spread + dir.z; }
      const s = speed * (0.4 + Math.random() * 0.8);
      const c = Array.isArray(color[0]) ? color[Math.floor(Math.random() * color.length)] : color;
      this.particle(p.x, p.y, p.z, vx * s, vy * s, vz * s, { life: life * (0.6 + Math.random() * 0.8), size: size * (0.6 + Math.random() * 0.8), color: c, grav, drag, bounce, shrink });
    }
  }
  puff(p, { size = 0.6, color = 0xffffff, life = 1.2, vel = null, grow = 1.8, opacity = 0.5, rise = 0.3 } = {}) {
    const s = this.puffPool.find(s => !s.visible); if (!s) return;
    s.visible = true; s.position.copy(p); s.material.color.set(color); s.material.opacity = opacity; s.material.rotation = Math.random() * 6.28; s.scale.setScalar(size);
    this.puffs.push({ s, life, max: life, v: vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 0.4, rise, (Math.random() - 0.5) * 0.4), grow, size, op: opacity, rot: (Math.random() - 0.5) * 1.5 });
  }
  cloud(p, n = 8, opts = {}) { for (let i = 0; i < n; i++) { const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6)); this.puff(q, { size: 0.4 + Math.random() * 0.5, life: 1 + Math.random(), ...opts }); } }
  tracer(a, b, { color = 0x9ff, width = 0.012, life = 0.08 } = {}) {
    const m = this.tracerPool.find(t => !t.visible); if (!m) return;
    m.visible = true; m.material.color.set(color); m.material.opacity = 1; m.position.copy(a); m.lookAt(b); const d = a.distanceTo(b); m.scale.set(width, width, d);
    this.tracers.push({ m, life, max: life });
  }
  decal(p, n, size = 0.12, color = 0xffffff) {
    const m = this.decalPool[this.decalNext = ((this.decalNext || 0) + 1) % this.decalPool.length];
    m.visible = true; m.position.copy(p).addScaledVector(n, 0.005); m.lookAt(p.clone().add(n)); m.scale.setScalar(size * (0.8 + Math.random() * 0.5)); m.rotation.z = Math.random() * 6.28; m.material.color.set(color);
  }
  chunk(p, v, { size = 0.05, color = 0xffffff, life = 3, spin = 6 } = {}) {
    const i = this.dNext; this.dNext = (i + 1) % this.BN; const d = this.dData[i];
    d.life = life; d.p.copy(p); d.v.copy(v); d.rv.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin); d.s = size; d.r.set(0, 0, 0);
    this.debris.setColorAt(i, new THREE.Color(color)); this.debris.instanceColor.needsUpdate = true;
  }
  light(p, color, intensity = 6, life = 0.08, dist = 8) {
    let L = this.lightPool.find(l => l.life <= 0) || this.lightPool.reduce((a, b) => a.life < b.life ? a : b);
    L.l.position.copy(p); L.l.color.set(color); L.l.distance = dist; L.life = L.max = life; L.intensity = intensity; L.l.intensity = intensity;
  }
  ring(p, { color = 0xffffff, size = 3, life = 0.5, y = 0.05 } = {}) {
    const m = this.ringPool.find(r => !r.visible); if (!m) return; m.visible = true; m.position.set(p.x, p.y + y, p.z); m.material.color.set(color); m.material.opacity = 0.8; m.scale.setScalar(0.2);
    this.rings.push({ m, life, max: life, size });
  }
  text(p, str, { color = '#fff', size = 20, life = 1.1, rise = 1, glow = '#ff4fa3' } = {}) {
    const d = this.textPool.find(t => !t._on) || this.textPool[0]; d._on = true; d.textContent = str; d.style.color = color; d.style.fontSize = size + 'px'; d.style.textShadow = `0 2px 6px #000, 0 0 12px ${glow}`;
    this.texts.push({ d, p: p.clone(), life, max: life, rise, vx: (Math.random() - 0.5) * 0.6 });
  }
  // ---------------------------------------------------------- presets
  muzzle(p, dir, color = 0x9ff) {
    this.light(p.clone().addScaledVector(dir, 0.9), color, 2.5, 0.06, 5);
    this.burst(p, 6, { speed: 4, spread: 0.5, dir, color: [[0.6, 1, 1], [1, 1, 1]], life: 0.12, size: 0.05, grav: 0, drag: 4, bounce: 0 });
    this.puff(p.clone().addScaledVector(dir, 0.15), { size: 0.25, life: 0.35, opacity: 0.35, vel: dir.clone().multiplyScalar(1.5), grow: 3 });
  }
  impact(p, n, { color = 0xffffff, sparks = 6 } = {}) {
    this.burst(p, sparks, { speed: 3, spread: 1, dir: n, color: [[1, 0.9, 0.6], [1, 0.6, 0.3]], life: 0.3, size: 0.03, grav: 8, drag: 1, bounce: 1 });
    this.decal(p, n, 0.1, color); this.puff(p.clone().addScaledVector(n, 0.05), { size: 0.15, life: 0.5, opacity: 0.3, grow: 2.5 });
  }
  bottleBreak(p, color) {
    const c = [color.r, color.g, color.b];
    this.burst(p, 18, { speed: 3.5, spread: 1, color: [c, [0.9, 0.95, 1]], life: 0.7, size: 0.035, grav: 9, drag: 0.5, bounce: 1 });
    for (let i = 0; i < 4; i++) this.chunk(p, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3), { size: 0.02 + Math.random() * 0.02, color: 0xbfe6ff, life: 2.5 });
    this.puff(p, { size: 0.3, life: 0.8, opacity: 0.4, color: color.getHex(), grow: 2.5 });
  }
  vaporHit(p, color = 0xe8f4ff) { this.cloud(p, 3, { color, opacity: 0.45, life: 0.8, grow: 2 }); }
  explosion(p, { radius = 3, color = 0xff8a3c, confetti = false } = {}) {
    this.light(p.clone().setY(p.y + 0.8), color, 14, 0.35, radius * 4);
    this.burst(p, 60, { speed: 7, spread: 1, color: [[1, 0.6, 0.2], [1, 0.9, 0.4], [1, 0.3, 0.6]], life: 0.9, size: 0.09, grav: 6, drag: 1.2, bounce: 1 });
    for (let i = 0; i < 12; i++) this.puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.8, (Math.random() - 0.5) * 1.2)), { size: 0.8 + Math.random(), life: 1.4, opacity: 0.55, color: i % 3 ? 0xddd0c8 : color, grow: 2.2, rise: 0.8 });
    this.ring(p, { color, size: radius * 1.5, life: 0.5 });
    if (confetti) for (let i = 0; i < 40; i++) this.chunk(p, new THREE.Vector3((Math.random() - 0.5) * 9, 3 + Math.random() * 6, (Math.random() - 0.5) * 9), { size: 0.05, color: [0xff4fa3, 0x5ef2ff, 0xd7f06a, 0xffb347, 0xffffff][i % 5], life: 4, spin: 14 });
    this.shake = Math.max(this.shake, 1); this.flash = Math.max(this.flash, 0.25); this.flashColor.set(color);
  }
  dust(p, n = 6) { for (let i = 0; i < n; i++) this.puff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5)), { size: 0.3, life: 0.6, opacity: 0.25, color: 0xcfc7bd, grow: 2.5, rise: 0.4 }); }
  confettiRain(p, n = 30) { for (let i = 0; i < n; i++) this.chunk(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2)), new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 3, (Math.random() - 0.5) * 2), { size: 0.045, color: [0xff4fa3, 0x5ef2ff, 0xd7f06a, 0xffb347][i % 4], life: 3.5, spin: 12 }); }

  // ---------------------------------------------------------- update
  update(dt, camera) {
    this.t += dt; const W = this.world;
    // particles
    const P = this.pPos, V = this.pVel; let alive = 0;
    if (this.pAlive) for (let i = 0; i < this.N; i++) {
      if (this.pLife[i] <= 0) { this.pAlpha[i] = 0; continue; } alive++;
      this.pLife[i] -= dt; const k = this.pLife[i] / this.pMax[i];
      V[i * 3 + 1] -= this.pGrav[i] * dt; const dr = Math.exp(-this.pDrag[i] * dt); V[i * 3] *= dr; V[i * 3 + 1] *= dr; V[i * 3 + 2] *= dr;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (this.pBounce[i]) { const fy = W.floorHeight(P[i * 3], P[i * 3 + 2]); if (P[i * 3 + 1] < fy + 0.01) { P[i * 3 + 1] = fy + 0.01; V[i * 3 + 1] = -V[i * 3 + 1] * 0.4; V[i * 3] *= 0.7; V[i * 3 + 2] *= 0.7; } }
      this.pAlpha[i] = Math.min(1, k * 2); if (this.pShrink[i]) this.pSize[i] *= 1 - dt * 0.6 * this.pShrink[i];
    }
    if (this.pAlive) { const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true; if (!alive) this.pAlive = 0; }
    this.points.visible = !!this.pAlive;
    this.pMat.uniforms.scale.value = window.innerHeight * 0.5;
    // puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) { const p = this.puffs[i]; p.life -= dt; const k = p.life / p.max; if (p.life <= 0) { p.s.visible = false; this.puffs.splice(i, 1); continue; } p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 1.5)); const sc = p.size * (1 + (1 - k) * p.grow); p.s.scale.setScalar(sc); const near = camera ? Math.min(1, p.s.position.distanceToSquared(camera.position) / 1.2) : 1; p.s.material.opacity = p.op * Math.min(1, k * 3) * (k < 0.5 ? k * 2 : 1) * near; p.s.material.rotation += p.rot * dt; }
    // tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.life -= dt; if (t.life <= 0) { t.m.visible = false; this.tracers.splice(i, 1); continue; } t.m.material.opacity = t.life / t.max; }
    // debris
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(); let any = false;
    for (let i = 0; i < this.BN; i++) { const d = this.dData[i]; if (d.life <= 0) continue; any = true; d.life -= dt; d.v.y -= 12 * dt; d.p.addScaledVector(d.v, dt); const fy = W.floorHeight(d.p.x, d.p.z); if (d.p.y < fy + d.s / 2) { d.p.y = fy + d.s / 2; d.v.y = -d.v.y * 0.35; d.v.x *= 0.8; d.v.z *= 0.8; d.rv.multiplyScalar(0.7); } d.r.x += d.rv.x * dt; d.r.y += d.rv.y * dt; d.r.z += d.rv.z * dt; q.setFromEuler(d.r); let sc = d.life < 0.5 ? d.s * d.life * 2 : d.s; if (camera && d.p.distanceToSquared(camera.position) < 0.2) sc = 0; s.set(sc, sc * 0.4, sc * 1.4); m.compose(d.p, q, s); this.debris.setMatrixAt(i, m); if (d.life <= 0) { m.makeScale(0, 0, 0); this.debris.setMatrixAt(i, m); } }
    if (any) this.debris.instanceMatrix.needsUpdate = true;
    // lights
    for (const L of this.lightPool) { if (L.life > 0) { L.life -= dt; L.l.intensity = L.intensity * Math.max(0, L.life / L.max); if (L.life <= 0) L.l.intensity = 0; } }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; const k = 1 - r.life / r.max; if (r.life <= 0) { r.m.visible = false; this.rings.splice(i, 1); continue; } r.m.scale.setScalar(0.2 + k * r.size); r.m.material.opacity = 0.8 * (1 - k); }
    // texts
    const v = this._v, w = window.innerWidth, h = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; if (t.life <= 0) { t.d.style.opacity = 0; t.d._on = false; this.texts.splice(i, 1); continue; } const k = 1 - t.life / t.max; t.p.y += t.rise * dt; t.p.x += t.vx * dt; v.copy(t.p).project(camera); if (v.z > 1) { t.d.style.opacity = 0; continue; } t.d.style.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; const sc = 1 + Math.sin(Math.min(1, k * 4) * Math.PI) * 0.35; t.d.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px) scale(${sc})`; }
    this.shake *= Math.exp(-dt * 5); this.flash *= Math.exp(-dt * 9);
  }
  reset() { this.pLife.fill(0); for (const p of this.puffs) p.s.visible = false; this.puffs.length = 0; for (const t of this.tracers) t.m.visible = false; this.tracers.length = 0; for (const d of this.dData) d.life = 0; for (const d of this.decalPool) d.visible = false; for (const t of this.texts) { t.d.style.opacity = 0; t.d._on = false; } this.texts.length = 0; }
}
