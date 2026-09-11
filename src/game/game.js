// Game orchestrator: state machine, combat resolution, power-ups, score/combo, menus.
import * as THREE from 'three';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { Weapons, WEAPONS } from './weapons.js';
import { Enemies } from './enemies.js';
import { Waves } from './waves.js';
import { UI } from './ui.js';

const $ = s => document.querySelector(s);
const PU = {
  slowmo: { name: 'MENTHE GLACIALE', color: '#5ef2ff', dur: 6 }, boost: { name: 'BOOSTER NICOTINE', color: '#ffb347', dur: 9 }, shield: { name: 'BOUCLIER VITRINE', color: '#d7f06a', dur: 10 },
  disco: { name: 'DISCO CBD', color: '#ff4fa3', dur: 7 }, ammo: { name: 'MÉGA-GUMMIES', color: '#b58cff', dur: 2 }, heal: { name: 'TISANE CBD', color: '#9be36a', dur: 2 },
};

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.state = 'menu'; this.time = 0; this.speed = 1; this.difficulty = 1; this.wave = 0; this.score = 0; this.combo = 1; this.comboT = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, whiffs: 0, bottles: 0, bestCombo: 1, time: 0 };
    this.powerups = {}; this.slowEnemies = 1; this.flamingoHP = 180; this.debugCam = null; this.shakeOn = true;
    this.world.doorForce = 0;
  }
  async init() {
    this.audio = new Audio();
    this.fx = new FX(this.R.scene, this.R.camera, this.world, this.quality);
    this.ui = new UI(this);
    this.weapons = new Weapons(this);
    this.enemies = new Enemies(this);
    this.waves = new Waves(this);
    this.R.scene.add(this.R.camera); // so the viewmodel renders
    const P = this.player;
    P.onFootstep = (run) => this.audio.play('footstep', null, { run });
    P.onJump = () => this.audio.play('jump'); P.onLand = (v) => { this.audio.play('land'); if (v > 7) this.fx.dust(P.pos, 4); };
    P.onDash = () => { this.audio.play('dash'); this.fx.shake = Math.max(this.fx.shake, 0.3); this.R.grade.uniforms.uChroma.value = 0.02; };
    P.onSlide = () => this.audio.play('slide');
    P.onDamage = (a, from) => { this.ui.damageFrom(from?.pos || from); this.audio.play('hurt'); };
    // menu wiring
    $('#btnPlay').addEventListener('click', () => this.start());
    document.querySelectorAll('#difficulty button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#difficulty button').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); this.difficulty = +b.dataset.diff; }));
    document.querySelectorAll('#quality button').forEach(b => b.addEventListener('click', () => { localStorage.setItem('vc_quality', b.dataset.q); location.search = '?q=' + b.dataset.q; }));
    $('#btnResume').addEventListener('click', () => this.resume()); $('#btnRestart').addEventListener('click', () => this.start()); $('#btnMenu').addEventListener('click', () => this.showMenu());
    $('#chkMusic').addEventListener('change', e => this.audio.setMusic(e.target.checked)); $('#chkShake').addEventListener('change', e => this.shakeOn = e.target.checked); $('#chkFps').addEventListener('change', e => this.ui.showFps = e.target.checked);
    $('#rngSens').addEventListener('input', e => this.input.sens = +e.target.value); $('#rngFov').addEventListener('input', e => { this.player.fovBase = +e.target.value; });
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'playing') this.pause(); };
    window.addEventListener('keydown', e => { if (e.code === 'Escape') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); } if (e.code === 'Enter' && this.state === 'over') this.start(); });
    this.hs = +(localStorage.getItem('vc_highscore') || 0); this.updateHighscore();
  }
  updateHighscore() { const hw = +(localStorage.getItem('vc_highwave') || 0); $('#highscore').innerHTML = this.hs ? `MEILLEUR SCORE<b>${this.hs.toLocaleString('fr-FR')}</b>vague ${hw}` : ''; }
  showMenu() { this.state = 'menu'; $('#intro').classList.remove('hidden'); $('#hud').classList.add('hidden'); this.ui.hideOverlay(); this.input.enabled = false; this.input.unlock(); this.audio.stopMusic(); this.weapons.vm.visible = false; }
  start() {
    this.audio.ensure(); this.audio.startMusic();
    this.state = 'playing'; $('#intro').classList.add('hidden'); $('#hud').classList.remove('hidden'); this.ui.hideOverlay();
    this.input.enabled = true; this.input.lock();
    // reset everything
    this.player.reset(4.3, 10.9, 0); this.enemies.clear(); this.weapons.reset(); this.fx.reset(); this.bottles.reset(); this.waves.reset();
    this.score = 0; this.combo = 1; this.comboT = 0; this.wave = 0; this.speed = 1; this.powerups = {}; this.slowEnemies = 1; this.player.speedMul = 1; this.shield = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, whiffs: 0, bottles: 0, bestCombo: 1, time: 0 };
    this.flamingoHP = 180; this.world.flamingo.visible = true; this.world.flamingo.userData.taken = false; this.world.flamingo.position.set(-0.45, 3.9, 3.96); this.world.flamingo.rotation.set(0, -0.27, 0); this.flamingoFall = null;
    this.weapons.vm.visible = true;
    // starting caches
    this.weapons.drop('vapo', new THREE.Vector3(6.55, 0, 10.45));
    this.weapons.drop('vapo', new THREE.Vector3(-6.12, 0, 10.05), 0.6, 'MUNITIONS VAPO');
    this.waves.start();
    this.ui.announce('ZINZIN MAYHEM', 'Survivez. Cognez. Ne vapotez pas à la caisse.');
    this.ui.refreshWeapon(true);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.overlay('pause'); this.input.unlock(); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.ui.hideOverlay(); this.input.lock(); }
  gameOver() {
    this.state = 'over'; this.audio.play('gameover'); this.audio.setIntensity(0);
    const record = this.score > this.hs; if (record) { this.hs = this.score; localStorage.setItem('vc_highscore', this.score); localStorage.setItem('vc_highwave', this.wave); this.updateHighscore(); }
    setTimeout(() => { this.ui.overlay(record ? 'record' : 'over'); this.input.unlock(); }, 1400);
  }
  debugCamera(x, y, z, yaw, pitch) { this.debugCam = { x, y, z, yaw, pitch }; }
  debugInfo() { const r = this.R.r.info.render; return { calls: r.calls, tris: r.triangles, state: this.state, wave: this.wave, enemies: this.enemies.list.length, alive: this.enemies.alive.length, score: this.score, hp: Math.round(this.player.hp), pos: this.player.pos.toArray().map(v => +v.toFixed(2)), weapon: this.weapons.cur, drops: this.weapons.drops.length }; }

  // ------------------------------------------------------------- combat
  hitEnemy(e, dmg, dir, knock = 3, head = false, weapon = 'vapo', point = null) {
    if (!e.alive) return; this.stats.hits++;
    const pt = point || e.chest; const killed = e.hurt(dmg, dir, knock, head);
    this.fx.vaporHit(pt, e.T.boss ? 0xffc0e0 : 0xe8f4ff); this.fx.burst(pt, 5, { speed: 2.5, color: [[1, 0.5, 0.7], [0.9, 0.95, 1]], life: 0.4, size: 0.04, grav: 5 });
    this.fx.text(pt.clone().setY(pt.y + 0.3), `${Math.round(dmg)}${head ? ' !' : ''}`, { color: head ? '#ffb347' : '#fff', size: head ? 22 : 16, glow: head ? '#ff4fa3' : '#5ef2ff' });
    this.audio.play(head ? 'headshot' : 'hit'); this.ui.hitmarker(killed);
    if (weapon !== 'zinzin') this.player.kickVel.x += (Math.random() - 0.5) * 2;
    if (killed) this.onKill(e, weapon, head, knock);
  }
  onKill(e, weapon, head, knock) {
    this.stats.kills++; this.waves.onKill(); this.audio.play('kill');
    // combo
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 3.2; this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const mult = Math.min(10, 1 + (this.combo - 1) * 0.5); const pts = Math.round(e.T.score * mult * (head ? 1.5 : 1) * (weapon === 'fists' ? 2 : 1));
    this.score += pts; $('#combo').classList.add('pop'); setTimeout(() => $('#combo').classList.remove('pop'), 120); this.audio.play('combo', null, { n: this.combo });
    this.fx.text(e.headPos, `+${pts}`, { color: '#d7f06a', size: 18 + Math.min(14, this.combo), glow: '#d7f06a', rise: 1.4, life: 1.3 });
    const name = this.ui.comboName(this.combo); if (name && [2, 3, 5, 8, 12, 16, 24].includes(this.combo)) this.ui.announce(name, `combo ×${this.combo} · ${weapon === 'fists' ? 'À MAINS NUES !' : head ? 'DANS LA TÊTE' : 'continuez !'}`);
    if (weapon === 'fists') this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'BAFFE !', { color: '#ffb347', size: 22 });
    if (weapon === 'flamingo') { this.fx.confettiRain(e.pos, 20); }
    if (e.T.boss) { this.ui.announce('PATRON NEUTRALISÉ', 'Le flamant est à vous. Les zinzins pleurent.'); this.fx.explosion(e.chest, { radius: 3, color: 0xff4fa3, confetti: true }); this.audio.play('explosion', e.pos); this.weapons.drop('flamingo', e.pos.clone()); this.weapons.dropPowerup('shield', e.pos.clone().add(new THREE.Vector3(1, 0, 0))); this.score += 5000; }
    else if (Math.random() < 0.11 + (this.combo > 5 ? 0.05 : 0)) { const keys = ['slowmo', 'boost', 'shield', 'disco', 'ammo', 'heal']; this.weapons.dropPowerup(keys[Math.floor(Math.random() * keys.length)], e.pos.clone()); }
    // the flamingo boss also drops big ammo
    if (this.combo >= 5 && this.combo % 5 === 0) this.fx.confettiRain(this.player.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), 25);
  }
  damagePlayer(amount, from) {
    if (this.state !== 'playing') return;
    let a = amount * this.difficulty * 0.9;
    if (this.shield > 0) { this.shield -= a; this.fx.ring(this.player.pos, { color: 0xd7f06a, size: 1.6, life: 0.3, y: 1 }); this.fx.text(this.player.eyePos.clone().addScaledVector(this.player.forward(), 1), 'BLOQUÉ', { color: '#d7f06a', size: 14 }); if (this.shield <= 0) { this.ui.toast('Bouclier brisé'); this.powerups.shield && (this.powerups.shield.t = 0); } return; }
    this.player.damage(a, from);
    if (this.player.dead) { this.gameOver(); this.ui.announce('HORS COMBAT', `vague ${this.wave} · ${this.stats.kills} zinzins`); }
  }
  explode(p, radius, dmg, owner = 'player', key = 'flamant') {
    this.fx.explosion(p, { radius, color: key === 'flamant' ? 0xff4fa3 : 0xff8a3c, confetti: key === 'flamant' }); this.audio.play('explosion', p);
    for (const e of this.enemies.list) { if (!e.alive) continue; const d = e.chest.distanceTo(p); if (d < radius + e.radius) { const f = 1 - Math.max(0, d - 0.5) / radius; const dir = e.chest.clone().sub(p).normalize(); dir.y = Math.max(dir.y, 0.3); this.hitEnemy(e, dmg * Math.max(0.25, f) * (owner === 'enemy' ? 0.5 : 1), dir, 18 * f, false, key, e.chest); } }
    const P = this.player; const d = P.eyePos.distanceTo(p); if (d < radius + 0.5) { const f = 1 - Math.max(0, d - 0.5) / radius; this.damagePlayer((owner === 'player' ? dmg * 0.25 : dmg * 0.6) * f, p); P.vel.add(P.pos.clone().setY(P.pos.y + 1).sub(p).normalize().multiplyScalar(6 * f)); P.vel.y += 3 * f; P.onGround = false; }
    for (const i of this.bottles.within(p, radius)) this.breakBottle(i, new THREE.Vector3(0, 1, 0));
    if (this.flamingoHP > 0 && this.world.flamingo.position.distanceTo(p) < radius + 1) this.hitFlamingo(dmg, this.world.flamingo.position);
  }
  breakBottle(i, dir) {
    const r = this.bottles.destroy(i); if (!r) return; this.stats.bottles++;
    const p = new THREE.Vector3(r.x, r.y, r.z); this.fx.bottleBreak(p, r.color); this.audio.play('bottle', p); this.score += 5;
    if (this.stats.bottles % 25 === 0) this.ui.toast(`${this.stats.bottles} bouteilles cassées. Le patron va être ravi.`);
  }
  hitFlamingo(dmg, point) {
    if (this.flamingoHP <= 0) return; this.flamingoHP -= dmg; this.fx.vaporHit(point, 0xffc0e0); this.audio.play('punch_hit', point);
    this.fx.text(point, 'COUIC', { color: '#ff4fa3', size: 14 });
    if (this.flamingoHP <= 0) { this.ui.announce('LE FLAMANT EST LIBRE', 'Il tombe. Ramassez-le. Ne posez pas de questions.'); this.audio.play('scream', point); this.flamingoFall = { t: 0, v: new THREE.Vector3(1.5, 3, 2.5) }; }
  }

  // ------------------------------------------------------------- power-ups
  applyPowerup(k) {
    const def = PU[k]; this.audio.play('powerup'); this.ui.announce(def.name, { slowmo: 'Le temps se fige. Pas vous.', boost: 'Cadence + vitesse + munitions infinies', shield: 'Encaisse 120 dégâts', disco: 'Les zinzins dansent. Frappez-les.', ammo: 'Toutes les armes rechargées', heal: '+50 vitalité' }[k]);
    this.powerups[k] = { name: def.name, color: def.color, t: def.dur, max: def.dur };
    if (k === 'ammo') this.weapons.refillAll(); if (k === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    if (k === 'shield') this.shield = 120; if (k === 'slowmo') this.audio.play('slowmo');
    if (k === 'disco') { for (const e of this.enemies.alive) e.dance = def.dur; }
    this.fx.confettiRain(this.player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 30);
  }
  updatePowerups(dt) {
    let slow = false, boost = false, disco = false;
    for (const k in this.powerups) { const p = this.powerups[k]; if (p.t <= 0) continue; p.t -= dt; if (p.t <= 0) { if (k === 'slowmo') this.audio.play('slowmo_end'); if (k === 'boost') this.ui.toast('Fin du boost'); } if (k === 'slowmo' && p.t > 0) slow = true; if (k === 'boost' && p.t > 0) boost = true; if (k === 'disco' && p.t > 0) disco = true; }
    const targetSpeed = slow ? 0.32 : 1; this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * 8)); this.audio.slow = 1 / Math.max(0.4, this.speed) ** 0.35;
    this.weapons.fireRateMul = boost ? 1.7 : 1; this.weapons.infinite = boost; this.player.speedMul = boost ? 1.35 : 1;
    const G = this.R.grade.uniforms; G.uSlow.value += ((slow ? 1 : 0) - G.uSlow.value) * (1 - Math.exp(-dt * 6)); G.uDisco.value += ((disco ? 1 : 0) - G.uDisco.value) * (1 - Math.exp(-dt * 4));
    if (disco) { const t = this.time * 4; for (let i = 0; i < this.world.lights.length; i++) { const l = this.world.lights[i]; if (l.isSpotLight) l.color.setHSL((t * 0.2 + i * 0.17) % 1, 0.9, 0.6); } } else if (this.discoWas) { for (const l of this.world.lights) if (l.isSpotLight) l.color.set(0xffe2b8); }
    this.discoWas = disco;
  }

  // ------------------------------------------------------------- frame
  debugStep(seconds, fn = null) { const n = Math.round(seconds * 60); for (let i = 0; i < n; i++) { if (fn) fn(i); this.simulate(1 / 60); this.input.endFrame(); } }
  frame(dt, now) {
    this.simulate(dt);
    if (this.debugCam) { const c = this.debugCam, cam = this.R.camera; cam.position.set(c.x, c.y, c.z); cam.rotation.set(c.pitch, c.yaw, 0, 'YXZ'); }
    this.R.adapt(dt, now * 1000);
    this.R.render(this.time);
    this.input.endFrame();
  }
  simulate(dt) {
    this.time += dt; const G = this.R.grade.uniforms;
    if (this.state === 'playing' || this.state === 'over') {
      this.updatePowerups(dt);
      const sp = this.speed; const gdt = dt * sp;
      if (this.state === 'playing') this.stats.time += dt;
      this.player.update(dt, this.state === 'over' ? 0 : Math.pow(sp, 0.35));
      this.weapons.update(dt, sp);
      this.enemies.update(gdt, this.time);
      if (this.state === 'playing') this.waves.update(gdt);
      this.comboT -= dt; if (this.comboT <= 0 && this.combo > 1) { this.combo = 1; }
      this.fx.update(gdt, this.R.camera);
      // flamingo falling
      if (this.flamingoFall) { const f = this.flamingoFall, F = this.world.flamingo; f.t += gdt; f.v.y -= 12 * gdt; F.position.addScaledVector(f.v, gdt); F.rotation.x += gdt * 3; F.rotation.z += gdt * 1.5; const fy = this.world.floorHeight(F.position.x, F.position.z); if (F.position.y <= fy + 0.3) { const [nx, nz] = this.world.nav.nearestFree(F.position.x, F.position.z); this.weapons.drop('flamingo', new THREE.Vector3(nx, 0, nz)); F.visible = false; F.userData.taken = true; this.flamingoFall = null; this.fx.dust(F.position, 10); this.audio.play('land', F.position); this.fx.shake = 0.8; } }
      // camera shake from fx
      if (this.shakeOn) this.player.shake = Math.max(this.player.shake, this.fx.shake);
      G.uFlash.value = this.fx.flash; G.uFlashColor.value.copy(this.fx.flashColor); G.uChroma.value *= Math.exp(-dt * 4); G.uChroma.value = Math.max(G.uChroma.value, this.fx.shake * 0.01);
      G.uDamage.value = this.player.hp < 30 ? 0.35 + Math.sin(this.time * 6) * 0.1 : Math.max(0, G.uDamage.value - dt);
      const L = this.audio.listener; L.x = this.player.pos.x; L.y = this.player.pos.y + 1.6; L.z = this.player.pos.z; L.yaw = this.player.yaw;
      this.audio.setIntensity(this.enemies.alive.length > 6 ? 1 : this.enemies.alive.length > 0 ? 0.6 : 0.2);
      this.ui.update(dt);
    } else if (this.state === 'menu') {
      const t = this.time * 0.08; const cam = this.R.camera; cam.position.set(6.85 + Math.sin(t) * 0.5, 4.6, 10.5); cam.lookAt(-0.5 + Math.sin(t * 0.7) * 1.5, 1.5, -3);
      this.fx.update(dt, cam);
    } else if (this.state === 'paused') { this.player.updateCamera(dt); }
    this.world.update(dt, this.time, this.player.pos);
  }
}
