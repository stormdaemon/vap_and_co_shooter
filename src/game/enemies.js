// Zinzins: single-draw-call skinned rigs (bones + texture atlas), AI (A* chase, melee, ranged, charge, support, kamikaze, boss).
import * as THREE from 'three';
import { genFace } from '../engine/textures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TYPES = {
  client:      { name: 'Client Pressé',       hp: 70,  speed: 2.9, dmg: 7,  range: 1.5, rate: 1.35, scale: 1.0,  score: 100, color: '#3b6bd6', shirt: '50ML ?!', mood: 1, weight: 1 },
  sprinter:    { name: 'Stagiaire Caféiné',   hp: 40,  speed: 5.2, dmg: 5,  range: 1.3, rate: 0.75, scale: 0.9,  score: 120, color: '#d7f06a', shirt: 'STAGE', mood: 2, weight: 0.8, zigzag: true },
  vapoteur:    { name: 'Vapoteur Enragé',     hp: 90,  speed: 2.4, dmg: 11, range: 9,   rate: 1.6,  scale: 1.05, score: 160, color: '#8b4fd6', shirt: 'CLOUD', mood: 2, weight: 1.1, ranged: 'vapor', keep: 5.5 },
  mamie:       { name: 'Mamie CBD',           hp: 240, speed: 1.7, dmg: 22, range: 1.9, rate: 1.5,  scale: 1.08, score: 260, color: '#e2c9a0', shirt: 'CBD ♥', mood: 1, weight: 2.5, hair: '#dedede', glasses: true },
  vigile:      { name: 'Vigile Zinzin',       hp: 150, speed: 2.6, dmg: 7,  range: 12,  rate: 0.85, scale: 1.12, score: 300, color: '#1a1d22', shirt: 'SECU', mood: 1, weight: 1.6, ranged: 'gun', keep: 7, beard: true },
  livreur:     { name: 'Livreur Turbo',       hp: 110, speed: 3.1, dmg: 18, range: 1.6, rate: 1.4,  scale: 1.0,  score: 280, color: '#ff8a1f', shirt: 'EXPRESS', mood: 2, weight: 2.2, charger: true },
  influenceur: { name: 'Influenceur',         hp: 60,  speed: 3.4, dmg: 4,  range: 8,   rate: 3.0,  scale: 0.98, score: 380, color: '#ffd700', shirt: 'LIKE', mood: 1, weight: 0.9, support: true, keep: 7 },
  kamikaze:    { name: 'Vapoteur Explosif',   hp: 50,  speed: 4.2, dmg: 34, range: 1.7, rate: 9,    scale: 0.95, score: 200, color: '#ff3b3b', shirt: 'BOOM', mood: 2, weight: 0.9, kamikaze: true },
  touriste:    { name: 'Touriste à Selfies',   hp: 65,  speed: 2.8, dmg: 3,  range: 9,   rate: 3.2,  scale: 1.0,  score: 220, color: '#ffffff', shirt: 'I ♥ VAPE', mood: 1, weight: 1, ranged: 'selfie', keep: 6, glasses: true },
  mime:        { name: 'Le Mime',              hp: 80,  speed: 3.2, dmg: 12, range: 1.5, rate: 1.2,  scale: 1.0,  score: 260, color: '#111111', shirt: '(…)', mood: 1, weight: 1, mime: true, hair: '#111111' },
  boss:        { name: 'LE PATRON ZINZIN',    hp: 1400, speed: 2.2, dmg: 30, range: 14, rate: 1.2, scale: 1.35, score: 2500, color: '#ff4fa3', shirt: 'PATRON', mood: 3, weight: 6, ranged: 'rocket', keep: 6, boss: true, beard: true },
};
const TAUNTS = ['T\'AS PAS DE 50 ML ?!', 'JE VEUX PARLER AU PATRON', 'C\'EST OÙ LES PROMOS ?', 'VAPOTER C\'EST LA VIE', 'MON CLOUD EST PLUS GROS', 'ZINZIN !!!', 'FRAISE OU MENTHE ?', 'JE SUIS PAS FOU', 'CBD POUR TOUS', 'RENDS-MOI MON FLAMANT', 'VOUS AVEZ DU 3 MG ?', 'LA CAISSE EST LÀ-BAS ?'];
const V = () => new THREE.Vector3();

