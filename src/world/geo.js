// Geometry helpers: world-unit UV boxes, merged static batches, simple builders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();

// Box whose UVs are in world units divided by texSize, so textures never stretch.
export function boxGeo(w, h, d, texSize = 1, uvOffset = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (texSize > 0) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / texSize + uvOffset, uv.getY(k) * dims[f][1] / texSize + uvOffset);
    }
  }
  return g;
}

export function planeGeo(w, h, texSize = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  if (texSize > 0) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / texSize, uv.getY(i) * h / texSize); }
  return g;
}

export function cylGeo(rt, rb, h, seg = 16, texSize = 0, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  if (texSize > 0) { const uv = g.attributes.uv; const c = Math.PI * (rt + rb); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * c / texSize, uv.getY(i) * h / texSize); }
  return g;
}

export function transform(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s); g.applyMatrix4(_m); return g;
}

// Batch: accumulate geometries per material and produce merged meshes.
export class Batch {
  constructor(scene) { this.scene = scene; this.groups = new Map(); this.meshes = []; }
  add(mat, geo, { cast = true, receive = true } = {}) {
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    let g = this.groups.get(key); if (!g) { g = { mat, cast, receive, geos: [] }; this.groups.set(key, g); }
    g.geos.push(geo);
  }
  // convenience: box at position with rotation
  box(mat, w, h, d, x, y, z, { ry = 0, rx = 0, rz = 0, tex = 1, cast = true, receive = true } = {}) {
    const g = transform(boxGeo(w, h, d, tex), x, y, z, rx, ry, rz);
    this.add(mat, g, { cast, receive }); return g;
  }
  cyl(mat, rt, rb, h, x, y, z, { seg = 16, ry = 0, rx = 0, rz = 0, tex = 0, cast = true, receive = true } = {}) {
    const g = transform(cylGeo(rt, rb, h, seg, tex), x, y, z, rx, ry, rz);
    this.add(mat, g, { cast, receive }); return g;
  }
  plane(mat, w, h, x, y, z, { ry = 0, rx = 0, rz = 0, tex = 0, cast = false, receive = true } = {}) {
    const g = transform(planeGeo(w, h, tex), x, y, z, rx, ry, rz);
    this.add(mat, g, { cast, receive }); return g;
  }
  sphere(mat, r, x, y, z, { seg = 12, sx = 1, sy = 1, sz = 1, cast = true, receive = true } = {}) {
    const g = transform(new THREE.SphereGeometry(r, seg, seg), x, y, z, 0, 0, 0, sx, sy, sz);
    this.add(mat, g, { cast, receive }); return g;
  }
  flush() {
    for (const g of this.groups.values()) {
      const geos = g.geos.filter(Boolean);
      if (!geos.length) continue;
      // normalise attributes: drop uv2/tangent mismatch
      for (const ge of geos) { for (const k of Object.keys(ge.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ge.deleteAttribute(k); if (!ge.attributes.uv) ge.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ge.attributes.position.count * 2), 2)); }
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, g.mat);
      mesh.castShadow = g.cast; mesh.receiveShadow = g.receive; mesh.matrixAutoUpdate = false;
      this.scene.add(mesh); this.meshes.push(mesh);
      geos.forEach(ge => ge.dispose());
    }
    this.groups.clear();
    return this.meshes;
  }
}

// Extruded octagon / polygon prism
export function prismGeo(radius, h, sides = 8, rot = 0) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) { const a = rot + i / sides * Math.PI * 2; const x = Math.cos(a) * radius, y = Math.sin(a) * radius; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); return g;
}
