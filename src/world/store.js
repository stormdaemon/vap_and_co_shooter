// The Vap&Co store, rebuilt from the legacy layout spec with PBR materials.
// Coordinates: Y up, metres. -Z = back (counters), +Z = shopfront. Floor y=0, ceiling 6.6.
import * as THREE from 'three';
import { Batch, boxGeo, transform, prismGeo, cylGeo } from './geo.js';
import { NavGrid } from './nav.js';
import { labelUV } from '../engine/textures.js';

const PI = Math.PI;
let seed = 1337; const rnd = (a = 0, b = 1) => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return a + (b - a) * (seed / 4294967296); };

export class World {
  constructor(scene, lib, quality) {
    this.scene = scene; this.lib = lib; this.quality = quality;
    this.colliders = [];   // {x0,x1,z0,z1,top, kind}
    this.occluders = [];   // THREE.Box3 (bullets / LOS)
    this.dynamic = [];     // objects needing update
    this.lights = [];
    this.caches = [];
    this.bottleSpots = []; // for destructible bottle spawns
    this.propSpecs = [];   // dynamic physics props (stools, jars)
    this.emissives = [];
    this.bounds = { x0: -8.3, x1: 8.3, z0: -12.6, z1: 12.6 };
    this.buildMaterials();
    this.batch = new Batch(scene);
    this.build();
    this.batch.flush();
    this.nav = new NavGrid(this, 0.4);
  }

