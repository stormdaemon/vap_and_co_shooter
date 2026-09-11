// Weapons: definitions, viewmodels, firing (hitscan / projectiles / beam), reload, switching, grenades, pickups.
import * as THREE from 'three';
import { buildFists, buildVapo, buildFumi, buildGummy, buildFlamant, buildLaser, buildBulles, buildFlamingoMelee, buildGrenadeHand, VM_MATS } from './viewmodels.js';

export const WEAPONS = {
  fists: { key: 'fists', name: 'Poings', desc: 'MÊLÉE · CLIC GAUCHE POUR COGNER', slot: 0, melee: true, damage: 28, range: 2.0, arc: 0.9, rate: 0.36, knock: 5, sound: 'punch_hit' },
  flamingo: { key: 'flamingo', name: 'Le Flamant Rose', desc: 'MÊLÉE LOURDE · KNOCKBACK ABSURDE', slot: 0, melee: true, damage: 75, range: 2.7, arc: 1.3, rate: 0.62, knock: 16, sound: 'flamingo_hit', sweep: true },
  vapo: { key: 'vapo', name: 'Vapo-Blaster', desc: 'SEMI-AUTO · VAPEUR IONISÉE', slot: 1, mag: 12, reserve: 84, damage: 32, rate: 0.17, spread: 0.007, reload: 1.15, auto: false, tracer: 0x5ef2ff, kick: 1, sound: 'shot_vapo', hitscan: true, knock: 2.5, color: 0x5ef2ff },
  fumi: { key: 'fumi', name: 'Fumigène 3000', desc: 'DISPERSION · 8 NUAGES DE VAPEUR', slot: 2, mag: 6, reserve: 36, damage: 15, pellets: 8, rate: 0.8, spread: 0.075, reload: 2.1, auto: false, tracer: 0xffb347, kick: 3, sound: 'shot_fumi', hitscan: true, knock: 11, color: 0xffb347 },
  gummy: { key: 'gummy', name: 'Mitrailleuse à Gummies', desc: 'AUTOMATIQUE · REBONDS CBD', slot: 3, mag: 42, reserve: 210, damage: 12, rate: 0.068, spread: 0.03, reload: 1.6, auto: true, kick: 0.35, sound: 'shot_gummy', projectile: { speed: 30, gravity: 7, radius: 0.06, bounces: 3, life: 3 }, knock: 1.5, color: 0xff4fa3 },
  flamant: { key: 'flamant', name: 'Lance-Flamant', desc: 'EXPLOSIF · CONFETTIS GARANTIS', slot: 4, mag: 1, reserve: 6, damage: 130, rate: 1.0, reload: 1.7, auto: false, kick: 4, sound: 'shot_flamant', projectile: { speed: 17, gravity: 1.2, radius: 0.18, explode: 3.4, life: 5 }, knock: 20, color: 0xff4fa3 },
  laser: { key: 'laser', name: 'Rayon Botanique', desc: 'FAISCEAU CONTINU · SURCHAUFFE', slot: 5, beam: true, dps: 95, mag: 100, reserve: 0, drain: 28, regen: 24, rate: 0, kick: 0.05, sound: 'laser', color: 0xd7f06a, knock: 0.6 },
  bulles: { key: 'bulles', name: 'Canon à Bulles', desc: 'PIÈGE FLOTTANT · ×1,6 DÉGÂTS', slot: 6, mag: 5, reserve: 25, damage: 10, rate: 0.55, reload: 1.8, auto: false, kick: 0.8, sound: 'bubble', projectile: { speed: 9, gravity: -0.5, radius: 0.32, life: 5, bubble: true }, knock: 0, color: 0x5ef2ff },
  grenade: { key: 'grenade', name: 'Gummy-Bombe', damage: 150, projectile: { speed: 13, gravity: 12, radius: 0.09, bounces: 2, explode: 3.3, life: 1.7, fuse: true }, knock: 22, color: 0xff4fa3 },
};
export const SLOT_COUNT = 7;

const V = () => new THREE.Vector3();
const _a = V(), _b = V();

export function rayCapsule(o, d, c, maxT) {
  const dx = o.x - c.x, dz = o.z - c.z; const a = d.x * d.x + d.z * d.z; let t = null;
  if (a > 1e-6) { const b = 2 * (dx * d.x + dz * d.z), cc = dx * dx + dz * dz - c.r * c.r; const disc = b * b - 4 * a * cc; if (disc >= 0) { const s = Math.sqrt(disc); const t0 = (-b - s) / (2 * a); if (t0 >= 0 && t0 <= maxT) { const y = o.y + d.y * t0; if (y >= c.y0 && y <= c.y1) t = t0; } } }
  for (const cy of [c.y0 + c.r, c.y1 - c.r]) { const ox = o.x - c.x, oy = o.y - cy, oz = o.z - c.z; const b = 2 * (ox * d.x + oy * d.y + oz * d.z), cc = ox * ox + oy * oy + oz * oz - c.r * c.r; const disc = b * b - 4 * cc; if (disc >= 0) { const t0 = (-b - Math.sqrt(disc)) / 2; if (t0 >= 0 && t0 <= maxT && (t === null || t0 < t)) t = t0; } }
  if (t === null && dx * dx + dz * dz < c.r * c.r && o.y > c.y0 && o.y < c.y1) t = 0;
  return t;
}

