// Weapons: definitions, procedural viewmodels, firing (hitscan + projectiles), reload, switching, pickups.
import * as THREE from 'three';

export const WEAPONS = {
  fists: { key: 'fists', name: 'Poings', desc: 'MÊLÉE · CLIC GAUCHE POUR COGNER', slot: 0, melee: true, damage: 28, range: 2.0, arc: 0.9, rate: 0.36, knock: 5, sound: 'punch_hit' },
  flamingo: { key: 'flamingo', name: 'Le Flamant Rose', desc: 'MÊLÉE LOURDE · KNOCKBACK ABSURDE', slot: 0, melee: true, damage: 75, range: 2.7, arc: 1.3, rate: 0.62, knock: 16, sound: 'flamingo_hit', sweep: true },
  vapo: { key: 'vapo', name: 'Vapo-Blaster', desc: 'SEMI-AUTO · VAPEUR IONISÉE', slot: 1, mag: 12, reserve: 84, damage: 32, rate: 0.17, spread: 0.007, reload: 1.15, auto: false, tracer: 0x5ef2ff, kick: 1, sound: 'shot_vapo', hitscan: true, knock: 2.5, color: 0x5ef2ff },
  fumi: { key: 'fumi', name: 'Fumigène 3000', desc: 'DISPERSION · 8 NUAGES DE VAPEUR', slot: 2, mag: 6, reserve: 36, damage: 15, pellets: 8, rate: 0.8, spread: 0.075, reload: 2.1, auto: false, tracer: 0xffb347, kick: 3, sound: 'shot_fumi', hitscan: true, knock: 11, color: 0xffb347 },
  gummy: { key: 'gummy', name: 'Mitrailleuse à Gummies', desc: 'AUTOMATIQUE · REBONDS CBD', slot: 3, mag: 42, reserve: 210, damage: 12, rate: 0.068, spread: 0.03, reload: 1.6, auto: true, kick: 0.35, sound: 'shot_gummy', projectile: { speed: 30, gravity: 7, radius: 0.06, bounces: 3, life: 3 }, knock: 1.5, color: 0xff4fa3 },
  flamant: { key: 'flamant', name: 'Lance-Flamant', desc: 'EXPLOSIF · CONFETTIS GARANTIS', slot: 4, mag: 1, reserve: 6, damage: 130, rate: 1.0, reload: 1.7, auto: false, kick: 4, sound: 'shot_flamant', projectile: { speed: 17, gravity: 1.2, radius: 0.18, explode: 3.4, life: 5 }, knock: 20, color: 0xff4fa3 },
};

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _d = V();

// ray vs vertical capsule {x,z,y0,y1,r}: returns t or null
export function rayCapsule(o, d, c, maxT) {
  // cylinder part
  const dx = o.x - c.x, dz = o.z - c.z; const a = d.x * d.x + d.z * d.z; let t = null;
  if (a > 1e-6) { const b = 2 * (dx * d.x + dz * d.z), cc = dx * dx + dz * dz - c.r * c.r; const disc = b * b - 4 * a * cc; if (disc >= 0) { const s = Math.sqrt(disc); const t0 = (-b - s) / (2 * a); if (t0 >= 0 && t0 <= maxT) { const y = o.y + d.y * t0; if (y >= c.y0 && y <= c.y1) t = t0; } } }
  // caps (spheres at y0+r and y1-r) — approximate by spheres at ends
  for (const cy of [c.y0 + c.r, c.y1 - c.r]) { const ox = o.x - c.x, oy = o.y - cy, oz = o.z - c.z; const b = 2 * (ox * d.x + oy * d.y + oz * d.z), cc = ox * ox + oy * oy + oz * oz - c.r * c.r; const disc = b * b - 4 * cc; if (disc >= 0) { const t0 = (-b - Math.sqrt(disc)) / 2; if (t0 >= 0 && t0 <= maxT && (t === null || t0 < t)) t = t0; } }
  // inside the capsule? (o inside cylinder) -> hit at 0
  if (t === null && dx * dx + dz * dz < c.r * c.r && o.y > c.y0 && o.y < c.y1) t = 0;
  return t;
}