  // ---------------------------------------------------------------- materials
  buildMaterials() {
    const L = this.lib, hi = this.quality !== 'low';
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const nscale = (m, s) => { m.normalScale = new THREE.Vector2(s, s); return m; };
    this.M = {
      floor: nscale(std({ map: L.floor.map, normalMap: hi ? L.floor.normalMap : null, roughnessMap: L.floor.roughnessMap, roughness: 0.6, metalness: 0.02, envMapIntensity: 0.9 }), 0.7),
      wood: nscale(std({ map: L.wood.map, normalMap: hi ? L.wood.normalMap : null, roughnessMap: L.wood.roughnessMap, roughness: 0.75, metalness: 0 }), 0.8),
      woodH: nscale(std({ map: L.woodH.map, normalMap: hi ? L.woodH.normalMap : null, roughnessMap: L.woodH.roughnessMap, roughness: 0.75, metalness: 0 }), 0.8),
      darkwood: nscale(std({ map: L.darkwood.map, normalMap: hi ? L.darkwood.normalMap : null, roughnessMap: L.darkwood.roughnessMap, roughness: 0.6, metalness: 0 }), 0.6),
      wall: nscale(std({ map: L.wall.map, normalMap: hi ? L.wall.normalMap : null, roughnessMap: L.wall.roughnessMap, roughness: 0.95, metalness: 0 }), 0.9),
      ceiling: nscale(std({ map: L.ceiling.map, normalMap: hi ? L.ceiling.normalMap : null, roughness: 0.55, metalness: 0.7, color: 0xb9bcc0 }), 0.5),
      metal: nscale(std({ map: L.metal.map, roughnessMap: L.metal.roughnessMap, normalMap: hi ? L.metal.normalMap : null, roughness: 0.45, metalness: 0.9 }), 0.3),
      metalDark: std({ map: L.metalDark.map, roughnessMap: L.metalDark.roughnessMap, roughness: 0.5, metalness: 0.85, color: 0x8a8d92 }),
      black: std({ color: 0x15171a, roughness: 0.55, metalness: 0.3 }),
      steel: std({ color: 0x9aa0a8, roughness: 0.35, metalness: 1 }),
      white: std({ color: 0xe9e6dd, roughness: 0.8 }),
      plaster: std({ color: 0xd6d3cc, roughness: 0.95 }),
      fabric: nscale(std({ map: L.fabric.map, normalMap: hi ? L.fabric.normalMap : null, roughness: 0.95 }), 0.6),
      leather: std({ color: 0x3a2a20, roughness: 0.6, metalness: 0.05 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, transmission: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false }),
      glassFront: new THREE.MeshPhysicalMaterial({ color: 0xbfdde8, transparent: true, opacity: 0.14, roughness: 0.03, metalness: 0, envMapIntensity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      pink: std({ color: 0xff4fa3, roughness: 0.35, metalness: 0, emissive: 0xff2a7f, emissiveIntensity: 0.12 }),
      pinkDark: std({ color: 0xd8347f, roughness: 0.4 }),
      leaf: std({ color: 0x3f8f3a, roughness: 0.8, side: THREE.DoubleSide }),
      leafDark: std({ color: 0x2c6b2f, roughness: 0.85, side: THREE.DoubleSide }),
      pot: std({ color: 0x6b5443, roughness: 0.9 }),
      soil: std({ color: 0x2a1d14, roughness: 1 }),
      screen: std({ map: L.screen, emissive: 0xffffff, emissiveMap: L.screen, emissiveIntensity: 0.9, roughness: 0.3 }),
      logo: std({ map: L.logo, roughness: 0.6 }),
      cbd: std({ map: L.cbd, roughness: 0.6 }),
      shelfPhoto: std({ map: L.shelf, roughness: 0.7 }),
      shelfPhoto2: std({ map: L.shelf2, roughness: 0.7 }),
      cabinetPhoto: std({ map: L.cabinet, roughness: 0.7 }),
      cartPhoto: std({ map: L.cart, roughness: 0.7 }),
      poster: std({ map: L.poster, roughness: 0.6 }),
      poster1: std({ map: L.poster1, roughness: 0.6 }),
      poster2: std({ map: L.poster2, roughness: 0.6 }),
      board: std({ map: L.board, roughness: 0.9 }),
      signCash: std({ map: L.signCash, roughness: 0.6 }),
      signStaff: std({ map: L.signStaff, roughness: 0.6 }),
      signWelcome: std({ map: L.signWelcome, roughness: 0.6 }),
      signEasy: std({ map: L.signEasy, roughness: 0.6 }),
      signZinzin: std({ map: L.signZinzin, roughness: 0.6, emissive: 0xff4fa3, emissiveMap: L.signZinzin, emissiveIntensity: 0.5 }),
      neonVap: std({ map: L.neonVap, emissive: 0xffffff, emissiveMap: L.neonVap, emissiveIntensity: 2.4, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      neonCbd: std({ map: L.neonCbd, emissive: 0xffffff, emissiveMap: L.neonCbd, emissiveIntensity: 2.2, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      neonOpen: std({ map: L.neonOpen, emissive: 0xffffff, emissiveMap: L.neonOpen, emissiveIntensity: 2.0, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      ledGreen: std({ color: 0x224422, emissive: 0x39ff5a, emissiveIntensity: 1.8 }),
      ledWarm: std({ color: 0xffe9c0, emissive: 0xffd28a, emissiveIntensity: 1.4 }),
      ledCool: std({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6 }),
      bunting: std({ map: L.bunting, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
      cloth: std({ map: L.cloth, roughness: 0.95 }),
      price: std({ map: L.price, roughness: 0.8 }),
      cardboard: std({ color: 0xb08a5a, roughness: 0.95 }),
      jar: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, envMapIntensity: 1.2 }),
      gummy: std({ color: 0xff7bb0, roughness: 0.35, emissive: 0xff2a7f, emissiveIntensity: 0.1 }),
      road: std({ color: 0x2e3033, roughness: 0.98 }),
      sidewalk: std({ color: 0x9a9791, roughness: 0.95 }),
      sky: new THREE.MeshBasicMaterial({ color: 0xcfe3f2 }),
      car: std({ color: 0x8e2b2b, roughness: 0.3, metalness: 0.6 }),
      tree: std({ color: 0x2f6b31, roughness: 0.9 }),
    };
    // bottle material with per-instance label UV (atlas 8x4)
    const bm = std({ map: L.labels, roughness: 0.35, metalness: 0.05, envMapIntensity: 1.2 });
    bm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 labelUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * labelUv.zw + labelUv.xy;\n#endif');
    };
    this.M.bottle = bm;
  }

  // ---------------------------------------------------------------- helpers
  collider(x0, x1, z0, z1, top = 3, kind = 'solid') { this.colliders.push({ x0, x1, z0, z1, top, kind }); this.occluders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, top, z1))); }
  occluder(x0, y0, z0, x1, y1, z1) { this.occluders.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))); }
  mesh(geo, mat, x = 0, y = 0, z = 0, { ry = 0, rx = 0, rz = 0, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = receive; this.scene.add(m); return m;
  }
  pointLight(color, intensity, x, y, z, dist = 8, decay = 2) {
    const l = new THREE.PointLight(color, intensity, dist, decay); l.position.set(x, y, z); this.scene.add(l); this.lights.push(l); return l;
  }

  floorHeight(x, z) {
    // staircase: footprint x -8.25..-6.2, treads run from z=-5.25 (bottom) to z=-10.2 (top)
    if (x > -8.35 && x < -6.1) {
      if (z < -5.1 && z > -10.2) return Math.min(3.33, Math.max(0, (-5.25 - z) / 4.95 * 3.33));
      if (z <= -10.2 && z > -12.6) return 3.47;
    }
    if (x <= -4.4 && x > -8.5 && z <= -10.15 && z > -12.6) return 3.47; // mezzanine
    return 0;
  }
  isBlocked(x, z, r = 0.3, y = null) {
    const B = this.bounds;
    if (x - r < B.x0 || x + r > B.x1 || z - r < B.z0 || z + r > B.z1) return true;
    if (y === null) y = this.floorHeight(x, z);
    for (const c of this.colliders) {
      if (c.top <= y + 0.05) continue;
      if (c.kind === 'under' && y > 3) continue;
      if (c.bottom !== undefined && c.bottom > y + 1.5) continue;
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- build
  build() {
    this.buildShell();
    this.buildBackWall();
    this.buildCounters();
    this.buildLeftWall();
    this.buildRightWall();
    this.buildCentral();
    this.buildKiosk();
    this.buildCart();
    this.buildStairs();
    this.buildShopfront();
    this.buildExterior();
    this.buildLighting();
  }

  buildShell() {
    const B = this.batch, M = this.M;
    // floor (planks run along Z)
    const fg = new THREE.PlaneGeometry(26.4, 17.4); fg.rotateX(-PI / 2); fg.rotateY(PI / 2);
    { const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26.4 / 2.6, uv.getY(i) * 17.4 / 1.52); }
    this.mesh(fg, M.floor, 0, 0, 0, { cast: false });
    // ceiling
    B.plane(M.ceiling, 17.6, 26.4, 0, 6.6, 0, { rx: PI / 2, tex: 2.2, cast: false });
    // walls (block wall upper + wood wainscot lower)
    B.box(M.wall, 17.5, 6.6, 0.3, 0, 3.3, -13.05, { tex: 2.4 });
    B.box(M.wall, 0.3, 6.6, 26.4, -8.75, 3.3, 0, { tex: 2.4 });
    B.box(M.wall, 0.3, 6.6, 26.4, 8.75, 3.3, 0, { tex: 2.4 });
    // wainscot cladding
    B.box(M.woodH, 17.2, 3.45, 0.06, 0, 1.725, -12.86, { tex: 1.2 });
    B.box(M.woodH, 0.06, 2.72, 25.6, -8.57, 1.36, 0, { tex: 1.2 });
    B.box(M.woodH, 0.06, 2.7, 15.6, 8.57, 1.35, -5, { tex: 1.2 });
    this.occluder(-9, 0, -13.2, 9, 7, -12.8); this.occluder(-9, 0, -13.2, -8.6, 7, 13.2); this.occluder(8.6, 0, -13.2, 9, 7, 13.2);
    // steel trusses + columns
    for (const z of [-12, -7, -2, 3, 8, 13]) {
      B.box(M.steel, 17.2, 0.12, 0.12, 0, 6.28, z, { tex: 0 }); B.box(M.steel, 17.2, 0.1, 0.1, 0, 5.88, z, { tex: 0 });
      for (let x = -8; x < 8.1; x += 1.0) { B.box(M.steel, 0.05, 0.5, 0.05, x, 6.08, z, { rz: 0.9, tex: 0 }); B.box(M.steel, 0.05, 0.5, 0.05, x + 0.5, 6.08, z, { rz: -0.9, tex: 0 }); }
    }
    for (const x of [-8.37, 8.37]) for (const z of [-7, -2, 3, 8]) B.box(M.steel, 0.19, 6.3, 0.19, x, 3.15, z, { tex: 0 });
    // industrial pendant lamps
    for (const x of [-4.4, 3.8]) for (const z of [-4.1, 3, 9.4]) {
      B.cyl(M.black, 0.01, 0.01, 1.2, x, 5.95, z, { seg: 6 });
      B.cyl(M.metalDark, 0.12, 0.34, 0.32, x, 5.36, z, { seg: 20 });
      B.cyl(M.ledWarm, 0.25, 0.25, 0.02, x, 5.2, z, { seg: 20, cast: false });
    }
    // green LED strip on the left wall + cove
    B.box(M.ledGreen, 0.04, 0.03, 21.8, -8.53, 2.81, 1.47, { cast: false });
    // welcome mat
    B.box(M.cloth, 1.7, 0.02, 0.86, 6.53, 0.02, 11.68, { tex: 0.5, cast: false });
  }

  shelfModule(x, z, w, ry = 0, style = 1, photo = null) {
    // wall merchandising module: back panel + shelves + bottles. Built in local space then rotated around y.
    const B = this.batch, M = this.M;
    const H = style === 2 ? 3.22 : 3.0, depth = 0.56;
    const local = (lx, ly, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, ly, z - lx * s + lz * c]; };
    let p;
    p = local(0, H / 2, -0.25); B.box(M.darkwood, w, H, 0.06, p[0], p[1], p[2], { ry, tex: 0.9 });
    if (photo) { p = local(0, H * 0.55, -0.215); B.plane(photo, w - 0.1, H * 0.85, p[0], p[1], p[2], { ry, cast: false }); }
    const n = style === 2 ? 5 : 7, y0 = 0.35, step = style === 2 ? 0.58 : 0.415;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * step; p = local(0, y, 0.02);
      B.box(M.darkwood, w, 0.03, depth, p[0], p[1], p[2], { ry, tex: 0.9 });
      // LED under shelf
      p = local(0, y - 0.02, 0.28); B.box(M.ledWarm, w - 0.1, 0.008, 0.02, p[0], p[1], p[2], { ry, cast: false });
      // bottles/boxes
      const count = Math.floor(w / 0.11);
      for (let k = 0; k < count; k++) {
        const lx = -w / 2 + 0.08 + k * ((w - 0.16) / Math.max(1, count - 1)); const q = local(lx, y + 0.015, 0.1 + rnd(-0.04, 0.04));
        if (rnd() < 0.75) this.bottleSpots.push({ x: q[0], y: q[1], z: q[2], h: rnd(0.11, 0.17), r: rnd(0.02, 0.032), ry: ry + rnd(-0.4, 0.4) });
        else { const b = local(lx, y + 0.075, 0.1); B.box(M.cardboard, 0.08, 0.12, 0.06, b[0], b[1], b[2], { ry: ry + rnd(-0.2, 0.2), tex: 0 }); }
      }
      // price tags
      for (let k = 0; k < 3; k++) { const t = local(-w / 3 + k * w / 3, y + 0.05, 0.3); B.plane(M.price, 0.12, 0.06, t[0], t[1], t[2], { ry, cast: false }); }
    }
    if (style === 2) { for (const s of [-1, 1]) { p = local(s * w / 2, H / 2, 0); B.box(M.darkwood, 0.05, H, 0.6, p[0], p[1], p[2], { ry, tex: 0.9 }); } }
    // collider (axis-aligned approx)
    const c = Math.cos(ry), s = Math.sin(ry);
    const hx = Math.abs(w / 2 * c) + Math.abs(0.3 * s), hz = Math.abs(w / 2 * s) + Math.abs(0.3 * c);
    this.collider(x - hx, x + hx, z - hz - 0.02, z + hz + 0.02, H);
  }

  buildBackWall() {
    const B = this.batch, M = this.M, L = this.lib;
    // dark reed pergola ceiling + rafters + spots
    B.box(M.darkwood, 17.15, 0.06, 3.4, 0, 3.94, -10.75, { tex: 0.8, cast: false });
    for (let z = -12.4; z <= -9.1; z += 0.22) B.box(M.darkwood, 17.1, 0.035, 0.06, 0, 3.89, z, { tex: 0.8, cast: false });
    for (let x = -8; x <= 8.1; x += 2.15) { B.box(M.wood, 0.12, 0.16, 3.6, x, 3.8, -10.8, { tex: 0.6 }); B.cyl(M.black, 0.06, 0.08, 0.16, x + 0.4, 3.62, -9.7, { seg: 10 }); B.cyl(M.ledWarm, 0.045, 0.045, 0.01, x + 0.4, 3.53, -9.7, { seg: 10, cast: false }); }
    B.box(M.wood, 17.25, 0.21, 0.12, 0, 3.83, -9.02, { tex: 0.6 });
    // bunting string
    for (let i = 0; i < 4; i++) B.plane(M.bunting, 4.1, 0.5, -6.15 + i * 4.1, 3.45, -8.94, { cast: false });
    // sign band + lit round logos
    B.box(M.black, 17.2, 1.06, 0.06, 0, 4.65, -12.6, { tex: 0 });
    B.cyl(M.cbd, 0.54, 0.54, 0.05, -4.6, 4.65, -12.54, { seg: 32, rx: PI / 2 });
    B.cyl(M.logo, 0.54, 0.54, 0.05, 3.5, 4.65, -12.54, { seg: 32, rx: PI / 2 });
    this.pointLight(0x5ef2ff, 6, -4.6, 4.65, -12.2, 5);
    this.pointLight(0xff4fa3, 6, 3.5, 4.65, -12.2, 5);
    // neon signs on the back wall band
    this.mesh(new THREE.PlaneGeometry(3.2, 1.6), M.neonVap, 0.5, 5.65, -12.82, { cast: false, receive: false });
    this.mesh(new THREE.PlaneGeometry(2.4, 1.2), M.neonCbd, -5.6, 5.7, -12.82, { cast: false, receive: false });
    this.pointLight(0xff4fa3, 10, 0.5, 5.6, -12.3, 7);
    this.pointLight(0x5ef2ff, 8, -5.6, 5.6, -12.3, 6);
    // wall merchandising modules
    const mods = [[-6.66, 2.35, 1, this.M.shelfPhoto], [-3.86, 2.48, 2, this.M.shelfPhoto2], [-1.07, 2.35, 1, this.M.cabinetPhoto], [1.57, 2.40, 1, this.M.shelfPhoto], [4.25, 2.38, 2, this.M.shelfPhoto2], [6.93, 2.28, 1, this.M.cabinetPhoto]];
    for (const [x, w, st, ph] of mods) this.shelfModule(x, -12.34, w, 0, st, ph);
    // staff door on the back wall-right? (legacy: right wall) -> handled in right wall
  }

  counter(x, z, width) {
    const B = this.batch, M = this.M;
    B.box(M.wood, width, 1.2, 1.1, x, 0.6, z, { tex: 0.6 });            // slat body
    B.box(M.darkwood, width + 0.1, 0.07, 1.25, x, 1.235, z, { tex: 0.9 }); // top
    B.box(M.black, width, 0.08, 1.12, x, 0.04, z, { tex: 0 });           // kick
    B.box(M.ledWarm, width - 0.2, 0.02, 0.02, x, 1.19, z + 0.58, { cast: false }); // under-top LED
    this.collider(x - width / 2, x + width / 2, z - 0.6, z + 0.62, 1.27);
    // things on top
    for (let i = 0; i < Math.floor(width / 0.5); i++) {
      const bx = x - width / 2 + 0.3 + i * 0.5 + rnd(-0.1, 0.1), bz = z + rnd(-0.35, 0.3);
      if (rnd() < 0.6) this.bottleSpots.push({ x: bx, y: 1.27, z: bz, h: rnd(0.12, 0.2), r: rnd(0.025, 0.04), ry: rnd(0, 6) });
      else B.box(M.cardboard, 0.14, 0.1, 0.1, bx, 1.32, bz, { ry: rnd(0, 1), tex: 0 });
    }
  }
  till(x, z) {
    const B = this.batch, M = this.M;
    B.box(M.black, 0.42, 0.06, 0.34, x, 1.3, z, { tex: 0 });
    B.box(M.black, 0.02, 0.36, 0.02, x, 1.5, z - 0.1, { tex: 0 });
    B.box(M.black, 0.5, 0.34, 0.03, x, 1.69, z - 0.1, { tex: 0 });
    B.plane(M.screen, 0.46, 0.29, x, 1.69, z - 0.08, { cast: false });
    B.box(M.metalDark, 0.16, 0.05, 0.1, x + 0.34, 1.3, z + 0.1, { tex: 0 });
    B.box(M.metalDark, 0.24, 0.12, 0.2, x - 0.4, 1.33, z + 0.05, { tex: 0 });
  }
  buildCounters() {
    const B = this.batch, M = this.M;
    this.counter(-4.9, -9.45, 5.82);
    this.counter(3.56, -9.45, 8.48);
    this.till(-6.75, -9.47); this.till(1.1, -9.47);
    // vending / display fridge on the counter
    B.box(M.metalDark, 0.6, 1.08, 0.5, -5.55, 1.8, -9.45, { tex: 0 });
    B.box(M.glass, 0.5, 0.9, 0.02, -5.55, 1.85, -9.19, { cast: false });
    B.box(M.ledCool, 0.44, 0.01, 0.02, -5.55, 2.26, -9.2, { cast: false });
    // counter-front graphics
    B.cyl(M.logo, 0.5, 0.5, 0.03, -4.95, 0.67, -8.84, { seg: 32, rx: PI / 2 });
    B.cyl(M.cbd, 0.56, 0.56, 0.03, 4.65, 0.65, -8.84, { seg: 32, rx: PI / 2 });
    B.plane(M.poster, 0.6, 1.0, 1.32, 0.68, -8.83, { cast: false });
    B.plane(M.board, 1.2, 0.9, 6.3, 1.76, -9.24, { cast: false });
    B.plane(M.signCash, 1.6, 0.6, -3.0, 2.9, -12.3, { cast: false });
    B.plane(M.signWelcome, 1.6, 0.6, 2.3, 2.95, -12.3, { cast: false });
    B.plane(M.signEasy, 1.4, 0.55, 5.9, 3.0, -12.3, { cast: false });
    B.plane(M.signZinzin, 1.6, 0.6, -0.3, 3.0, -12.3, { cast: false });
    // jars on the counter
    for (let i = 0; i < 6; i++) this.propSpecs.push({ kind: 'jar', x: 2.6 + i * 0.17, y: 1.27, z: -9.5 });
    this.flowers(6.98, 1.29, -9.13); this.flowers(-0.42, 1.3, -9.2);
    // shopping bags behind the counter
    for (let i = 0; i < 8; i++) B.box(M.cloth, 0.22, 0.32, 0.12, -7.55 + i * 0.3, 0.16, -11.0, { ry: rnd(-0.3, 0.3), tex: 0.4 });
    // neon "Vap&Co" on the right counter front (photo shows a lit round sign)
    this.mesh(new THREE.PlaneGeometry(1.6, 0.8), M.neonVap, 5.9, 0.7, -8.83, { cast: false, receive: false });
    this.pointLight(0xff4fa3, 4, 5.9, 0.8, -8.3, 4);
  }
  flowers(x, y, z) {
    const B = this.batch, M = this.M;
    B.cyl(M.jar, 0.06, 0.05, 0.2, x, y + 0.1, z, { seg: 10 });
    for (let i = 0; i < 6; i++) { const a = i * 1.05; B.cyl(M.leafDark, 0.006, 0.006, 0.3, x + Math.cos(a) * 0.04, y + 0.32, z + Math.sin(a) * 0.04, { seg: 4, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }); B.sphere(i % 2 ? M.pink : M.gummy, 0.035, x + Math.cos(a) * 0.12, y + 0.46, z + Math.sin(a) * 0.12, { seg: 8 }); }
  }

  glassBay(x, z, w = 2.45) {
    // left wall vitrines (rotated 90°, facing +x)
    const B = this.batch, M = this.M;
    B.box(M.darkwood, 0.06, 1.93, w, x - 0.25, 1.0, z, { tex: 0.9 });
    B.plane(M.cabinetPhoto, w - 0.1, 1.7, x - 0.21, 1.05, z, { ry: PI / 2, cast: false });
    for (let i = 0; i < 4; i++) {
      const y = 0.88 + i * 0.42;
      B.box(M.glass, 0.5, 0.012, w, x, y, z, { cast: false });
      B.box(M.ledCool, 0.02, 0.008, w - 0.1, x - 0.2, y + 0.4, z, { cast: false });
      for (let k = 0; k < 12; k++) { const bz = z - w / 2 + 0.12 + k * ((w - 0.24) / 11); if (rnd() < 0.7) this.bottleSpots.push({ x: x + rnd(-0.12, 0.12), y: y + 0.006, z: bz, h: rnd(0.1, 0.16), r: rnd(0.02, 0.03), ry: rnd(0, 6) }); else B.box(M.cardboard, 0.07, 0.11, 0.07, x, y + 0.06, bz, { tex: 0 }); }
    }
    B.box(M.glassFront, 0.01, 1.93, w, x + 0.26, 1.0, z, { cast: false });
    B.box(M.black, 0.55, 0.3, w, x, 0.15, z, { tex: 0 });
    B.box(M.black, 0.55, 0.04, w, x, 2.0, z, { tex: 0 });
    this.collider(x - 0.3, x + 0.3, z - w / 2, z + w / 2, 2.05);
  }
  buildLeftWall() {
    const B = this.batch, M = this.M;
    for (const z of [-3.5, -0.7, 2.1, 4.9, 7.7]) this.glassBay(-8.15, z);
    // hookah shelves
    for (const z of [-1.2, 1.7, 4.7]) { B.box(M.darkwood, 0.36, 0.05, 0.73, -6.96, 0.68, z, { tex: 0.9 }); B.box(M.black, 0.3, 0.68, 0.6, -6.96, 0.34, z, { tex: 0 }); for (let k = 0; k < 3; k++) this.hookah(-6.96, 0.7, z - 0.25 + k * 0.25); this.collider(-7.16, -6.76, z - 0.38, z + 0.38, 1.4); }
    this.hookahTable(-7.53, 8.25);
    // posters on the wainscot
    B.plane(M.poster1, 0.7, 1.05, -8.53, 1.9, -6.5, { ry: PI / 2, cast: false });
    B.plane(M.poster2, 0.7, 1.05, -8.53, 1.9, 10.2, { ry: PI / 2, cast: false });
    this.pointLight(0x39ff5a, 3, -7.8, 2.8, -2, 5); this.pointLight(0x39ff5a, 3, -7.8, 2.8, 5, 5);
  }
  hookah(x, y, z) {
    const B = this.batch, M = this.M;
    B.cyl(M.metal, 0.07, 0.09, 0.03, x, y + 0.015, z, { seg: 12 });
    B.cyl(M.jar, 0.06, 0.05, 0.18, x, y + 0.12, z, { seg: 12 });
    B.cyl(M.metal, 0.012, 0.02, 0.4, x, y + 0.4, z, { seg: 8 });
    B.cyl(M.metalDark, 0.04, 0.03, 0.05, x, y + 0.62, z, { seg: 10 });
  }
  hookahTable(x, z) {
    const B = this.batch, M = this.M;
    B.box(M.darkwood, 1.05, 0.05, 1.12, x, 0.75, z, { tex: 0.9 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(M.metalDark, 0.04, 0.73, 0.04, x + sx * 0.48, 0.365, z + sz * 0.5, { tex: 0 });
    this.hookah(x - 0.2, 0.78, z); this.hookah(x + 0.25, 0.78, z + 0.2);
    this.collider(x - 0.55, x + 0.55, z - 0.6, z + 0.6, 0.8);
  }

  buildRightWall() {
    const B = this.batch, M = this.M;
    this.shelfModule(8.18, -4.15, 2.33, -PI / 2, 2, M.shelfPhoto2);
    // stockroom door (PRIVÉ)
    B.box(M.darkwood, 0.06, 2.2, 1.08, 8.55, 1.1, -0.45, { tex: 0.9 });
    B.box(M.black, 0.08, 2.3, 0.08, 8.55, 1.15, -1.03, { tex: 0 }); B.box(M.black, 0.08, 2.3, 0.08, 8.55, 1.15, 0.13, { tex: 0 }); B.box(M.black, 0.08, 0.08, 1.2, 8.55, 2.26, -0.45, { tex: 0 });
    B.cyl(M.metal, 0.015, 0.015, 0.14, 8.48, 1.03, -0.75, { seg: 8, rz: PI / 2 });
    B.plane(M.signStaff, 0.9, 0.34, 8.5, 2.55, -0.45, { ry: -PI / 2, cast: false });
    // jar shelving units
    for (const z of [3.05, 5.45]) {
      B.box(M.darkwood, 0.5, 0.68, 1.0, 8.09, 0.34, z, { tex: 0.9 });
      for (const y of [0.75, 1.31, 1.87]) { B.box(M.darkwood, 0.45, 0.03, 1.0, 8.09, y, z, { tex: 0.9 }); for (let k = 0; k < 7; k++) { const jz = z - 0.42 + k * 0.14; B.cyl(M.jar, 0.055, 0.05, 0.13, 8.05, y + 0.08, jz, { seg: 10 }); B.cyl(M.black, 0.057, 0.057, 0.015, 8.05, y + 0.15, jz, { seg: 10 }); for (let g = 0; g < 3; g++) B.sphere(M.gummy, 0.02, 8.05 + rnd(-0.02, 0.02), y + 0.04 + g * 0.03, jz + rnd(-0.02, 0.02), { seg: 5 }); } }
      B.box(M.darkwood, 0.05, 2.0, 1.0, 8.34, 1.0, z, { tex: 0.9 });
      this.flowers(8.05, 2.01, z);
      this.collider(7.8, 8.4, z - 0.52, z + 0.52, 2.0);
    }
    this.plant(7.24, 10.95, 1.32, 0); this.plant(7.63, -9.27, 0.51, 1); this.plant(-7.6, -11.2, 0.5, 1); this.plant(-6.42, 10.66, 1.12, 0);
    this.plant(6.85, -1.92, 0.87, 0); this.plant(-5.43, -3.1, 0.57, 1); this.plant(7.4, -7.5, 0.66, 1); this.plant(-1.8, -10.82, 0.55, 1); this.plant(-5.9, 3.16, 0.6, 1);
    // hanging foliage
    for (const z of [-8.1, -5.1]) { B.cyl(M.pot, 0.16, 0.12, 0.2, 7.6, 3.2, z, { seg: 10 }); for (let i = 0; i < 10; i++) B.cyl(M.leaf, 0.008, 0.008, rnd(0.5, 1.1), 7.6 + rnd(-0.14, 0.14), 2.75, z + rnd(-0.14, 0.14), { seg: 4, rx: rnd(-0.2, 0.2), rz: rnd(-0.2, 0.2) }); }
  }
  plant(x, z, s, type) {
    const B = this.batch, M = this.M;
    B.cyl(M.pot, 0.22 * s, 0.17 * s, 0.32 * s, x, 0.16 * s, z, { seg: 14 });
    B.cyl(M.soil, 0.2 * s, 0.2 * s, 0.02, x, 0.32 * s, z, { seg: 14 });
    if (type === 0) {
      B.cyl(M.pot, 0.05 * s, 0.08 * s, 1.8 * s, x, 0.32 * s + 0.9 * s, z, { seg: 8 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const g = new THREE.PlaneGeometry(0.16 * s, 1.1 * s); g.translate(0, 0.55 * s, 0); transform(g, x, 2.05 * s, z, -0.35 - rnd(0, 0.5), a, 0); this.batch.add(M.leaf, g); }
    } else {
      for (let i = 0; i < 25; i++) { const a = rnd(0, PI * 2), r = rnd(0, 0.16 * s); const g = new THREE.PlaneGeometry(0.06 * s, 0.6 * s); g.translate(0, 0.3 * s, 0); transform(g, x + Math.cos(a) * r, 0.32 * s, z + Math.sin(a) * r, rnd(-0.5, 0.2), a, rnd(-0.3, 0.3)); this.batch.add(i % 2 ? M.leaf : M.leafDark, g); }
    }
    this.collider(x - 0.24 * s, x + 0.24 * s, z - 0.24 * s, z + 0.24 * s, 0.35 * s);
  }

  buildCentral() {
    const B = this.batch, M = this.M;
    // high table + stools
    const tx = -3.82, tz = -0.45, len = 3.9;
    B.box(M.darkwood, 1.16, 0.06, len, tx, 1.15, tz, { tex: 0.9 });
    for (const sz of [-1, 1]) { B.box(M.metalDark, 0.06, 1.12, 0.06, tx - 0.5, 0.56, tz + sz * (len / 2 - 0.2), { tex: 0 }); B.box(M.metalDark, 0.06, 1.12, 0.06, tx + 0.5, 0.56, tz + sz * (len / 2 - 0.2), { tex: 0 }); B.box(M.metalDark, 1.06, 0.05, 0.05, tx, 0.1, tz + sz * (len / 2 - 0.2), { tex: 0 }); }
    for (const sx of [-1, 1]) for (const sz of [-1.57, -0.45, 0.67]) this.stool(tx + sx * 0.93, tz + sz);
    this.collider(tx - 0.95, tx + 0.95, tz - 2.15, tz + 2.15, 1.2);
    // lamp post
    B.cyl(M.metalDark, 0.18, 0.2, 0.06, -5.36, 0.03, 1.9, { seg: 16 });
    B.cyl(M.metalDark, 0.04, 0.05, 2.45, -5.36, 1.25, 1.9, { seg: 10 });
    for (let i = 0; i < 3; i++) { const a = i * 2.1; const lx = -5.36 + Math.cos(a) * 0.32, lz = 1.9 + Math.sin(a) * 0.32; B.box(M.metalDark, 0.04, 0.04, 0.34, -5.36 + Math.cos(a) * 0.16, 2.38, 1.9 + Math.sin(a) * 0.16, { ry: -a + PI / 2, tex: 0 }); B.box(M.jar, 0.18, 0.28, 0.18, lx, 2.2, lz, { cast: false }); B.sphere(M.ledWarm, 0.05, lx, 2.2, lz, { seg: 8, cast: false }); }
    this.pointLight(0xffd28a, 5, -5.36, 2.3, 1.9, 6);
    this.collider(-5.6, -5.12, 1.66, 2.14, 2.5);
    // accessory rack (slatwall like photo 1)
    B.box(M.wood, 2.25, 2.3, 0.24, 1.05, 1.15, -5.65, { tex: 0.6 });
    for (let y = 0.3; y < 2.2; y += 0.1) B.box(M.black, 2.2, 0.012, 0.01, 1.05, y, -5.52, { tex: 0, cast: false });
    for (let i = 0; i < 18; i++) { const x = 0.1 + (i % 6) * 0.38, y = 1.9 - Math.floor(i / 6) * 0.5; B.box(M.metal, 0.01, 0.01, 0.12, x, y, -5.47, { tex: 0 }); B.box([M.cardboard, M.black, M.pink][i % 3], 0.16, 0.24, 0.03, x, y - 0.12, -5.42, { tex: 0 }); }
    for (const y of [0.3, 0.7, 1.15]) { B.box(M.darkwood, 2.2, 0.03, 0.4, 1.05, y, -5.4, { tex: 0.9 }); for (let k = 0; k < 6; k++) B.box(M.leather, 0.18, 0.1, 0.24, 0.2 + k * 0.34, y + 0.065, -5.4, { ry: rnd(-0.2, 0.2), tex: 0 }); }
    this.collider(-0.1, 2.2, -5.85, -5.18, 2.3);
    // glass cabinets
    this.cabinet(2.75, -5.65, 0.87, 2.43, 0.8); this.cabinet(5.87, -6.04, 1.23, 1.82, 0.78); this.cabinet(1.63, -1.12, 0.72, 1.53, 0.72);
    // wall display (yaw -0.12)
    B.box(M.darkwood, 1.59, 1.87, 0.23, 4.83, 0.94, -2.33, { ry: -0.12, tex: 0.9 });
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const lx = -0.6 + c * 0.3, ly = 0.3 + r * 0.33; B.box([M.cardboard, M.black, M.pink, M.gummy][(r + c) % 4], 0.2, 0.26, 0.08, 4.83 + lx * Math.cos(-0.12) - 0.16 * Math.sin(-0.12), ly, -2.33 + lx * Math.sin(-0.12) + 0.16 * Math.cos(-0.12), { ry: -0.12, tex: 0 }); }
    this.collider(3.95, 5.7, -2.65, -2.0, 1.9);
  }
  stool(x, z) { this.propSpecs.push({ kind: 'stool', x, z }); }
  cabinet(x, z, w, h, d) {
    const B = this.batch, M = this.M;
    B.box(M.black, w, 0.12, d, x, 0.06, z, { tex: 0 }); B.box(M.black, w, 0.04, d, x, h - 0.02, z, { tex: 0 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(M.metalDark, 0.03, h, 0.03, x + sx * (w / 2 - 0.015), h / 2, z + sz * (d / 2 - 0.015), { tex: 0 });
    B.box(M.glass, w - 0.02, h - 0.16, d - 0.02, x, h / 2, z, { cast: false });
    for (let i = 0; i < 6; i++) { const y = 0.3 + i * 0.33; if (y > h - 0.3) break; B.box(M.glass, w - 0.06, 0.008, d - 0.06, x, y, z, { cast: false }); B.box(M.ledCool, 0.008, 0.008, d - 0.1, x - w / 2 + 0.03, y + 0.31, z, { cast: false }); for (let k = 0; k < 3; k++) if (rnd() < 0.8) this.bottleSpots.push({ x: x - w / 3 + k * w / 3, y: y + 0.005, z: z + rnd(-0.15, 0.15), h: rnd(0.08, 0.14), r: rnd(0.018, 0.028), ry: rnd(0, 6) }); }
    this.collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
  }

  buildKiosk() {
    const B = this.batch, M = this.M;
    const cx = -0.45, cz = 4.0, R = 2.08;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * PI * 2 + PI / 8; const px = cx + Math.cos(a) * R, pz = cz + Math.sin(a) * R;
      B.box(M.wood, 0.15, 3.25, 0.15, px, 1.625, pz, { ry: -a, tex: 0.6 });
    }
    // bays: k=0 open entrance (facing +z / the shopfront), others counters w/ bottles + lattice
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * PI * 2 + PI / 8, a1 = (k + 1) / 8 * PI * 2 + PI / 8, am = (a0 + a1) / 2;
      const bx = cx + Math.cos(am) * 1.935, bz = cz + Math.sin(am) * 1.935, ry = -am + PI / 2;
      if (k === 1) { B.box(M.wood, 1.6, 0.06, 0.08, bx, 0.15, bz, { ry, tex: 0.6 }); continue; } // entrance faces +z (angle ~ π/2)
      B.box(M.wood, 1.6, 1.06, 0.13, bx, 0.53, bz, { ry, tex: 0.6 });
      B.box(M.darkwood, 1.66, 0.05, 0.3, bx, 1.165, bz, { ry, tex: 0.9 });
      for (let i = 0; i < 9; i++) { const t = -0.7 + i * 0.175; const sx = bx + Math.cos(ry) * t, sz = bz - Math.sin(ry) * t; this.bottleSpots.push({ x: sx, y: 1.19, z: sz, h: rnd(0.1, 0.17), r: rnd(0.02, 0.03), ry: rnd(0, 6) }); }
      if (k === 4 || k === 5 || k === 6) for (let i = 0; i < 6; i++) { const t = -0.7 + i * 0.28; B.box(M.wood, 0.03, 1.9, 0.03, bx + Math.cos(ry) * t, 2.2, bz - Math.sin(ry) * t, { ry, rz: 0.75, tex: 0 }); B.box(M.wood, 0.03, 1.9, 0.03, bx + Math.cos(ry) * t, 2.2, bz - Math.sin(ry) * t, { ry, rz: -0.75, tex: 0 }); }
    }
    // roof: 8 sectors of slats (cones approximated with a low cone + rafters)
    const roof = new THREE.ConeGeometry(2.5, 0.55, 8, 1, true); roof.rotateY(PI / 8); transform(roof, cx, 3.6, cz);
    { const uv = roof.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 1.5); }
    B.add(M.darkwood, roof); this.M.darkwood.side = THREE.DoubleSide;
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + PI / 8; B.box(M.wood, 0.08, 0.1, 2.5, cx + Math.cos(a) * 1.25, 3.6, cz + Math.sin(a) * 1.25, { ry: -a + PI / 2, rx: 0.22, tex: 0.6 }); }
    B.cyl(M.darkwood, 0.4, 0.4, 0.1, cx, 3.85, cz, { seg: 8 });
    B.cyl(M.ledWarm, 0.12, 0.12, 0.03, cx, 3.32, cz, { seg: 12, cast: false });
    this.pointLight(0xffd28a, 8, cx, 3.2, cz, 7);
    // flamingo on the roof (boss mount — kept as a separate group)
    this.flamingo = this.makeFlamingo(1.0); this.flamingo.position.set(cx, 3.9, cz - 0.04); this.flamingo.rotation.y = -0.27; this.scene.add(this.flamingo);
    // colliders: octagon approximated by 4 boxes ring (leave the entrance bay open toward +z)
    this.collider(cx - 2.1, cx + 2.1, cz - 2.1, cz - 1.75, 1.2);      // back bay
    this.collider(cx - 2.1, cx - 1.75, cz - 2.1, cz + 2.1, 1.2);      // left
    this.collider(cx + 1.75, cx + 2.1, cz - 2.1, cz + 2.1, 1.2);      // right
    this.collider(cx - 2.1, cx - 0.75, cz + 1.75, cz + 2.1, 1.2);     // front-left
    this.collider(cx + 0.75, cx + 2.1, cz + 1.75, cz + 2.1, 1.2);     // front-right
    this.colliders.push({ x0: cx - 0.75, x1: cx + 0.75, z0: cz + 1.75, z1: cz + 2.1, top: 0.2, kind: 'step' });
  }
  makeFlamingo(s = 1) {
    const g = new THREE.Group(); const M = this.M;
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * s, y * s, z * s); m.rotation.set(rx, ry, rz); m.scale.setScalar(s); m.castShadow = true; g.add(m); return m; };
    add(new THREE.TorusGeometry(0.9, 0.32, 14, 28), M.pink, 0, 0.32, 0, PI / 2);
    add(new THREE.SphereGeometry(0.55, 18, 14), M.pink, 0, 0.55, -0.55).scale.set(0.9 * s, 0.8 * s, 1.2 * s);
    add(new THREE.ConeGeometry(0.22, 0.7, 10), M.pinkDark, 0, 0.75, -1.25, -1.2);
    // neck: curved tube
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0.15), new THREE.Vector3(0, 1.1, 0.55), new THREE.Vector3(0, 1.7, 0.6), new THREE.Vector3(0, 2.05, 0.9)]);
    add(new THREE.TubeGeometry(curve, 24, 0.16, 10, false), M.pink, 0, 0, 0);
    add(new THREE.SphereGeometry(0.26, 14, 12), M.pink, 0, 2.08, 0.95);
    add(new THREE.ConeGeometry(0.1, 0.5, 10), M.black, 0, 1.95, 1.3, 1.9);
    add(new THREE.SphereGeometry(0.05, 8, 8), M.black, 0.16, 2.14, 1.08); add(new THREE.SphereGeometry(0.05, 8, 8), M.black, -0.16, 2.14, 1.08);
    for (const sx of [-1, 1]) { const w = add(new THREE.SphereGeometry(0.45, 14, 10), M.pinkDark, sx * 0.9, 0.6, -0.45); w.scale.set(0.35 * s, 0.5 * s, 1 * s); w.rotation.z = sx * 0.5; }
    return g;
  }

  buildCart() {
    const B = this.batch, M = this.M;
    const x = 4.55, z = 1.8, ry = -0.13;
    const L = (lx, ly, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    let p = L(0, 0.83, 0); B.box(M.wood, 1.15, 0.06, 2.5, p[0], p[1], p[2], { ry, tex: 0.6 });
    for (const s of [-1, 1]) { p = L(s * 0.55, 1.04, 0); B.box(M.wood, 0.04, 0.36, 2.5, p[0], p[1], p[2], { ry, tex: 0.6 }); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { p = L(sx * 0.5, 1.65, sz * 1.18); B.box(M.wood, 0.06, 1.64, 0.06, p[0], p[1], p[2], { ry, tex: 0.6 }); }
    for (const s of [-1, 1]) { p = L(s * 0.8, 0.43, 0); B.cyl(M.darkwood, 0.43, 0.43, 0.05, p[0], p[1], p[2], { seg: 20, rz: PI / 2, ry }); for (let k = 0; k < 12; k++) { const a = k / 12 * PI; B.box(M.darkwood, 0.02, 0.84, 0.02, p[0], p[1], p[2], { rx: a, ry, tex: 0 }); } }
    for (let i = 0; i < 14; i++) { p = L(0, 2.46, -1.25 + i * (2.5 / 13)); B.box(M.darkwood, 1.3, 0.03, 0.14, p[0], p[1], p[2], { ry, tex: 0.9 }); }
    p = L(-0.55, 1.6, 0); B.plane(M.cartPhoto, 2.3, 1.3, p[0], p[1], p[2], { ry: ry - PI / 2, cast: false });
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) { p = L(-0.4 + c * 0.2, 0.86, -1.0 + r * 0.33); this.bottleSpots.push({ x: p[0], y: p[1], z: p[2], h: rnd(0.1, 0.16), r: rnd(0.02, 0.03), ry: rnd(0, 6) }); }
    const f = this.makeFlamingo(0.36); p = L(0, 2.5, 0); f.position.set(p[0], p[1], p[2]); f.rotation.y = ry; this.scene.add(f);
    this.collider(3.8, 5.3, 0.45, 3.15, 1.2);
  }

  buildStairs() {
    const B = this.batch, M = this.M;
    // flight: 18 treads from z=-5.25 going -Z, rise .185 run .275, x centred -7.2
    for (let i = 0; i < 18; i++) {
      const z = -5.25 - i * 0.275 - 0.1375, y = (i + 1) * 0.185;
      B.box(M.darkwood, 1.64, 0.11, 0.285, -7.2, y - 0.055, z, { tex: 0.9 });
      B.box(M.black, 1.6, 0.185 - 0.11, 0.03, -7.2, y - 0.11 - 0.0375, z + 0.13, { tex: 0 });
    }
    // stringers + balusters + handrail (right side = x -6.36; left side against wall)
    for (const sx of [-0.84, 0.84]) {
      const g = boxGeo(0.06, 0.2, 5.6, 0); transform(g, -7.2 + sx, 1.75, -7.72, Math.atan2(3.33, 4.95), 0, 0); B.add(M.metalDark, g);
      for (let i = 0; i < 9; i++) { const z = -5.4 - i * 0.6; const y = this.floorHeight(-7.2, z); B.box(M.metalDark, 0.03, 0.95, 0.03, -7.2 + sx, y + 0.5, z, { tex: 0 }); }
      const r = boxGeo(0.05, 0.05, 5.6, 0); transform(r, -7.2 + sx, 1.75 + 0.95, -7.72, Math.atan2(3.33, 4.95), 0, 0); B.add(M.darkwood, r);
    }
    // landing + mezzanine platform
    B.box(M.darkwood, 2.0, 0.17, 1.22, -7.05, 3.4, -10.78, { tex: 0.9 });
    B.box(M.darkwood, 3.95, 0.18, 2.0, -6.47, 3.38, -11.15, { tex: 0.9 });
    B.box(M.metalDark, 4.2, 0.12, 0.12, -6.5, 3.28, -10.15, { tex: 0 });
    // mezzanine railing (open edge z=-10.15, from x=-4.5 to x=-6.2; stairs arrive at x<-6.2)
    for (let i = 0; i < 6; i++) { const x = -4.6 - i * 0.32; B.box(M.metalDark, 0.03, 1.0, 0.03, x, 3.97, -10.15, { tex: 0 }); }
    B.box(M.darkwood, 1.9, 0.05, 0.05, -5.4, 4.47, -10.15, { tex: 0.9 });
    B.box(M.metalDark, 0.03, 1.0, 0.03, -4.5, 3.97, -11.15, { tex: 0 }); B.box(M.darkwood, 0.05, 0.05, 2.0, -4.5, 4.47, -11.15, { tex: 0.9 });
    for (let i = 1; i < 6; i++) B.box(M.metalDark, 0.03, 1.0, 0.03, -4.5, 3.97, -10.15 - i * 0.35, { tex: 0 });
    // stuff on the mezzanine (stock boxes)
    for (let i = 0; i < 5; i++) B.box(M.cardboard, 0.4, 0.35, 0.4, -5.2 + rnd(-0.3, 0.3), 3.65, -11.8 + rnd(-0.2, 0.2), { ry: rnd(0, 1), tex: 0 });
    // colliders: stair side rails (x) and platform edge rail; stairs region is walkable (height field)
    this.collider(-6.4, -6.3, -10.2, -5.2, 5, 'rail');   // right stair rail
    this.collider(-8.1, -8.0, -10.2, -5.2, 5, 'rail');   // left rail (wall side)
    this.collider(-6.25, -4.45, -10.2, -10.1, 5, 'rail'); // mezzanine front rail
    this.collider(-4.55, -4.45, -12.3, -10.1, 5, 'rail'); // mezzanine side rail
    this.collider(-5.6, -4.8, -12.1, -11.5, 4.0);          // boxes
    // ground-level: under the mezzanine is blocked by a wall/stock (block it for simplicity)
    this.colliders.push({ x0: -8.3, x1: -4.5, z0: -12.6, z1: -10.2, top: 3.3, bottom: 0, kind: 'under' });
    this.occluder(-8.3, 0, -12.6, -4.5, 3.5, -10.2);
    B.box(M.woodH, 3.8, 3.3, 2.4, -6.45, 1.65, -11.4, { tex: 1.2 });
  }

  buildShopfront() {
    const B = this.batch, M = this.M;
    const z = 12.9;
    for (const y of [6.1, 3.65, 0.1]) B.box(M.metalDark, 17.35, 0.12, 0.12, 0, y, z, { tex: 0 });
    for (const x of [-8.4, -6.4, -4.4, -2.4, -0.4, 1.6, 3.6, 5.7, 8.4]) B.box(M.metalDark, 0.085, 6.2, 0.1, x, 3.1, z, { tex: 0 });
    for (let x = -7.4; x < 8.5; x += 2) {
      B.box(M.glassFront, 1.88, 2.26, 0.02, x, 4.84, z, { cast: false });
      if (x < 3.5 || x > 6) B.box(M.glassFront, 1.88, 3.3, 0.02, x, 1.94, z, { cast: false });
    }
    B.box(M.glassFront, 1.6, 2.26, 0.02, 4.75, 4.84, z, { cast: false });
    // articulated door (hinge at x=5.72)
    const door = new THREE.Group(); door.position.set(5.72, 0, z - 0.05);
    const leaf = new THREE.Mesh(boxGeo(1.93, 3.5, 0.03, 0), M.glassFront); leaf.position.set(0.965, 1.75, 0); door.add(leaf);
    const frame = new THREE.Mesh(boxGeo(1.93, 0.08, 0.06, 0), M.metalDark); frame.position.set(0.965, 3.5, 0); door.add(frame);
    const frame2 = frame.clone(); frame2.position.y = 0.05; door.add(frame2);
    const side = new THREE.Mesh(boxGeo(0.06, 3.5, 0.06, 0), M.metalDark); side.position.set(0.03, 1.75, 0); door.add(side);
    const side2 = side.clone(); side2.position.x = 1.9; door.add(side2);
    for (const y of [1.25, 1.45]) { const bar = new THREE.Mesh(cylGeo(0.015, 0.015, 0.5, 8), M.metal); bar.rotation.z = PI / 2; bar.position.set(1.45, y, 0.06); door.add(bar); }
    const openSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), M.neonOpen); openSign.position.set(0.965, 2.7, -0.03); openSign.rotation.y = PI; door.add(openSign);
    door.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.scene.add(door); this.door = door; this.doorAngle = 0;
    // colliders for the shopfront (door opening between x 3.5 and 6 is passable when open — but outside is blocked anyway)
    this.colliders.push({ x0: -8.6, x1: 3.55, z0: z - 0.1, z1: z + 0.3, top: 6.6 });
    this.colliders.push({ x0: 6.0, x1: 8.6, z0: z - 0.1, z1: z + 0.3, top: 6.6 });
    this.doorCollider = { x0: 3.55, x1: 6.0, z0: z - 0.1, z1: z + 0.3, top: 6.6 }; this.colliders.push(this.doorCollider);
    this.occluder(-9, 0, z - 0.05, 9, 7, z + 0.05);
    this.pointLight(0xd7f06a, 4, 6.6, 2.8, 12.4, 5);
  }

  buildExterior() {
    const B = this.batch, M = this.M;
    B.box(M.sidewalk, 40, 0.1, 14, 0, -0.06, 19.7, { tex: 0, cast: false });
    B.box(M.road, 64, 0.1, 10, 0, -0.07, 29, { tex: 0, cast: false });
    for (let x = -30; x < 30; x += 3) B.box(M.white, 1.6, 0.11, 0.15, x, -0.06, 29, { tex: 0, cast: false });
    for (const [x, z, c] of [[-5, 20, 0x8e2b2b], [-12, 20.3, 0xdedede], [9.3, 20.1, 0x1e3a7a]]) {
      const cm = new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.6 });
      B.box(cm, 1.8, 0.6, 4.2, x, 0.55, z, { tex: 0 }); B.box(cm, 1.6, 0.55, 2.2, x, 1.1, z - 0.2, { tex: 0 }); B.box(M.glassFront, 1.62, 0.5, 2.0, x, 1.12, z - 0.2, { cast: false });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(M.black, 0.32, 0.32, 0.2, x + sx * 0.85, 0.32, z + sz * 1.4, { seg: 14, rz: PI / 2 });
    }
    for (let x = -30; x <= 30; x += 5) { B.cyl(M.pot, 0.18, 0.25, 3, x, 1.5, 35, { seg: 8 }); B.sphere(M.tree, 2.2, x, 4.2, 35, { seg: 8 }); }
    // sky dome / backdrop
    const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), new THREE.MeshBasicMaterial({ color: 0xbfd9ee, side: THREE.BackSide, fog: false })); sky.position.set(0, 0, 10); this.scene.add(sky);
    // buildings across the street
    for (let x = -30; x < 30; x += 7) B.box(M.plaster, 6.5, 6 + (x * 7 % 5), 6, x, 3, 42, { tex: 0 });
  }

  buildLighting() {
    const s = this.scene, q = this.quality;
    s.background = new THREE.Color(0x0e1210);
    s.fog = new THREE.FogExp2(0x151a17, 0.012);
    const hemi = new THREE.HemisphereLight(0xe4ecff, 0x5a4a3a, 0.9); s.add(hemi);
    // daylight through the shopfront (+Z)
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.25); sun.position.set(6, 12, 30); sun.target.position.set(0, 0, 2); s.add(sun); s.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(q === 'low' ? 1024 : 2048, q === 'low' ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 16; sc.bottom = -16; sc.near = 5; sc.far = 60; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
    this.sun = sun;
    // ceiling spots (pendants)
    const spots = [[-4.4, -4.1], [3.8, -4.1], [-4.4, 3], [3.8, 3], [-4.4, 9.4], [3.8, 9.4]];
    const shadowSpots = q === 'high' ? 3 : q === 'med' ? 1 : 0;
    spots.forEach(([x, z], i) => {
      const sp = new THREE.SpotLight(0xffe2b8, 34, 14, 0.85, 0.6, 1.6); sp.position.set(x, 5.25, z); sp.target.position.set(x, 0, z); s.add(sp); s.add(sp.target);
      if (i < shadowSpots) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0008; sp.shadow.normalBias = 0.02; sp.shadow.camera.near = 0.5; sp.shadow.camera.far = 12; }
      this.lights.push(sp);
    });
    // back-of-store warm fill
    this.pointLight(0xffd7a8, 7, 0, 3.5, -10.5, 12, 1.6);
    this.pointLight(0xffd7a8, 4, -5.5, 3.5, -10.5, 9, 1.6);
    this.pointLight(0xffd7a8, 4, 6, 3.5, -10.5, 9, 1.6);
    // lit sign band ambience
    this.ambient = hemi;
  }

  // ---------------------------------------------------------------- runtime
  update(dt, t, playerPos) {
    // door: opens when the player (or an enemy) is near
    const want = (playerPos && Math.hypot(playerPos.x - 6.6, playerPos.z - 12.9) < 3.4) || this.doorForce > t ? 1.1 : 0;
    this.doorAngle += (want - this.doorAngle) * (1 - Math.exp(-dt * 4));
    this.door.rotation.y = -this.doorAngle;
    this.doorCollider.top = this.doorAngle > 0.6 ? 0 : 6.6;
    // flamingo bobbing on the roof
    if (this.flamingo && !this.flamingo.userData.taken) { this.flamingo.position.y = 3.9 + Math.sin(t * 1.3) * 0.05; this.flamingo.rotation.z = Math.sin(t * 0.9) * 0.04; }
    // neon flicker
    if (this.M.neonVap) this.M.neonVap.emissiveIntensity = 2.4 + (Math.random() < 0.02 ? -1.2 : 0) + Math.sin(t * 30) * 0.05;
  }

  // Ray vs occluders (AABBs) — returns nearest hit distance or Infinity
  raycast(origin, dir, maxDist = 60) {
    let best = maxDist; const o = origin, d = dir; let normal = null;
    for (const b of this.occluders) {
      const t = rayBox(o, d, b, best);
      if (t !== null && t < best) { best = t; normal = boxNormal(o, d, t, b); }
    }
    return { dist: best, normal };
  }
  hasLineOfSight(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); if (len < 1e-4) return true; dir.divideScalar(len);
    return this.raycast(a, dir, len - 0.05).dist >= len - 0.05;
  }
}

