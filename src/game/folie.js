// La Folie: bladder & transit (pee / poop), puddles & poop mines, staff toilet, Roger the pigeon, random absurd events, the scream.
import * as THREE from 'three';

const V = () => new THREE.Vector3();
export const FLAMINGO_LINES = ['JE SUIS UN FLAMANT, PAS UN CANARD', 'QUI A COMMANDÉ DU 50 ML ?', 'J\'AI VU DES CHOSES SUR CE TOIT', 'COIN. PARDON. COUAC.', 'LE PATRON ME DOIT 3 SEMAINES DE VACANCES', 'VOUS AVEZ VU MES JAMBES ?', 'ROSE C\'EST UNE COULEUR DE GUERRIER', 'IL FAIT FROID ICI NON ?'];
const PIGEON_LINES = ['ROUCOU', 'ROUCOUCOU !', 'PRRRT', 'MIETTE ?', 'BOMBARDEMENT !'];
const SCREAMS = ['AAAAAAAH !', 'DÉGAGEZ !!!', 'J\'AI PAS DE 50 ML !', 'C\'EST MON MAGASIN !', 'ROGER, ATTAQUE !', 'WAAAAAH'];

export const EVENTS = {
  lune:     { name: 'GRAVITÉ LUNAIRE',        desc: 'Tout le monde flotte. Sautez.', dur: 14, color: '#b58cff' },
  tetes:    { name: 'GROSSES TÊTES',          desc: 'Têtes ×3 · tirs à la tête ×2', dur: 14, color: '#ffb347' },
  minis:    { name: 'ZINZINS MINUSCULES',     desc: 'Petits, rapides, ridicules', dur: 12, color: '#5ef2ff' },
  geants:   { name: 'ZINZINS GÉANTS',         desc: 'Ils ont grandi. Vous non.', dur: 12, color: '#ff3b3b' },
  pluie:    { name: 'PLUIE DE FLACONS',       desc: 'Le plafond se vide sur les zinzins', dur: 10, color: '#d7f06a' },
  macarena: { name: 'PAUSE MACARENA',         desc: 'Tout le monde danse. Vous aussi.', dur: 6, color: '#ff4fa3' },
  tonneau:  { name: 'TONNEAU !',              desc: 'Le magasin fait une roulade', dur: 3, color: '#ffffff' },
  flamant:  { name: 'LE FLAMANT PARLE',       desc: 'Il a des choses à dire', dur: 12, color: '#ff4fa3' },
  liquidation: { name: 'TOUT DOIT DISPARAÎTRE', desc: 'Les flacons explosent tout seuls', dur: 8, color: '#ffd700' },
  fientes:  { name: 'ESCADRILLE DE PIGEONS',  desc: 'Roger a appelé des renforts', dur: 10, color: '#dddddd' },
};

