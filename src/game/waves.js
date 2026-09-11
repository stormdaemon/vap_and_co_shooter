// Wave director: composition, spawn points, intermissions, bosses, drops, wave modifiers.
import * as THREE from 'three';

const WAVE_NAMES = ['Ouverture du magasin', 'Rush du samedi', 'Promo -10%', 'Rupture de 50 ml', 'LE PATRON ARRIVE', 'Soldes d\'été', 'Livraison en retard', 'Inventaire de nuit', 'Black Friday', 'RETOUR DU PATRON', 'Zinzins Anonymes', 'Le comptoir végétal', 'Nuage toxique', 'Vape-in de protestation', 'LE PATRON ULTIME'];
const SPAWNS = { door: [5.4, 11.9], staff: [7.6, -0.45], mezz: [-6.2, -11.2] };
export const MODS = {
  none: null,
  fast: { key: 'fast', name: 'TURBO', desc: 'Zinzins +25 % vitesse · score ×1,5', color: '#ffb347', scoreMul: 1.5 },
  blackout: { key: 'blackout', name: 'PANNE DE COURANT', desc: 'Lumières coupées · lampe torche (L) · score ×2', color: '#b58cff', scoreMul: 2 },
  double: { key: 'double', name: 'HAPPY HOUR', desc: 'Tous les points doublés', color: '#d7f06a', scoreMul: 2 },
  fiesta: { key: 'fiesta', name: 'FIESTA CBD', desc: 'Disco permanent · les zinzins dansent par moments', color: '#ff4fa3', scoreMul: 1.3 },
  pluie: { key: 'pluie', name: 'PLUIE DE POWER-UPS', desc: 'Les zinzins lâchent 3× plus de bonus', color: '#5ef2ff', scoreMul: 1 },
  costauds: { key: 'costauds', name: 'ZINZINS COSTAUDS', desc: 'Moins nombreux mais +60 % de vie · score ×1,6', color: '#ff3b3b', scoreMul: 1.6, hpMul: 1.6, countMul: 0.65 },
  kamikazes: { key: 'kamikazes', name: 'SOIRÉE EXPLOSIVE', desc: 'Beaucoup de vapoteurs explosifs · score ×1,4', color: '#ff8a1f', scoreMul: 1.4 },
};