const _inv = [0, 0, 0];
export function rayBox(o, d, b, maxT = Infinity) {
  let tmin = 0, tmax = maxT;
  for (let i = 0; i < 3; i++) {
    const oi = i === 0 ? o.x : i === 1 ? o.y : o.z, di = i === 0 ? d.x : i === 1 ? d.y : d.z;
    const mn = i === 0 ? b.min.x : i === 1 ? b.min.y : b.min.z, mx = i === 0 ? b.max.x : i === 1 ? b.max.y : b.max.z;
    if (Math.abs(di) < 1e-8) { if (oi < mn || oi > mx) return null; continue; }
    const inv = 1 / di; let t1 = (mn - oi) * inv, t2 = (mx - oi) * inv; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return null;
  }
  return tmin;
}
function boxNormal(o, d, t, b) {
  const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t; const n = new THREE.Vector3();
  const eps = 1e-3;
  if (Math.abs(px - b.min.x) < eps) n.set(-1, 0, 0); else if (Math.abs(px - b.max.x) < eps) n.set(1, 0, 0);
  else if (Math.abs(py - b.min.y) < eps) n.set(0, -1, 0); else if (Math.abs(py - b.max.y) < eps) n.set(0, 1, 0);
  else if (Math.abs(pz - b.min.z) < eps) n.set(0, 0, -1); else n.set(0, 0, 1);
  return n;
}