// ------------------------------------------------------------------ Roger the pigeon
class Pigeon {
  constructor(f) {
    this.f = f; this.g = f.g; const M = (o) => new THREE.MeshStandardMaterial(o);
    const g = new THREE.Group(); const grey = M({ color: 0x8e8e96, roughness: 0.8 }), dark = M({ color: 0x3a3a44, roughness: 0.8 }), irid = M({ color: 0x6a3fa0, roughness: 0.4, metalness: 0.4 });
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    mk(new THREE.SphereGeometry(0.11, 10, 8), grey, 0, 0, 0).scale.set(1, 0.85, 1.3);
    mk(new THREE.SphereGeometry(0.06, 8, 8), dark, 0, 0.1, 0.12); mk(new THREE.SphereGeometry(0.05, 8, 8), irid, 0, 0.03, 0.08);
    mk(new THREE.ConeGeometry(0.015, 0.05, 6), M({ color: 0xffb347 }), 0, 0.09, 0.19).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) { const e = mk(new THREE.SphereGeometry(0.012, 6, 6), M({ color: 0xff3b3b }), sx * 0.04, 0.12, 0.15); }
    mk(new THREE.BoxGeometry(0.06, 0.01, 0.14), dark, 0, 0.02, -0.16);
    this.wings = []; for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.08, 0.04, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.12), grey); m.position.x = sx * 0.11; w.add(m); g.add(w); this.wings.push(w); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.mesh = g; this.g.R.scene.add(g); this.pos = new THREE.Vector3(0, 2.6, 8); this.target = null; this.state = 'follow'; this.t = 0; this.poopCd = 6; this.phase = 0; this.active = false; g.visible = false;
  }
  activate() { if (this.active) return; this.active = true; this.mesh.visible = true; this.pos.copy(this.g.player.pos).add(new THREE.Vector3(0, 2.6, 0)); this.g.ui.announce('ROGER LE PIGEON', 'a rejoint la partie. Il fiente sur les zinzins. Ne posez pas de questions.'); this.g.tts.say('Roger le pigeon a rejoint la partie', { priority: 1 }); this.g.audio.play('coo', this.pos); }
  update(dt) {
    if (!this.active) return; const g = this.g, P = g.player; this.t += dt; this.phase += dt * 14;
    const mul = (g.upgrades.pigeon ? 2 : 1) * (g.folie.event?.key === 'fientes' ? 4 : 1);
    this.poopCd -= dt * mul;
    let want;
    if (this.state === 'follow') {
      const a = this.t * 0.9; want = new THREE.Vector3(P.pos.x + Math.cos(a) * 1.6, P.pos.y + 2.5 + Math.sin(this.t * 2.1) * 0.25, P.pos.z + Math.sin(a) * 1.6);
      if (this.poopCd <= 0) { const cands = g.enemies.alive.filter(e => e.pos.distanceTo(P.pos) < 13); if (cands.length) { this.target = cands[Math.floor(Math.random() * cands.length)]; this.state = 'bomb'; this.stateT = 0; if (Math.random() < 0.5) g.fx.text(this.pos, PIGEON_LINES[Math.floor(Math.random() * PIGEON_LINES.length)], { color: '#eee', size: 13, glow: '#000' }); g.audio.play('coo', this.pos); } else this.poopCd = 2; }
    } else {
      this.stateT += dt; const e = this.target;
      if (!e || !e.alive || this.stateT > 6) { this.state = 'follow'; this.poopCd = 5 + Math.random() * 4; }
      else { want = new THREE.Vector3(e.pos.x, e.pos.y + e.height + 1.3, e.pos.z); if (this.pos.distanceTo(want) < 0.6) { this.f.spawnFiente(this.pos.clone().add(new THREE.Vector3(0, -0.15, 0))); this.state = 'follow'; this.poopCd = 5 + Math.random() * 4; g.audio.play('plop', this.pos); } }
    }
    if (want) { const d = want.clone().sub(this.pos); const l = d.length(); if (l > 0.01) this.pos.addScaledVector(d.normalize(), Math.min(l, dt * (this.state === 'bomb' ? 7 : 4))); this.mesh.lookAt(this.pos.x + d.x, this.pos.y, this.pos.z + d.z); }
    this.pos.y = Math.min(this.pos.y, 6.2);
    this.mesh.position.copy(this.pos); const flap = Math.sin(this.phase) * 0.7; this.wings[0].rotation.z = flap; this.wings[1].rotation.z = -flap; this.mesh.rotation.z = Math.sin(this.t * 3) * 0.1;
  }
  reset() { this.active = false; this.mesh.visible = false; this.state = 'follow'; }
}

