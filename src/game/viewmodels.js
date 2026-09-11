// First-person viewmodels: proper hands (fist / grip poses) and detailed weapons, merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
export const VM_MATS = {
  skin: std({ color: 0xd9a37e, roughness: 0.65, emissive: 0xd9a37e, emissiveIntensity: 0.1 }),
  sleeve: std({ color: 0x2e4a3a, roughness: 0.95, emissive: 0x2e4a3a, emissiveIntensity: 0.15 }),
  cuff: std({ color: 0xb8cf5a, roughness: 0.8, emissive: 0xb8cf5a, emissiveIntensity: 0.04 }),
  dark: std({ color: 0x2b2f36, roughness: 0.42, metalness: 0.6, emissive: 0x2b2f36, emissiveIntensity: 0.22 }),
  gun: std({ color: 0x4a4f58, roughness: 0.35, metalness: 0.75, emissive: 0x4a4f58, emissiveIntensity: 0.18 }),
  steel: std({ color: 0xb8bec6, roughness: 0.25, metalness: 0.95, emissive: 0xb8bec6, emissiveIntensity: 0.08 }),
  brass: std({ color: 0xd4a848, roughness: 0.3, metalness: 0.9, emissive: 0xd4a848, emissiveIntensity: 0.1 }),
  wood: std({ color: 0x7a5232, roughness: 0.55, emissive: 0x7a5232, emissiveIntensity: 0.12 }),
  rubber: std({ color: 0x1a1a1d, roughness: 0.9, emissive: 0x1a1a1d, emissiveIntensity: 0.15 }),
  pink: std({ color: 0xff4fa3, roughness: 0.35, emissive: 0xff2a7f, emissiveIntensity: 0.2 }),
  pinkDark: std({ color: 0xc72c78, roughness: 0.4, emissive: 0xc72c78, emissiveIntensity: 0.12 }),
  plastic: std({ color: 0xff8ac5, roughness: 0.45, emissive: 0xff8ac5, emissiveIntensity: 0.12 }),
  cyan: std({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 0.3, roughness: 0.2 }),
  orange: std({ color: 0xffb347, emissive: 0xff8a1f, emissiveIntensity: 0.35, roughness: 0.3 }),
  lime: std({ color: 0xd7f06a, emissive: 0xd7f06a, emissiveIntensity: 0.3, roughness: 0.3 }),
  violet: std({ color: 0xb58cff, emissive: 0x8a5cff, emissiveIntensity: 0.35, roughness: 0.3 }),
  white: std({ color: 0xf2f2f2, roughness: 0.4, emissive: 0xf2f2f2, emissiveIntensity: 0.1 }),
  glass: std({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
  screen: std({ color: 0x0a1a20, emissive: 0x5ef2ff, emissiveIntensity: 0.5, roughness: 0.2 }),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Collects geometries per material and merges them into a small number of meshes.
class Builder {
  constructor() { this.lists = new Map(); this.named = []; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, parentMatrix = null) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_p, _q, _s);
    if (parentMatrix) _m.premultiply(parentMatrix);
    if (geo.index) geo = geo.toNonIndexed();
    geo.applyMatrix4(_m);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!this.lists.has(mat)) this.lists.set(mat, []); this.lists.get(mat).push(geo); return this;
  }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, r = 0, pm = null) { return this.add(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, 1, 1, 1, pm); }
  cyl(mat, r0, r1, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16, pm = null) { return this.add(new THREE.CylinderGeometry(r0, r1, h, seg), mat, x, y, z, rx, ry, rz, 1, 1, 1, pm); }
  sphere(mat, r, x, y, z, seg = 10, sx = 1, sy = 1, sz = 1, pm = null) { return this.add(new THREE.SphereGeometry(r, seg, seg), mat, x, y, z, 0, 0, 0, sx, sy, sz, pm); }
  torus(mat, R, r, x, y, z, rx = 0, ry = 0, rz = 0, pm = null) { return this.add(new THREE.TorusGeometry(R, r, 8, 20), mat, x, y, z, rx, ry, rz, 1, 1, 1, pm); }
  build() {
    const g = new THREE.Group();
    for (const [mat, geos] of this.lists) { const merged = mergeGeometries(geos, false); const m = new THREE.Mesh(merged, mat); m.frustumCulled = false; m.renderOrder = 10; g.add(m); geos.forEach(x => x.dispose()); }
    return g;
  }
}

