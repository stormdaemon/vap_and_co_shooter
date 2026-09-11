// Zinzins: procedural humanoid rigs, AI (A* chase, melee, ranged, boss), hit reactions, ragdoll-lite deaths.
import * as THREE from 'three';
import { genFace, genShirt } from '../engine/textures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TYPES = {
  client:   { name: 'Client Pressé',      hp: 70,  speed: 2.9, dmg: 7,  range: 1.5, rate: 1.35, scale: 1.0, score: 100, color: 0x3b6bd6, shirt: '50ML ?!', mood: 1, weight: 1 },
  sprinter: { name: 'Stagiaire Caféiné',  hp: 40,  speed: 5.2, dmg: 5,  range: 1.3, rate: 0.75, scale: 0.9, score: 120, color: 0xd7f06a, shirt: 'STAGE', mood: 2, weight: 0.8, zigzag: true },
  vapoteur: { name: 'Vapoteur Enragé',    hp: 90,  speed: 2.4, dmg: 14, range: 9,   rate: 1.6, scale: 1.05, score: 160, color: 0x8b4fd6, shirt: 'CLOUD', mood: 2, weight: 1.1, ranged: 'vapor', keep: 5.5 },
  mamie:    { name: 'Mamie CBD',          hp: 240, speed: 1.7, dmg: 22, range: 1.9, rate: 1.5, scale: 1.08, score: 260, color: 0xe2c9a0, shirt: 'CBD ♥', mood: 1, weight: 2.5, hair: '#dedede', glasses: true },
  vigile:   { name: 'Vigile Zinzin',      hp: 150, speed: 2.6, dmg: 8,  range: 12,  rate: 0.45, scale: 1.12, score: 300, color: 0x1a1d22, shirt: 'SECU', mood: 1, weight: 1.6, ranged: 'gun', keep: 7, beard: true },
  boss:     { name: 'LE PATRON ZINZIN',   hp: 1400, speed: 2.2, dmg: 30, range: 14, rate: 1.2, scale: 1.35, score: 2500, color: 0xff4fa3, shirt: 'PATRON', mood: 3, weight: 6, ranged: 'rocket', keep: 6, boss: true, beard: true },
};
const TAUNTS = ['T\'AS PAS DE 50 ML ?!', 'JE VEUX PARLER AU PATRON', 'C\'EST OÙ LES PROMOS ?', 'VAPOTER C\'EST LA VIE', 'MON CLOUD EST PLUS GROS', 'ZINZIN !!!', 'FRAISE OU MENTHE ?', 'JE SUIS PAS FOU', 'CBD POUR TOUS', 'RENDS-MOI MON FLAMANT'];
const V = () => new THREE.Vector3();
const MOODS = { 1: 1, 2: 2, 3: 3 };