// ---------------------------------------------------------------- atlas (one 256² texture per zinzin)
const CELLS = { skin: [0, 0, 64, 64], pants: [64, 0, 64, 64], hair: [128, 0, 64, 64], shoe: [192, 0, 64, 64], shirt: [0, 64, 64, 64], accent: [64, 64, 64, 64], metal: [128, 64, 64, 64], white: [192, 64, 64, 64], face: [0, 128, 128, 128], shirtFront: [128, 128, 128, 128] };
function buildAtlas({ skin, shirt, shirtText, pants, hair, accent, face, stripes = false }) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const fill = (cell, col) => { const [cx, cy, w, h] = CELLS[cell]; x.fillStyle = col; x.fillRect(cx, cy, w, h); };
  fill('skin', skin); fill('pants', pants); fill('hair', hair); fill('shoe', '#1a1a1a'); fill('shirt', shirt); fill('accent', accent); fill('metal', '#2a2d33'); fill('white', '#f0f0f0');
  // subtle fabric noise on shirt/pants
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.fillRect(Math.random() * 128, Math.random() * 64 + (Math.random() < 0.5 ? 0 : 64), 2, 1); }
  x.drawImage(face, 0, 128, 128, 128);
  fill('shirtFront', shirt);
  if (stripes) { x.fillStyle = '#f2f2f2'; for (let yy = 64; yy < 128; yy += 16) x.fillRect(0, yy, 64, 8); for (let yy = 128; yy < 256; yy += 32) x.fillRect(128, yy, 128, 16); } for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(128 + Math.random() * 128, 128 + Math.random() * 128, 2, 1); }
  x.fillStyle = 'rgba(255,255,255,.9)'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${shirtText.length > 5 ? 22 : 30}px Inter, Arial, sans-serif`; x.fillText(shirtText, 192, 178);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.font = '700 11px Inter, Arial, sans-serif'; x.fillText('VAP&CO', 192, 214);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
}
function cellUV(cell) { const [cx, cy, w, h] = CELLS[cell]; const i = 2; return [(cx + i) / 256, 1 - (cy + h - i) / 256, (w - 2 * i) / 256, (h - 2 * i) / 256]; }

let uid = 0;
export class Zinzin {
  constructor(sys, type, x, z, opts = {}) {
    this.sys = sys; this.g = sys.g; this.type = type; const T = TYPES[type]; this.T = T; this.id = uid++;
    const diff = this.g.difficulty, waveMul = 1 + (this.g.wave - 1) * 0.11;
    this.hp = this.maxHp = Math.round(T.hp * (0.7 + diff * 0.3) * waveMul * (opts.hpMul || 1)); this.speed = T.speed * (0.9 + Math.random() * 0.25) * (0.85 + diff * 0.15);
    this.pos = new THREE.Vector3(x, this.g.world.floorHeight(x, z), z); this.vel = V(); this.yaw = Math.random() * 6.28; this.targetYaw = this.yaw;
    this.scale = T.scale * (0.94 + Math.random() * 0.12); this.radius = 0.32 * this.scale; this.height = 1.8 * this.scale;
    this.alive = true; this.state = 'spawn'; this.stateT = 0; this.phase = Math.random() * 6; this.attackCd = 1 + Math.random(); this.stagger = 0; this.path = null; this.pathT = Math.random() * 0.5; this.wp = 0;
    this.knock = V(); this.deathT = 0; this.fall = V(); this.tumble = new THREE.Euler(); this.dance = 0; this.frozen = 0; this.lastTaunt = 0; this.trapped = 0; this.buff = 0; this.fuse = -1; this.charge = null; this.chargeCd = 2 + Math.random() * 2; this.slipT = 0; this.slipCd = 0; this.stuck = 0; this.flee = 0; this.wetT = 0; this.sizeMul = 1;
    this.buildRig(opts);
    this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw;
    if (opts.dropIn) { this.pos.y += 6; this.state = 'drop'; this.vel.y = 0; }
  }
  // ---------------------------------------------------------------- rig
  buildRig(opts) {
    const T = this.T, s = this.scale, S = v => v * s;
    const skin = ['#e6b89c', '#c99370', '#8d5a3c', '#f1d1b5', '#a86f4b'][Math.floor(Math.random() * 5)];
    const hair = T.hair || ['#2b1d14', '#5b3b1f', '#111111', '#c9a04a', '#7a1f1f'][Math.floor(Math.random() * 5)];
    const pants = ['#2c3550', '#1f1f22', '#4d3b2c', '#6b6b6b', '#3d2f4f'][Math.floor(Math.random() * 5)];
    const accent = { mamie: '#8b1a3a', vigile: '#111111', boss: '#ffd700', livreur: '#ff8a1f', influenceur: '#ffd700', kamikaze: '#ff3b3b', vapoteur: '#5ef2ff' }[this.type] || '#d7f06a';
    const skinCol = T.mime ? '#f4f4f4' : skin;
    const face = genFace({ skin: skinCol, mood: T.mood, seed: this.id + 1, hair, beard: T.beard, glasses: T.glasses, size: 128 });
    const atlas = buildAtlas({ skin: skinCol, shirt: T.color, shirtText: T.shirt, pants: T.mime ? '#111111' : pants, hair, accent, face: face.image, stripes: !!T.mime }); face.dispose();
    this.mat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8, metalness: 0.02, transparent: !!T.mime, opacity: T.mime ? 0.45 : 1 });
    // bones
    const bones = []; const B = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); bones.push(b); b.userData.rest = parent ? parent.userData.rest.clone().add(b.position) : b.position.clone(); return b; };
    const root = B('root', null, 0, 0, 0);
    const pelvisY = T.boss ? 1.35 : 0.95;
    this.pelvis = B('pelvis', root, 0, S(pelvisY), 0); this.torso = B('torso', this.pelvis, 0, S(0.1), 0); this.head = B('head', this.torso, 0, S(0.54), 0);
    this.arms = []; this.legs = [];
    for (const side of [-1, 1]) { const sh = B('sh', this.torso, side * S(0.25), S(0.44), 0); const el = B('el', sh, 0, S(-0.3), 0); this.arms.push({ sh, el }); }
    for (const side of [-1, 1]) { const hip = B('hip', this.pelvis, side * S(0.11), S(-0.08), 0); const kn = B('kn', hip, 0, S(-0.42), 0); this.legs.push({ hip, kn }); }
    const geos = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1);
    // add a part: geometry in bone-local space, uv remapped to atlas cells; cell may be a function(normal) -> cell name
    const part = (geo, bone, cell, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      if (geo.index) geo = geo.toNonIndexed();
      e.set(rx, ry, rz); q.setFromEuler(e); pv.set(x, y, z); m4.compose(pv, q, sv); geo.applyMatrix4(m4);
      const r = bone.userData.rest; geo.translate(r.x, r.y, r.z);
      const n = geo.attributes.normal, uv = geo.attributes.uv, cnt = geo.attributes.position.count;
      const bi = bones.indexOf(bone); const si = new Float32Array(cnt * 4), sw = new Float32Array(cnt * 4);
      const nrm = new THREE.Vector3(); const cellFor = typeof cell === 'function' ? cell : () => cell;
      for (let i = 0; i < cnt; i++) {
        nrm.set(n.getX(i), n.getY(i), n.getZ(i)); const c = cellUV(cellFor(nrm)); let u = uv.getX(i), v = uv.getY(i); u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
        uv.setXY(i, c[0] + u * c[2], c[1] + v * c[3]); si[i * 4] = bi; sw[i * 4] = 1;
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
      geos.push(geo);
    };
    const RB = (w, h, d, r = 0.05) => new RoundedBoxGeometry(S(w), S(h), S(d), 2, S(r));
    const tr = (g, x, y, z) => { g.translate(S(x), S(y), S(z)); return g; };
    // body
    part(RB(0.38, 0.2, 0.24, 0.06), this.pelvis, 'pants');
    part(tr(RB(0.4, 0.48, 0.23, 0.09), 0, 0.24, 0), this.torso, n => n.z > 0.55 ? 'shirtFront' : 'shirt');
    part(new THREE.CylinderGeometry(S(0.06), S(0.07), S(0.1), 10), this.torso, 'skin', 0, S(0.5), 0);
    part(tr(RB(0.24, 0.28, 0.25, 0.09), 0, 0.14, 0), this.head, n => n.z > 0.6 ? 'face' : (n.y > 0.6 || n.z < -0.6) ? 'hair' : 'skin');
    for (const sx of [-1, 1]) part(new THREE.SphereGeometry(S(0.035), 6, 6), this.head, 'skin', sx * S(0.125), S(0.13), 0);
    for (let i = 0; i < 2; i++) {
      const a = this.arms[i], l = this.legs[i];
      part(new THREE.SphereGeometry(S(0.075), 6, 5), a.sh, 'shirt');
      part(tr(RB(0.12, 0.32, 0.12, 0.04), 0, -0.14, 0), a.sh, 'shirt');
      part(tr(RB(0.1, 0.3, 0.1, 0.04), 0, -0.14, 0), a.el, 'skin');
      part(tr(RB(0.09, 0.11, 0.06, 0.025), 0, -0.33, 0), a.el, 'skin');
      part(tr(RB(0.15, 0.42, 0.16, 0.05), 0, -0.2, 0), l.hip, 'pants');
      part(tr(RB(0.13, 0.42, 0.14, 0.05), 0, -0.2, 0), l.kn, 'pants');
      part(new THREE.BoxGeometry(S(0.14), S(0.08), S(0.26)), l.kn, 'shoe', 0, S(-0.44), S(0.05));
    }
    // type accessories
    const R = this.arms[1].el, L = this.arms[0].el;
    if (this.type === 'vigile') { part(new THREE.CylinderGeometry(S(0.15), S(0.15), S(0.08), 12), this.head, 'metal', 0, S(0.3), 0); part(new THREE.BoxGeometry(S(0.24), S(0.02), S(0.12)), this.head, 'metal', 0, S(0.27), S(0.15)); part(new THREE.BoxGeometry(S(0.05), S(0.06), S(0.24)), R, 'metal', 0, S(-0.3), S(-0.05)); }
    if (this.type === 'mamie') { part(new THREE.SphereGeometry(S(0.1), 8, 8), this.head, 'hair', 0, S(0.33), S(-0.08)); part(new THREE.BoxGeometry(S(0.26), S(0.22), S(0.12)), L, 'accent', 0, S(-0.42), 0); part(new THREE.CylinderGeometry(S(0.015), S(0.015), S(0.9), 6), R, 'shoe', 0, S(-0.6), S(0.05)); }
    if (this.type === 'vapoteur') { part(new THREE.CylinderGeometry(S(0.025), S(0.025), S(0.16), 8), R, 'accent', 0, S(-0.32), S(0.04), 1.2); }
    if (this.type === 'boss') { part(new THREE.CylinderGeometry(S(0.16), S(0.13), S(0.12), 8, 1, true), this.head, 'accent', 0, S(0.34), 0); part(new THREE.CylinderGeometry(S(0.07), S(0.07), S(0.8), 12), R, 'accent', 0, S(-0.3), S(-0.2), Math.PI / 2); }
    if (this.type === 'livreur') { part(new THREE.SphereGeometry(S(0.17), 10, 8), this.head, 'accent', 0, S(0.16), 0); part(new THREE.BoxGeometry(S(0.36), S(0.34), S(0.24)), this.torso, 'accent', 0, S(0.25), S(-0.24)); part(new THREE.BoxGeometry(S(0.16), S(0.16), S(0.08)), this.torso, 'white', 0, S(0.25), S(-0.37)); }
    if (this.type === 'influenceur') { part(new THREE.BoxGeometry(S(0.07), S(0.14), S(0.01)), L, 'accent', 0, S(-0.34), S(0.04)); part(new THREE.TorusGeometry(S(0.09), S(0.012), 6, 16), L, 'white', 0, S(-0.34), S(0.06)); part(new THREE.BoxGeometry(S(0.3), S(0.04), S(0.3)), this.head, 'white', 0, S(0.3), 0); }
    if (this.type === 'touriste') { part(new THREE.CylinderGeometry(S(0.012), S(0.012), S(0.7), 6), R, 'metal', 0, S(-0.3), S(0.3), 1.1); part(new THREE.BoxGeometry(S(0.08), S(0.15), S(0.012)), R, 'white', 0, S(-0.55), S(0.62), 0.3); part(new THREE.BoxGeometry(S(0.36), S(0.06), S(0.2)), this.head, 'accent', 0, S(0.3), S(0.04)); }
    if (this.type === 'mime') { part(new THREE.CylinderGeometry(S(0.16), S(0.12), S(0.05), 12), this.head, 'metal', 0, S(0.3), 0); part(new THREE.BoxGeometry(S(0.3), S(0.04), S(0.3)), this.head, 'accent', S(0.03), S(0.31), 0, 0, 0, 0.15); }
    if (this.type === 'kamikaze') { for (const sx of [-1, 1]) part(new THREE.CylinderGeometry(S(0.06), S(0.06), S(0.34), 10), this.torso, 'accent', sx * S(0.09), S(0.24), S(-0.18)); part(new THREE.BoxGeometry(S(0.3), S(0.1), S(0.06)), this.torso, 'metal', 0, S(0.42), S(-0.18)); }
    const geo = mergeGeometries(geos, false);
    const mesh = new THREE.SkinnedMesh(geo, this.mat); mesh.add(root); mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = true;
    geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6;
    const grp = new THREE.Group(); grp.add(mesh); this.mesh = grp; this.skin = mesh;
    // blob shadow
    const blob = new THREE.Mesh(new THREE.CircleGeometry(S(0.4), 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; grp.add(blob); this.blob = blob;
    if (T.boss) { this.mount = this.g.world.makeFlamingo(0.95); this.mount.position.set(0, S(-0.25), 0); grp.add(this.mount); this.height = 2.6 * s; this.radius = 0.7; }
    this.g.R.scene.add(grp);
  }
  capsule() { return { x: this.pos.x, z: this.pos.z, y0: this.pos.y + 0.05, y1: this.pos.y + this.height, r: this.radius + 0.06 }; }
  get headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height - 0.15, this.pos.z); }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.65, this.pos.z); }

  // ---------------------------------------------------------------- AI
  update(dt, t) {
    const g = this.g, P = g.player, W = g.world;
    if (!this.alive) { this.updateDeath(dt); return; }
    this.stateT += dt; this.attackCd -= dt; this.phase += dt; if (this.buff > 0) this.buff -= dt;
    if (this.state === 'drop') { this.vel.y -= 16 * dt; this.pos.y += this.vel.y * dt; const fy = W.floorHeight(this.pos.x, this.pos.z); if (this.pos.y <= fy) { this.pos.y = fy; this.state = 'chase'; g.fx.dust(this.pos, 8); g.fx.ring(this.pos, { color: 0xffffff, size: 2, life: 0.35 }); g.audio.play('land', this.pos); g.fx.shake = Math.max(g.fx.shake, 0.3); } this.sync(dt); return; }
    if (this.state === 'spawn') { if (this.stateT > 0.6) this.state = 'chase'; this.sync(dt); return; }
    if (this.trapped > 0) { this.trapped -= dt; const fy = W.floorHeight(this.pos.x, this.pos.z); const want = fy + 1.4 + Math.sin(this.phase * 2) * 0.15; this.pos.y += (want - this.pos.y) * (1 - Math.exp(-dt * 3)); this.animate(dt, 0, false, true); this.sync(dt); if (this.trapped <= 0) { this.untrap(); } return; }
    if (this.pos.y > W.floorHeight(this.pos.x, this.pos.z) + 0.05 && this.state !== 'drop') { this.pos.y = Math.max(W.floorHeight(this.pos.x, this.pos.z), this.pos.y - 8 * dt); }
    if (this.frozen > 0) { this.frozen -= dt; this.sync(dt); return; }
    this.slipCd = Math.max(0, this.slipCd - dt); if (this.wetT > 0) this.wetT -= dt;
    if (this.slipT > 0) { this.slipT -= dt; this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-dt * 3)); this.collide(); this.animate(dt, 0, false, false, true); this.sync(dt); return; }
    if (this.stuck > 0) { this.stuck -= dt; this.charge = null; this.animate(dt, 0, false, true); this.sync(dt); return; }
    if (this.dance > 0) { this.dance -= dt; this.animate(dt, 0, true); this.sync(dt); return; }
    // kamikaze fuse
    if (this.fuse >= 0) { this.fuse -= dt; this.mat.emissive.setRGB(1, 0.1, 0.1); this.mat.emissiveIntensity = Math.sin(this.fuse * 40) > 0 ? 0.8 : 0; if (this.fuse <= 0) { this.detonate(); return; } this.animate(dt, 0); this.sync(dt); return; }
    // stagger / knockback
    if (this.stagger > 0) { this.stagger -= dt; this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-dt * 6)); this.collide(); this.animate(dt, 0); this.sync(dt); return; }
    this.knock.multiplyScalar(Math.exp(-dt * 8));
    // charge (livreur)
    if (this.charge) {
      const c = this.charge; c.t -= dt;
      if (c.phase === 'wind') { if (c.t <= 0) { c.phase = 'go'; c.t = 0.75; g.audio.play('dash', this.pos); } }
      else { this.pos.addScaledVector(c.dir, 12 * dt); const before = this.pos.clone(); this.collide(); if (before.distanceToSquared(this.pos) > 0.002 || c.t <= 0) { if (c.t > 0) { this.stagger = 0.8; g.fx.dust(this.pos, 6); g.audio.play('land', this.pos); } this.charge = null; this.chargeCd = 3.5 + Math.random() * 2; }
        else { const d = P.pos.distanceTo(this.pos); if (d < 1.2 && !c.hit) { c.hit = true; g.damagePlayer(this.T.dmg, this); P.vel.add(c.dir.clone().multiplyScalar(9)); P.vel.y += 3; P.onGround = false; g.fx.shake = 1; g.audio.play('punch_hit', this.pos); } for (const o of this.sys.list) { if (o !== this && o.alive && o.pos.distanceTo(this.pos) < 0.9) g.hitEnemy(o, 20, c.dir, 8, false, 'zinzin', o.chest); } g.fx.puff(this.pos.clone().setY(this.pos.y + 0.3), { size: 0.4, life: 0.4, opacity: 0.3, color: 0xffd0a0 }); }
      }
      this.pos.y = W.floorHeight(this.pos.x, this.pos.z); this.animate(dt, c.phase === 'go' ? 6 : 0); this.sync(dt); return;
    }
    const toT = P.pos.clone().sub(this.pos).setY(0); const dist = toT.length();
    const T = this.T; let move = V();
    if (this.losT === undefined || (this.losT -= dt) <= 0) { this.losT = 0.12 + Math.random() * 0.08; this.los = W.hasLineOfSight(this.chest, P.eyePos); } const los = this.los;
    if (!T.mime && t - this.lastTaunt > 9 && Math.random() < dt * 0.15 && dist < 12) { this.lastTaunt = t; g.fx.text(this.headPos.clone().setY(this.headPos.y + 0.35), this.type === 'influenceur' ? 'LIKE ET ABONNE-TOI !' : TAUNTS[Math.floor(Math.random() * TAUNTS.length)], { color: '#ffe', size: 13, life: 1.6, glow: '#000' }); g.audio.play(Math.random() < 0.5 ? 'laugh' : 'grunt', this.pos); }
    if (this.flee > 0) { this.flee -= dt; const away = toT.clone().normalize().multiplyScalar(-1); const sep = this.sys.separation(this); away.add(sep); const spd = this.speed * 1.3; const wantV = away.normalize().multiplyScalar(spd); const k = 1 - Math.exp(-dt * 8); this.vel.x += (wantV.x - this.vel.x) * k; this.vel.z += (wantV.z - this.vel.z) * k; this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.collide(); this.pos.y = W.floorHeight(this.pos.x, this.pos.z); this.targetYaw = Math.atan2(-toT.x, -toT.z); let dy0 = this.targetYaw - this.yaw; dy0 = Math.atan2(Math.sin(dy0), Math.cos(dy0)); this.yaw += dy0 * (1 - Math.exp(-dt * 8)); this.animate(dt, spd); this.sync(dt); return; }
    if (T.mime) { // the mime sneaks toward the player's back
      const back = P.pos.clone().addScaledVector(P.forward(), -1.2); const toB = back.clone().sub(this.pos).setY(0);
      if (dist > T.range && toB.length() > 0.6) move = this.follow(dt, back); else if (dist <= T.range + 0.4 && this.attackCd <= 0) this.meleeAttack();
      this.targetYaw = Math.atan2(toT.x, toT.z);
    } else if (T.ranged || T.support) {
      if (dist > T.keep + 1.5 || (!los && !T.support)) move = this.follow(dt, P.pos); else if (dist < T.keep - 2) move = toT.clone().normalize().multiplyScalar(-1); else { move = new THREE.Vector3(-toT.z, 0, toT.x).normalize().multiplyScalar(Math.sin(this.phase * 0.7) > 0 ? 1 : -1); if (W.isBlocked(this.pos.x + move.x * 0.6, this.pos.z + move.z * 0.6, 0.3, this.pos.y)) move.set(0, 0, 0); }
      if (T.ranged && los && dist < T.range && this.attackCd <= 0) this.shoot();
      if (T.support && this.attackCd <= 0) this.pulse();
      this.targetYaw = Math.atan2(toT.x, toT.z);
    } else if (T.kamikaze) {
      if (dist > T.range) move = this.follow(dt, P.pos); else if (this.fuse < 0) { this.fuse = 0.85; g.fx.text(this.headPos, 'POUR LA VAPE !!!', { color: '#ff3b3b', size: 16 }); g.audio.play('scream', this.pos); }
      this.targetYaw = Math.atan2(toT.x, toT.z);
    } else {
      if (T.charger) { this.chargeCd -= dt; if (this.chargeCd <= 0 && los && dist > 3.5 && dist < 12) { this.charge = { phase: 'wind', t: 0.6, dir: toT.clone().normalize(), hit: false }; this.targetYaw = Math.atan2(toT.x, toT.z); g.fx.text(this.headPos, 'VROUUUM', { color: '#ff8a1f', size: 18 }); g.audio.play('vapor', this.pos); g.fx.ring(this.pos, { color: 0xff8a1f, size: 1.5, life: 0.6 }); this.sync(dt); return; } }
      if (dist > T.range) { move = this.follow(dt, P.pos); if (T.zigzag) { const side = new THREE.Vector3(-move.z, 0, move.x); move.addScaledVector(side, Math.sin(this.phase * 6) * 0.8).normalize(); } }
      else if (this.attackCd <= 0) this.meleeAttack();
      this.targetYaw = Math.atan2(toT.x, toT.z);
    }
    const sep = this.sys.separation(this); move.add(sep);
    const spd = this.speed * (this.g.slowEnemies || 1) * (this.buff > 0 ? 1.35 : 1) * (this.g.waveMod?.fast ? 1.25 : 1);
    const wantV = move.lengthSq() > 0.01 ? move.normalize().multiplyScalar(spd) : V();
    const k = 1 - Math.exp(-dt * 8); this.vel.x += (wantV.x - this.vel.x) * k; this.vel.z += (wantV.z - this.vel.z) * k;
    this.pos.x += (this.vel.x + this.knock.x) * dt; this.pos.z += (this.vel.z + this.knock.z) * dt;
    this.collide();
    this.pos.y = W.floorHeight(this.pos.x, this.pos.z);
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
  meleeAttack() {
    const T = this.T; this.attackCd = T.rate * (0.8 + Math.random() * 0.4); this.swingT = 0.45; this.swingArm = Math.random() < 0.5 ? 0 : 1;
    const g = this.g;
    setTimeout(() => {
      if (!this.alive || g.state !== 'playing' || this.trapped > 0) return;
      const P = g.player; const d = P.pos.distanceTo(this.pos);
      if (d < T.range + 0.5 && Math.abs(P.pos.y - this.pos.y) < 1.2) { g.damagePlayer(T.dmg, this); g.audio.play('punch_hit', this.pos); if (this.type === 'mamie') { P.kickVel.y += 60; P.vel.add(P.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(5)); g.fx.shake = 1; } }
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
    } else if (T.ranged === 'selfie') {
      g.audio.play('shutter', this.pos); g.fx.light(from.clone().addScaledVector(dir, 0.6), 0xffffff, 6, 0.12, 6); g.fx.text(this.headPos.clone().setY(this.headPos.y + 0.35), 'CHEESE !', { color: '#fff', size: 16, glow: '#000' });
      const dist = P.pos.distanceTo(this.pos); const facing = P.lookDir().dot(dir.clone().multiplyScalar(-1)) > 0.55; if (facing && dist < 9) { g.fx.flash = Math.max(g.fx.flash, 0.9); g.fx.flashColor.set(0xffffff); g.ui.toast('Aveuglé par un selfie.', 1.5); g.damagePlayer(T.dmg, this); }
      if (Math.random() < 0.3) g.tts.say(['C\'est pour mon Insta', 'Souriez !', 'Encore une pour la story'][Math.floor(Math.random() * 3)], { priority: 0, pitch: 1.2 });
    } else if (T.ranged === 'rocket') {
      g.audio.play('shot_flamant', this.pos); g.fx.muzzle(from, dir, 0xff4fa3);
      dir.y += 0.08; g.weapons.spawnProjectile(from, dir.normalize(), { key: 'flamant', damage: T.dmg * 2, knock: 12, projectile: { speed: 13, gravity: 1.5, radius: 0.2, explode: 2.6, life: 5 } }, 'enemy');
      if (Math.random() < 0.35) { this.knock.copy(P.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(9)); g.fx.text(this.headPos, 'CHAAARGE !', { color: '#ff4fa3', size: 18 }); }
    }
  }
  // influenceur: buffs and heals nearby zinzins
  pulse() {
    const g = this.g; this.attackCd = this.T.rate; this.swingT = 0.4; this.swingArm = 0;
    g.fx.ring(this.pos, { color: 0xffd700, size: 5, life: 0.7, y: 0.1 }); g.audio.play('coin', this.pos); g.fx.text(this.headPos.clone().setY(this.headPos.y + 0.3), '+1 LIKE', { color: '#ffd700', size: 15 });
    let n = 0; for (const o of this.sys.list) { if (o === this || !o.alive) continue; if (o.pos.distanceTo(this.pos) < 5.5) { o.buff = 4; o.hp = Math.min(o.maxHp, o.hp + 12); n++; } }
    if (n) g.fx.text(this.headPos.clone().setY(this.headPos.y + 0.6), `${n} ABONNÉS`, { color: '#fff', size: 12, glow: '#ffd700' });
  }
  detonate() {
    if (!this.alive) return; const g = this.g; this.fuse = -1;
    this.hp = 0; this.alive = false; this.dead = true; this.remove = true; this.dispose();
    g.explode(this.chest, 3, 60, 'enemy', 'kamikaze'); g.stats.kills++; g.waves.onKill();
  }
  slip(label = 'GLISSADE !') {
    if (!this.alive || this.slipCd > 0 || this.T.boss) return false; this.slipT = 1.3; this.slipCd = 3.5; this.charge = null;
    this.knock.set(this.vel.x * 0.6 + (Math.random() - 0.5) * 2, 0, this.vel.z * 0.6 + (Math.random() - 0.5) * 2); this.vel.set(0, 0, 0);
    this.g.fx.text(this.headPos, label, { color: '#ffef6a', size: 16, glow: '#000' }); this.g.audio.play('slip', this.pos); this.g.fx.dust(this.pos, 3); return true;
  }
  setSize(m) { this.sizeMul = m; this.mesh.scale.setScalar(m); this.radius = 0.32 * this.scale * m; this.height = 1.8 * this.scale * m * (this.T.boss ? 1.44 : 1); if (this.T.boss) this.radius = 0.7 * m; this.blob.scale.setScalar(1); }
  trap(dur = 4) {
    if (!this.alive || this.T.boss) return false; this.trapped = dur; this.charge = null; this.fuse = -1; this.vel.set(0, 0, 0);
    if (!this.bubble) { this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, envMapIntensity: 1.8, depthWrite: false })); this.mesh.add(this.bubble); }
    this.bubble.visible = true; const r = this.height * 0.62; this.bubble.scale.setScalar(r); this.bubble.position.y = this.height * 0.5;
    this.g.fx.text(this.headPos, 'BULLE !', { color: '#5ef2ff', size: 16 }); return true;
  }
  untrap() { this.trapped = 0; if (this.bubble) this.bubble.visible = false; this.g.fx.burst(this.chest, 14, { speed: 2, color: [0.7, 0.9, 1], life: 0.5, size: 0.04, grav: 2 }); this.g.audio.play('bottle', this.pos); this.stagger = 0.3; }
  // ---------------------------------------------------------------- damage
  hurt(amount, dir, knock = 3, head = false) {
    if (!this.alive) return false;
    if (this.trapped > 0) { amount *= 1.6; this.untrap(); }
    this.hp -= amount; const T = this.T;
    const kb = knock / Math.sqrt(T.weight); this.knock.addScaledVector(dir.clone().setY(0).normalize(), kb);
    if (!this.charge) this.stagger = Math.max(this.stagger, T.boss ? 0.08 : Math.min(0.45, 0.12 + kb * 0.03)); this.hitFlash = 0.09;
    if (this.hp <= 0) { this.die(dir, knock); if (T.kamikaze) this.g.explode(this.chest, 2, 30, 'enemy', 'kamikaze'); return true; }
    return false;
  }
  die(dir, knock) {
    this.alive = false; this.deathT = 0; this.dead = true; this.hp = 0; this.trapped = 0; if (this.bubble) this.bubble.visible = false;
    const k = Math.max(3, knock) / Math.sqrt(this.T.weight); this.fall.copy(dir).setY(0).normalize().multiplyScalar(k * 1.2); this.fall.y = 2 + k * 0.4;
    this.tumbleV = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6); this.tumble.set(0, this.yaw, 0);
    if (this.T.mime) this.g.fx.text(this.headPos, '…', { color: '#fff', size: 30, glow: '#000', life: 2 }); else this.g.audio.play('scream', this.pos); this.mat.emissive.setRGB(0, 0, 0);
    if (this.mount) this.mount.visible = false;
  }
  updateDeath(dt) {
    this.deathT += dt; const W = this.g.world;
    if (this.deathT < 3.0) {
      this.fall.y -= 14 * dt; this.pos.addScaledVector(this.fall, dt); const fy = W.floorHeight(this.pos.x, this.pos.z);
      if (this.pos.y < fy) { this.pos.y = fy; if (this.fall.y < -3) { this.g.fx.dust(this.pos, 4); this.g.audio.play('land', this.pos); } this.fall.y = -this.fall.y * 0.3; this.fall.x *= 0.6; this.fall.z *= 0.6; this.tumbleV.multiplyScalar(0.5); }
      this.collide();
      this.tumble.x += this.tumbleV.x * dt; this.tumble.z += this.tumbleV.z * dt; this.tumble.y += this.tumbleV.y * dt;
      if (this.pos.y <= fy + 0.01) { const tx = Math.PI / 2 * Math.sign(Math.sin(this.tumble.x) || 1); this.tumble.x += (tx - this.tumble.x) * (1 - Math.exp(-dt * 4)); this.tumble.z *= Math.exp(-dt * 3); this.tumbleV.multiplyScalar(Math.exp(-dt * 6)); }
      this.mesh.position.set(this.pos.x, this.pos.y + (Math.abs(Math.sin(this.tumble.x)) * 0.35 + 0.05) * this.scale, this.pos.z); this.mesh.rotation.copy(this.tumble);
      for (const a of this.arms) { a.sh.rotation.x += (1.4 - a.sh.rotation.x) * dt * 3; a.el.rotation.x += (0.6 - a.el.rotation.x) * dt * 3; }
      for (const l of this.legs) { l.hip.rotation.x *= Math.exp(-dt * 3); l.kn.rotation.x *= Math.exp(-dt * 3); }
      this.blob.visible = false;
    } else if (this.deathT < 3.9) { const k = (this.deathT - 3.0) / 0.9; this.mesh.position.y -= dt * 0.8; if (!this.mat.transparent) { this.mat.transparent = true; this.mat.needsUpdate = true; } this.mat.opacity = (this.T.mime ? 0.45 : 1) * (1 - k); }
    else this.remove = true;
  }
  // ---------------------------------------------------------------- animation
  animate(dt, speed, dancing = false, floating = false, slipping = false) {
    const s = this.scale, T = this.T; const moving = Math.min(1, speed / 2.5);
    if (slipping) { const k = Math.min(1, (1.3 - this.slipT) * 4); this.pelvis.position.y = (T.boss ? 1.35 : 0.95) * s * (1 - 0.55 * k); this.pelvis.rotation.set(-1.4 * k, 0, 0); this.torso.rotation.set(0.2 * k, 0, 0); this.head.rotation.set(-0.4 * k, 0, 0); for (let i = 0; i < 2; i++) { this.arms[i].sh.rotation.set(-2.8 * k, 0, (i ? -1 : 1) * 0.9 * k); this.arms[i].el.rotation.x = -0.4; this.legs[i].hip.rotation.x = -1.3 * k + Math.sin(this.phase * 12 + i) * 0.3 * k; this.legs[i].kn.rotation.x = 0.6 * k; } return; }
    this.walkPhase = (this.walkPhase || 0) + dt * (T.boss ? 5 : 7 + speed * 2) * moving; const p = this.walkPhase; const sw = Math.sin(p);
    if (this.swingT > 0) this.swingT -= dt;
    const baseY = (T.boss ? 1.35 : 0.95) * s;
    if (dancing || floating) { const d = this.phase * (floating ? 5 : 9); this.pelvis.position.y = baseY + Math.abs(Math.sin(d)) * 0.08; this.pelvis.rotation.set(floating ? 0.3 : 0, Math.sin(d * 0.5) * 0.4, floating ? Math.sin(d) * 0.3 : 0); this.torso.rotation.set(0, 0, Math.sin(d) * 0.2); this.head.rotation.set(Math.sin(d * 2) * 0.2, 0, Math.cos(d) * 0.3); for (let i = 0; i < 2; i++) { this.arms[i].sh.rotation.set(-2.6 + Math.sin(d + i) * 0.5, 0, (i ? -1 : 1) * 0.6); this.arms[i].el.rotation.x = -0.6; this.legs[i].hip.rotation.x = Math.sin(d + i * 3.14) * 0.5; this.legs[i].kn.rotation.x = 0.3; } return; }
    this.pelvis.position.y = baseY + Math.abs(sw) * 0.03 * moving + (T.boss ? Math.sin(this.phase * 2) * 0.08 : 0);
    this.pelvis.rotation.set(0, sw * 0.08 * moving, Math.cos(p) * 0.04 * moving);
    this.torso.rotation.set(0.12 + (this.stagger > 0 ? -0.3 : 0) + (T.zigzag || T.charger ? 0.3 : 0) + (this.type === 'mamie' ? 0.25 : 0), -sw * 0.15 * moving, 0);
    this.head.rotation.set(Math.sin(this.phase * 3) * 0.06 + (T.mood >= 2 ? Math.sin(this.phase * 11) * 0.08 : 0), Math.sin(this.phase * 1.7) * 0.15, Math.sin(this.phase * 5) * 0.05 * (T.mood >= 2 ? 1 : 0));
    for (let i = 0; i < 2; i++) {
      const sgn = i ? 1 : -1; const a = this.arms[i], l = this.legs[i];
      const zombie = T.mood >= 2 && !T.ranged && !T.support;
      let ax = zombie ? -1.3 + Math.sin(this.phase * 4 + i) * 0.2 : sgn * sw * 0.6 * moving - 0.2, ex = zombie ? -0.3 : -0.5 - Math.abs(sw) * 0.3 * moving;
      if ((T.ranged) && i === 1) { ax = -1.35; ex = -0.2; }
      if (T.support && i === 0) { ax = -2.4; ex = -0.9; }
      if (T.charger) { ax = -1.0; ex = -0.9; }
      if (this.swingT > 0 && i === this.swingArm) { const k = this.swingT / 0.45; ax = -2.2 + (1 - k) * 2.6; ex = -0.9 + (1 - k) * 0.6; }
      a.sh.rotation.set(ax, 0, sgn * 0.15); a.el.rotation.x = ex;
      if (T.boss) { l.hip.rotation.x = -1.2; l.kn.rotation.x = 1.4; continue; }
      l.hip.rotation.x = -sgn * sw * 0.7 * moving; l.kn.rotation.x = Math.max(0, sgn * Math.cos(p)) * 0.9 * moving + 0.05;
    }
    if (this.mount) { this.mount.position.y = -0.25 * s + Math.sin(this.phase * 2) * 0.08; this.mount.rotation.z = Math.sin(this.phase * 1.5) * 0.06; }
    if (this.hitFlash > 0) { this.hitFlash -= dt; const f = this.hitFlash > 0 ? 0.35 : 0; this.mat.emissive.setRGB(f, f * 0.25, f * 0.3); this.mat.emissiveIntensity = 1; this.wasFlash = true; }
    else if (this.wasFlash) { this.mat.emissive.setRGB(this.buff > 0 ? 0.25 : 0, this.buff > 0 ? 0.2 : 0, 0); this.wasFlash = false; }
    else if (this.buff > 0) { this.mat.emissive.setRGB(0.25, 0.2, 0); this.wasFlash = true; }
  }
  sync(dt) { if (this.alive) { this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, this.yaw, 0); } }
  dispose() { if (this.disposed) return; this.disposed = true; this.g.R.scene.remove(this.mesh); this.skin.geometry.dispose(); this.mat.map.dispose(); this.mat.dispose(); if (this.bubble) { this.bubble.geometry.dispose(); this.bubble.material.dispose(); } }
}

export class Enemies {
  constructor(game) { this.g = game; this.list = []; }
  spawn(type, x, z, opts = {}) { const e = new Zinzin(this, type, x, z, opts); this.list.push(e); this.g.folie?.onSpawn?.(e); return e; }
  separation(e) {
    const out = new THREE.Vector3();
    for (const o of this.list) { if (o === e || !o.alive) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z; const d = Math.hypot(dx, dz); const min = e.radius + o.radius + 0.15; if (d < min && d > 1e-4) { const f = (min - d) / min; out.x += dx / d * f * 2.5; out.z += dz / d * f * 2.5; } }
    const P = this.g.player; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const d = Math.hypot(dx, dz); if (d < e.radius + 0.5 && d > 1e-4) { out.x += dx / d * 1.5; out.z += dz / d * 1.5; }
    return out;
  }
  update(dt, t) {
    for (let i = this.list.length - 1; i >= 0; i--) { const e = this.list[i]; if (e.remove) { this.list.splice(i, 1); continue; } e.update(dt, t); if (e.remove) { e.dispose(); this.list.splice(i, 1); } }
  }
  get alive() { return this.list.filter(e => e.alive); }
  clear() { for (const e of this.list) e.dispose(); this.list.length = 0; }
}