// ---------------------------------------------------------------- hands
// Hand local frame: +y = back of the hand, -z = finger direction, +x = thumb side for a right hand (mirror for left).
// pose: 'fist' (fully curled), 'grip' (wrapped around a vertical grip), 'hold' (loose, holding a fore-end), 'open'
export function handGeometry(b, side = 1, pose = 'fist', pm = null) {
  const S = VM_MATS.skin; const mirror = side;
  const curl = { fist: [-1.35, -1.75, -1.3], grip: [-1.15, -1.45, -0.9], hold: [-0.9, -1.1, -0.6], open: [-0.15, -0.2, -0.1] }[pose] || [-1.3, -1.6, -1.2];
  // palm
  b.box(S, 0.082, 0.03, 0.09, 0, 0, 0, 0, 0, 0, 0.01, pm);
  // fingers: 4, each 3 segments curling downward (rotation about x)
  for (let i = 0; i < 4; i++) {
    const fx = (-0.031 + i * 0.0205) * mirror; const len = [0.03, 0.026, 0.022]; const w = 0.017 - i * 0.0012;
    let mat = new THREE.Matrix4().makeTranslation(fx, 0.0, -0.045); if (pm) mat.premultiply(pm);
    for (let s = 0; s < 3; s++) {
      const rot = new THREE.Matrix4().makeRotationX(curl[s]); mat = mat.clone().multiply(rot);
      const local = new THREE.Matrix4().makeTranslation(0, 0, -len[s] / 2);
      b.box(S, w, 0.016, len[s], 0, 0, 0, 0, 0, 0, 0.005, mat.clone().multiply(local));
      mat = mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, -len[s]));
    }
  }
  // thumb: from the side, wrapping across the front
  { let mat = new THREE.Matrix4().makeTranslation(0.045 * mirror, -0.004, -0.01); if (pm) mat.premultiply(pm);
    const rots = [[-0.4, 0.9 * mirror, 0.3 * mirror], [-1.1, 0, 0]]; const lens = [0.03, 0.026];
    for (let s = 0; s < 2; s++) { const e = new THREE.Euler(rots[s][0], rots[s][1], rots[s][2]); mat = mat.clone().multiply(new THREE.Matrix4().makeRotationFromEuler(e)); b.box(S, 0.018, 0.017, lens[s], 0, 0, 0, 0, 0, 0, 0.005, mat.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -lens[s] / 2))); mat = mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, -lens[s])); } }
  // wrist + forearm sleeve going back (+z) and slightly down toward the camera
  b.cyl(S, 0.03, 0.033, 0.05, 0, 0.0, 0.06, Math.PI / 2, 0, 0, 12, pm);
  b.cyl(VM_MATS.cuff, 0.037, 0.037, 0.02, 0, 0.0, 0.085, Math.PI / 2, 0, 0, 12, pm);
  b.cyl(VM_MATS.sleeve, 0.036, 0.044, 0.2, 0, -0.01, 0.19, Math.PI / 2 - 0.08, 0, 0, 12, pm);
}

function M(x, y, z, rx = 0, ry = 0, rz = 0) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); }

// ---------------------------------------------------------------- weapon models
// Each returns a Group with userData { muzzle, hip, ads, parts:{slide?,pump?...} }.
export function buildFists() {
  const g = new THREE.Group(); const hands = [];
  for (const side of [-1, 1]) {
    const b = new Builder(); handGeometry(b, side, 'fist'); const h = b.build();
    // boxing guard: knuckles forward (rotate hand so the back faces -z), slightly turned inward
    h.rotation.set(0.55, side * 0.2, side * -Math.PI / 2); h.position.set(side * 0.21, -0.22, -0.42); g.add(h); hands.push(h);
  }
  g.userData = { hands, hip: [0, 0, 0], ads: [0, 0, 0] }; return g;
}