export class Weapons {
  constructor(game) {
    this.g = game; this.player = game.player; this.camera = game.R.camera; this.fx = game.fx; this.audio = game.audio; this.world = game.world;
    this.inv = {}; this.slots = ['fists', null, null, null, null, null, null]; this.cur = 'fists';
    this.cd = 0; this.reloading = 0; this.reloadTotal = 0; this.draw = 0; this.swing = 0; this.hand = 0; this.recoil = V(); this.recoilV = V(); this.swayX = 0; this.swayY = 0;
    this.projectiles = []; this.drops = []; this.slideT = 0; this.pumpT = 0; this.beamOn = false; this.beamAcc = new Map(); this.overheat = 0; this.grenades = 2; this.throwT = 0; this.grenadeCd = 0;
    this.fireRateMul = 1; this.damageMul = 1; this.infinite = false;
    this.vm = new THREE.Group(); this.camera.add(this.vm);
    const vl = new THREE.PointLight(0xfff2e0, 0.4, 1.6, 1.5); vl.position.set(0.15, 0.3, -0.05); this.vm.add(vl);
    this.models = {}; this.buildModels();
    this.projGeo = { gummy: new THREE.SphereGeometry(0.06, 8, 6), bubble: new THREE.SphereGeometry(0.32, 18, 12), grenade: new THREE.SphereGeometry(0.09, 10, 8) };
    this.projMat = { gummy: new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.3, emissive: 0xff2a7f, emissiveIntensity: 0.5 }), bubble: new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.03, metalness: 0, envMapIntensity: 2, depthWrite: false }), grenade: VM_MATS.pink };
    this.setCurrent('fists', true);
  }
  buildModels() {
    this.models = { fists: buildFists(), vapo: buildVapo(), fumi: buildFumi(), gummy: buildGummy(), flamant: buildFlamant(this.world), laser: buildLaser(), bulles: buildBulles(), flamingo: buildFlamingoMelee(this.world) };
    this.grenadeVm = buildGrenadeHand(); this.grenadeVm.visible = false; this.vm.add(this.grenadeVm);
    for (const k in this.models) { const m = this.models[k]; m.visible = false; m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 10; } }); this.vm.add(m); }
    this.grenadeVm.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 10; } });
  }
  get def() { return WEAPONS[this.cur]; }
  get ammo() { return this.inv[this.cur]; }
  has(key) { return !!this.inv[key] || key === 'fists' || (key === 'flamingo' && this.slots[0] === 'flamingo'); }
  give(key, ammoMul = 1) {
    const d = WEAPONS[key]; if (!d) return false;
    if (key === 'grenade') { this.grenades = Math.min(6, this.grenades + Math.round(2 * ammoMul)); return true; }
    if (d.melee) { if (key === 'flamingo') { this.slots[0] = 'flamingo'; this.setCurrent('flamingo'); } return true; }
    if (this.inv[key]) { if (d.beam) { this.inv[key].mag = 100; return true; } const a = this.inv[key]; const before = a.reserve; a.reserve = Math.min(d.reserve * 2, a.reserve + Math.round(d.reserve * ammoMul)); return a.reserve > before; }
    this.inv[key] = { mag: d.mag, reserve: Math.round(d.reserve * ammoMul) }; this.slots[d.slot] = key; this.setCurrent(key); return true;
  }
  refillAll() { for (const k in this.inv) { const d = WEAPONS[k]; this.inv[k].mag = d.mag; this.inv[k].reserve = d.reserve * 2; } this.grenades = Math.min(6, this.grenades + 2); this.overheat = 0; }
  setCurrent(key, instant = false) {
    if (!this.has(key) && key !== 'fists') return;
    if (this.cur === key && !instant) return;
    this.stopBeam();
    this.cur = key; this.reloading = 0; this.draw = instant ? 0 : 0.32; this.swing = 0; this.cd = Math.max(this.cd, 0.1);
    for (const k in this.models) this.models[k].visible = k === key;
    this.g.ui?.weaponChanged();
  }
  switchSlot(i) { const k = this.slots[i]; if (k && this.has(k)) this.setCurrent(k); }
  cycle(dir) { const keys = this.slots.filter(k => k && this.has(k)); const i = keys.indexOf(this.cur); this.setCurrent(keys[(i + dir + keys.length) % keys.length]); }
  // ------------------------------------------------------------- update
  update(dt, speed) {
    const inp = this.g.input, P = this.player; const D = this.def; const gdt = dt * speed;
    this.cd = Math.max(0, this.cd - gdt * this.fireRateMul); if (this.draw > 0) this.draw -= gdt; if (this.swing > 0) this.swing -= gdt; this.slideT *= Math.exp(-gdt * 18); this.pumpT = Math.max(0, this.pumpT - gdt); this.grenadeCd = Math.max(0, this.grenadeCd - gdt);
    for (let i = 0; i < SLOT_COUNT; i++) if (inp.wasPressed('Digit' + (i + 1))) this.switchSlot(i);
    if (inp.mouse.wheel) this.cycle(inp.mouse.wheel > 0 ? 1 : -1);
    if (inp.wasPressed('KeyR')) this.startReload();
    if (inp.wasPressed('KeyG') && this.grenades > 0 && this.grenadeCd <= 0 && !P.dead && this.draw <= 0) this.throwGrenade();
    P.adsTarget = (inp.mouse.right && !D.melee && this.reloading <= 0 && this.throwT <= 0) ? 1 : 0;
    if (this.reloading > 0) { this.reloading -= gdt; if (this.reloading <= 0) { const a = this.ammo; const need = D.mag - a.mag; const take = this.infinite ? need : Math.min(need, a.reserve); a.mag += take; if (!this.infinite) a.reserve -= take; this.audio.play('rack'); } }
    // beam energy
    if (D.beam) { const a = this.ammo; if (this.overheat > 0) { this.overheat -= gdt; a.mag = Math.min(100, a.mag + D.regen * 0.5 * gdt); } else if (!this.beamOn) a.mag = Math.min(100, a.mag + D.regen * gdt); }
    const wantFire = D.auto || D.beam ? inp.mouse.left : inp.mouse.leftPressed;
    const punch = inp.wasPressed('KeyE');
    if (!P.dead && this.draw <= 0 && this.throwT <= 0) {
      if (punch && !D.melee) this.melee(WEAPONS.fists);
      else if (D.beam) { if (wantFire && this.overheat <= 0 && this.ammo.mag > 0) this.beam(gdt); else this.stopBeam(); }
      else if (wantFire && this.cd <= 0 && this.reloading <= 0) { if (D.melee) this.melee(D); else this.fire(); }
    } else this.stopBeam();
    if (this.throwT > 0) this.throwT -= gdt;
    if (this.pendingThrow) { this.pendingThrow.t -= gdt; if (this.pendingThrow.t <= 0) { const t = this.pendingThrow; this.pendingThrow = null; this.spawnProjectile(t.origin, t.dir, WEAPONS.grenade, 'player'); this.audio.play('punch_miss'); } }
    this.updateProjectiles(gdt);
    this.updateDrops(gdt);
    this.animate(dt, gdt);
  }
  startReload() { const D = this.def, a = this.ammo; if (D.melee || D.beam || this.reloading > 0 || !a || a.mag >= D.mag || (a.reserve <= 0 && !this.infinite)) return; this.reloading = this.reloadTotal = D.reload * (this.fireRateMul > 1 ? 0.7 : 1); this.audio.play('reload'); this.player.adsTarget = 0; }
  spreadMul() { const P = this.player; return P.ads > 0.5 ? 0.35 : (P.moving > 1 ? 1.6 : 1) * (P.onGround ? 1 : 1.8); }
  muzzleWorld(D) { const model = this.models[this.cur]; const origin = this.camera.getWorldPosition(_a.clone()); const dir = this.camera.getWorldDirection(_b.clone()); return model?.userData.muzzle ? model.userData.muzzle.getWorldPosition(V()) : origin.addScaledVector(dir, 0.4); }
  fire() {
    const D = this.def, a = this.ammo; if (!a) return;
    if (a.mag <= 0) { this.audio.play('empty'); this.cd = 0.25; if (a.reserve > 0 || this.infinite) this.startReload(); else this.g.ui.toast('Chargeur vide — trouvez des munitions ou changez d\'arme'); return; }
    if (!this.infinite) a.mag--; this.cd = D.rate;
    const cam = this.camera, P = this.player;
    const origin = cam.getWorldPosition(V()); const dir = cam.getWorldDirection(V());
    const mz = this.muzzleWorld(D);
    this.fx.muzzle(mz, dir, D.color || 0xffffff); this.audio.play(D.sound);
    this.recoilV.z += 3 * D.kick; this.recoilV.x += 1.8 * D.kick; P.kickVel.y += 40 * D.kick * (P.ads > 0.5 ? 0.5 : 1); P.kickVel.x += (Math.random() - 0.5) * 30 * D.kick; P.fovKick += D.kick * 1.5;
    this.fx.shake = Math.max(this.fx.shake, D.kick * 0.12); this.slideT = 1; if (D.key === 'fumi') this.pumpT = 0.45;
    this.g.stats.shots++;
    const pellets = D.pellets || 1, sm = this.spreadMul();
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone(); const s = (D.spread || 0) * sm; d.x += (Math.random() - 0.5) * 2 * s; d.y += (Math.random() - 0.5) * 2 * s; d.z += (Math.random() - 0.5) * 2 * s; d.normalize();
      if (D.hitscan) this.hitscan(origin, d, D, mz); else this.spawnProjectile(mz, d, D);
    }
    if (a.mag <= 0 && (a.reserve > 0 || this.infinite)) setTimeout(() => { if (this.cur === D.key) this.startReload(); }, 250);
  }
  // continuous beam (laser)
  beam(dt) {
    const D = this.def, a = this.ammo, P = this.player;
    if (!this.beamOn) { this.beamOn = true; this.audio.play('laser_start'); }
    a.mag -= D.drain * dt * (this.infinite ? 0 : 1); if (a.mag <= 0) { a.mag = 0; this.overheat = 2.2; this.stopBeam(); this.audio.play('overheat'); this.g.ui.toast('SURCHAUFFE — le rayon refroidit'); return; }
    const origin = this.camera.getWorldPosition(V()), dir = this.camera.getWorldDirection(V()); const mz = this.muzzleWorld(D);
    const h = this.trace(origin, dir, 40);
    this.fx.tracer(mz, h.point, { color: D.color, width: 0.03 + Math.sin(this.g.time * 60) * 0.006, life: 0.05 }); this.fx.tracer(mz, h.point, { color: 0xffffff, width: 0.008, life: 0.05 });
    this.g.stats.shots += dt * 4;
    this.recoilV.x += (Math.random() - 0.5) * 0.4; P.kickVel.x += (Math.random() - 0.5) * 1.5;
    if (Math.random() < dt * 8) this.fx.light(h.point, D.color, 2, 0.1, 3);
    if (h.type === 'enemy') { const acc = (this.beamAcc.get(h.enemy) || 0) + D.dps * this.damageMul * dt; if (acc >= 12) { this.g.hitEnemy(h.enemy, acc, dir, D.knock, h.head, 'laser', h.point); this.beamAcc.set(h.enemy, 0); this.g.stats.hits++; } else this.beamAcc.set(h.enemy, acc); if (Math.random() < dt * 20) this.fx.burst(h.point, 2, { speed: 2, color: [0.85, 1, 0.4], life: 0.3, size: 0.03, grav: 3 }); }
    else if (h.type === 'bottle' && Math.random() < dt * 6) this.g.breakBottle(h.index, dir);
    else if (h.type === 'flamingo' && Math.random() < dt * 6) this.g.hitFlamingo(15, h.point);
    else if (h.type === 'prop' && Math.random() < dt * 6) h.prop.hit(10, dir, 2);
    else if (h.type === 'world' && Math.random() < dt * 30) { this.fx.burst(h.point, 2, { speed: 1.5, color: [0.85, 1, 0.4], life: 0.25, size: 0.025, grav: 4, dir: h.normal }); if (Math.random() < 0.15) this.fx.decal(h.point, h.normal || new THREE.Vector3(0, 1, 0), 0.06, 0x333322); }
  }
  stopBeam() { if (this.beamOn) { this.beamOn = false; this.audio.play('laser_stop'); this.beamAcc.clear(); } }
  throwGrenade() {
    this.grenades--; this.grenadeCd = 0.9; this.throwT = 0.5; this.stopBeam(); this.audio.play('jump');
    const origin = this.camera.getWorldPosition(V()), dir = this.camera.getWorldDirection(V()); dir.y += 0.18; dir.normalize();
    this.pendingThrow = { t: 0.14, origin: origin.clone().addScaledVector(dir, 0.4).add(new THREE.Vector3(0, -0.1, 0)), dir };
    this.g.ui.refreshWeapon(true);
  }
  trace(origin, d, maxDist = 60, ignore = null) {
    let best = { dist: maxDist, type: null }; const w = this.world.raycast(origin, d, maxDist); if (w.dist < best.dist) best = { dist: w.dist, type: 'world', normal: w.normal };
    for (const e of this.g.enemies.list) { if (!e.alive || e === ignore) continue; const c = e.capsule(); if (e.trapped > 0) { c.y0 = e.pos.y; c.y1 = e.pos.y + e.height; c.r = e.height * 0.6; } const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) { const y = origin.y + d.y * t; best = { dist: t, type: 'enemy', enemy: e, head: y > c.y1 - 0.32 && e.trapped <= 0 }; } }
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
    if (D.key === 'gummy') { mesh = new THREE.Mesh(this.projGeo.gummy, this.projMat.gummy.clone()); mesh.material.color.setHSL(Math.random(), 0.8, 0.6); mesh.material.emissive.copy(mesh.material.color); }
    else if (D.key === 'flamant') { mesh = this.world.makeFlamingo(0.22); }
    else if (D.key === 'bulles') { mesh = new THREE.Mesh(this.projGeo.bubble, this.projMat.bubble); }
    else if (D.key === 'grenade') { mesh = new THREE.Group(); const b = new THREE.Mesh(this.projGeo.grenade, this.projMat.grenade); mesh.add(b); const l = new THREE.PointLight(0xff4fa3, 1.2, 3, 2); mesh.add(l); mesh.userData.light = l; }
    else { mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.radius, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xbfe6ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 })); }
    mesh.position.copy(p); this.g.R.scene.add(mesh);
    this.projectiles.push({ mesh, pos: p.clone(), vel: d.clone().multiplyScalar(pd.speed), def: D, pd, life: pd.life || 4, bounces: pd.bounces || 0, owner, spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), t: 0 });
  }
  updateProjectiles(dt) {
    const g = this.g;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; p.t += dt; let dead = p.life <= 0;
      if (dead && p.pd.fuse) { g.explode(p.pos.clone(), p.pd.explode, p.def.damage * this.damageMul, p.owner, 'grenade'); }
      if (dead && p.pd.bubble) { this.fx.burst(p.pos, 10, { speed: 1.5, color: [0.7, 0.9, 1], life: 0.4, size: 0.04, grav: 2 }); }
      p.vel.y -= p.pd.gravity * dt; if (p.pd.bubble) { p.vel.multiplyScalar(Math.exp(-dt * 1.2)); p.vel.x += Math.sin(p.t * 3) * dt * 0.5; }
      const step = p.vel.length() * dt; const d = step > 1e-6 ? p.vel.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const h = p.owner === 'player' ? this.trace(p.pos, d, step + p.pd.radius) : this.traceEnemyProj(p.pos, d, step + p.pd.radius);
      if (h.type && !dead) {
        if (p.pd.bubble) {
          if (h.type === 'enemy') { g.hitEnemy(h.enemy, p.def.damage, d, 0, false, 'bulles', h.point); h.enemy.trap(4.5); dead = true; this.audio.play('bubble_pop', p.pos); }
          else if (h.type === 'world') { const n = h.normal || new THREE.Vector3(0, 1, 0); p.pos.copy(h.point).addScaledVector(n, p.pd.radius + 0.02); p.vel.reflect(n).multiplyScalar(0.5); }
          else if (h.type === 'bottle') g.breakBottle(h.index, d);
        }
        else if (p.pd.fuse) {
          if (h.type === 'enemy' || h.type === 'prop') { g.explode(h.point.clone(), p.pd.explode, p.def.damage * this.damageMul, p.owner, 'grenade'); dead = true; }
          else if (h.type === 'world') { const n = h.normal || new THREE.Vector3(0, 1, 0); p.pos.copy(h.point).addScaledVector(n, p.pd.radius + 0.01); p.vel.reflect(n).multiplyScalar(0.45); this.audio.play('ricochet', p.pos); }
          else if (h.type === 'bottle') g.breakBottle(h.index, d);
        }
        else if (p.pd.explode) { g.explode(h.point.clone().addScaledVector(d, -0.1), p.pd.explode, p.def.damage * this.damageMul, p.owner, p.def.key); dead = true; }
        else if (h.type === 'enemy') { g.hitEnemy(h.enemy, p.def.damage * this.damageMul, d, p.def.knock, h.head, p.def.key, h.point); dead = true; }
        else if (h.type === 'player') { g.damagePlayer(p.def.damage, p.pos); this.fx.vaporHit(h.point, 0xffd0e0); dead = true; }
        else if (h.type === 'bottle') { g.breakBottle(h.index, d); }
        else if (h.type === 'flamingo') { g.hitFlamingo(p.def.damage, h.point); dead = true; }
        else if (h.type === 'prop') { h.prop.hit(p.def.damage, d, p.def.knock); dead = true; }
        else if (h.type === 'world') {
          if (p.bounces > 0) { p.bounces--; const n = h.normal || new THREE.Vector3(0, 1, 0); p.pos.copy(h.point).addScaledVector(n, p.pd.radius + 0.01); p.vel.reflect(n).multiplyScalar(0.55); this.audio.play('ricochet', p.pos); this.fx.burst(p.pos, 3, { speed: 1.5, color: [1, 0.4, 0.7], life: 0.3, size: 0.03, grav: 5 }); continue; }
          else { this.fx.burst(h.point, 6, { speed: 2, color: [1, 0.4, 0.7], life: 0.4, size: 0.04, grav: 6 }); dead = true; }
        }
      } else if (!dead) p.pos.addScaledVector(p.vel, dt);
      const fy = this.world.floorHeight(p.pos.x, p.pos.z);
      if (!dead && p.pos.y < fy + p.pd.radius) {
        if (p.pd.explode && !p.pd.fuse) { g.explode(p.pos.clone(), p.pd.explode, p.def.damage * this.damageMul, p.owner, p.def.key); dead = true; }
        else if (p.bounces > 0 || p.pd.fuse) { if (!p.pd.fuse) p.bounces--; p.pos.y = fy + p.pd.radius; p.vel.y = -p.vel.y * 0.45; p.vel.x *= 0.75; p.vel.z *= 0.75; if (Math.abs(p.vel.y) > 1) this.audio.play('ricochet', p.pos); }
        else if (p.pd.bubble) { p.pos.y = fy + p.pd.radius; p.vel.y = Math.abs(p.vel.y) * 0.5 + 0.3; }
        else { this.fx.burst(p.pos, 6, { speed: 2, color: [1, 0.4, 0.7], life: 0.4, size: 0.04, grav: 6 }); dead = true; }
      }
      if (p.pos.y > 6.4) { p.pos.y = 6.4; p.vel.y = -Math.abs(p.vel.y) * 0.3; }
      p.mesh.position.copy(p.pos); p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt;
      if (p.def.key === 'flamant') { p.mesh.rotation.set(0, 0, 0); p.mesh.lookAt(p.pos.clone().add(p.vel)); p.mesh.rotateY(Math.PI); this.fx.puff(p.pos, { size: 0.25, life: 0.5, opacity: 0.35, color: 0xffc0e0, grow: 2 }); this.fx.particle(p.pos.x, p.pos.y, p.pos.z, (Math.random() - 0.5), Math.random(), (Math.random() - 0.5), { life: 0.5, size: 0.06, color: [1, 0.4, 0.7] }); }
      if (p.pd.fuse && p.mesh.userData.light) { p.mesh.userData.light.intensity = Math.sin(p.t * (10 + (1.7 - p.life) * 30)) > 0 ? 2 : 0.2; }
      if (p.pd.bubble) { p.mesh.scale.setScalar(1 + Math.sin(p.t * 6) * 0.06); }
      if (dead) { this.g.R.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }
  traceEnemyProj(origin, d, maxDist) {
    let best = { dist: maxDist, type: null }; const w = this.world.raycast(origin, d, maxDist); if (w.dist < best.dist) best = { dist: w.dist, type: 'world', normal: w.normal };
    const P = this.player; const c = { x: P.pos.x, z: P.pos.z, y0: P.pos.y, y1: P.pos.y + P.eye + 0.15, r: 0.38 }; const t = rayCapsule(origin, d, c, best.dist); if (t !== null && t < best.dist) best = { dist: t, type: 'player' };
    best.point = origin.clone().addScaledVector(d, best.dist); return best;
  }
  melee(D) {
    if (this.cd > 0) return; this.cd = D.rate; this.swing = D.rate; this.hand = 1 - this.hand; this.meleeDef = D; this.stopBeam();
    const P = this.player, cam = this.camera; const origin = cam.getWorldPosition(V()), dir = cam.getWorldDirection(V());
    let hit = false; const targets = [];
    for (const e of this.g.enemies.list) { if (!e.alive) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const dist = Math.hypot(dx, dz); if (dist > D.range + e.radius) continue; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dz * dir.z) / (dist || 1) / (Math.hypot(dir.x, dir.z) || 1)))); if (ang > D.arc) continue; if (!this.world.hasLineOfSight(origin, e.pos.clone().setY(e.pos.y + 1.2))) continue; targets.push(e); }
    for (const p of this.g.props?.list || []) { if (!p.alive) continue; const dx = p.pos.x - P.pos.x, dz = p.pos.z - P.pos.z; const dist = Math.hypot(dx, dz); if (dist < D.range + 0.4 && (dx * dir.x + dz * dir.z) / (dist || 1) > 0.5) { p.hit(D.damage, dir, D.knock); hit = true; } }
    if (!D.sweep && targets.length) { targets.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)); targets.length = 1; }
    for (const e of targets) { const kd = e.pos.clone().sub(P.pos).setY(0).normalize().lerp(dir, 0.3); this.g.hitEnemy(e, D.damage * this.damageMul, kd, D.knock, false, D.key, e.pos.clone().setY(e.pos.y + 1.2)); hit = true; }
    const h = this.trace(origin, dir, D.range + 0.3); if (h.type === 'bottle') { this.g.breakBottle(h.index, dir); hit = true; } if (h.type === 'flamingo') { this.g.hitFlamingo(D.damage, h.point); hit = true; }
    this.audio.play(hit ? D.sound : 'punch_miss'); if (!hit) this.g.stats.whiffs++;
    if (D.key === 'flamingo') { this.fx.shake = Math.max(this.fx.shake, 0.6); P.kickVel.y += 30; if (hit) this.fx.ring(P.pos.clone().addScaledVector(dir, 1.2), { color: 0xff4fa3, size: 3, life: 0.35, y: 0.1 }); }
    else P.kickVel.y += hit ? 12 : 6;
  }
  // ------------------------------------------------------------- drops / pickups
  drop(key, pos, ammoMul = 1, label = null) {
    const D = WEAPONS[key]; let m;
    if (key === 'grenade') { m = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(this.projGeo.grenade, VM_MATS.pink); b.position.set((i - 1) * 0.16, 0, 0); m.add(b); } }
    else { m = this.models[key].clone(); m.visible = true; m.traverse(o => { if (o.isMesh) o.renderOrder = 0; }); m.scale.setScalar(key === 'flamingo' ? 1.6 : 1.3); m.userData = {}; }
    const glow = new THREE.PointLight(D.color || 0xff4fa3, 0.6, 2.2, 2); glow.position.set(0, 0.6, 0); m.add(glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 32), new THREE.MeshBasicMaterial({ color: D.color || 0xff4fa3, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.15;
    const g = new THREE.Group(); g.add(m); g.add(ring); const fy = this.world.floorHeight(pos.x, pos.z); g.position.set(pos.x, fy + 0.5, pos.z); this.g.R.scene.add(g);
    const d = { key, g, m, ring, t: Math.random() * 6, ammoMul, label: label || (key === 'flamingo' ? 'LE FLAMANT ROSE' : D.name), pos: g.position, kind: 'weapon' };
    this.drops.push(d); return d;
  }
  dropPowerup(type, pos) {
    const PU = { slowmo: ['Menthe Glaciale', 0x5ef2ff], boost: ['Booster Nicotine', 0xffb347], shield: ['Bouclier Vitrine', 0xd7f06a], disco: ['Disco CBD', 0xff4fa3], ammo: ['Méga-Gummies', 0xb58cff], heal: ['Tisane CBD', 0x9be36a], rage: ['Rage du Patron', 0xff3b3b], magnet: ['Aimant à Zinzins', 0xffd700] };
    const [name, color] = PU[type]; const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.2 })); g.add(core);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5 })); g.add(shell);
    const glow = new THREE.PointLight(color, 0.6, 2.2, 2); glow.position.set(0, 0.5, 0); g.add(glow); const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.35; g.add(ring);
    const fy = this.world.floorHeight(pos.x, pos.z); g.position.set(pos.x, fy + 0.6, pos.z); this.g.R.scene.add(g);
    const d = { key: type, g, m: core, ring, t: Math.random() * 6, label: name, pos: g.position, kind: 'powerup', shell, life: 25 }; this.drops.push(d); return d;
  }
  updateDrops(dt) {
    const P = this.player; let nearest = null, nd = 99; const magnet = this.g.powerups.magnet?.t > 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt; d.m.rotation.y += dt * 1.2; d.m.position.y = Math.sin(d.t * 2) * 0.06; d.ring.rotation.z += dt;
      if (d.shell) { d.shell.rotation.x += dt; d.shell.rotation.z += dt * 0.7; d.life -= dt; if (d.life < 5) d.g.visible = Math.sin(d.t * 20) > 0; if (d.life <= 0) { this.g.R.scene.remove(d.g); this.drops.splice(i, 1); continue; } }
      if (magnet && d.kind === 'powerup') { const to = P.pos.clone().sub(d.pos).setY(0); const l = to.length(); if (l > 0.5) d.g.position.addScaledVector(to.normalize(), dt * 6); }
      const dist = Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z);
      if (d.kind === 'powerup' && dist < 0.9) { this.g.applyPowerup(d.key); this.g.R.scene.remove(d.g); this.drops.splice(i, 1); continue; }
      if (d.kind === 'weapon' && dist < 2.0 && dist < nd) { nearest = d; nd = dist; }
    }
    this.nearDrop = nearest;
    if (nearest && this.g.input.wasPressed('KeyF')) { const got = this.give(nearest.key, nearest.ammoMul); if (got !== false) { this.audio.play('pickup'); this.g.R.scene.remove(nearest.g); this.drops.splice(this.drops.indexOf(nearest), 1); this.g.ui.toast(`${nearest.label} récupéré`); this.fx.confettiRain(nearest.pos.clone().setY(nearest.pos.y + 2.2), 10); this.g.ui.refreshWeapon(true); } }
  }
  // ------------------------------------------------------------- viewmodel animation
  animate(dt, gdt) {
    const P = this.player, inp = this.g.input, D = this.def, model = this.models[this.cur]; if (!model) return;
    const ud = model.userData;
    this.swayX += (inp.mouse.dx * 0.0008 - this.swayX) * (1 - Math.exp(-dt * 10)); this.swayY += (inp.mouse.dy * 0.0008 - this.swayY) * (1 - Math.exp(-dt * 10));
    this.recoilV.addScaledVector(this.recoil, -dt * 260); this.recoilV.multiplyScalar(Math.exp(-dt * 18)); this.recoil.addScaledVector(this.recoilV, dt);
    const bob = P.bobAmt; const bx = Math.sin(P.bobPhase * 0.5) * 0.012 * bob, by = Math.abs(Math.sin(P.bobPhase)) * 0.012 * bob;
    const hip = ud.hip || [0.24, -0.2, -0.42], ads = ud.ads || hip; const a = P.ads;
    let x = hip[0] * (1 - a) + ads[0] * a + bx - this.swayX * 0.6, y = hip[1] * (1 - a) + ads[1] * a + by + this.swayY * 0.4 - P.landDip * 0.3, z = hip[2] * (1 - a) + ads[2] * a + this.recoil.z * 0.05;
    let rx = -this.recoil.x * 0.08 + this.swayY * 0.8, ry = -this.swayX * 1.4, rz = this.swayX * 0.6 - (P.sliding > 0 ? 0.25 : 0);
    if (this.draw > 0) { const k = this.draw / 0.32; y -= k * 0.35; rx -= k * 0.9; }
    if (this.reloading > 0) { const k = 1 - this.reloading / this.reloadTotal; const s = Math.sin(k * Math.PI); y -= s * 0.16; rx -= s * 0.9; rz += Math.sin(k * Math.PI * 2) * 0.5; ry += s * 0.3; }
    if (P.running && P.moving > 4 && a < 0.5 && this.reloading <= 0) { x += 0.06; y -= 0.05; rx -= 0.25; ry += 0.35; }
    if (P.dashTime > 0) rz += 0.3;
    if (this.beamOn) { x += (Math.random() - 0.5) * 0.004; y += (Math.random() - 0.5) * 0.004; }
    // moving parts
    if (ud.parts?.slide) ud.parts.slide.position.z = 0.035 * this.slideT;
    if (ud.parts?.pump) { const k = this.pumpT > 0 ? Math.sin((0.45 - this.pumpT) / 0.45 * Math.PI) : (this.reloading > 0 ? Math.sin((1 - this.reloading / this.reloadTotal) * Math.PI * 2) * 0.5 + 0.5 : 0); ud.parts.pump.position.z = 0.07 * k; }
    // grenade throw overlay
    if (this.throwT > 0) { const k = 1 - this.throwT / 0.5; this.grenadeVm.visible = true; const h = this.grenadeVm.userData.hand; h.position.set(-0.2 + k * 0.25, -0.22 + Math.sin(k * Math.PI) * 0.18, -0.36 - k * 0.2); h.rotation.set(0.6 - k * 1.8, 0.3, 0.2); h.visible = k < 0.35 || k > 0.9 ? true : true; h.children[0].visible = k < 0.3; } else this.grenadeVm.visible = false;
    if (D.melee) {
      if (this.cur === 'fists') {
        const hands = ud.hands; const k = this.swing > 0 ? 1 - this.swing / (this.meleeDef?.rate || 0.36) : 0; const punch = Math.sin(Math.min(1, k * 1.6) * Math.PI);
        for (let i = 0; i < 2; i++) { const h = hands[i]; const side = i ? 1 : -1; const active = i === this.hand && this.swing > 0; const idle = Math.sin(P.bobPhase * 0.5 + i) * 0.01;
          h.position.set(side * 0.21 + bx + (active ? -side * punch * 0.14 : 0), -0.22 + by - P.landDip * 0.3 + idle + (active ? punch * 0.08 : 0), -0.42 - (active ? punch * 0.34 : 0));
          h.rotation.set(0.55 - (active ? punch * 0.5 : 0) + this.swayY, side * 0.2 - this.swayX + (active ? -side * punch * 0.4 : 0), side * -Math.PI / 2 + (active ? side * punch * 0.35 : 0)); }
        model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); return;
      }
      const k = this.swing > 0 ? 1 - this.swing / (this.meleeDef?.rate || 0.6) : 0; const s = Math.sin(Math.min(1, k * 1.3) * Math.PI); ry += -s * 1.6 + (k > 0 ? -0.2 : 0); rx += s * 0.5; x -= s * 0.25; z -= s * 0.2; rz += s * 0.8;
    }
    model.position.set(x, y, z); model.rotation.set(rx, ry, rz);
  }
  reset() { this.inv = {}; this.slots = ['fists', null, null, null, null, null, null]; this.stopBeam(); this.setCurrent('fists', true); for (const p of this.projectiles) this.g.R.scene.remove(p.mesh); this.projectiles.length = 0; for (const d of this.drops) this.g.R.scene.remove(d.g); this.drops.length = 0; this.fireRateMul = 1; this.damageMul = 1; this.infinite = false; this.grenades = 2; this.overheat = 0; this.throwT = 0; }
}
