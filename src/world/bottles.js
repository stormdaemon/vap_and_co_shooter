// Instanced e-liquid bottles with per-instance photo labels. Destructible.
import * as THREE from 'three';
import { labelUV } from '../engine/textures.js';

export class Bottles {
  constructor(scene, world, quality = 'med') {
    this.scene = scene; this.world = world;
    const spots = world.bottleSpots; const n = spots.length; this.n = n;
    const body = new THREE.CylinderGeometry(1, 1, 1, 12, 1); body.translate(0, 0.5, 0);
    // UVs: wrap label around the body once (u across circumference), v along height
    this.mesh = new THREE.InstancedMesh(body, world.M.bottle, n);
    const lab = new Float32Array(n * 4);
    const capGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1); capGeo.translate(0, 0.5, 0);
    this.caps = new THREE.InstancedMesh(capGeo, world.M.black, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.alive = new Uint8Array(n).fill(1); this.spots = spots;
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const b = spots[i];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry); p.set(b.x, b.y, b.z); s.set(b.r, b.h, b.r); m.compose(p, q, s); this.mesh.setMatrixAt(i, m);
      p.set(b.x, b.y + b.h, b.z); s.set(b.r * 0.7, b.h * 0.18, b.r * 0.7); m.compose(p, q, s); this.caps.setMatrixAt(i, m);
      const uv = labelUV(i % 32); lab[i * 4] = uv.offset[0]; lab[i * 4 + 1] = uv.offset[1]; lab[i * 4 + 2] = uv.repeat[0]; lab[i * 4 + 3] = uv.repeat[1];
      color.setHSL((i * 0.137) % 1, 0.6, 0.6); this.mesh.setColorAt(i, color.lerp(new THREE.Color(1, 1, 1), 0.6));
    }
    body.setAttribute('labelUv', new THREE.InstancedBufferAttribute(lab, 4));
    this.mesh.castShadow = quality === 'high'; this.mesh.receiveShadow = true; this.caps.castShadow = false;
    this.mesh.instanceMatrix.needsUpdate = true; this.caps.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh); scene.add(this.caps);
    // spatial buckets for fast hit tests
    this.buckets = new Map();
    for (let i = 0; i < n; i++) { const k = this.key(spots[i].x, spots[i].z); if (!this.buckets.has(k)) this.buckets.set(k, []); this.buckets.get(k).push(i); }
  }
  key(x, z) { return ((x + 20) | 0) * 100 + ((z + 20) | 0); }
  // ray test: returns {index, dist, point} of the nearest hit bottle within maxDist
  raycast(o, d, maxDist) {
    let best = null;
    const steps = Math.ceil(maxDist / 0.8);
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxDist, s * 0.8); const x = o.x + d.x * t, z = o.z + d.z * t;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const k = this.key(x + dx, z + dz); const arr = this.buckets.get(k); if (!arr) continue;
        for (const i of arr) {
          if (!this.alive[i] || seen.has(i)) continue; seen.add(i);
          const b = this.spots[i];
          // ray vs vertical cylinder (approx as sphere at mid height with radius max(r, h/2))
          const cx = b.x - o.x, cy = b.y + b.h / 2 - o.y, cz = b.z - o.z;
          const tc = cx * d.x + cy * d.y + cz * d.z; if (tc < 0 || tc > maxDist) continue;
          const px = cx - d.x * tc, py = cy - d.y * tc, pz = cz - d.z * tc;
          const R = Math.max(b.r * 1.5, b.h * 0.55);
          if (px * px + py * py + pz * pz < R * R && (!best || tc < best.dist)) best = { index: i, dist: tc, point: new THREE.Vector3(b.x, b.y + b.h / 2, b.z) };
        }
      }
      if (best && best.dist < t) break;
    }
    return best;
  }
  // all alive bottles within radius of point (for explosions)
  within(p, r) { const out = []; for (let i = 0; i < this.n; i++) { if (!this.alive[i]) continue; const b = this.spots[i]; if (Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) < r) out.push(i); } return out; }
  destroy(i) {
    if (!this.alive[i]) return null; this.alive[i] = 0;
    const m = new THREE.Matrix4().makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m); this.caps.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true; this.caps.instanceMatrix.needsUpdate = true;
    const b = this.spots[i]; const c = new THREE.Color(); this.mesh.getColorAt(i, c);
    return { x: b.x, y: b.y + b.h / 2, z: b.z, color: c };
  }
  reset() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) { if (this.alive[i]) continue; this.alive[i] = 1; const b = this.spots[i]; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry); p.set(b.x, b.y, b.z); s.set(b.r, b.h, b.r); m.compose(p, q, s); this.mesh.setMatrixAt(i, m); p.set(b.x, b.y + b.h, b.z); s.set(b.r * 0.7, b.h * 0.18, b.r * 0.7); m.compose(p, q, s); this.caps.setMatrixAt(i, m); }
    this.mesh.instanceMatrix.needsUpdate = true; this.caps.instanceMatrix.needsUpdate = true;
  }
}