export function buildVapo() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // frame + grip
  b.box(Mt.dark, 0.05, 0.075, 0.2, 0, -0.005, -0.04, 0, 0, 0, 0.008);
  b.box(Mt.rubber, 0.046, 0.14, 0.06, 0, -0.095, 0.035, 0.22, 0, 0, 0.008);
  for (let i = 0; i < 5; i++) b.box(Mt.dark, 0.05, 0.004, 0.05, 0, -0.06 - i * 0.02, 0.03 + i * 0.006, 0.22);
  b.box(Mt.dark, 0.03, 0.025, 0.06, 0, -0.045, -0.02); // trigger guard
  b.box(Mt.steel, 0.006, 0.03, 0.01, 0, -0.045, -0.01, 0.3);
  // barrel + shroud + vents
  b.cyl(Mt.steel, 0.011, 0.011, 0.16, 0, 0.028, -0.2, Math.PI / 2, 0, 0, 12);
  b.cyl(Mt.dark, 0.02, 0.02, 0.1, 0, 0.028, -0.2, Math.PI / 2, 0, 0, 12);
  for (let i = 0; i < 4; i++) b.box(Mt.cyan, 0.045, 0.004, 0.012, 0, 0.028, -0.17 - i * 0.02);
  // vape tank (the "power cell") under the frame front with glass and coil glow
  b.cyl(Mt.glass, 0.02, 0.02, 0.09, 0, -0.03, -0.12, Math.PI / 2, 0, 0, 14);
  b.cyl(Mt.cyan, 0.012, 0.012, 0.085, 0, -0.03, -0.12, Math.PI / 2, 0, 0, 10);
  b.cyl(Mt.brass, 0.022, 0.022, 0.012, 0, -0.03, -0.075, Math.PI / 2, 0, 0, 14); b.cyl(Mt.brass, 0.022, 0.022, 0.012, 0, -0.03, -0.165, Math.PI / 2, 0, 0, 14);
  // sights
  b.box(Mt.dark, 0.006, 0.014, 0.01, 0, 0.078, -0.13); b.box(Mt.lime, 0.004, 0.004, 0.004, 0, 0.087, -0.13);
  b.box(Mt.dark, 0.024, 0.014, 0.008, 0, 0.078, 0.02); b.box(Mt.dark, 0.006, 0.01, 0.008, -0.009, 0.08, 0.02); b.box(Mt.dark, 0.006, 0.01, 0.008, 0.009, 0.08, 0.02);
  // side screen
  b.box(Mt.screen, 0.002, 0.02, 0.04, 0.026, 0.0, 0.0);
  // hand on grip (right)
  handGeometry(b, 1, 'grip', M(-0.004, -0.09, 0.04, 0.22, 0, -Math.PI / 2 + 0.1));
  const body = b.build(); g.add(body);
  // slide (moving part)
  const sb = new Builder(); sb.box(Mt.gun, 0.052, 0.042, 0.19, 0, 0.05, -0.055, 0, 0, 0, 0.006); for (let i = 0; i < 6; i++) sb.box(Mt.dark, 0.054, 0.02, 0.004, 0, 0.05, 0.01 + i * 0.008); sb.box(Mt.steel, 0.02, 0.02, 0.03, 0, 0.05, -0.13);
  const slide = sb.build(); g.add(slide);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.028, -0.29); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.24, -0.2, -0.42], ads: [0, -0.098, -0.3], parts: { slide }, slideAxis: 0.028 }; return g;
}