let uid = 0;
export class Zinzin {
  constructor(sys, type, x, z, opts = {}) {
    this.sys = sys; this.g = sys.g; this.type = type; const T = TYPES[type]; this.T = T; this.id = uid++;
    const diff = this.g.difficulty, waveMul = 1 + (this.g.wave - 1) * 0.11;
    this.hp = this.maxHp = Math.round(T.hp * (0.7 + diff * 0.3) * waveMul * (opts.hpMul || 1)); this.speed = T.speed * (0.9 + Math.random() * 0.25) * (0.85 + diff * 0.15);
    this.pos = new THREE.Vector3(x, this.g.world.floorHeight(x, z), z); this.vel = V(); this.yaw = Math.random() * 6.28; this.targetYaw = this.yaw;
    this.scale = T.scale * (0.94 + Math.random() * 0.12); this.radius = 0.32 * this.scale; this.height = 1.8 * this.scale;
    this.alive = true; this.state = 'spawn'; this.stateT = 0; this.phase = Math.random() * 6; this.attackCd = 1 + Math.random(); this.stagger = 0; this.path = null; this.pathT = Math.random() * 0.5; this.wp = 0;
    this.knock = V(); this.deathT = 0; this.fall = V(); this.tumble = new THREE.Euler(); this.dance = 0; this.frozen = 0; this.lastTaunt = 0; this.grudge = null;
    this.buildRig(opts);
    this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw;
    if (opts.dropIn) { this.pos.y += 6; this.state = 'drop'; this.vel.y = 0; }
  }
  buildRig(opts) {
    const T = this.T, s = this.scale; const col = new THREE.Color(T.color);
    const skinCol = ['#e6b89c', '#c99370', '#8d5a3c', '#f1d1b5', '#a86f4b'][Math.floor(Math.random() * 5)];
    const hairCol = T.hair || ['#2b1d14', '#5b3b1f', '#111111', '#c9a04a', '#7a1f1f'][Math.floor(Math.random() * 5)];
    const mSkin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.75 });
    const mShirt = new THREE.MeshStandardMaterial({ map: genShirt({ color: '#' + col.getHexString(), text: T.shirt }), roughness: 0.85 });
    const mPants = new THREE.MeshStandardMaterial({ color: ['#2c3550', '#1f1f22', '#4d3b2c', '#6b6b6b'][Math.floor(Math.random() * 4)], roughness: 0.9 });
    const mHair = new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.9 });
    const mShoe = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const face = genFace({ skin: skinCol, mood: MOODS[T.mood] ?? 2, seed: this.id + 1, hair: hairCol, beard: T.beard, glasses: T.glasses });
    const mFace = new THREE.MeshStandardMaterial({ map: face, roughness: 0.7 });
    const root = new THREE.Group(); this.mesh = root; this.mats = { mSkin, mShirt, mPants, mHair, mFace, mShoe };
    const mk = (geo, mat, x, y, z, shadow = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m; };
    const S = (v) => v * s;
    // pelvis / torso / head hierarchy
    this.pelvis = new THREE.Group(); this.pelvis.position.set(0, S(0.95), 0); root.add(this.pelvis);
    this.pelvis.add(mk(new RoundedBoxGeometry(S(0.38), S(0.2), S(0.24), 3, S(0.06)), mPants, 0, 0, 0));
    this.torso = new THREE.Group(); this.torso.position.set(0, S(0.1), 0); this.pelvis.add(this.torso);
    const torsoGeo = new RoundedBoxGeometry(S(0.4), S(0.48), S(0.23), 3, S(0.09)); torsoGeo.translate(0, S(0.24), 0);
    this.torso.add(mk(torsoGeo, mShirt, 0, 0, 0, true));
    this.torso.add(mk(new THREE.CylinderGeometry(S(0.06), S(0.07), S(0.1), 10), mSkin, 0, S(0.5), 0)); // neck
    this.head = new THREE.Group(); this.head.position.set(0, S(0.54), 0); this.torso.add(this.head);
    const headGeo = new RoundedBoxGeometry(S(0.24), S(0.28), S(0.25), 3, S(0.09)); headGeo.translate(0, S(0.14), 0);
    const headMats = [mSkin, mSkin, mHair, mSkin, mFace, mHair]; // +x,-x,+y,-y,+z(front),-z
    const headMesh = new THREE.Mesh(headGeo, headMats); headMesh.castShadow = true; this.head.add(headMesh);
    for (const sx of [-1, 1]) this.head.add(mk(new THREE.SphereGeometry(S(0.035), 6, 6), mSkin, sx * S(0.125), S(0.13), 0));
    if (T.boss) { const crown = mk(new THREE.CylinderGeometry(S(0.16), S(0.13), S(0.12), 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }), 0, S(0.34), 0); this.head.add(crown); }
    if (T.type === 'vigile' || this.type === 'vigile') { const cap = mk(new THREE.CylinderGeometry(S(0.15), S(0.15), S(0.08), 12), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, S(0.3), 0); this.head.add(cap); const peak = mk(new THREE.BoxGeometry(S(0.24), S(0.02), S(0.12)), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, S(0.27), S(0.15)); this.head.add(peak); }
    if (this.type === 'mamie') { const bun = mk(new THREE.SphereGeometry(S(0.1), 8, 8), mHair, 0, S(0.33), S(-0.08)); this.head.add(bun); }
    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * S(0.25), S(0.44), 0); this.torso.add(sh);
      sh.add(mk(new THREE.SphereGeometry(S(0.075), 8, 8), mShirt, 0, 0, 0)); // shoulder
      const up = new RoundedBoxGeometry(S(0.12), S(0.32), S(0.12), 2, S(0.04)); up.translate(0, S(-0.14), 0); sh.add(mk(up, mShirt, 0, 0, 0, true));
      const el = new THREE.Group(); el.position.set(0, S(-0.3), 0); sh.add(el);
      const fo = new RoundedBoxGeometry(S(0.1), S(0.3), S(0.1), 2, S(0.04)); fo.translate(0, S(-0.14), 0); el.add(mk(fo, mSkin, 0, 0, 0));
      const hand = mk(new RoundedBoxGeometry(S(0.09), S(0.11), S(0.06), 2, S(0.025)), mSkin, 0, S(-0.33), 0); el.add(hand);
      this.arms.push({ sh, el, hand });
    }
    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * S(0.11), S(-0.08), 0); this.pelvis.add(hip);
      const th = new RoundedBoxGeometry(S(0.15), S(0.42), S(0.16), 2, S(0.05)); th.translate(0, S(-0.2), 0); hip.add(mk(th, mPants, 0, 0, 0, true));
      const kn = new THREE.Group(); kn.position.set(0, S(-0.42), 0); hip.add(kn);
      const sh = new RoundedBoxGeometry(S(0.13), S(0.42), S(0.14), 2, S(0.05)); sh.translate(0, S(-0.2), 0); kn.add(mk(sh, mPants, 0, 0, 0, true));
      kn.add(mk(new THREE.BoxGeometry(S(0.14), S(0.08), S(0.26)), mShoe, 0, S(-0.44), S(0.05)));
      this.legs.push({ hip, kn });
    }
    // weapon props
    if (this.T.ranged === 'gun') { const gun = new THREE.Group(); gun.add(mk(new THREE.BoxGeometry(S(0.05), S(0.06), S(0.24)), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.7 }), 0, 0, S(-0.1))); gun.position.set(0, S(-0.3), S(0.05)); this.arms[1].el.add(gun); this.gun = gun; }
    if (this.type === 'mamie') { const bag = mk(new THREE.BoxGeometry(S(0.26), S(0.22), S(0.12)), new THREE.MeshStandardMaterial({ color: 0x8b1a3a, roughness: 0.5 }), 0, S(-0.42), 0); this.arms[0].el.add(bag); const cane = mk(new THREE.CylinderGeometry(S(0.015), S(0.015), S(0.9), 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }), 0, S(-0.6), S(0.05)); this.arms[1].el.add(cane); }
    if (this.T.ranged === 'vapor') { const vape = mk(new THREE.CylinderGeometry(S(0.025), S(0.025), S(0.16), 8), new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x5ef2ff, emissiveIntensity: 0.8 }), 0, S(-0.32), S(0.04)); vape.rotation.x = 1.2; this.arms[1].el.add(vape); }
    if (this.T.boss) { // boss rides the flamingo
      this.mount = this.g.world.makeFlamingo(0.95); this.mount.position.set(0, S(-0.25), 0); root.add(this.mount); this.pelvis.position.y = S(1.35); this.height = 2.6 * s; this.radius = 0.7;
      const bazooka = mk(new THREE.CylinderGeometry(S(0.07), S(0.07), S(0.8), 12), new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.4 }), 0, S(-0.3), S(-0.2)); bazooka.rotation.x = Math.PI / 2; this.arms[1].el.add(bazooka);
    }
    // shadow blob
    const blob = new THREE.Mesh(new THREE.CircleGeometry(S(0.4), 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; root.add(blob); this.blob = blob;
    this.g.R.scene.add(root);
  }
  capsule() { return { x: this.pos.x, z: this.pos.z, y0: this.pos.y + 0.05, y1: this.pos.y + this.height, r: this.radius + 0.06 }; }
  get headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height - 0.15, this.pos.z); }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.65, this.pos.z); }

  // ------------------------------------------------------------- AI
  update(dt, t) {
    const g = this.g, P = g.player, W = g.world;
    if (!this.alive) { this.updateDeath(dt); return; }
    this.stateT += dt; this.attackCd -= dt; this.phase += dt;
    if (this.state === 'drop') { this.vel.y -= 16 * dt; this.pos.y += this.vel.y * dt; const fy = W.floorHeight(this.pos.x, this.pos.z); if (this.pos.y <= fy) { this.pos.y = fy; this.state = 'chase'; g.fx.dust(this.pos, 8); g.fx.ring(this.pos, { color: 0xffffff, size: 2, life: 0.35 }); g.audio.play('land', this.pos); g.fx.shake = Math.max(g.fx.shake, 0.3); } this.sync(dt); return; }
    if (this.state === 'spawn') { if (this.stateT > 0.6) this.state = 'chase'; this.sync(dt); return; }
    if (this.frozen > 0) { this.frozen -= dt; this.sync(dt); return; }
    if (this.dance > 0) { this.dance -= dt; this.animate(dt, 0, true); this.sync(dt); return; }
    // knockback / stagger
    if (this.stagger > 0) { this.stagger -= dt; this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-dt * 6)); this.collide(); this.animate(dt, 0); this.sync(dt); return; }
    this.knock.multiplyScalar(Math.exp(-dt * 8));
    const target = this.grudge && this.grudge.alive ? this.grudge.pos : P.pos; const toT = target.clone().sub(this.pos).setY(0); const dist = toT.length();
    const T = this.T; let move = V(); let want = 0;
    const los = W.hasLineOfSight(this.chest, P.eyePos);
    // taunt
    if (t - this.lastTaunt > 9 && Math.random() < dt * 0.15 && dist < 12) { this.lastTaunt = t; g.fx.text(this.headPos.clone().setY(this.headPos.y + 0.35), TAUNTS[Math.floor(Math.random() * TAUNTS.length)], { color: '#ffe', size: 13, life: 1.6, glow: '#000' }); g.audio.play(Math.random() < 0.5 ? 'laugh' : 'grunt', this.pos); }
    if (T.ranged) {
      // ranged: keep distance, shoot when LOS
      if (dist > T.keep + 1.5 || !los) want = 1; else if (dist < T.keep - 2) want = -1; else want = 0;
      if (want === 1) move = this.follow(dt, target); else if (want === -1) move = toT.clone().normalize().multiplyScalar(-1); else { move = new THREE.Vector3(-toT.z, 0, toT.x).normalize().multiplyScalar(Math.sin(this.phase * 0.7) > 0 ? 1 : -1); if (W.isBlocked(this.pos.x + move.x * 0.6, this.pos.z + move.z * 0.6, 0.3, this.pos.y)) move.set(0, 0, 0); }
      if (los && dist < T.range && this.attackCd <= 0) { this.shoot(); }
      this.targetYaw = Math.atan2(toT.x, toT.z);
    } else {
      if (dist > T.range) { move = this.follow(dt, target); if (T.zigzag) { const side = new THREE.Vector3(-move.z, 0, move.x); move.addScaledVector(side, Math.sin(this.phase * 6) * 0.8).normalize(); } }
      else if (this.attackCd <= 0) this.meleeAttack(target);
      this.targetYaw = Math.atan2(toT.x, toT.z);
    }
    // move with separation
    const sep = this.sys.separation(this); move.add(sep);
    const spd = this.speed * (this.g.slowEnemies || 1) * (this.type === 'sprinter' ? 1 : 1);
    const wantV = move.lengthSq() > 0.01 ? move.normalize().multiplyScalar(spd) : V();
    const k = 1 - Math.exp(-dt * 8); this.vel.x += (wantV.x - this.vel.x) * k; this.vel.z += (wantV.z - this.vel.z) * k;
    this.pos.x += (this.vel.x + this.knock.x) * dt; this.pos.z += (this.vel.z + this.knock.z) * dt;
    this.collide();
    this.pos.y = W.floorHeight(this.pos.x, this.pos.z);
    // yaw smoothing
    let dy = this.targetYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * (1 - Math.exp(-dt * 8));
    this.animate(dt, Math.hypot(this.vel.x, this.vel.z));
    this.sync(dt);
  }
  follow(dt, target) {
    const W = this.g.world; this.pathT -= dt;
    const direct = W.nav.clearWalk(this.pos.x, this.pos.z, target.x, target.z) && Math.abs(W.floorHeight(target.x, target.z) - this.pos.y) < 0.5;
    if (direct) { this.path = null; return target.clone().sub(this.pos).setY(0).normalize(); }
    if (this.pathT <= 0 || !this.path) { this.pathT = 0.5 + Math.random() * 0.3; this.path = W.nav.find(this.pos.x, this.pos.z, target.x, target.z); this.wp = 0; }
    if (!this.path || !this.path.length) return target.clone().sub(this.pos).setY(0).normalize();
    let wp = this.path[this.wp]; while (wp && Math.hypot(wp[0] - this.pos.x, wp[1] - this.pos.z) < 0.3 && this.wp < this.path.length - 1) { this.wp++; wp = this.path[this.wp]; }
    return new THREE.Vector3(wp[0] - this.pos.x, 0, wp[1] - this.pos.z).normalize();
  }
  collide() {
    const W = this.g.world, r = this.radius; const B = W.bounds;
    this.pos.x = Math.max(B.x0 + r, Math.min(B.x1 - r, this.pos.x)); this.pos.z = Math.max(B.z0 + r, Math.min(B.z1 - r, this.pos.z));
    for (let it = 0; it < 2; it++) for (const c of W.colliders) {
      if (c.top <= this.pos.y + 0.36) continue; if (c.kind === 'under' && this.pos.y > 3) continue;
      const cx = Math.max(c.x0, Math.min(c.x1, this.pos.x)), cz = Math.max(c.z0, Math.min(c.z1, this.pos.z)); const dx = this.pos.x - cx, dz = this.pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-6) { const px = Math.min(this.pos.x - c.x0, c.x1 - this.pos.x), pz = Math.min(this.pos.z - c.z0, c.z1 - this.pos.z); if (px < pz) this.pos.x += (this.pos.x - c.x0 < c.x1 - this.pos.x ? -1 : 1) * (px + r); else this.pos.z += (this.pos.z - c.z0 < c.z1 - this.pos.z ? -1 : 1) * (pz + r); }
      else { const d = Math.sqrt(d2); this.pos.x += dx / d * (r - d); this.pos.z += dz / d * (r - d); }
    }
  }
  meleeAttack(target) {
    const T = this.T; this.attackCd = T.rate * (0.8 + Math.random() * 0.4); this.swingT = 0.45; this.swingArm = Math.random() < 0.5 ? 0 : 1;
    const g = this.g;
    setTimeout(() => {
      if (!this.alive || g.state !== 'playing') return;
      const P = g.player; const tgt = this.grudge && this.grudge.alive ? this.grudge : null;
      if (tgt) { if (tgt.pos.distanceTo(this.pos) < T.range + 0.6) { g.hitEnemy(tgt, T.dmg * 2, tgt.pos.clone().sub(this.pos).normalize(), 4, false, 'zinzin', tgt.chest); } return; }
      const d = P.pos.distanceTo(this.pos); if (d < T.range + 0.5 && Math.abs(P.pos.y - this.pos.y) < 1.2) { g.damagePlayer(T.dmg, this); g.audio.play('punch_hit', this.pos); if (this.type === 'mamie') { P.kickVel.y += 60; P.vel.add(P.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(5)); g.fx.shake = 1; } }
      else g.audio.play('punch_miss', this.pos);
    }, 220 / (g.speed || 1));
  }
  shoot() {
    const T = this.T, g = this.g, P = g.player; this.attackCd = T.rate * (0.8 + Math.random() * 0.5); this.swingT = 0.3; this.swingArm = 1;
    const from = this.chest.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 0.3, 0.1, Math.cos(this.yaw) * 0.3)); const to = P.eyePos.clone().setY(P.pos.y + P.eye - 0.2);
    const dir = to.sub(from).normalize();
    if (T.ranged === 'gun') {
      dir.x += (Math.random() - 0.5) * 0.09; dir.y += (Math.random() - 0.5) * 0.06; dir.z += (Math.random() - 0.5) * 0.09; dir.normalize();
      g.audio.play('shot_enemy', this.pos); g.fx.muzzle(from, dir, 0xffcc88);
      const h = g.weapons.traceEnemyProj(from, dir, 40); g.fx.tracer(from, h.point, { color: 0xffb060, width: 0.01, life: 0.06 });
      if (h.type === 'player') g.damagePlayer(T.dmg * (0.7 + Math.random() * 0.5), this); else if (h.type === 'world') g.fx.impact(h.point, h.normal || new THREE.Vector3(0, 1, 0), { sparks: 4 });
    } else if (T.ranged === 'vapor') {
      g.audio.play('vapor', this.pos); g.fx.puff(from, { size: 0.4, life: 0.5, color: 0xbfe6ff, opacity: 0.5, grow: 2 });
      g.weapons.spawnProjectile(from, dir, { key: 'vapor', damage: T.dmg, knock: 3, projectile: { speed: 11, gravity: 2, radius: 0.22, life: 4 } }, 'enemy');
    } else if (T.ranged === 'rocket') {
      g.audio.play('shot_flamant', this.pos); g.fx.muzzle(from, dir, 0xff4fa3);
      dir.y += 0.08; g.weapons.spawnProjectile(from, dir.normalize(), { key: 'flamant', damage: T.dmg * 2, knock: 12, projectile: { speed: 13, gravity: 1.5, radius: 0.2, explode: 2.6, life: 5 } }, 'enemy');
      // boss also charges sometimes
      if (Math.random() < 0.35) { this.knock.copy(P.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9)); g.fx.text(this.headPos, 'CHAAARGE !', { color: '#ff4fa3', size: 18 }); }
    }
  }
  // ------------------------------------------------------------- damage
  hurt(amount, dir, knock = 3, head = false) {
    if (!this.alive) return false;
    this.hp -= amount; const T = this.T;
    const kb = knock / Math.sqrt(T.weight); this.knock.addScaledVector(dir.clone().setY(0).normalize(), kb);
    this.stagger = Math.max(this.stagger, T.boss ? 0.08 : Math.min(0.45, 0.12 + kb * 0.03)); this.hitFlash = 0.12;
    if (this.type !== 'sprinter' && Math.random() < 0.5) this.grudgeCheck();
    if (this.hp <= 0) { this.die(dir, knock); return true; }
    return false;
  }
  grudgeCheck() {}
  die(dir, knock) {
    this.alive = false; this.deathT = 0; this.dead = true; this.hp = 0;
    const k = Math.max(3, knock) / Math.sqrt(this.T.weight); this.fall.copy(dir).setY(0).normalize().multiplyScalar(k * 1.2); this.fall.y = 2 + k * 0.4;
    this.tumbleV = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6); this.tumble.set(0, this.yaw, 0);
    this.g.audio.play('scream', this.pos);
    if (this.mount) { this.mount.visible = false; }
  }
  updateDeath(dt) {
    this.deathT += dt; const W = this.g.world;
    if (this.deathT < 3.2) {
      this.fall.y -= 14 * dt; this.pos.addScaledVector(this.fall, dt); const fy = W.floorHeight(this.pos.x, this.pos.z);
      if (this.pos.y < fy) { this.pos.y = fy; if (this.fall.y < -3) { this.g.fx.dust(this.pos, 4); this.g.audio.play('land', this.pos); } this.fall.y = -this.fall.y * 0.3; this.fall.x *= 0.6; this.fall.z *= 0.6; this.tumbleV.multiplyScalar(0.5); }
      this.collide();
      this.tumble.x += this.tumbleV.x * dt; this.tumble.z += this.tumbleV.z * dt; this.tumble.y += this.tumbleV.y * dt;
      // settle toward lying flat
      if (this.pos.y <= fy + 0.01) { const tx = Math.PI / 2 * Math.sign(Math.sin(this.tumble.x) || 1); this.tumble.x += (tx - this.tumble.x) * (1 - Math.exp(-dt * 4)); this.tumble.z *= Math.exp(-dt * 3); this.tumbleV.multiplyScalar(Math.exp(-dt * 6)); }
      this.mesh.position.set(this.pos.x, this.pos.y + (Math.abs(Math.sin(this.tumble.x)) * 0.35 + 0.05) * this.scale, this.pos.z); this.mesh.rotation.copy(this.tumble);
      // limp limbs
      for (const a of this.arms) { a.sh.rotation.x += (1.4 - a.sh.rotation.x) * dt * 3; a.el.rotation.x += (0.6 - a.el.rotation.x) * dt * 3; }
      for (const l of this.legs) { l.hip.rotation.x *= Math.exp(-dt * 3); l.kn.rotation.x *= Math.exp(-dt * 3); }
      this.blob.visible = false;
    } else if (this.deathT < 4.2) { const k = (this.deathT - 3.2); this.mesh.position.y -= dt * 0.8; this.mesh.traverse(o => { if (o.material && !o.material.transparent && o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => { m = m.clone(); m.transparent = true; return m; }) : Object.assign(o.material.clone(), { transparent: true }); } if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.opacity = 1 - k); }); }
    else this.remove = true;
  }
  // ------------------------------------------------------------- animation
  animate(dt, speed, dancing = false) {
    const s = this.scale, T = this.T; const moving = Math.min(1, speed / 2.5);
    this.walkPhase = (this.walkPhase || 0) + dt * (T.boss ? 5 : 7 + speed * 2) * moving; const p = this.walkPhase; const sw = Math.sin(p);
    if (this.swingT > 0) this.swingT -= dt;
    if (dancing) { const d = this.phase * 9; this.pelvis.position.y = (T.boss ? 1.35 : 0.95) * s + Math.abs(Math.sin(d)) * 0.08; this.pelvis.rotation.set(0, Math.sin(d * 0.5) * 0.4, 0); this.torso.rotation.set(0, 0, Math.sin(d) * 0.2); this.head.rotation.set(Math.sin(d * 2) * 0.2, 0, Math.cos(d) * 0.3); for (let i = 0; i < 2; i++) { this.arms[i].sh.rotation.set(-2.6 + Math.sin(d + i) * 0.4, 0, (i ? -1 : 1) * 0.6); this.arms[i].el.rotation.x = -0.6; this.legs[i].hip.rotation.x = Math.sin(d + i * 3.14) * 0.4; this.legs[i].kn.rotation.x = 0.3; } return; }
    this.pelvis.position.y = (T.boss ? 1.35 : 0.95) * s + Math.abs(sw) * 0.03 * moving + (T.boss ? Math.sin(this.phase * 2) * 0.08 : 0);
    this.pelvis.rotation.set(0, sw * 0.08 * moving, Math.cos(p) * 0.04 * moving);
    this.torso.rotation.set(0.12 + (this.stagger > 0 ? -0.3 : 0) + (T.zigzag ? 0.25 : 0), -sw * 0.15 * moving, 0);
    this.head.rotation.set(Math.sin(this.phase * 3) * 0.06 + (this.T.mood >= 2 ? Math.sin(this.phase * 11) * 0.08 : 0), Math.sin(this.phase * 1.7) * 0.15, Math.sin(this.phase * 5) * 0.05 * (this.T.mood >= 2 ? 1 : 0));
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1; const a = this.arms[i], l = this.legs[i];
      const zombie = T.mood >= 2 && !T.ranged; // arms forward
      let ax = zombie ? -1.3 + Math.sin(this.phase * 4 + i) * 0.2 : sgn * sw * 0.6 * moving - 0.2, ex = zombie ? -0.3 : -0.5 - Math.abs(sw) * 0.3 * moving;
      if (T.ranged && i === 1) { ax = -1.35; ex = -0.2; } // aiming arm
      if (this.swingT > 0 && i === this.swingArm) { const k = this.swingT / 0.45; ax = -2.2 + (1 - k) * 2.6; ex = -0.9 + (1 - k) * 0.6; }
      a.sh.rotation.set(ax, 0, sgn * 0.15); a.el.rotation.x = ex;
      if (T.boss) { l.hip.rotation.x = -1.2; l.kn.rotation.x = 1.4; continue; }
      l.hip.rotation.x = -sgn * sw * 0.7 * moving; l.kn.rotation.x = Math.max(0, sgn * Math.cos(p)) * 0.9 * moving + 0.05;
    }
    if (this.mount) { this.mount.position.y = -0.25 * s + Math.sin(this.phase * 2) * 0.08; this.mount.rotation.z = Math.sin(this.phase * 1.5) * 0.06; }
    // hit flash
    if (this.hitFlash > 0) { this.hitFlash -= dt; const f = this.hitFlash > 0 ? 0.9 : 0; for (const k in this.mats) { this.mats[k].emissive.setRGB(f, f * 0.2, f * 0.3); this.mats[k].emissiveIntensity = 1; } }
    else if (this.wasFlash !== false) { for (const k in this.mats) this.mats[k].emissive.setRGB(0, 0, 0); this.wasFlash = false; }
    if (this.hitFlash > 0) this.wasFlash = true;
  }
  sync(dt) { if (this.alive) { this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, this.yaw, 0); this.mesh.scale.setScalar(1); } }
  dispose() { this.g.R.scene.remove(this.mesh); this.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}

export class Enemies {
  constructor(game) { this.g = game; this.list = []; }
  spawn(type, x, z, opts = {}) { const e = new Zinzin(this, type, x, z, opts); this.list.push(e); return e; }
  separation(e) {
    const out = new THREE.Vector3();
    for (const o of this.list) { if (o === e || !o.alive) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z; const d = Math.hypot(dx, dz); const min = e.radius + o.radius + 0.15; if (d < min && d > 1e-4) { const f = (min - d) / min; out.x += dx / d * f * 2.5; out.z += dz / d * f * 2.5; } }
    // don't overlap the player
    const P = this.g.player; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const d = Math.hypot(dx, dz); if (d < e.radius + 0.5 && d > 1e-4) { out.x += dx / d * 1.5; out.z += dz / d * 1.5; }
    return out;
  }
  update(dt, t) {
    for (let i = this.list.length - 1; i >= 0; i--) { const e = this.list[i]; e.update(dt, t); if (e.remove) { e.dispose(); this.list.splice(i, 1); } }
  }
  get alive() { return this.list.filter(e => e.alive); }
  clear() { for (const e of this.list) e.dispose(); this.list.length = 0; }
}