export class Weapons {
  constructor(game) {
    this.g = game; this.player = game.player; this.camera = game.R.camera; this.fx = game.fx; this.audio = game.audio; this.world = game.world;
    this.inv = {}; this.slots = ['fists', null, null, null, null]; this.cur = 'fists'; this.pending = null;
    this.cd = 0; this.reloading = 0; this.reloadTotal = 0; this.draw = 0; this.swing = 0; this.hand = 0; this.recoil = V(); this.recoilV = V(); this.swayX = 0; this.swayY = 0; this.fireHeld = false;
    this.projectiles = []; this.drops = [];
    this.fireRateMul = 1; this.damageMul = 1; this.infinite = false;
    this.vm = new THREE.Group(); this.camera.add(this.vm);
    const vl = new THREE.PointLight(0xfff2e0, 0.35, 1.4, 1.5); vl.position.set(0.15, 0.25, -0.1); this.vm.add(vl);
    this.models = {}; this.buildModels();
    this.projGeo = { gummy: new THREE.SphereGeometry(0.06, 8, 6), flamant: null };
    this.projMat = { gummy: new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.3, emissive: 0xff2a7f, emissiveIntensity: 0.5 }) };
    this.setCurrent('fists', true);
  }
  // ------------------------------------------------------------- models
  mat(o) { return new THREE.MeshStandardMaterial(o); }
  buildModels() {
    const mDark = this.mat({ color: 0x3a3e46, roughness: 0.4, metalness: 0.5, emissive: 0x3a3e46, emissiveIntensity: 0.18 }), mSteel = this.mat({ color: 0x9aa2ab, roughness: 0.3, metalness: 0.9, emissive: 0x9aa2ab, emissiveIntensity: 0.12 }), mSkin = this.mat({ color: 0xd9a37e, roughness: 0.7, emissive: 0xd9a37e, emissiveIntensity: 0.12 }), mSleeve = this.mat({ color: 0x2a3a30, roughness: 0.9, emissive: 0x2a3a30, emissiveIntensity: 0.2 });
    const mCyan = this.mat({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 0.3, roughness: 0.2 }), mPink = this.mat({ color: 0xff4fa3, roughness: 0.35, emissive: 0xff2a7f, emissiveIntensity: 0.25 }), mOrange = this.mat({ color: 0xffb347, emissive: 0xff8a1f, emissiveIntensity: 1.2 }), mWood = this.mat({ color: 0x6b4a2e, roughness: 0.6 }), mGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05 }), mPlastic = this.mat({ color: 0xff7bb8, roughness: 0.4 });
    const box = (m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = false; return o; };
    const cyl = (m, r0, r1, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
    const hand = (side = 1) => { const g = new THREE.Group(); g.add(box(mSkin, 0.075, 0.06, 0.1, 0, 0, 0)); for (let i = 0; i < 4; i++) g.add(box(mSkin, 0.016, 0.05, 0.02, -0.03 + i * 0.02, -0.02, 0.055)); g.add(box(mSkin, 0.02, 0.05, 0.02, side * 0.045, 0.0, 0.02, 0, 0, side * 0.5)); g.add(box(mSleeve, 0.1, 0.09, 0.14, 0, 0.005, -0.11)); return g; };
    // fists: two hands
    { const g = new THREE.Group(); const l = hand(-1), r = hand(1); l.position.set(-0.22, -0.2, -0.42); r.position.set(0.22, -0.2, -0.42); l.rotation.set(0.3, 0.3, 0); r.rotation.set(0.3, -0.3, 0); g.add(l, r); g.userData = { hands: [l, r] }; this.models.fists = g; }
    // vapo blaster: pistol with glowing tank
    { const g = new THREE.Group(); g.add(box(mDark, 0.045, 0.14, 0.06, 0, -0.08, 0.02, 0.25)); g.add(box(mDark, 0.05, 0.06, 0.24, 0, 0.0, -0.06)); g.add(box(mSteel, 0.052, 0.035, 0.22, 0, 0.035, -0.08)); g.add(cyl(mSteel, 0.012, 0.012, 0.1, 0, 0.02, -0.22, Math.PI / 2)); g.add(cyl(mCyan, 0.02, 0.02, 0.1, 0, 0.07, -0.02, Math.PI / 2)); g.add(cyl(mGlass, 0.024, 0.024, 0.11, 0, 0.07, -0.02, Math.PI / 2)); g.add(box(mDark, 0.01, 0.03, 0.02, 0, -0.03, 0.0)); const h = hand(1); h.position.set(0, -0.1, 0.05); h.rotation.x = -0.2; g.add(h); const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.28); g.add(mz); g.userData = { muzzle: mz, hip: [0.26, -0.22, -0.45], ads: [0, -0.115, -0.32], rot: [0, 0, 0] }; this.models.vapo = g; }
    // fumigène 3000: shotgun with canister
    { const g = new THREE.Group(); g.add(box(mWood, 0.05, 0.09, 0.22, 0, -0.03, 0.22, -0.15)); g.add(box(mDark, 0.055, 0.07, 0.3, 0, 0, 0.0)); g.add(cyl(mSteel, 0.016, 0.016, 0.5, 0.017, 0.02, -0.3, Math.PI / 2)); g.add(cyl(mSteel, 0.016, 0.016, 0.5, -0.017, 0.02, -0.3, Math.PI / 2)); g.add(cyl(mDark, 0.045, 0.045, 0.18, 0, -0.04, -0.2, Math.PI / 2)); g.add(cyl(mOrange, 0.03, 0.03, 0.12, 0, -0.04, -0.2, Math.PI / 2)); g.add(box(mWood, 0.06, 0.05, 0.16, 0, -0.06, -0.38)); g.add(box(mDark, 0.01, 0.03, 0.02, 0, -0.06, 0.06)); const h = hand(1); h.position.set(0, -0.11, 0.1); g.add(h); const h2 = hand(-1); h2.position.set(-0.01, -0.1, -0.36); h2.rotation.set(0, 0, 0.4); g.add(h2); const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.56); g.add(mz); g.userData = { muzzle: mz, hip: [0.22, -0.2, -0.42], ads: [0, -0.1, -0.3], rot: [0, 0, 0] }; this.models.fumi = g; }
    // gummy SMG: pink plastic with jar magazine
    { const g = new THREE.Group(); g.add(box(mPlastic, 0.07, 0.1, 0.34, 0, 0, -0.05)); g.add(box(mDark, 0.045, 0.14, 0.06, 0, -0.1, 0.06, 0.2)); g.add(cyl(mDark, 0.02, 0.02, 0.16, 0, 0.02, -0.28, Math.PI / 2)); g.add(cyl(mPink, 0.03, 0.03, 0.04, 0, 0.02, -0.34, Math.PI / 2)); const jar = cyl(mGlass, 0.05, 0.05, 0.14, 0, -0.1, -0.12); g.add(jar); for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), this.mat({ color: [0xff4fa3, 0xd7f06a, 0x5ef2ff, 0xffb347][i % 4], roughness: 0.3 })); s.position.set((Math.random() - 0.5) * 0.06, -0.15 + (i % 7) * 0.016, -0.12 + (Math.random() - 0.5) * 0.06); g.add(s); } g.add(box(mDark, 0.04, 0.05, 0.12, 0, 0.07, 0.02)); const h = hand(1); h.position.set(0, -0.12, 0.09); g.add(h); const h2 = hand(-1); h2.position.set(-0.02, -0.06, -0.22); h2.rotation.z = 0.5; g.add(h2); const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.37); g.add(mz); g.userData = { muzzle: mz, hip: [0.24, -0.21, -0.42], ads: [0, -0.105, -0.3], rot: [0, 0, 0] }; this.models.gummy = g; }
    // lance-flamant: big tube with flamingo head
    { const g = new THREE.Group(); g.add(cyl(mPink, 0.07, 0.07, 0.7, 0, 0.02, -0.15, Math.PI / 2, 0, 0, 18)); g.add(cyl(mDark, 0.075, 0.075, 0.06, 0, 0.02, -0.48, Math.PI / 2)); g.add(cyl(mDark, 0.075, 0.075, 0.06, 0, 0.02, 0.18, Math.PI / 2)); g.add(box(mDark, 0.05, 0.12, 0.06, 0, -0.08, 0.08, 0.2)); g.add(box(mDark, 0.05, 0.08, 0.05, 0, -0.06, -0.2)); const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mPink); head.position.set(0, 0.13, -0.42); g.add(head); const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 8), mDark); beak.position.set(0, 0.11, -0.5); beak.rotation.x = -Math.PI / 2; g.add(beak); const neck = cyl(mPink, 0.02, 0.025, 0.12, 0, 0.09, -0.4); g.add(neck); const h = hand(1); h.position.set(0, -0.12, 0.1); g.add(h); const h2 = hand(-1); h2.position.set(-0.02, -0.08, -0.2); h2.rotation.z = 0.5; g.add(h2); const mz = new THREE.Object3D(); mz.position.set(0, 0.02, -0.52); g.add(mz); g.userData = { muzzle: mz, hip: [0.22, -0.18, -0.4], ads: [0, -0.1, -0.28], rot: [0, 0, 0] }; this.models.flamant = g; }
    // flamingo melee: uses the world flamingo builder at small scale
    { const g = new THREE.Group(); const f = this.world.makeFlamingo(0.22); f.position.set(0.05, -0.55, -0.4); f.rotation.set(0.2, 0.9, 0.3); g.add(f); const h = hand(1); h.position.set(0.12, -0.2, -0.32); h.rotation.set(0.5, 0, 0); g.add(h); g.userData = { hip: [0.22, -0.02, -0.15], ads: [0.22, -0.02, -0.15], rot: [0, 0, 0], mesh: f }; this.models.flamingo = g; }
    for (const k in this.models) { this.models[k].visible = false; this.models[k].traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 10; } }); this.vm.add(this.models[k]); }
  }
  get def() { return WEAPONS[this.cur]; }
  get ammo() { return this.inv[this.cur]; }
  has(key) { return !!this.inv[key] || key === 'fists' || (key === 'flamingo' && this.slots[0] === 'flamingo'); }
  give(key, ammoMul = 1) {
    const d = WEAPONS[key]; if (!d) return false;
    if (d.melee) { if (key === 'flamingo') { this.slots[0] = 'flamingo'; this.setCurrent('flamingo'); } return true; }
    if (this.inv[key]) { const a = this.inv[key]; const before = a.reserve; a.reserve = Math.min(d.reserve * 2, a.reserve + Math.round(d.reserve * ammoMul)); return a.reserve > before; }
    this.inv[key] = { mag: d.mag, reserve: Math.round(d.reserve * ammoMul) }; this.slots[d.slot] = key; this.setCurrent(key); return true;
  }
  refillAll() { for (const k in this.inv) { const d = WEAPONS[k]; this.inv[k].mag = d.mag; this.inv[k].reserve = d.reserve * 2; } }
  setCurrent(key, instant = false) {
    if (!this.has(key) && !(key === 'fists')) return;
    if (this.cur === key && !instant) return;
    this.cur = key; this.reloading = 0; this.draw = instant ? 0 : 0.32; this.swing = 0; this.cd = Math.max(this.cd, 0.1);
    for (const k in this.models) this.models[k].visible = k === key;
    this.g.ui?.weaponChanged();
  }
  switchSlot(i) { const k = this.slots[i]; if (k && this.has(k)) this.setCurrent(k); }
  cycle(dir) { const keys = this.slots.filter(k => k && this.has(k)); const i = keys.indexOf(this.cur); this.setCurrent(keys[(i + dir + keys.length) % keys.length]); }
  // ------------------------------------------------------------- input / firing
  update(dt, speed) {
    const inp = this.g.input, P = this.player; const D = this.def; const gdt = dt * speed;
    this.cd = Math.max(0, this.cd - gdt * this.fireRateMul); if (this.draw > 0) this.draw -= gdt; if (this.swing > 0) this.swing -= gdt;
    // switching
    for (let i = 0; i < 5; i++) if (inp.wasPressed('Digit' + (i + 1))) this.switchSlot(i);
    if (inp.mouse.wheel) this.cycle(inp.mouse.wheel > 0 ? 1 : -1);
    if (inp.wasPressed('KeyR')) this.startReload();
    // ADS
    P.adsTarget = (inp.mouse.right && !D.melee && this.reloading <= 0) ? 1 : 0;
    // reload progress
    if (this.reloading > 0) { this.reloading -= gdt; if (this.reloading <= 0) { const a = this.ammo; const need = D.mag - a.mag; const take = this.infinite ? need : Math.min(need, a.reserve); a.mag += take; if (!this.infinite) a.reserve -= take; this.audio.play('rack'); } }
    // firing
    const wantFire = D.auto ? inp.mouse.left : inp.mouse.leftPressed;
    const punch = inp.wasPressed('KeyE');
    if (!P.dead && this.draw <= 0) {
      if (punch && !D.melee) this.melee(WEAPONS.fists);
      else if (wantFire && this.cd <= 0 && this.reloading <= 0) { if (D.melee) this.melee(D); else this.fire(); }
    }
    this.updateProjectiles(gdt);
    this.updateDrops(gdt);
    this.animate(dt, gdt);
  }
  startReload() { const D = this.def, a = this.ammo; if (D.melee || this.reloading > 0 || !a || a.mag >= D.mag || (a.reserve <= 0 && !this.infinite)) return; this.reloading = this.reloadTotal = D.reload * (this.fireRateMul > 1 ? 0.7 : 1); this.audio.play('reload'); P_adsOff(this.player); }
  fire() {
    const D = this.def, a = this.ammo; if (!a) return;
    if (a.mag <= 0) { this.audio.play('empty'); this.cd = 0.25; if (a.reserve > 0 || this.infinite) this.startReload(); else this.g.ui.toast('Chargeur vide — trouvez des munitions ou changez d\'arme'); return; }
    if (!this.infinite) a.mag--; this.cd = D.rate;
    const cam = this.camera, P = this.player;
    const origin = cam.getWorldPosition(_a.clone()); const dir = cam.getWorldDirection(_b.clone());
    const spreadMul = P.ads > 0.5 ? 0.35 : (P.moving > 1 ? 1.6 : 1) * (P.onGround ? 1 : 1.8);
    const model = this.models[this.cur]; const mz = model.userData.muzzle ? model.userData.muzzle.getWorldPosition(V()) : origin.clone().addScaledVector(dir, 0.4);
    this.fx.muzzle(mz, dir, D.color || 0xffffff);
    this.audio.play(D.sound);
    this.recoilV.z += 3 * D.kick; this.recoilV.x += 1.8 * D.kick; P.kickVel.y += 40 * D.kick * (P.ads > 0.5 ? 0.5 : 1); P.kickVel.x += (Math.random() - 0.5) * 30 * D.kick; P.fovKick += D.kick * 1.5;
    this.fx.shake = Math.max(this.fx.shake, D.kick * 0.12);
    this.g.stats.shots++;
    const pellets = D.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone(); const s = (D.spread || 0) * spreadMul; d.x += (Math.random() - 0.5) * 2 * s; d.y += (Math.random() - 0.5) * 2 * s; d.z += (Math.random() - 0.5) * 2 * s; d.normalize();
      if (D.hitscan) this.hitscan(origin, d, D, mz);
      else this.spawnProjectile(mz, d, D);
    }
    if (a.mag <= 0 && (a.reserve > 0 || this.infinite)) setTimeout(() => { if (this.cur === D.key) this.startReload(); }, 250);
  }
  // Generic ray query against world, enemies, bottles, flamingo. Returns nearest hit.
  trace(origin, d, maxDist = 60, ignore = null) {
    let best = { dist: maxDist, type: null }; const w = this.world.raycast(origin, d, maxDist); if (w.dist < best.dist) best = { dist: w.dist, type: 'world', normal: w.normal };
    for (const e of this.g.enemies.list) { if (!e.alive || e === ignore) continue; const c = e.capsule(); const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) { const y = origin.y + d.y * t; best = { dist: t, type: 'enemy', enemy: e, head: y > c.y1 - 0.32 }; } }
    const b = this.g.bottles.raycast(origin, d, best.dist); if (b && b.dist < best.dist) best = { dist: b.dist, type: 'bottle', index: b.index };
    if (this.g.flamingoHP > 0) { const f = this.world.flamingo; const c = { x: f.position.x, z: f.position.z, y0: f.position.y, y1: f.position.y + 2.3, r: 1.0 }; const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) best = { dist: t, type: 'flamingo' }; }
    for (const p of this.g.props?.list || []) { if (!p.alive) continue; const c = p.capsule(); const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) best = { dist: t, type: 'prop', prop: p }; }
    best.point = origin.clone().addScaledVector(d, best.dist); return best;
  }
  hitscan(origin, d, D, mz) {
    const h = this.trace(origin, d, 60);
    const end = h.point; this.fx.tracer(mz, end, { color: D.tracer, width: D.key === 'fumi' ? 0.02 : 0.012, life: 0.07 });
    if (h.type === 'enemy') { this.g.hitEnemy(h.enemy, D.damage * this.damageMul * (h.head ? 1.6 : 1), d, D.knock, h.head, D.key, end); }
    else if (h.type === 'bottle') this.g.breakBottle(h.index, d);
    else if (h.type === 'flamingo') this.g.hitFlamingo(D.damage, end);
    else if (h.type === 'prop') h.prop.hit(D.damage, d, D.knock);
    else if (h.type === 'world') { this.fx.impact(end, h.normal || new THREE.Vector3(0, 1, 0), { sparks: D.key === 'fumi' ? 3 : 6 }); if (Math.random() < 0.3) this.audio.play('ricochet', end); }
    if (D.key === 'fumi') this.fx.puff(mz.clone().addScaledVector(d, 0.6), { size: 0.35, life: 0.6, opacity: 0.3, vel: d.clone().multiplyScalar(4), grow: 3, color: 0xffe0c0 });
  }
  spawnProjectile(p, d, D, owner = 'player') {
    const pd = D.projectile; let mesh;
    if (D.key === 'gummy') { mesh = new THREE.Mesh(this.projGeo.gummy, this.projMat.gummy); mesh.material = this.projMat.gummy.clone(); mesh.material.color.setHSL(Math.random(), 0.8, 0.6); mesh.material.emissive.copy(mesh.material.color); }
    else if (D.key === 'flamant') { mesh = this.world.makeFlamingo(0.22); }
    else { mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.radius, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xbfe6ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 })); }
    mesh.position.copy(p); this.g.R.scene.add(mesh);
    this.projectiles.push({ mesh, pos: p.clone(), vel: d.clone().multiplyScalar(pd.speed), def: D, pd, life: pd.life || 4, bounces: pd.bounces || 0, owner, spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6) });
  }
  updateProjectiles(dt) {
    const g = this.g;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; let dead = p.life <= 0;
      p.vel.y -= p.pd.gravity * dt; const step = p.vel.length() * dt; const d = p.vel.clone().normalize();
      const h = p.owner === 'player' ? this.trace(p.pos, d, step + p.pd.radius) : this.traceEnemyProj(p.pos, d, step + p.pd.radius);
      if (h.type) {
        if (p.pd.explode) { g.explode(h.point.clone().addScaledVector(d, -0.1), p.pd.explode, p.def.damage * this.damageMul, p.owner, p.def.key); dead = true; }
        else if (h.type === 'enemy') { g.hitEnemy(h.enemy, p.def.damage * this.damageMul, d, p.def.knock, h.head, p.def.key, h.point); dead = true; }
        else if (h.type === 'player') { g.player.damage(p.def.damage, p.pos); this.fx.vaporHit(h.point, 0xffd0e0); dead = true; }
        else if (h.type === 'bottle') { g.breakBottle(h.index, d); }
        else if (h.type === 'flamingo') { g.hitFlamingo(p.def.damage, h.point); dead = true; }
        else if (h.type === 'prop') { h.prop.hit(p.def.damage, d, p.def.knock); dead = true; }
        else if (h.type === 'world') {
          if (p.bounces > 0) { p.bounces--; const n = h.normal || new THREE.Vector3(0, 1, 0); p.pos.copy(h.point).addScaledVector(n, p.pd.radius + 0.01); p.vel.reflect(n).multiplyScalar(0.55); this.audio.play('ricochet', p.pos); this.fx.burst(p.pos, 3, { speed: 1.5, color: [1, 0.4, 0.7], life: 0.3, size: 0.03, grav: 5 }); continue; }
          else { this.fx.burst(h.point, 6, { speed: 2, color: [1, 0.4, 0.7], life: 0.4, size: 0.04, grav: 6 }); dead = true; }
        }
      } else p.pos.addScaledVector(p.vel, dt);
      // floor
      const fy = this.world.floorHeight(p.pos.x, p.pos.z);
      if (p.pos.y < fy + p.pd.radius) { if (p.pd.explode) { g.explode(p.pos.clone(), p.pd.explode, p.def.damage * this.damageMul, p.owner, p.def.key); dead = true; } else if (p.bounces > 0) { p.bounces--; p.pos.y = fy + p.pd.radius; p.vel.y = -p.vel.y * 0.5; p.vel.x *= 0.8; p.vel.z *= 0.8; this.audio.play('ricochet', p.pos); } else { this.fx.burst(p.pos, 6, { speed: 2, color: [1, 0.4, 0.7], life: 0.4, size: 0.04, grav: 6 }); dead = true; } }
      p.mesh.position.copy(p.pos); p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt;
      if (p.def.key === 'flamant') { p.mesh.rotation.set(0, 0, 0); p.mesh.lookAt(p.pos.clone().add(p.vel)); p.mesh.rotateY(Math.PI); this.fx.puff(p.pos, { size: 0.25, life: 0.5, opacity: 0.35, color: 0xffc0e0, grow: 2 }); this.fx.particle(p.pos.x, p.pos.y, p.pos.z, (Math.random() - 0.5), Math.random(), (Math.random() - 0.5), { life: 0.5, size: 0.06, color: [1, 0.4, 0.7] }); }
      if (dead) { this.g.R.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }
  traceEnemyProj(origin, d, maxDist) {
    let best = { dist: maxDist, type: null }; const w = this.world.raycast(origin, d, maxDist); if (w.dist < best.dist) best = { dist: w.dist, type: 'world', normal: w.normal };
    const P = this.player; const c = { x: P.pos.x, z: P.pos.z, y0: P.pos.y, y1: P.pos.y + P.eye + 0.15, r: 0.38 }; const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) best = { dist: t, type: 'player' };
    best.point = origin.clone().addScaledVector(d, best.dist); return best;
  }
  melee(D) {
    if (this.cd > 0) return; this.cd = D.rate; this.swing = D.rate; this.hand = 1 - this.hand; this.meleeDef = D;
    const P = this.player, cam = this.camera; const origin = cam.getWorldPosition(V()), dir = cam.getWorldDirection(V());
    let hit = false; const targets = [];
    for (const e of this.g.enemies.list) { if (!e.alive) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const dist = Math.hypot(dx, dz); if (dist > D.range + e.radius) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dz * dir.z) / (dist || 1) / (Math.hypot(dir.x, dir.z) || 1)))); if (ang > D.arc) continue; if (!this.world.hasLineOfSight(origin, e.pos.clone().setY(e.pos.y + 1.2))) continue; targets.push(e); }
    for (const p of this.g.props?.list || []) { if (!p.alive) continue; const dx = p.pos.x - P.pos.x, dz = p.pos.z - P.pos.z; const dist = Math.hypot(dx, dz); if (dist < D.range + 0.4 && (dx * dir.x + dz * dir.z) / (dist || 1) > 0.5) { p.hit(D.damage, dir, D.knock); hit = true; } }
    if (!D.sweep && targets.length) targets.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)), targets.length = 1;
    for (const e of targets) { const kd = e.pos.clone().sub(P.pos).setY(0).normalize().lerp(dir, 0.3); this.g.hitEnemy(e, D.damage * this.damageMul, kd, D.knock, false, D.key, e.pos.clone().setY(e.pos.y + 1.2)); hit = true; }
    // bottles & flamingo in reach
    const h = this.trace(origin, dir, D.range + 0.3); if (h.type === 'bottle') { this.g.breakBottle(h.index, dir); hit = true; } if (h.type === 'flamingo') { this.g.hitFlamingo(D.damage, h.point); hit = true; }
    this.audio.play(hit ? D.sound : 'punch_miss'); if (!hit) this.g.stats.whiffs++;
    if (D.key === 'flamingo') { this.fx.shake = Math.max(this.fx.shake, 0.6); P.kickVel.y += 30; if (hit) this.fx.ring(P.pos.clone().addScaledVector(dir, 1.2), { color: 0xff4fa3, size: 3, life: 0.35, y: 0.1 }); }
    else P.kickVel.y += hit ? 12 : 6;
  }
  // ------------------------------------------------------------- drops / pickups
  drop(key, pos, ammoMul = 1, label = null) {
    const D = WEAPONS[key]; const m = this.models[key] ? this.models[key].clone() : new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2)); m.visible = true; m.traverse(o => { if (o.isMesh) o.renderOrder = 0; });
    m.scale.setScalar(key === 'flamingo' ? 1.6 : 1.3); const glow = new THREE.PointLight(D.color || 0xff4fa3, 0.6, 2.2, 2); glow.position.set(0, 0.6, 0); m.add(glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 32), new THREE.MeshBasicMaterial({ color: D.color || 0xff4fa3, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.15;
    const g = new THREE.Group(); g.add(m); g.add(ring); const fy = this.world.floorHeight(pos.x, pos.z); g.position.set(pos.x, fy + 0.5, pos.z); this.g.R.scene.add(g);
    const d = { key, g, m, ring, t: Math.random() * 6, ammoMul, label: label || (key === 'flamingo' ? 'LE FLAMANT ROSE' : D.name), pos: g.position, kind: 'weapon' };
    this.drops.push(d); return d;
  }
  dropPowerup(type, pos) {
    const PU = { slowmo: ['Menthe Glaciale', 0x5ef2ff], boost: ['Booster Nicotine', 0xffb347], shield: ['Bouclier Vitrine', 0xd7f06a], disco: ['Disco CBD', 0xff4fa3], ammo: ['Méga-Gummies', 0xb58cff], heal: ['Tisane CBD', 0x9be36a] };
    const [name, color] = PU[type]; const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.2 })); g.add(core);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5 })); g.add(shell);
    const glow = new THREE.PointLight(color, 0.6, 2.2, 2); glow.position.set(0, 0.5, 0); g.add(glow); const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.35; g.add(ring);
    const fy = this.world.floorHeight(pos.x, pos.z); g.position.set(pos.x, fy + 0.6, pos.z); this.g.R.scene.add(g);
    const d = { key: type, g, m: core, ring, t: Math.random() * 6, label: name, pos: g.position, kind: 'powerup', shell, life: 25 }; this.drops.push(d); return d;
  }
  updateDrops(dt) {
    const P = this.player; let nearest = null, nd = 99;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt; d.m.rotation.y += dt * 1.2; d.m.position.y = Math.sin(d.t * 2) * 0.06; d.ring.rotation.z += dt;
      if (d.shell) { d.shell.rotation.x += dt; d.shell.rotation.z += dt * 0.7; d.life -= dt; if (d.life < 5) d.g.visible = Math.sin(d.t * 20) > 0; if (d.life <= 0) { this.g.R.scene.remove(d.g); this.drops.splice(i, 1); continue; } }
      const dist = Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z);
      if (d.kind === 'powerup' && dist < 0.9) { this.g.applyPowerup(d.key); this.g.R.scene.remove(d.g); this.drops.splice(i, 1); continue; }
      if (d.kind === 'weapon' && dist < 2.0 && dist < nd) { nearest = d; nd = dist; }
    }
    this.nearDrop = nearest;
    if (nearest && this.g.input.wasPressed('KeyF')) { const got = this.give(nearest.key, nearest.ammoMul); if (got !== false) { this.audio.play('pickup'); this.g.R.scene.remove(nearest.g); this.drops.splice(this.drops.indexOf(nearest), 1); this.g.ui.toast(`${nearest.label} récupéré`); this.fx.confettiRain(nearest.pos.clone().setY(nearest.pos.y + 2.2), 10); } }
  }
  // ------------------------------------------------------------- viewmodel animation
  animate(dt, gdt) {
    const P = this.player, inp = this.g.input, D = this.def, model = this.models[this.cur]; if (!model) return;
    const ud = model.userData;
    // sway
    this.swayX += (inp.mouse.dx * 0.0008 - this.swayX) * (1 - Math.exp(-dt * 10)); this.swayY += (inp.mouse.dy * 0.0008 - this.swayY) * (1 - Math.exp(-dt * 10));
    // recoil spring
    this.recoilV.addScaledVector(this.recoil, -dt * 260); this.recoilV.multiplyScalar(Math.exp(-dt * 18)); this.recoil.addScaledVector(this.recoilV, dt);
    const bob = P.bobAmt; const bx = Math.sin(P.bobPhase * 0.5) * 0.012 * bob, by = Math.abs(Math.sin(P.bobPhase)) * 0.012 * bob;
    const hip = ud.hip || [0.26, -0.22, -0.45], ads = ud.ads || hip; const a = P.ads;
    let x = hip[0] * (1 - a) + ads[0] * a + bx - this.swayX * 0.6, y = hip[1] * (1 - a) + ads[1] * a + by + this.swayY * 0.4 - P.landDip * 0.3, z = hip[2] * (1 - a) + ads[2] * a + this.recoil.z * 0.05;
    let rx = -this.recoil.x * 0.08 + this.swayY * 0.8, ry = -this.swayX * 1.4, rz = this.swayX * 0.6 - (P.sliding > 0 ? 0.25 : 0);
    // draw
    if (this.draw > 0) { const k = this.draw / 0.32; y -= k * 0.35; rx -= k * 0.9; }
    // reload
    if (this.reloading > 0) { const k = 1 - this.reloading / this.reloadTotal; const s = Math.sin(k * Math.PI); y -= s * 0.16; rx -= s * 0.9; rz += Math.sin(k * Math.PI * 2) * 0.5; ry += s * 0.3; }
    // run pose
    if (P.running && P.moving > 4 && a < 0.5 && this.reloading <= 0) { x += 0.06; y -= 0.05; rx -= 0.25; ry += 0.35; }
    // dash tilt
    if (P.dashTime > 0) { rz += 0.3; }
    // melee swing
    if (D.melee) {
      if (this.cur === 'fists') { const hands = ud.hands; const k = this.swing > 0 ? 1 - this.swing / (this.meleeDef?.rate || 0.36) : 0; const punch = Math.sin(Math.min(1, k * 1.6) * Math.PI); for (let i = 0; i < 2; i++) { const h = hands[i]; const active = i === this.hand && this.swing > 0; h.position.set((i ? 0.22 : -0.22) + bx, -0.2 + by - P.landDip * 0.3 + (active ? punch * 0.08 : 0), -0.42 - (active ? punch * 0.34 : 0)); h.rotation.set(0.3 - (active ? punch * 0.6 : 0) + this.swayY, (i ? -0.3 : 0.3) - this.swayX, active ? punch * (i ? -0.5 : 0.5) : 0); } model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); return; }
      else { const k = this.swing > 0 ? 1 - this.swing / (this.meleeDef?.rate || 0.6) : 0; const s = Math.sin(Math.min(1, k * 1.3) * Math.PI); ry += -s * 1.6 + (k > 0 ? -0.2 : 0); rx += s * 0.5; x -= s * 0.25; z -= s * 0.2; rz += s * 0.8; }
    }
    model.position.set(x, y, z); model.rotation.set(rx, ry, rz);
  }
  reset() { this.inv = {}; this.slots = ['fists', null, null, null, null]; this.setCurrent('fists', true); for (const p of this.projectiles) this.g.R.scene.remove(p.mesh); this.projectiles.length = 0; for (const d of this.drops) this.g.R.scene.remove(d.g); this.drops.length = 0; this.fireRateMul = 1; this.damageMul = 1; this.infinite = false; }
}
function P_adsOff(p) { p.adsTarget = 0; }