export function buildFumi() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // receiver + stock
  b.box(Mt.gun, 0.058, 0.075, 0.26, 0, 0, 0.02, 0, 0, 0, 0.01);
  b.box(Mt.wood, 0.05, 0.085, 0.24, 0, -0.03, 0.26, -0.12, 0, 0, 0.012);
  b.box(Mt.rubber, 0.052, 0.09, 0.02, 0, -0.045, 0.38, -0.12); // buttpad
  b.box(Mt.wood, 0.045, 0.12, 0.05, 0, -0.09, 0.09, 0.35, 0, 0, 0.01); // pistol grip
  b.box(Mt.dark, 0.03, 0.025, 0.07, 0, -0.045, 0.0); b.box(Mt.steel, 0.006, 0.03, 0.01, 0, -0.045, 0.01, 0.3);
  // twin barrels + heat shield
  for (const sx of [-1, 1]) b.cyl(Mt.steel, 0.015, 0.015, 0.52, sx * 0.018, 0.025, -0.36, Math.PI / 2, 0, 0, 12);
  b.box(Mt.dark, 0.06, 0.012, 0.42, 0, 0.05, -0.32); for (let i = 0; i < 8; i++) b.box(Mt.orange, 0.05, 0.004, 0.008, 0, 0.057, -0.16 - i * 0.045);
  // canister (smoke tank) under the barrels with pressure gauge
  b.cyl(Mt.dark, 0.042, 0.042, 0.2, 0, -0.035, -0.22, Math.PI / 2, 0, 0, 16); b.cyl(Mt.glass, 0.036, 0.036, 0.12, 0, -0.035, -0.22, Math.PI / 2, 0, 0, 16); b.cyl(Mt.orange, 0.028, 0.028, 0.11, 0, -0.035, -0.22, Math.PI / 2, 0, 0, 12);
  b.cyl(Mt.brass, 0.014, 0.014, 0.02, 0.03, -0.015, -0.14, 0, 0, Math.PI / 2, 10); b.cyl(Mt.white, 0.01, 0.01, 0.004, 0.042, -0.015, -0.14, 0, 0, Math.PI / 2, 10);
  b.box(Mt.dark, 0.006, 0.02, 0.006, 0, 0.065, -0.56); b.box(Mt.lime, 0.005, 0.005, 0.005, 0, 0.078, -0.56);
  // shells on the side saddle
  for (let i = 0; i < 4; i++) { b.cyl(Mt.pink, 0.008, 0.008, 0.05, -0.036, 0.01, 0.1 + i * 0.02, 0, 0, Math.PI / 2, 8); b.cyl(Mt.brass, 0.0085, 0.0085, 0.012, -0.036, 0.01, 0.1 + i * 0.02 + 0.02, 0, 0, Math.PI / 2, 8); }
  // right hand on grip, left hand on pump
  handGeometry(b, 1, 'grip', M(-0.004, -0.1, 0.1, 0.35, 0, -Math.PI / 2 + 0.1));
  const body = b.build(); g.add(body);
  const pb = new Builder(); pb.box(Mt.wood, 0.06, 0.05, 0.14, 0, -0.06, -0.3, 0, 0, 0, 0.01); for (let i = 0; i < 5; i++) pb.box(Mt.dark, 0.062, 0.004, 0.052, 0, -0.06, -0.35 + i * 0.025);
  handGeometry(pb, -1, 'hold', M(0.0, -0.07, -0.3, -0.2, 0, Math.PI / 2 - 0.35)); const pump = pb.build(); g.add(pump);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.025, -0.63); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.2, -0.19, -0.4], ads: [0, -0.088, -0.3], parts: { pump } }; return g;
}

export function buildGummy() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // bulky pink body with rails and a candy-dispenser look
  b.box(Mt.plastic, 0.07, 0.09, 0.3, 0, 0.005, -0.03, 0, 0, 0, 0.014);
  b.box(Mt.pinkDark, 0.074, 0.02, 0.24, 0, 0.055, -0.03, 0, 0, 0, 0.006);
  for (let i = 0; i < 9; i++) b.box(Mt.dark, 0.076, 0.006, 0.012, 0, 0.068, -0.14 + i * 0.026);
  b.box(Mt.rubber, 0.046, 0.14, 0.06, 0, -0.1, 0.07, 0.2, 0, 0, 0.008);
  b.box(Mt.dark, 0.03, 0.025, 0.06, 0, -0.05, 0.0); b.box(Mt.steel, 0.006, 0.03, 0.01, 0, -0.05, 0.01, 0.3);
  b.box(Mt.plastic, 0.05, 0.05, 0.16, 0, 0.005, 0.2, 0, 0, 0, 0.012); // stock
  // barrel with candy-striped compensator
  b.cyl(Mt.dark, 0.018, 0.018, 0.18, 0, 0.02, -0.27, Math.PI / 2, 0, 0, 12);
  for (let i = 0; i < 4; i++) b.cyl(i % 2 ? Mt.white : Mt.pink, 0.024, 0.024, 0.014, 0, 0.02, -0.31 - i * 0.015, Math.PI / 2, 0, 0, 12);
  // glass jar magazine full of gummies + violet glow
  b.cyl(Mt.glass, 0.048, 0.048, 0.15, 0, -0.1, -0.12, 0, 0, 0, 16); b.cyl(Mt.dark, 0.05, 0.05, 0.016, 0, -0.025, -0.12, 0, 0, 0, 16); b.cyl(Mt.dark, 0.05, 0.05, 0.016, 0, -0.176, -0.12, 0, 0, 0, 16);
  const gm = [Mt.pink, Mt.lime, Mt.cyan, Mt.orange, Mt.violet];
  for (let i = 0; i < 18; i++) b.sphere(gm[i % 5], 0.013, (Math.random() - 0.5) * 0.06, -0.16 + (i % 9) * 0.014, -0.12 + (Math.random() - 0.5) * 0.06, 6);
  // top screen + counter
  b.box(Mt.screen, 0.03, 0.002, 0.05, 0, 0.078, 0.03); b.box(Mt.violet, 0.004, 0.004, 0.02, 0.03, 0.03, -0.1); b.box(Mt.violet, 0.004, 0.004, 0.02, -0.03, 0.03, -0.1);
  handGeometry(b, 1, 'grip', M(-0.004, -0.095, 0.075, 0.2, 0, -Math.PI / 2 + 0.1));
  handGeometry(b, -1, 'hold', M(0.0, -0.045, -0.2, -0.1, 0, Math.PI / 2 - 0.4));
  const body = b.build(); g.add(body);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.4); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.22, -0.2, -0.4], ads: [0, -0.1, -0.28] }; return g;
}

