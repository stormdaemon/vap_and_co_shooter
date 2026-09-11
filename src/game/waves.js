// Wave director: composition, spawn points, intermissions, bosses, drops.
import * as THREE from 'three';
import { TYPES } from './enemies.js';

const WAVE_NAMES = ['Ouverture du magasin', 'Rush du samedi', 'Promo -10%', 'Rupture de 50 ml', 'LE PATRON ARRIVE', 'Soldes d\'été', 'Livraison en retard', 'Inventaire de nuit', 'Black Friday', 'RETOUR DU PATRON', 'Zinzins Anonymes', 'Le comptoir végétal', 'Nuage toxique', 'Vape-in de protestation', 'LE PATRON ULTIME'];
const SPAWNS = { door: [5.4, 11.9], staff: [7.6, -0.45], mezz: [-6.2, -11.2] };

export class Waves {
  constructor(game) { this.g = game; this.reset(); }
  reset() { this.wave = 0; this.state = 'idle'; this.timer = 0; this.toSpawn = []; this.spawnT = 0; this.spawned = 0; this.killed = 0; this.total = 0; this.pending = []; this.bossAlive = false; }
  start() { this.wave = 0; this.nextWave(4); }
  nextWave(delay = 8) { this.state = 'intermission'; this.timer = delay; this.g.ui.setWaveState(`Prochaine vague dans ${Math.ceil(delay)} s`); }
  compose(n) {
    const list = [];
    const isBoss = n % 5 === 0;
    const count = Math.min(46, Math.round((6 + n * 2.6) * (0.75 + this.g.difficulty * 0.25)));
    const pool = [['client', 10]]; if (n >= 2) pool.push(['sprinter', 5 + n]); if (n >= 3) pool.push(['vapoteur', 4 + n * 0.8]); if (n >= 4) pool.push(['mamie', 2 + n * 0.5]); if (n >= 5) pool.push(['vigile', 2 + n * 0.6]);
    const tot = pool.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < count; i++) { let r = Math.random() * tot; let t = 'client'; for (const [k, w] of pool) { r -= w; if (r <= 0) { t = k; break; } } list.push(t); }
    if (isBoss) { list.splice(Math.floor(list.length * 0.3), 0, 'boss'); }
    return list;
  }
  beginWave() {
    this.wave++; this.g.wave = this.wave; this.state = 'active'; this.toSpawn = this.compose(this.wave); this.total = this.toSpawn.length; this.spawned = 0; this.killed = 0; this.spawnT = 1.2;
    const name = WAVE_NAMES[(this.wave - 1) % WAVE_NAMES.length];
    this.g.ui.announce(`VAGUE ${this.wave}`, name); this.g.audio.play('wave'); this.g.audio.setIntensity(Math.min(1, 0.3 + this.wave * 0.08));
    if (this.wave % 5 === 0) setTimeout(() => { this.g.ui.announce('LE PATRON ZINZIN', 'Il chevauche le flamant. Il a une bazooka. Il veut son 50 ml.'); this.g.audio.play('boss'); }, 2500);
    if (this.wave === 1) this.g.ui.toast('Des armes sont cachées dans le magasin : une près de la plante de l\'entrée.', 6);
    if (this.wave === 2) this.g.ui.toast('Astuce : courez + C pour glisser, double-tap une direction pour dasher.', 6);
    if (this.wave === 3) this.g.ui.toast('Tirez sur le flamant rose du kiosque. Faites-nous confiance.', 6);
  }
  pickSpawn(type) {
    const P = this.g.player.pos, W = this.g.world;
    const far = (x, z) => Math.hypot(x - P.x, z - P.z) > 6;
    const r = Math.random();
    if (type === 'boss') return { x: 5.0, z: 11.0, drop: true };
    if (r < 0.35 && far(...SPAWNS.door)) return { x: SPAWNS.door[0] + (Math.random() - 0.5) * 1.2, z: SPAWNS.door[1], door: true };
    if (r < 0.55 && far(...SPAWNS.staff)) return { x: SPAWNS.staff[0], z: SPAWNS.staff[1] + (Math.random() - 0.5) * 0.6 };
    if (r < 0.62 && far(...SPAWNS.mezz)) return { x: SPAWNS.mezz[0] + (Math.random() - 0.5), z: SPAWNS.mezz[1] };
    for (let k = 0; k < 30; k++) { const [x, z] = W.nav.randomFree(); if (far(x, z) && Math.hypot(x - P.x, z - P.z) < 16 && W.floorHeight(x, z) < 1) return { x, z, drop: true }; }
    return { x: SPAWNS.door[0], z: SPAWNS.door[1], door: true };
  }
  update(dt) {
    const g = this.g;
    if (this.state === 'intermission') {
      this.timer -= dt; g.ui.setWaveState(`Prochaine vague dans ${Math.max(0, Math.ceil(this.timer))} s`);
      if (this.timer <= 0) this.beginWave();
      return;
    }
    if (this.state !== 'active') return;
    // pending drop-ins (telegraphed)
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { this.pending.splice(i, 1); g.enemies.spawn(p.type, p.x, p.z, { dropIn: true }); } }
    // trickle spawns
    const alive = g.enemies.alive.length; const cap = Math.min(18, 7 + this.wave * 1.5);
    this.spawnT -= dt;
    if (this.toSpawn.length && this.spawnT <= 0 && alive + this.pending.length < cap) {
      const burst = Math.min(this.toSpawn.length, 1 + Math.floor(Math.random() * (this.wave > 3 ? 3 : 2)));
      for (let b = 0; b < burst; b++) {
        const type = this.toSpawn.shift(); const s = this.pickSpawn(type);
        if (s.drop) { this.pending.push({ type, x: s.x, z: s.z, t: 1.0 }); g.fx.ring(new THREE.Vector3(s.x, g.world.floorHeight(s.x, s.z), s.z), { color: type === 'boss' ? 0xff4fa3 : 0xd7f06a, size: 2.2, life: 1.0, y: 0.06 }); }
        else { g.enemies.spawn(type, s.x, s.z); if (s.door) { g.world.doorForce = g.time + 2; g.audio.play('door', new THREE.Vector3(s.x, 1, s.z)); } }
        this.spawned++;
      }
      this.spawnT = Math.max(0.35, 1.6 - this.wave * 0.08) * (0.7 + Math.random() * 0.6);
    }
    const left = this.toSpawn.length + this.pending.length + alive;
    g.ui.setWaveState(`${left} zinzin${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`);
    if (left === 0) this.endWave();
  }
  onKill() { this.killed++; }
  endWave() {
    const g = this.g; this.state = 'done';
    g.ui.announce('VAGUE TERMINÉE', `+${500 * this.wave} pts de survie · le magasin respire`); g.score += 500 * this.wave; g.audio.play('powerup');
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30);
    // rewards: ammo + powerup near the player
    const P = g.player.pos; const fw = g.player.forward(); const p = new THREE.Vector3(P.x + fw.x * 2, 0, P.z + fw.z * 2); const [nx, nz] = g.world.nav.nearestFree(p.x, p.z); p.set(nx, 0, nz);
    const owned = Object.keys(g.weapons.inv); if (owned.length) g.weapons.drop(owned[Math.floor(Math.random() * owned.length)], p, 1, 'MUNITIONS');
    const pu = ['slowmo', 'boost', 'shield', 'disco', 'ammo', 'heal'][Math.floor(Math.random() * 6)]; g.weapons.dropPowerup(pu, new THREE.Vector3(nx + 1, 0, nz));
    // unlock hints / new caches
    if (this.wave === 1) { g.weapons.drop('fumi', new THREE.Vector3(4.94, 0, 3.65)); g.ui.toast('Nouvelle cache : Fumigène 3000 derrière le chariot.', 5); }
    if (this.wave === 2) { g.weapons.drop('gummy', new THREE.Vector3(-4.96, 0, -0.74)); g.ui.toast('Nouvelle cache : Mitrailleuse à Gummies près de la table haute.', 5); }
    if (this.wave === 3) { g.weapons.drop('flamant', new THREE.Vector3(-1.28, 0, -11.04)); g.ui.toast('Nouvelle cache : Lance-Flamant derrière le comptoir.', 5); }
    this.nextWave(this.wave % 5 === 0 ? 12 : 9);
  }
}