// ------------------------------------------------------------------ Folie
export class Folie {
  constructor(game) {
    this.g = game; const s = game.R.scene;
    this.bladder = 0; this.transit = 0; this.peeing = false; this.puddles = []; this.cacas = []; this.fientes = []; this.wobble = 0;
    this.eventT = 35 + Math.random() * 25; this.event = null; this.eventLeft = 0; this.screamCd = 0; this.sitting = 0; this.roll = 0; this.flamLineT = 0;
    const M = (o) => new THREE.MeshStandardMaterial(o);
    this.matPee = new THREE.MeshBasicMaterial({ color: 0xf2e24a, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    this.matCaca = M({ color: 0x5a3a1a, roughness: 0.55 }); this.matFlag = M({ color: 0xffffff, side: THREE.DoubleSide }); this.matFiente = M({ color: 0xf4f4f0, roughness: 0.5 });
    this.puddleGeo = new THREE.CircleGeometry(1, 20); this.cacaGeo = this.makeCacaGeo(); this.fienteGeo = new THREE.SphereGeometry(0.06, 8, 6);
    this.pigeon = new Pigeon(this);
    // pee stream: pooled small spheres rendered as particles via fx
    this.peeMat = new THREE.MeshBasicMaterial({ color: 0xffef6a });
    // staff toilet (interactive)
    this.toilet = this.buildToilet(); this.toiletPos = new THREE.Vector3(7.85, 0, -2.2);
  }
  makeCacaGeo() {
    const geos = []; const push = (r, y, sx = 1) => { const g = new THREE.SphereGeometry(r, 10, 8); g.scale(sx, 0.55, sx); g.translate(0, y, 0); geos.push(g); };
    push(0.22, 0.09); push(0.16, 0.2); push(0.1, 0.29); const tip = new THREE.ConeGeometry(0.05, 0.12, 8); tip.translate(0, 0.38, 0); geos.push(tip);
    // merge manually (all non-indexed to keep it simple)
    const parts = geos.map(g => g.toNonIndexed()); let count = 0; for (const p of parts) count += p.attributes.position.count;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2); let o = 0;
    for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); uv.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
  }
  buildToilet() {
    const M = (o) => new THREE.MeshStandardMaterial(o); const white = M({ color: 0xf4f4f0, roughness: 0.25 }), chrome = M({ color: 0xcfd4da, metalness: 1, roughness: 0.2 });
    const g = new THREE.Group(); const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    mk(new THREE.CylinderGeometry(0.2, 0.16, 0.38, 14), white, 0, 0.19, 0); mk(new THREE.CylinderGeometry(0.26, 0.24, 0.06, 16), white, 0, 0.41, 0).scale.set(1, 1, 1.25);
    mk(new THREE.TorusGeometry(0.22, 0.035, 8, 20), M({ color: 0x1a1a1d, roughness: 0.6 }), 0, 0.45, 0).rotation.x = Math.PI / 2;
    mk(new THREE.BoxGeometry(0.44, 0.42, 0.2), white, 0, 0.66, -0.3); mk(new THREE.BoxGeometry(0.48, 0.03, 0.24), white, 0, 0.88, -0.3);
    mk(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), chrome, 0.12, 0.92, -0.3); mk(new THREE.SphereGeometry(0.03, 8, 8), chrome, 0.12, 0.99, -0.3);
    // toilet paper on the wall + sign
    mk(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), white, 0.42, 0.75, -0.2).rotation.z = Math.PI / 2;
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#17301c'; x.fillRect(0, 0, 256, 96); x.strokeStyle = '#d7f06a'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 84); x.fillStyle = '#d7f06a'; x.font = '900 34px Inter,Arial'; x.textAlign = 'center'; x.fillText('WC ÉQUIPE', 128, 42); x.font = '700 18px Inter,Arial'; x.fillText('(et clients désespérés)', 128, 72);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), M({ map: tex, roughness: 0.7 })); sign.position.set(0, 1.7, -0.45); g.add(sign);
    g.position.set(7.85, 0, -2.2); g.rotation.y = -Math.PI / 2; this.g.R.scene.add(g);
    this.g.world.collider(7.55, 8.3, -2.6, -1.8, 0.9);
    return g;
  }
  reset() { this.bladder = 0; this.transit = 0; this.peeing = false; for (const p of this.puddles) this.g.R.scene.remove(p.m); this.puddles.length = 0; for (const c of this.cacas) this.g.R.scene.remove(c.m); this.cacas.length = 0; for (const f of this.fientes) this.g.R.scene.remove(f.m); this.fientes.length = 0; this.event = null; this.eventLeft = 0; this.eventT = 35 + Math.random() * 25; this.pigeon.reset(); this.sitting = 0; this.roll = 0; this.applyEventEnd(true); this.g.ui.setEvent(null); }

  // ---------------------------------------------------------------- pee / poop
  pee(dt) {
    const g = this.g, P = g.player, W = g.weapons;
    const minB = g.upgrades.couche ? 0 : 12; if (this.bladder < minB && !this.peeing) { g.ui.toast('Pas envie pour l\'instant. Cassez des flacons pour boire… enfin, vous voyez.', 2.5); return; }
    if (this.bladder <= 0.5) { this.stopPee(); return; }
    if (!this.peeing) { this.peeing = true; g.audio.play('pee_start'); g.ui.announce('PIPI', 'Maintenez P. Les zinzins glissent.'); g.tts.say('Attention, sol mouillé', { priority: 0 }); }
    this.bladder = Math.max(0, this.bladder - dt * (g.upgrades.couche ? 12 : 26));
    // stream: fast yellow particles along the aim, slightly down, arc
    const o = g.R.camera.getWorldPosition(V()).add(new THREE.Vector3(0, -0.45, 0)), d = g.R.camera.getWorldDirection(V()); d.y -= 0.15; d.normalize();
    for (let i = 0; i < 4; i++) { const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06); g.fx.particle(o.x, o.y, o.z, (d.x + jitter.x) * 9, (d.y + jitter.y) * 9 + 1.5, (d.z + jitter.z) * 9, { life: 0.9, size: 0.055, color: [1, 0.9, 0.35], grav: 9, drag: 0.2, bounce: 0, shrink: 0 }); }
    if (Math.random() < dt * 8) g.audio.play('pee_loop');
    // where does it land? trace a parabola roughly: use raycast along d for 6m then floor
    const h = W.trace(o, d, 6); let land = h.point.clone(); if (h.type === 'enemy') { this.wet(h.enemy); land = h.enemy.pos.clone(); } else if (h.type === 'prop') h.prop.hit(0, d, 1.5);
    if (h.type !== 'enemy' && h.type !== 'world') { land = o.clone().addScaledVector(d, 4); }
    land.y = g.world.floorHeight(land.x, land.z); this.addPuddle(land, dt);
    W.throwT = Math.max(W.throwT, 0.05); // hands busy: no firing while peeing
  }
  stopPee() { if (this.peeing) { this.peeing = false; this.g.audio.play('pee_stop'); } }
  wet(e) { if (!e.alive || e.wetT > 0) return; e.wetT = 1.2; if (e.fuse >= 0) { e.fuse = -1; this.g.fx.text(e.headPos, 'MÈCHE ÉTEINTE', { color: '#5ef2ff', size: 14 }); e.mat.emissive.setRGB(0, 0, 0); } e.slip('PIPI DANS LES YEUX'); if (Math.random() < 0.3) this.g.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), ['MAIS C\'EST DÉGUEULASSE', 'C\'EST CHAUD !!', 'J\'AI RIEN DEMANDÉ', 'ÇA SENT LA FRAISE ?'][Math.floor(Math.random() * 4)], { color: '#ffef6a', size: 14, glow: '#000' }); }
  addPuddle(p, dt) {
    const near = this.puddles.find(q => q.m.position.distanceTo(p) < 0.6);
    if (near) { near.r = Math.min(1.4, near.r + dt * 0.5); near.life = 25; near.m.scale.setScalar(near.r); return; }
    if (this.puddles.length > 24) { this.g.R.scene.remove(this.puddles[0].m); this.puddles.shift(); }
    const m = new THREE.Mesh(this.puddleGeo, this.matPee); m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y + 0.012, p.z); m.scale.setScalar(0.35); this.g.R.scene.add(m); this.puddles.push({ m, r: 0.35, life: 25 });
  }
  poop() {
    const g = this.g, P = g.player; if (this.transit < 50) { g.ui.toast(`Transit à ${Math.round(this.transit)} %. Tuez des zinzins, ça viendra.`, 2.5); g.audio.play('deny'); return; }
    this.transit -= 50; g.audio.play('poop'); g.ui.announce('CACA', 'Une mine odorante. Les zinzins restent collés.'); g.tts.say(['Oh non', 'Ça c\'est fait', 'Pardon'][Math.floor(Math.random() * 3)], { priority: 0, pitch: 0.8 });
    const back = P.forward().multiplyScalar(-0.6); const p = P.pos.clone().add(back); const [nx, nz] = g.world.nav.nearestFree(p.x, p.z); this.spawnCaca(new THREE.Vector3(nx, g.world.floorHeight(nx, nz), nz), 'player');
    P.kickVel.y -= 20; g.fx.shake = Math.max(g.fx.shake, 0.3); g.player.speedMul *= 1; this.wobble = 0;
  }
  spawnCaca(p, owner = 'player') {
    if (this.cacas.length > 14) { this.g.R.scene.remove(this.cacas[0].m); this.cacas.shift(); }
    const m = new THREE.Mesh(this.cacaGeo, this.matCaca); m.castShadow = true; m.position.copy(p); m.rotation.y = Math.random() * 6.28;
    // little flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), this.matFlag); pole.position.set(0.08, 0.5, 0); m.add(pole);
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#5a3a1a'; x.font = '900 30px Inter,Arial'; x.textAlign = 'center'; x.fillText(owner === 'player' ? 'CACA' : 'PEUR', 64, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); flag.position.set(0.19, 0.7, 0); m.add(flag);
    this.g.R.scene.add(m); this.cacas.push({ m, life: 40, owner, flies: 0 });
    for (let i = 0; i < 6; i++) this.g.fx.puff(p.clone().add(new THREE.Vector3(0, 0.3, 0)), { size: 0.25, life: 1.2, opacity: 0.25, color: 0x8a6a3a, grow: 2, rise: 0.5 });
  }
  spawnFiente(p) {
    const m = new THREE.Mesh(this.fienteGeo, this.matFiente); m.position.copy(p); this.g.R.scene.add(m); this.fientes.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.5, -1, (Math.random() - 0.5) * 0.5), life: 4 });
  }
  // ---------------------------------------------------------------- toilet
  nearToilet() { const P = this.g.player.pos; return Math.hypot(P.x - this.toiletPos.x, P.z - this.toiletPos.z) < 1.6 && this.g.state === 'playing'; }
  sit() {
    const g = this.g; if (this.sitting > 0) return; this.sitting = 3; g.audio.play('flush'); g.ui.announce('PAUSE TOILETTES', '3 secondes de bonheur. Les zinzins n\'attendent pas.'); g.tts.say('Rayon trois, pause pipi rayon trois', { priority: 1 });
    g.player.pos.set(this.toiletPos.x - 0.55, 0, this.toiletPos.z); g.player.prev.copy(g.player.pos); g.player.vel.set(0, 0, 0);
  }
  // ---------------------------------------------------------------- scream
  scream() {
    const g = this.g, P = g.player; if (this.screamCd > 0) { g.audio.play('deny'); return; } this.screamCd = 12;
    const line = SCREAMS[Math.floor(Math.random() * SCREAMS.length)]; g.audio.play('scream_player'); g.tts.say(line, { priority: 2, pitch: 1.3, rate: 1.3 });
    g.fx.text(P.eyePos.clone().addScaledVector(P.forward(), 1.5), line, { color: '#fff', size: 26, glow: '#ff4fa3', life: 1.4 }); g.fx.ring(P.pos, { color: 0xffffff, size: 12, life: 0.7, y: 1.2 }); g.fx.shake = Math.max(g.fx.shake, 0.5); P.fovKick += 8;
    for (const e of g.enemies.alive) { const d = e.pos.distanceTo(P.pos); if (d < 7) { e.flee = 2.2; e.stagger = Math.max(e.stagger, 0.5); e.knock.add(e.pos.clone().sub(P.pos).setY(0).normalize().multiplyScalar(4)); if (Math.random() < 0.25) { this.spawnCaca(e.pos.clone(), 'zinzin'); g.fx.text(e.headPos, 'PEUR !', { color: '#8a6a3a', size: 14 }); } } }
    for (const b of g.bottles.within(P.pos.clone().setY(1.2), 2.2)) if (Math.random() < 0.4) g.breakBottle(b, new THREE.Vector3(0, 1, 0));
  }
  // ---------------------------------------------------------------- events
  startEvent(key) {
    const g = this.g; const E = EVENTS[key]; this.applyEventEnd(true); this.event = { key, ...E }; this.eventLeft = E.dur;
    g.ui.announce(E.name, E.desc); g.ui.setEvent(this.event); g.audio.play('event'); g.tts.say(E.name.toLowerCase(), { priority: 1 });
    if (key === 'lune') { g.player.gravity = 5; g.player.jumpV = 7.5; }
    if (key === 'tetes') for (const e of g.enemies.alive) e.head.scale.setScalar(2.8);
    if (key === 'minis') for (const e of g.enemies.alive) e.setSize(0.5);
    if (key === 'geants') for (const e of g.enemies.alive) e.setSize(1.55);
    if (key === 'macarena') { for (const e of g.enemies.alive) e.dance = E.dur; g.macarena = E.dur; g.audio.setIntensity(1); }
    if (key === 'tonneau') { this.roll = 0.001; }
    if (key === 'flamant') { this.flamLineT = 0; }
    if (key === 'fientes') { this.pigeon.activate(); }
  }
  applyEventEnd(silent = false) {
    const g = this.g; if (!this.event) return; const key = this.event.key;
    if (key === 'lune') { g.player.gravity = 16; g.player.jumpV = 5.6; }
    if (key === 'tetes') for (const e of g.enemies.list) e.head.scale.setScalar(1);
    if (key === 'minis' || key === 'geants') for (const e of g.enemies.list) e.setSize(1);
    if (key === 'macarena') g.macarena = 0;
    if (key === 'tonneau') { this.roll = 0; g.player.extraRoll = 0; }
    this.event = null; g.ui.setEvent(null); if (!silent) g.ui.toast('Fin de l\'événement. Retour à la folie ordinaire.', 2);
  }
  onSpawn(e) { const k = this.event?.key; if (k === 'tetes') e.head.scale.setScalar(2.8); if (k === 'minis') e.setSize(0.5); if (k === 'geants') e.setSize(1.55); if (k === 'macarena') e.dance = this.eventLeft; }
  // ---------------------------------------------------------------- update
  update(dt, t) {
    const g = this.g, P = g.player, inp = g.input;
    if (g.state !== 'playing') return;
    // gauges
    this.bladder = Math.min(100, this.bladder + dt * 1.1 * (g.upgrades.couche ? 3 : 1));
    this.screamCd = Math.max(0, this.screamCd - dt);
    if (this.bladder > 85 && !this.peeing) { this.wobble += dt; if (Math.random() < dt * 0.15) g.ui.toast('ENVIE PRESSANTE. Appuyez sur P (ou trouvez les WC équipe).', 3); } else this.wobble = Math.max(0, this.wobble - dt * 2);
    P.extraRoll = Math.sin(t * 9) * 0.012 * Math.min(1, this.wobble) + this.roll;
    // pee (hold P) / poop (O) / scream (T) / toilet (F)
    if (inp.down('KeyP') && !P.dead && this.sitting <= 0) this.pee(dt); else this.stopPee();
    if (inp.wasPressed('KeyO') && !P.dead && this.sitting <= 0) this.poop();
    if (inp.wasPressed('KeyT') && !P.dead) this.scream();
    if (this.nearToilet() && inp.wasPressed('KeyF') && !g.weapons.nearDrop && !g.nearShop()) this.sit();
    if (this.sitting > 0) { this.sitting -= dt; P.vel.set(0, 0, 0); P.eyeTarget = 1.15; P.hp = Math.min(P.maxHp, P.hp + dt * 12); this.bladder = Math.max(0, this.bladder - dt * 40); this.transit = Math.max(0, this.transit - dt * 30); g.weapons.throwT = Math.max(g.weapons.throwT, 0.05); if (this.sitting <= 0) { g.audio.play('flush'); g.fx.confettiRain(P.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 20); g.ui.toast('Soulagé. +vitalité. Le papier était fini, mais bon.', 3); g.fx.ring(P.pos, { color: 0x5ef2ff, size: 3, life: 0.5 }); } }
    // puddles: enemies slip, player wobbles
    for (let i = this.puddles.length - 1; i >= 0; i--) { const q = this.puddles[i]; q.life -= dt; if (q.life <= 0) { g.R.scene.remove(q.m); this.puddles.splice(i, 1); continue; } q.m.material = this.matPee; if (q.life < 4) q.m.scale.setScalar(q.r * q.life / 4);
      for (const e of g.enemies.alive) { if (e.slipCd > 0 || e.trapped > 0) continue; if (Math.hypot(e.pos.x - q.m.position.x, e.pos.z - q.m.position.z) < q.r * 0.9 && Math.hypot(e.vel.x, e.vel.z) > 1.2 && Math.abs(e.pos.y - q.m.position.y) < 0.5) e.slip('GLISSADE !'); }
      if (Math.hypot(P.pos.x - q.m.position.x, P.pos.z - q.m.position.z) < q.r * 0.8 && P.moving > 2 && !P.wetToast) { P.wetToast = 6; g.ui.toast('T\'as marché dedans.', 2); this.wobble = Math.max(this.wobble, 0.5); } }
    if (P.wetToast > 0) P.wetToast -= dt;
    // poop mines: stick enemies, damage over time, flies
    for (let i = this.cacas.length - 1; i >= 0; i--) { const c = this.cacas[i]; c.life -= dt; if (c.life <= 0) { g.R.scene.remove(c.m); this.cacas.splice(i, 1); continue; } c.m.children[1].rotation.y = Math.sin(t * 3) * 0.4;
      if (Math.random() < dt * 2) g.fx.particle(c.m.position.x + (Math.random() - 0.5) * 0.4, c.m.position.y + 0.3 + Math.random() * 0.3, c.m.position.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5), 0.3, (Math.random() - 0.5), { life: 0.8, size: 0.02, color: [0.1, 0.1, 0.1], grav: 0, drag: 2 });
      for (const e of g.enemies.alive) { if (Math.hypot(e.pos.x - c.m.position.x, e.pos.z - c.m.position.z) < 0.45 && Math.abs(e.pos.y - c.m.position.y) < 0.5) { if (e.stuck <= 0) { e.stuck = 2.5; e.vel.set(0, 0, 0); g.fx.text(e.headPos, ['NOOON MES CROCS', 'C\'EST COLLANT', 'QUI A FAIT ÇA ?!', 'BEURK BEURK BEURK'][Math.floor(Math.random() * 4)], { color: '#8a6a3a', size: 14, glow: '#000' }); g.audio.play('squish', e.pos); } if (Math.random() < dt * 2) g.hitEnemy(e, 6, new THREE.Vector3(0, 1, 0), 0, false, 'caca', e.chest); } }
      if (Math.hypot(P.pos.x - c.m.position.x, P.pos.z - c.m.position.z) < 0.45 && P.moving > 1 && !P.cacaToast) { P.cacaToast = 8; g.ui.toast(c.owner === 'player' ? 'Tu as marché dans ton propre caca. Bravo.' : 'Un zinzin a eu peur ici. Ça se sent.', 3); g.audio.play('squish'); P.speedMul *= 0.999; } }
    if (P.cacaToast > 0) P.cacaToast -= dt;
    // fientes (pigeon droppings)
    for (let i = this.fientes.length - 1; i >= 0; i--) { const f = this.fientes[i]; f.life -= dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); let hit = false;
      for (const e of g.enemies.alive) { if (Math.hypot(e.pos.x - f.m.position.x, e.pos.z - f.m.position.z) < e.radius + 0.1 && f.m.position.y < e.pos.y + e.height && f.m.position.y > e.pos.y) { g.hitEnemy(e, 14, new THREE.Vector3(0, -1, 0), 1, true, 'fiente', e.headPos); g.fx.text(e.headPos.clone().setY(e.headPos.y + 0.5), 'FIENTE !', { color: '#eee', size: 16, glow: '#000' }); e.slip('SPLATCH'); hit = true; break; } }
      const fy = g.world.floorHeight(f.m.position.x, f.m.position.z); if (f.m.position.y <= fy + 0.03 || hit || f.life <= 0) { if (!hit) { g.fx.decal(new THREE.Vector3(f.m.position.x, fy, f.m.position.z), new THREE.Vector3(0, 1, 0), 0.16, 0xf4f4f0); g.audio.play('plop', f.m.position); } g.R.scene.remove(f.m); this.fientes.splice(i, 1); } }
    this.pigeon.update(dt);
    if (g.wave >= 2 && !this.pigeon.active) this.pigeon.activate();
    // events
    if (g.waves.state === 'active' && !this.event) { this.eventT -= dt; if (this.eventT <= 0 && g.wave >= 2) { const keys = Object.keys(EVENTS).filter(k => k !== 'fientes' || this.pigeon.active); this.startEvent(keys[Math.floor(Math.random() * keys.length)]); this.eventT = 40 + Math.random() * 35; } }
    if (this.event) {
      this.eventLeft -= dt; const k = this.event.key;
      if (k === 'tonneau') { this.roll += dt * (Math.PI * 2 / 2.4); if (this.roll >= Math.PI * 2) { this.roll = 0; this.applyEventEnd(); } }
      if (k === 'pluie' && Math.random() < dt * 9) { const [x, z] = g.world.nav.randomFree(); const alive = g.enemies.alive; const tgt = alive.length && Math.random() < 0.7 ? alive[Math.floor(Math.random() * alive.length)].pos : null; const px = tgt ? tgt.x + (Math.random() - 0.5) : x, pz = tgt ? tgt.z + (Math.random() - 0.5) : z; g.weapons.spawnProjectile(new THREE.Vector3(px, 6.2, pz), new THREE.Vector3(0, -1, 0), { key: 'pluie', damage: 22, knock: 4, projectile: { speed: 3, gravity: 14, radius: 0.09, bounces: 0, life: 3 } }, 'player'); }
      if (k === 'liquidation' && Math.random() < dt * 14) { const alive = g.bottles.alive; let tries = 0; while (tries++ < 20) { const i = Math.floor(Math.random() * g.bottles.n); if (alive[i]) { g.breakBottle(i, new THREE.Vector3(0, 1, 0)); const b = g.bottles.spots[i]; for (const e of g.enemies.alive) if (Math.hypot(e.pos.x - b.x, e.pos.z - b.z) < 1.4) g.hitEnemy(e, 9, new THREE.Vector3(0, 1, 0), 2, false, 'bottle', e.chest); break; } } }
      if (k === 'flamant') { this.flamLineT -= dt; if (this.flamLineT <= 0) { this.flamLineT = 2.4; const line = FLAMINGO_LINES[Math.floor(Math.random() * FLAMINGO_LINES.length)]; g.fx.text(new THREE.Vector3(-0.45, 6.3, 3.96), line, { color: '#ff4fa3', size: 18, life: 2.2, rise: 0.2 }); g.audio.play('honk', new THREE.Vector3(-0.45, 4, 4)); g.tts.say(line.toLowerCase(), { priority: 0, pitch: 1.6, rate: 1.1 }); } }
      if (k === 'macarena') { g.macarena = this.eventLeft; }
      if (this.eventLeft <= 0 && k !== 'tonneau') this.applyEventEnd();
    }
  }
  onKill(e) { this.transit = Math.min(100, this.transit + 7); if (Math.random() < 0.06) { this.spawnCaca(e.pos.clone(), 'zinzin'); this.g.fx.text(e.headPos, 'IL A EU PEUR', { color: '#8a6a3a', size: 13 }); } }
  onBottle() { this.bladder = Math.min(100, this.bladder + 2.5); }
  onPowerup() { this.transit = Math.min(100, this.transit + 20); }
}