export function buildFlamant(world) {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // launcher tube (pink, ribbed) with flamingo-head muzzle and a duck-float float ring
  b.cyl(Mt.pink, 0.065, 0.065, 0.66, 0, 0.02, -0.12, Math.PI / 2, 0, 0, 20);
  for (let i = 0; i < 5; i++) b.cyl(Mt.pinkDark, 0.07, 0.07, 0.02, 0, 0.02, -0.4 + i * 0.13, Math.PI / 2, 0, 0, 20);
  b.cyl(Mt.dark, 0.07, 0.07, 0.05, 0, 0.02, 0.2, Math.PI / 2, 0, 0, 20);
  b.cyl(Mt.dark, 0.08, 0.06, 0.06, 0, 0.02, -0.47, Math.PI / 2, 0, 0, 20);
  b.torus(Mt.pink, 0.09, 0.03, 0, 0.02, -0.43, 0, 0, 0);
  // flamingo head on top
  b.cyl(Mt.pink, 0.02, 0.026, 0.14, 0, 0.13, -0.36, 0.3, 0, 0, 10); b.sphere(Mt.pink, 0.05, 0, 0.2, -0.4, 12); b.add(new THREE.ConeGeometry(0.02, 0.1, 8), Mt.dark, 0, 0.19, -0.47, -Math.PI / 2); b.sphere(Mt.white, 0.012, 0.03, 0.215, -0.41, 6); b.sphere(Mt.white, 0.012, -0.03, 0.215, -0.41, 6);
  // grips, trigger, shoulder rest, sight
  b.box(Mt.rubber, 0.046, 0.13, 0.06, 0, -0.08, 0.08, 0.2, 0, 0, 0.008); b.box(Mt.rubber, 0.046, 0.1, 0.05, 0, -0.06, -0.22, 0, 0, 0, 0.008);
  b.box(Mt.dark, 0.03, 0.025, 0.06, 0, -0.04, 0.0);
  b.box(Mt.dark, 0.05, 0.02, 0.1, 0, 0.09, 0.0); b.box(Mt.lime, 0.02, 0.006, 0.02, 0, 0.1, -0.03);
  b.box(Mt.screen, 0.002, 0.03, 0.05, 0.066, 0.02, -0.05);
  handGeometry(b, 1, 'grip', M(-0.004, -0.085, 0.085, 0.2, 0, -Math.PI / 2 + 0.1));
  handGeometry(b, -1, 'grip', M(0.004, -0.07, -0.22, 0.0, 0, Math.PI / 2 - 0.1));
  const body = b.build(); g.add(body);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.52); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.2, -0.17, -0.38], ads: [0, -0.09, -0.26] }; return g;
}