export class Waves {
  constructor(game) { this.g = game; this.reset(); }
  reset() { this.wave = 0; this.state = 'idle'; this.timer = 0; this.toSpawn = []; this.spawnT = 0; this.spawned = 0; this.killed = 0; this.total = 0; this.pending = []; this.g.waveMod = null; }
  start() { this.wave = 0; this.nextWave(4); }
  nextWave(delay = 8) { this.state = 'intermission'; this.timer = delay; this.g.ui.setWaveState(`Prochaine vague dans ${Math.ceil(delay)} s`); this.g.onIntermission?.(true); }
  pickMod(n) {
    if (n < 3 || n % 5 === 0) return null; if (Math.random() < 0.35) return null;
    const keys = ['fast', 'double', 'pluie', 'costauds']; if (n >= 4) keys.push('blackout', 'fiesta'); if (n >= 6) keys.push('kamikazes');
    return MODS[keys[Math.floor(Math.random() * keys.length)]];
  }
  compose(n, mod) {
    const list = [];
    const isBoss = n % 5 === 0;
    let count = Math.min(46, Math.round((6 + n * 2.6) * (0.75 + this.g.difficulty * 0.25)) * (mod?.countMul || 1));
    const pool = [['client', 10]]; if (n >= 2) pool.push(['sprinter', 5 + n]); if (n >= 3) pool.push(['vapoteur', 4 + n * 0.8]); if (n >= 4) pool.push(['mamie', 2 + n * 0.5], ['livreur', 2 + n * 0.4]); if (n >= 5) pool.push(['vigile', 2 + n * 0.6], ['kamikaze', 1.5 + n * 0.4]); if (n >= 6) pool.push(['influenceur', 1.5 + n * 0.2]); if (n >= 3) pool.push(['touriste', 1.5 + n * 0.4]); if (n >= 5) pool.push(['mime', 1.5 + n * 0.4]);
    if (mod?.key === 'kamikazes') pool.push(['kamikaze', 25]);
    const tot = pool.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < count; i++) { let r = Math.random() * tot; let t = 'client'; for (const [k, w] of pool) { r -= w; if (r <= 0) { t = k; break; } } list.push(t); }
    if (isBoss) { list.splice(Math.floor(list.length * 0.3), 0, 'boss'); if (n >= 10) list.splice(Math.floor(list.length * 0.7), 0, 'boss'); }
    return list;
  }
  beginWave() {
    this.wave++; this.g.wave = this.wave; this.state = 'active'; this.g.onIntermission?.(false);
    const mod = this.pickMod(this.wave); this.g.setWaveMod(mod);
    this.toSpawn = this.compose(this.wave, mod); this.total = this.toSpawn.length; this.spawned = 0; this.killed = 0; this.spawnT = 1.2;
    const name = WAVE_NAMES[(this.wave - 1) % WAVE_NAMES.length];
    this.g.ui.announce(`VAGUE ${this.wave}`, mod ? `${mod.name} · ${mod.desc}` : name); this.g.audio.play('wave'); this.g.audio.setIntensity(Math.min(1, 0.3 + this.wave * 0.08));
    if (this.wave % 5 === 0) setTimeout(() => { this.g.ui.announce('LE PATRON ZINZIN', this.wave >= 10 ? 'Ils sont deux. Deux flamants. Deux bazookas.' : 'Il chevauche le flamant. Il a une bazooka. Il veut son 50 ml.'); this.g.audio.play('boss'); }, 2500);
    if (this.wave === 1) this.g.ui.toast('Des armes sont cachées dans le magasin : une près de la plante de l\'entrée.', 6);
    if (this.wave === 2) this.g.ui.toast('Astuce : courez + C pour glisser, double-tap une direction pour dasher, G pour lancer une Gummy-Bombe.', 7);
    if (this.wave === 3) this.g.ui.toast('Tirez sur le flamant rose du kiosque. Faites-nous confiance. Entre les vagues : boutique à la caisse (F).', 7);
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
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { this.pending.splice(i, 1); g.enemies.spawn(p.type, p.x, p.z, { dropIn: true, hpMul: g.waveMod?.hpMul || 1 }); } }
    const alive = g.enemies.alive.length; const cap = Math.min(20, 7 + this.wave * 1.5);
    this.spawnT -= dt;
    if (this.toSpawn.length && this.spawnT <= 0 && alive + this.pending.length < cap) {
      const burst = Math.min(this.toSpawn.length, 1 + Math.floor(Math.random() * (this.wave > 3 ? 3 : 2)));
      for (let b = 0; b < burst; b++) {
        const type = this.toSpawn.shift(); const s = this.pickSpawn(type);
        if (s.drop) { this.pending.push({ type, x: s.x, z: s.z, t: 1.0 }); g.fx.ring(new THREE.Vector3(s.x, g.world.floorHeight(s.x, s.z), s.z), { color: type === 'boss' ? 0xff4fa3 : 0xd7f06a, size: 2.2, life: 1.0, y: 0.06 }); }
        else { g.enemies.spawn(type, s.x, s.z, { hpMul: g.waveMod?.hpMul || 1 }); if (s.door) { g.world.doorForce = g.time + 2; g.audio.play('door', new THREE.Vector3(s.x, 1, s.z)); } }
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
    const bonus = Math.round(500 * this.wave * (g.waveMod?.scoreMul || 1));
    g.ui.announce('VAGUE TERMINÉE', `+${bonus} pts · boutique ouverte à la caisse (F)`); g.score += bonus; g.audio.play('powerup');
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30); g.setWaveMod(null);
    const P = g.player.pos; const fw = g.player.forward(); const p = new THREE.Vector3(P.x + fw.x * 2, 0, P.z + fw.z * 2); const [nx, nz] = g.world.nav.nearestFree(p.x, p.z); p.set(nx, 0, nz);
    const owned = Object.keys(g.weapons.inv); if (owned.length) g.weapons.drop(owned[Math.floor(Math.random() * owned.length)], p, 1, 'MUNITIONS');
    const pu = ['slowmo', 'boost', 'shield', 'disco', 'ammo', 'heal', 'rage', 'magnet'][Math.floor(Math.random() * 8)]; g.weapons.dropPowerup(pu, new THREE.Vector3(nx + 1, 0, nz));
    if (this.wave === 1) { g.weapons.drop('fumi', new THREE.Vector3(4.94, 0, 3.65)); g.ui.toast('Nouvelle cache : Fumigène 3000 derrière le chariot.', 5); }
    if (this.wave === 2) { g.weapons.drop('gummy', new THREE.Vector3(-4.96, 0, -0.74)); g.weapons.drop('grenade', new THREE.Vector3(2.75, 0, -4.9), 1, 'GUMMY-BOMBES'); g.ui.toast('Nouvelles caches : Mitrailleuse à Gummies (table haute) et Gummy-Bombes (vitrines).', 6); }
    if (this.wave === 3) { g.weapons.drop('flamant', new THREE.Vector3(-1.28, 0, -11.04)); g.ui.toast('Nouvelle cache : Lance-Flamant derrière le comptoir.', 5); }
    if (this.wave === 4) { g.weapons.drop('laser', new THREE.Vector3(-6.0, 0, 8.6)); g.ui.toast('Nouvelle cache : Rayon Botanique près de la table à chicha.', 5); }
    if (this.wave === 6) { g.weapons.drop('seche', new THREE.Vector3(7.3, 0, -1.4)); g.ui.toast('Nouvelle cache : Sèche-Cheveux 9000 près des WC équipe. Oui.', 6); }
    if (this.wave === 5) { g.weapons.drop('bulles', new THREE.Vector3(-5.2, 3.5, -11.3)); g.ui.toast('Nouvelle cache : Canon à Bulles sur la mezzanine.', 5); }
    if (this.wave >= 6 && this.wave % 2 === 0) g.weapons.drop('grenade', p.clone().add(new THREE.Vector3(-1, 0, 0)), 1, 'GUMMY-BOMBES');
    this.nextWave(this.wave % 5 === 0 ? 14 : 11);
  }
}