export function buildLaser() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // botanical ray gun: wooden-green body, glass coil, leaf fins
  b.box(Mt.gun, 0.06, 0.07, 0.28, 0, 0, -0.02, 0, 0, 0, 0.012);
  b.box(Mt.rubber, 0.046, 0.13, 0.06, 0, -0.09, 0.06, 0.22, 0, 0, 0.008);
  b.box(Mt.dark, 0.03, 0.025, 0.06, 0, -0.05, -0.01); b.box(Mt.steel, 0.006, 0.03, 0.01, 0, -0.05, 0.0, 0.3);
  b.cyl(Mt.glass, 0.032, 0.032, 0.2, 0, 0.03, -0.2, Math.PI / 2, 0, 0, 16);
  for (let i = 0; i < 7; i++) b.torus(Mt.lime, 0.02, 0.004, 0, 0.03, -0.12 - i * 0.026, 0, 0, 0);
  b.cyl(Mt.dark, 0.036, 0.036, 0.03, 0, 0.03, -0.31, Math.PI / 2, 0, 0, 16); b.cyl(Mt.lime, 0.018, 0.018, 0.02, 0, 0.03, -0.325, Math.PI / 2, 0, 0, 12);
  for (const a of [0.5, 2.6, 4.7]) { const px = Math.cos(a) * 0.04, py = 0.03 + Math.sin(a) * 0.04; b.box(Mt.lime, 0.004, 0.06, 0.1, px, py, -0.25, 0, 0, a); }
  b.box(Mt.screen, 0.03, 0.002, 0.06, 0, 0.037, 0.03); b.box(Mt.dark, 0.006, 0.02, 0.006, 0, 0.05, -0.08);
  handGeometry(b, 1, 'grip', M(-0.004, -0.085, 0.065, 0.22, 0, -Math.PI / 2 + 0.1));
  handGeometry(b, -1, 'hold', M(0.0, -0.03, -0.16, -0.1, 0, Math.PI / 2 - 0.4));
  const body = b.build(); g.add(body);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.03, -0.34); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.22, -0.19, -0.4], ads: [0, -0.1, -0.28] }; return g;
}

export function buildBulles() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  // bubble cannon: round tank, wide bell muzzle, soap bottle
  b.sphere(Mt.cyan, 0.06, 0, 0.02, 0.02, 14); b.sphere(Mt.glass, 0.066, 0, 0.02, 0.02, 14);
  b.box(Mt.white, 0.05, 0.06, 0.2, 0, 0.0, -0.14, 0, 0, 0, 0.014);
  b.cyl(Mt.white, 0.03, 0.07, 0.1, 0, 0.01, -0.3, Math.PI / 2, 0, 0, 18); b.cyl(Mt.cyan, 0.026, 0.06, 0.09, 0, 0.01, -0.305, Math.PI / 2, 0, 0, 18);
  b.box(Mt.rubber, 0.046, 0.13, 0.06, 0, -0.09, 0.05, 0.22, 0, 0, 0.008);
  b.box(Mt.dark, 0.03, 0.025, 0.06, 0, -0.05, -0.02);
  b.cyl(Mt.glass, 0.025, 0.025, 0.09, 0, -0.06, -0.14, 0, 0, 0, 12); b.cyl(Mt.cyan, 0.02, 0.02, 0.06, 0, -0.07, -0.14, 0, 0, 0, 12);
  for (let i = 0; i < 3; i++) b.sphere(Mt.glass, 0.012 + i * 0.006, 0.05 + i * 0.02, 0.06 + i * 0.03, -0.1 - i * 0.04, 8);
  handGeometry(b, 1, 'grip', M(-0.004, -0.085, 0.055, 0.22, 0, -Math.PI / 2 + 0.1));
  const body = b.build(); g.add(body);
  const mz = new THREE.Object3D(); mz.position.set(0, 0.01, -0.36); g.add(mz);
  g.userData = { muzzle: mz, hip: [0.24, -0.2, -0.42], ads: [0, -0.1, -0.3] }; return g;
}

export function buildFlamingoMelee(world) {
  const g = new THREE.Group(); const f = world.makeFlamingo(0.16); f.position.set(0.16, -0.44, -0.46); f.rotation.set(0.25, 1.0, 0.35); g.add(f);
  const b = new Builder(); handGeometry(b, 1, 'grip', M(0.16, -0.16, -0.3, 0.9, 0.3, -1.2)); g.add(b.build());
  g.userData = { hip: [0.2, 0, -0.12], ads: [0.2, 0, -0.12], mesh: f }; return g;
}

export function buildGrenadeHand() {
  const b = new Builder(), Mt = VM_MATS; const g = new THREE.Group();
  b.sphere(Mt.pink, 0.045, 0, 0, 0, 12); b.cyl(Mt.dark, 0.014, 0.014, 0.02, 0, 0.05, 0, 0, 0, 0, 10); b.box(Mt.steel, 0.03, 0.01, 0.005, 0.02, 0.055, 0);
  handGeometry(b, -1, 'hold', M(0.0, -0.05, 0.01, 0.6, 0, 0.0));
  const h = b.build(); h.position.set(-0.2, -0.22, -0.36); g.add(h); g.userData = { hand: h }; return g;
}
