// Game orchestrator: state machine, combat resolution, power-ups, ultimate, shop, wave modifiers, score/combo, menus.
import * as THREE from 'three';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { Weapons, WEAPONS } from './weapons.js';
import { Enemies } from './enemies.js';
import { Waves } from './waves.js';
import { UI } from './ui.js';
import { Props } from './props.js';
import { Folie } from './folie.js';
import { Announcer } from './tts.js';

const $ = s => document.querySelector(s);
const PU = {
  slowmo: { name: 'MENTHE GLACIALE', color: '#5ef2ff', dur: 6 }, boost: { name: 'BOOSTER NICOTINE', color: '#ffb347', dur: 9 }, shield: { name: 'BOUCLIER VITRINE', color: '#d7f06a', dur: 10 },
  disco: { name: 'DISCO CBD', color: '#ff4fa3', dur: 7 }, ammo: { name: 'MÉGA-GUMMIES', color: '#b58cff', dur: 2 }, heal: { name: 'TISANE CBD', color: '#9be36a', dur: 2 },
  rage: { name: 'RAGE DU PATRON', color: '#ff3b3b', dur: 8 }, magnet: { name: 'AIMANT À ZINZINS', color: '#ffd700', dur: 14 },
};
export const SHOP = [
  { key: 'hp', name: 'Vitalité +25', desc: 'Max 200. Soigne aussi.', cost: 900, max: 4 },
  { key: 'reload', name: 'Doigts de fée', desc: 'Rechargement −20 % (cumulable)', cost: 700, max: 3 },
  { key: 'dash', name: 'Semelles nicotine', desc: 'Dash 2× plus souvent', cost: 800, max: 2 },
  { key: 'grenades', name: '+3 Gummy-Bombes', desc: 'Lancer avec G', cost: 350, max: 99 },
  { key: 'ammo', name: 'Réassort complet', desc: 'Toutes les armes rechargées', cost: 450, max: 99 },
  { key: 'dmg', name: 'Sauce piquante', desc: 'Dégâts +12 % (cumulable)', cost: 1100, max: 4 },
  { key: 'ult', name: 'Ultime chargé', desc: 'Tempête de Vapeur prête (X)', cost: 600, max: 99 },
  { key: 'life', name: 'Seconde chance', desc: 'Revient à 50 % de vie une fois', cost: 2500, max: 1 },
  { key: 'couche', name: 'Couche-culotte', desc: 'Pipi illimité, vessie ×3. Personne ne juge.', cost: 650, max: 1 },
  { key: 'pigeon', name: 'Pigeon dressé', desc: 'Roger fiente deux fois plus souvent', cost: 500, max: 1 },
  { key: 'regen', name: 'Tisane en perfusion', desc: 'Régénération +2 PV/s (cumulable)', cost: 700, max: 3 },
  { key: 'autocollant', name: 'Autocollant « Ne vapotez pas »', desc: 'Ne fait absolument rien.', cost: 1, max: 99 },
];
export const NONSENSE = ['Info magasin : le flamant a été vu en train de payer en billets de Monopoly.', 'Rappel : les zinzins ne sont pas comestibles. Même les gummies.', 'Le stagiaire a rangé les 50 ml par ordre de tristesse.', 'Un client demande si le CBD marche sur les pigeons. Réponse : Roger dit oui.', 'Météo intérieure : nuageux avec risque de fraise.', 'La caisse enregistreuse a demandé une augmentation.', 'Quelqu\'un a laissé un tabouret dans le tabouret.', 'Le patron rappelle que les pauses pipi sont facturées 0 point.', 'Promo : 1 zinzin acheté, 1 zinzin offert. Non remboursable.', 'La mezzanine est fière de vous. Ne montez pas dessus, elle rougit.', 'Attention : sol glissant. Personne ne sait pourquoi.', 'Le Mime a essayé de dire quelque chose. Il a échoué.', 'Le vigile a perdu sa casquette dans un combat contre une porte.', 'Nouveau parfum en rayon : « Odeur de victoire », 3 mg.', 'Le pigeon Roger a été élu employé du mois.', 'Il est interdit de vapoter à la caisse. Il est autorisé d\'y crier.', 'Un flacon vient de se casser tout seul. Il n\'en pouvait plus.', 'Les tabourets ont voté : ils partent en grève à la vague 7.', 'Le Livreur Turbo a livré un colis vide. Il était très fier.', 'Rappel sécurité : ne pas essuyer la vitrine avec un zinzin.', 'Un Influenceur a essayé de liker une bouteille. Elle a explosé de joie.', 'Le magasin vous remercie. Il ne sait pas pourquoi non plus.', 'La musique change de rythme quand personne ne regarde.', 'Roger demande des miettes. Roger n\'aura pas de miettes.'];
const SHOP_POS = new THREE.Vector3(1.1, 0, -8.1);

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.state = 'menu'; this.time = 0; this.speed = 1; this.difficulty = 1; this.wave = 0; this.score = 0; this.combo = 1; this.comboT = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, whiffs: 0, bottles: 0, bestCombo: 1, time: 0 };
    this.powerups = {}; this.slowEnemies = 1; this.flamingoHP = 180; this.debugCam = null; this.shakeOn = true; this.waveMod = null; this.ult = 0; this.upgrades = {}; this.extraLife = false; this.intermission = false;
    this.world.doorForce = 0;
  }
  async init() {
    this.audio = new Audio();
    this.fx = new FX(this.R.scene, this.R.camera, this.world, this.quality);
    this.ui = new UI(this);
    this.weapons = new Weapons(this);
    this.enemies = new Enemies(this);
    this.waves = new Waves(this);
    this.props = new Props(this);
    this.tts = new Announcer(); this.folie = new Folie(this); this.notifT = 8; this.macarena = 0;
    this.R.scene.add(this.R.camera);
    // flashlight
    this.flash = new THREE.SpotLight(0xfff4e0, 0, 18, 0.5, 0.45, 1.2); this.flash.position.set(0.15, -0.1, 0); this.flash.target.position.set(0, 0, -5); this.R.camera.add(this.flash); this.R.camera.add(this.flash.target); this.flashOn = false;
    const P = this.player;
    P.onFootstep = (run) => this.audio.play('footstep', null, { run });
    P.onJump = () => this.audio.play('jump'); P.onLand = (v) => { this.audio.play('land'); if (v > 7) this.fx.dust(P.pos, 4); };
    P.onDash = () => { this.audio.play('dash'); this.fx.shake = Math.max(this.fx.shake, 0.3); this.R.grade.uniforms.uChroma.value = 0.02; };
    P.onSlide = () => this.audio.play('slide');
    P.onDamage = (a, from) => { this.ui.damageFrom(from?.pos || from); this.audio.play('hurt'); };
    $('#btnPlay').addEventListener('click', () => this.start());
    document.querySelectorAll('#difficulty button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#difficulty button').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); this.difficulty = +b.dataset.diff; }));
    document.querySelectorAll('#quality button').forEach(b => b.addEventListener('click', () => { localStorage.setItem('vc_quality', b.dataset.q); location.search = '?q=' + b.dataset.q; }));
    $('#btnResume').addEventListener('click', () => this.resume()); $('#btnRestart').addEventListener('click', () => this.start()); $('#btnMenu').addEventListener('click', () => this.showMenu());
    $('#chkMusic').addEventListener('change', e => this.audio.setMusic(e.target.checked)); $('#chkVoice').addEventListener('change', e => { this.tts.enabled = e.target.checked; if (!e.target.checked) this.tts.stop(); }); $('#chkShake').addEventListener('change', e => this.shakeOn = e.target.checked); $('#chkFps').addEventListener('change', e => this.ui.showFps = e.target.checked);
    $('#rngSens').addEventListener('input', e => this.input.sens = +e.target.value); $('#rngFov').addEventListener('input', e => { this.player.fovBase = +e.target.value; });
    $('#btnShopClose').addEventListener('click', () => this.closeShop());
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'playing') this.pause(); };
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); else if (this.state === 'shop') this.closeShop(); }
      if (e.code === 'Enter' && this.state === 'over') this.start();
      if (e.code === 'KeyL' && this.state === 'playing') this.toggleFlash();
      if (e.code === 'KeyX' && this.state === 'playing') this.useUlt();
      if (e.code === 'KeyF' && this.state === 'shop') this.closeShop();
    });
    this.hs = +(localStorage.getItem('vc_highscore') || 0); this.updateHighscore();
  }
  updateHighscore() { const hw = +(localStorage.getItem('vc_highwave') || 0); $('#highscore').innerHTML = this.hs ? `MEILLEUR SCORE<b>${this.hs.toLocaleString('fr-FR')}</b>vague ${hw}` : ''; }
  showMenu() { this.tts.stop(); this.state = 'menu'; $('#intro').classList.remove('hidden'); $('#hud').classList.add('hidden'); this.ui.hideOverlay(); this.ui.hideShop(); this.input.enabled = false; this.input.unlock(); this.audio.stopMusic(); this.weapons.vm.visible = false; this.setWaveMod(null); }
  start() {
    this.audio.ensure(); this.audio.startMusic();
    this.state = 'playing'; $('#intro').classList.add('hidden'); $('#hud').classList.remove('hidden'); this.ui.hideOverlay(); this.ui.hideShop();
    this.input.enabled = true; this.input.lock();
    this.player.reset(4.3, 10.9, 0); this.player.maxHp = 100; this.player.hp = 100; this.enemies.clear(); this.weapons.reset(); this.fx.reset(); this.bottles.reset(); this.waves.reset(); this.props.reset();
    this.score = 0; this.combo = 1; this.comboT = 0; this.wave = 0; this.speed = 1; this.powerups = {}; this.slowEnemies = 1; this.player.speedMul = 1; this.shield = 0; this.ult = 0; this.upgrades = {}; this.extraLife = false; this.setWaveMod(null); this.flashOn = false; this.flash.intensity = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, whiffs: 0, bottles: 0, bestCombo: 1, time: 0 };
    this.flamingoHP = 180; this.world.flamingo.visible = true; this.world.flamingo.userData.taken = false; this.world.flamingo.position.set(-0.45, 3.9, 3.96); this.world.flamingo.rotation.set(0, -0.27, 0); this.flamingoFall = null;
    this.weapons.vm.visible = true; this.folie.reset(); this.notifT = 8; this.macarena = 0; this.player.gravity = 16; this.player.jumpV = 5.6; this.player.extraRoll = 0; this.ui.clearNotifs();
    this.weapons.drop('vapo', new THREE.Vector3(6.55, 0, 10.45));
    this.weapons.drop('vapo', new THREE.Vector3(-6.12, 0, 10.05), 0.6, 'MUNITIONS VAPO');
    this.waves.start();
    this.ui.announce('ZINZIN MAYHEM', 'Survivez. Cognez. Ne vapotez pas à la caisse.'); this.tts.say('Bienvenue chez Vap and Co. Ne vapotez pas à la caisse.', { priority: 2 });
    this.ui.refreshWeapon(true);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.overlay('pause'); this.input.unlock(); this.weapons.stopBeam(); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.ui.hideOverlay(); this.input.lock(); }
  gameOver() {
    this.tts.say('Hors combat. Le magasin est tombé.', { priority: 2 });
    if (this.extraLife) { this.extraLife = false; this.player.dead = false; this.player.hp = this.player.maxHp * 0.5; this.player.lastHurt = this.player.time; this.shield = 80; this.ui.announce('SECONDE CHANCE', 'Le patron vous rembourse. Une seule fois.'); this.audio.play('powerup'); this.useUltEffect(true); return; }
    this.state = 'over'; this.audio.play('gameover'); this.audio.setIntensity(0); this.weapons.stopBeam();
    const record = this.score > this.hs; if (record) { this.hs = this.score; localStorage.setItem('vc_highscore', this.score); localStorage.setItem('vc_highwave', this.wave); this.updateHighscore(); }
    setTimeout(() => { this.ui.overlay(record ? 'record' : 'over'); this.input.unlock(); }, 1400);
  }
  toggleFlash() { this.flashOn = !this.flashOn; this.audio.play('beep'); this.ui.toast(this.flashOn ? 'Lampe torche allumée' : 'Lampe torche éteinte', 1.5); }
  // Compile every shader variant the game can hit (pooled FX, projectiles, drops, skinned depth) before play starts.
  warmup() {
    const R = this.R, fx = this.fx, W = this.weapons; const scene = R.scene;
    // two hidden reference zinzins: one opaque, one transparent (death fade) so both skinned shader variants stay resident
    const dummy = this.enemies.spawn('client', 0, 6); dummy.trap(0.01); const dummy2 = this.enemies.spawn('mime', 1, 6); this.enemies.list.length = 0; this.dummies = [dummy, dummy2];
    const pools = [...fx.puffPool, ...fx.tracerPool, ...fx.decalPool, ...fx.ringPool]; for (const o of pools) o.visible = true; fx.points.visible = true; fx.debris.visible = true;
    for (const k in W.models) W.models[k].visible = true; W.grenadeVm.visible = true;
    const o = new THREE.Vector3(0, 1.5, 6), d = new THREE.Vector3(0, 0, -1);
    for (const k of ['gummy', 'bulles', 'grenade', 'flamant']) W.spawnProjectile(o, d, WEAPONS[k], 'player'); W.spawnProjectile(o, d, { key: 'pluie', damage: 1, knock: 0, projectile: { speed: 0, gravity: 0, radius: 0.09, life: 1 } }, 'player');
    const F = this.folie; F.spawnCaca(new THREE.Vector3(0.5, 0, 6)); F.addPuddle(new THREE.Vector3(-0.5, 0, 6), 1); F.spawnFiente(new THREE.Vector3(0, 2, 6)); F.pigeon.mesh.visible = true; F.pigeon.mesh.position.set(0, 2.5, 6);
    const drops = [W.drop('vapo', new THREE.Vector3(1, 0, 6)), W.dropPowerup('heal', new THREE.Vector3(-1, 0, 6))];
    R.camera.position.set(0, 1.7, 9); R.camera.lookAt(0, 1, 0); R.camera.updateMatrixWorld(true);
    R.precompile(); R.render(0); R.render(0.02);
    for (const o of pools) o.visible = false; for (const k in W.models) W.models[k].visible = false; W.grenadeVm.visible = false;
    for (const p of W.projectiles) scene.remove(p.mesh); W.projectiles.length = 0; for (const dr of drops) scene.remove(dr.g); W.drops.length = 0;
    for (const d of this.dummies) { d.mesh.visible = false; d.alive = false; d.hp = 0; } fx.reset(); F.pigeon.mesh.visible = false; for (const c of F.cacas) scene.remove(c.m); F.cacas.length = 0; for (const q of F.puddles) scene.remove(q.m); F.puddles.length = 0; for (const f of F.fientes) scene.remove(f.m); F.fientes.length = 0;
    W.setCurrent('fists', true);
  }
  debugCamera(x, y, z, yaw, pitch) { this.debugCam = { x, y, z, yaw, pitch }; }
  get boss() { return this.enemies.list.find(e => e.alive && e.T.boss) || null; }
  get scoreMul() { return (this.waveMod?.scoreMul || 1); }
  debugInfo() { const r = this.R.r.info.render; return { calls: r.calls, tris: r.triangles, state: this.state, wave: this.wave, enemies: this.enemies.list.length, alive: this.enemies.alive.length, score: this.score, hp: Math.round(this.player.hp), pos: this.player.pos.toArray().map(v => +v.toFixed(2)), weapon: this.weapons.cur, drops: this.weapons.drops.length, mod: this.waveMod?.key || null, ult: +this.ult.toFixed(2) }; }

  // ------------------------------------------------------------- wave modifiers
  setWaveMod(mod) {
    this.waveMod = mod; const W = this.world;
    const blackout = mod?.key === 'blackout';
    if (blackout && !this.blackoutWas) { this.audio.play('blackout'); this.flashOn = true; }
    this.blackoutWas = blackout;
    W.sun.intensity = blackout ? 0.08 : 1.25; W.ambient.intensity = blackout ? 0.08 : 0.9;
    for (const l of W.lights) { if (l.isSpotLight) l.intensity = blackout ? 0 : 34; else if (l.userData.base === undefined) { l.userData.base = l.intensity; } if (!l.isSpotLight) l.intensity = blackout ? l.userData.base * 0.35 : l.userData.base; }
    this.R.scene.environmentIntensity = blackout ? 0.06 : 0.5;
    this.ui.setMod(mod); if (mod) this.tts.say(mod.name.toLowerCase() + '. ' + mod.desc, { priority: 1 });
  }
  onIntermission(on) { this.intermission = on; }
  // ------------------------------------------------------------- shop
  nearShop() { const P = this.player.pos; return this.intermission && this.state === 'playing' && Math.hypot(P.x - SHOP_POS.x, P.z - SHOP_POS.z) < 2.6; }
  openShop() { if (this.state !== 'playing') return; this.state = 'shop'; this.weapons.stopBeam(); this.input.unlock(); this.ui.showShop(); this.audio.play('coin'); }
  closeShop() { if (this.state !== 'shop') return; this.state = 'playing'; this.ui.hideShop(); this.input.lock(); }
  buy(key) {
    const it = SHOP.find(s => s.key === key); const n = this.upgrades[key] || 0; const cost = Math.round(it.cost * (1 + n * 0.5));
    if (n >= it.max || this.score < cost) { this.audio.play('deny'); this.ui.toast(n >= it.max ? 'Déjà au maximum' : 'Pas assez de points'); return; }
    this.score -= cost; this.upgrades[key] = n + 1; this.audio.play('buy');
    const P = this.player;
    if (key === 'hp') { P.maxHp += 25; P.hp = P.maxHp; }
    if (key === 'grenades') this.weapons.grenades = Math.min(9, this.weapons.grenades + 3);
    if (key === 'ammo') { this.weapons.refillAll(); this.upgrades.ammo = 0; }
    if (key === 'ult') { this.ult = 1; this.upgrades.ult = 0; }
    if (key === 'life') this.extraLife = true;
    if (key === 'regen') this.player.regenRate = 3 + 2 * this.upgrades.regen;
    if (key === 'autocollant') { this.ui.toast('Merci pour votre achat. Il ne fait rien.', 3); this.tts.say('Merci pour votre achat', { priority: 0 }); }
    if (key === 'pigeon') this.folie.pigeon.activate();
    this.ui.toast(`${it.name} acheté`); this.ui.refreshShop(); this.ui.refreshWeapon(true);
  }
  get reloadMul() { return Math.pow(0.8, this.upgrades.reload || 0); }
  get dmgMul() { return (1 + 0.12 * (this.upgrades.dmg || 0)) * (this.powerups.rage?.t > 0 ? 2 : 1); }

  // ------------------------------------------------------------- ultimate
  addUlt(v) { const was = this.ult; this.ult = Math.min(1, this.ult + v); if (was < 1 && this.ult >= 1) { this.audio.play('ult_ready'); this.ui.toast('TEMPÊTE DE VAPEUR prête — appuyez sur X', 3); } }
  useUlt() { if (this.ult < 1 || this.player.dead) { if (this.ult < 1) this.audio.play('deny'); return; } this.ult = 0; this.useUltEffect(false); }
  useUltEffect(revive) {
    const P = this.player; const c = P.pos.clone().setY(P.pos.y + 1); this.audio.play('ult');
    this.ui.announce(revive ? 'RESPIRATION' : 'TEMPÊTE DE VAPEUR', revive ? 'Tout le monde recule.' : 'Le magasin entier tousse.');
    this.fx.explosion(c, { radius: 9, color: 0x5ef2ff, confetti: true }); this.fx.ring(P.pos, { color: 0x5ef2ff, size: 18, life: 1.2, y: 0.2 });
    for (let i = 0; i < 40; i++) this.fx.puff(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 2, (Math.random() - 0.5) * 8)), { size: 1.2 + Math.random(), life: 2.5, opacity: 0.5, color: 0xbfe8ff, grow: 2.5, rise: 0.4 });
    for (const e of this.enemies.list) { if (!e.alive) continue; const d = e.pos.distanceTo(P.pos); if (d < 10) { const f = 1 - d / 10; const dir = e.pos.clone().sub(P.pos).setY(0).normalize(); this.hitEnemy(e, (revive ? 30 : 90) * (0.4 + f), dir, 26 * (0.4 + f), false, 'ult', e.chest); if (e.alive) e.stagger = Math.max(e.stagger, 1.2); } }
    this.props.blast(c, 8, 18); for (const i of this.bottles.within(c, 4)) this.breakBottle(i, new THREE.Vector3(0, 1, 0));
    this.powerups.slowmo = { name: PU.slowmo.name, color: PU.slowmo.color, t: 2.6, max: 2.6 }; this.fx.flash = 0.6; this.fx.flashColor.set(0x5ef2ff);
  }

  // ------------------------------------------------------------- combat
  hitEnemy(e, dmg, dir, knock = 3, head = false, weapon = 'vapo', point = null) {
    if (!e.alive) return; this.stats.hits++;
    dmg *= this.dmgMul; if (weapon === 'fists' && this.powerups.rage?.t > 0) dmg *= 3;
    const pt = point || e.chest; const killed = e.hurt(dmg, dir, knock, head);
    this.fx.vaporHit(pt, e.T.boss ? 0xffc0e0 : 0xe8f4ff); this.fx.burst(pt, 5, { speed: 2.5, color: [[1, 0.5, 0.7], [0.9, 0.95, 1]], life: 0.4, size: 0.04, grav: 5 });
    this.fx.text(pt.clone().setY(pt.y + 0.3), `${Math.round(dmg)}${head ? ' !' : ''}`, { color: head ? '#ffb347' : '#fff', size: head ? 22 : 16, glow: head ? '#ff4fa3' : '#5ef2ff' });
    this.audio.play(head ? 'headshot' : 'hit'); this.ui.hitmarker(killed);
    if (!['zinzin', 'prop', 'ult', 'caca', 'fiente', 'bottle', 'seche', 'pluie'].includes(weapon)) this.player.kickVel.x += (Math.random() - 0.5) * 2;
    if (head && this.folie.event?.key === 'tetes') { /* big heads: extra pop */ this.fx.text(pt.clone().setY(pt.y + 0.6), 'GROSSE TÊTE', { color: '#ffb347', size: 14 }); }
    if (killed) this.onKill(e, weapon, head, knock);
  }
  onKill(e, weapon, head, knock) {
    this.stats.kills++; this.waves.onKill(); this.audio.play('kill'); this.folie.onKill(e);
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 3.2; this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo); const name = this.ui.comboName(this.combo);
    const mult = Math.min(10, 1 + (this.combo - 1) * 0.5); const pts = Math.round(e.T.score * mult * (head ? 1.5 : 1) * (weapon === 'fists' ? 2 : 1) * (weapon === 'caca' || weapon === 'fiente' ? 3 : 1) * this.scoreMul);
    this.score += pts; $('#combo').classList.add('pop'); setTimeout(() => $('#combo').classList.remove('pop'), 120); this.audio.play('combo', null, { n: this.combo });
    this.addUlt(e.T.boss ? 0.5 : head ? 0.09 : 0.055);
    this.fx.text(e.headPos, `+${pts}`, { color: '#d7f06a', size: 18 + Math.min(14, this.combo), glow: '#d7f06a', rise: 1.4, life: 1.3 });
    if (name && [2, 3, 5, 8, 12, 16, 24].includes(this.combo)) this.ui.announce(name, `combo ×${this.combo} · ${weapon === 'fists' ? 'À MAINS NUES !' : head ? 'DANS LA TÊTE' : 'continuez !'}`);
    if (weapon === 'fists') this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'BAFFE !', { color: '#ffb347', size: 22 });
    if (weapon === 'flamingo') this.fx.confettiRain(e.pos, 20);
    if (weapon === 'prop') this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'MOBILIER !', { color: '#ffb347', size: 18 });
    if (weapon === 'caca') { this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'MORT DE HONTE', { color: '#8a6a3a', size: 18 }); this.tts.say('Éliminé par un caca', { priority: 0 }); }
    if (weapon === 'fiente') { this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'BRAVO ROGER', { color: '#eee', size: 18 }); }
    if (weapon === 'seche') this.fx.text(e.headPos.clone().setY(e.headPos.y + 0.4), 'SÉCHÉ', { color: '#ff8ac5', size: 18 });
    if (name && [3, 5, 8, 12].includes(this.combo)) this.tts.say(name.toLowerCase(), { priority: 1 });
    if (e.T.boss) { this.ui.announce('PATRON NEUTRALISÉ', 'Le flamant est à vous. Les zinzins pleurent.'); this.fx.explosion(e.chest, { radius: 3, color: 0xff4fa3, confetti: true }); this.audio.play('explosion', e.pos); this.weapons.drop('flamingo', e.pos.clone()); this.weapons.dropPowerup('shield', e.pos.clone().add(new THREE.Vector3(1, 0, 0))); this.score += Math.round(5000 * this.scoreMul); }
    else { const chance = (0.11 + (this.combo > 5 ? 0.05 : 0)) * (this.waveMod?.key === 'pluie' ? 3 : 1); if (Math.random() < chance) { const keys = ['slowmo', 'boost', 'shield', 'disco', 'ammo', 'heal', 'rage', 'magnet']; this.weapons.dropPowerup(keys[Math.floor(Math.random() * keys.length)], e.pos.clone()); } }
    if (this.combo >= 5 && this.combo % 5 === 0) this.fx.confettiRain(this.player.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), 25);
  }
  damagePlayer(amount, from) {
    if (this.state !== 'playing') return;
    if (this.macarena > 0 || this.folie.sitting > 0 && Math.random() < 0.5) return; // dancing is sacred; the toilet is half-sacred
    let a = amount * this.difficulty * 0.72;
    if (this.shield > 0) { this.shield -= a; this.fx.ring(this.player.pos, { color: 0xd7f06a, size: 1.6, life: 0.3, y: 1 }); this.fx.text(this.player.eyePos.clone().addScaledVector(this.player.forward(), 1), 'BLOQUÉ', { color: '#d7f06a', size: 14 }); if (this.shield <= 0) { this.ui.toast('Bouclier brisé'); this.powerups.shield && (this.powerups.shield.t = 0); } return; }
    this.player.damage(a, from);
    if (this.player.dead) { this.gameOver(); if (this.state === 'over') this.ui.announce('HORS COMBAT', `vague ${this.wave} · ${this.stats.kills} zinzins`); }
  }
  explode(p, radius, dmg, owner = 'player', key = 'flamant') {
    const color = { flamant: 0xff4fa3, grenade: 0xff4fa3, kamikaze: 0xff3b3b }[key] || 0xff8a3c;
    this.fx.explosion(p, { radius, color, confetti: key === 'flamant' || key === 'grenade' }); this.audio.play('explosion', p);
    for (const e of this.enemies.list) { if (!e.alive) continue; const d = e.chest.distanceTo(p); if (d < radius + e.radius) { const f = 1 - Math.max(0, d - 0.5) / radius; const dir = e.chest.clone().sub(p).normalize(); dir.y = Math.max(dir.y, 0.3); this.hitEnemy(e, dmg * Math.max(0.25, f) * (owner === 'enemy' ? 0.5 : 1), dir, 18 * f, false, key, e.chest); } }
    const P = this.player; const d = P.eyePos.distanceTo(p); if (d < radius + 0.5) { const f = 1 - Math.max(0, d - 0.5) / radius; this.damagePlayer((owner === 'player' ? dmg * 0.25 : dmg * 0.6) * f, p); P.vel.add(P.pos.clone().setY(P.pos.y + 1).sub(p).normalize().multiplyScalar(6 * f)); P.vel.y += 3 * f; P.onGround = false; }
    for (const i of this.bottles.within(p, radius)) this.breakBottle(i, new THREE.Vector3(0, 1, 0));
    this.props.blast(p, radius, 14);
    if (this.flamingoHP > 0 && this.world.flamingo.position.distanceTo(p) < radius + 1) this.hitFlamingo(dmg, this.world.flamingo.position);
  }
  breakBottle(i, dir) {
    const r = this.bottles.destroy(i); if (!r) return; this.stats.bottles++;
    const p = new THREE.Vector3(r.x, r.y, r.z); this.fx.bottleBreak(p, r.color); this.audio.play('bottle', p); this.score += 5; this.folie.onBottle();
    if (this.stats.bottles % 25 === 0) this.ui.toast(`${this.stats.bottles} bouteilles cassées. Le patron va être ravi.`);
  }
  hitFlamingo(dmg, point) {
    if (this.flamingoHP <= 0) return; this.flamingoHP -= dmg; this.fx.vaporHit(point, 0xffc0e0); this.audio.play('punch_hit', point);
    this.fx.text(point, 'COUIC', { color: '#ff4fa3', size: 14 });
    if (this.flamingoHP <= 0) { this.ui.announce('LE FLAMANT EST LIBRE', 'Il tombe. Ramassez-le. Ne posez pas de questions.'); this.audio.play('scream', point); this.world.flamingo.userData.taken = true; this.flamingoFall = { t: 0, v: new THREE.Vector3(1.5, 3, 2.5) }; }
  }

  // ------------------------------------------------------------- power-ups
  applyPowerup(k) {
    const def = PU[k]; this.audio.play('powerup'); this.ui.announce(def.name, { slowmo: 'Le temps se fige. Pas vous.', boost: 'Cadence + vitesse + munitions infinies', shield: 'Encaisse 120 dégâts', disco: 'Les zinzins dansent. Frappez-les.', ammo: 'Toutes les armes rechargées', heal: '+50 vitalité', rage: 'Dégâts ×2 · baffes ×6', magnet: 'Les bonus viennent à vous' }[k]);
    this.powerups[k] = { name: def.name, color: def.color, t: def.dur, max: def.dur }; this.folie.onPowerup(); this.tts.say(def.name.toLowerCase(), { priority: 1 });
    if (k === 'ammo') this.weapons.refillAll(); if (k === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    if (k === 'shield') this.shield = 120; if (k === 'slowmo') this.audio.play('slowmo');
    if (k === 'disco') { for (const e of this.enemies.alive) e.dance = def.dur; }
    this.fx.confettiRain(this.player.pos.clone().add(new THREE.Vector3(0, 3, 0)), 30);
  }
  updatePowerups(dt) {
    let slow = false, boost = false, disco = this.waveMod?.key === 'fiesta';
    for (const k in this.powerups) { const p = this.powerups[k]; if (p.t <= 0) continue; p.t -= dt; if (p.t <= 0) { if (k === 'slowmo') this.audio.play('slowmo_end'); if (k === 'boost') this.ui.toast('Fin du boost'); } if (k === 'slowmo' && p.t > 0) slow = true; if (k === 'boost' && p.t > 0) boost = true; if (k === 'disco' && p.t > 0) disco = true; }
    const targetSpeed = slow ? 0.32 : 1; this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * 8)); this.audio.slow = 1 / Math.max(0.4, this.speed) ** 0.35;
    this.weapons.fireRateMul = (boost ? 1.7 : 1) / this.reloadMul; this.weapons.infinite = boost; this.player.speedMul = boost ? 1.35 : 1; this.player.dashCdMul = Math.pow(0.5, this.upgrades.dash || 0);
    const G = this.R.grade.uniforms; G.uSlow.value += ((slow ? 1 : 0) - G.uSlow.value) * (1 - Math.exp(-dt * 6)); G.uDisco.value += ((disco ? 1 : 0) - G.uDisco.value) * (1 - Math.exp(-dt * 4));
    if (disco) { const t = this.time * 4; for (let i = 0; i < this.world.lights.length; i++) { const l = this.world.lights[i]; if (l.isSpotLight) l.color.setHSL((t * 0.2 + i * 0.17) % 1, 0.9, 0.6); } if (this.waveMod?.key === 'fiesta' && Math.random() < dt * 0.08) for (const e of this.enemies.alive) if (Math.random() < 0.4) e.dance = 2.5; } else if (this.discoWas) { for (const l of this.world.lights) if (l.isSpotLight) l.color.set(0xffe2b8); }
    this.discoWas = disco;
    this.flash.intensity += ((this.flashOn ? 14 : 0) - this.flash.intensity) * (1 - Math.exp(-dt * 10));
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
      this.props.update(gdt);
      if (this.state === 'playing') this.waves.update(gdt);
      this.folie.update(dt, this.time);
      if (this.macarena > 0) { this.macarena -= dt; this.weapons.throwT = Math.max(this.weapons.throwT, 0.05); this.player.extraRoll += Math.sin(this.time * 6) * 0.05; this.player.kickVel.y += Math.sin(this.time * 12) * 3; if (this.macarena <= 0) this.ui.toast('Fin de la Macarena. Reprise des hostilités.', 2); }
      this.notifT -= dt; if (this.notifT <= 0 && this.state === 'playing') { this.notifT = 14 + Math.random() * 16; this.ui.notif(NONSENSE[Math.floor(Math.random() * NONSENSE.length)]); }
      this.comboT -= dt; if (this.comboT <= 0 && this.combo > 1) { this.combo = 1; }
      this.fx.update(gdt, this.R.camera);
      if (this.flamingoFall) { const f = this.flamingoFall, F = this.world.flamingo; f.t += gdt; f.v.y -= 12 * gdt; F.position.addScaledVector(f.v, gdt); F.rotation.x += gdt * 3; F.rotation.z += gdt * 1.5; const fy = this.world.floorHeight(F.position.x, F.position.z); if (F.position.y <= fy + 0.3) { const [nx, nz] = this.world.nav.nearestFree(F.position.x, F.position.z); this.weapons.drop('flamingo', new THREE.Vector3(nx, 0, nz)); F.visible = false; F.userData.taken = true; this.flamingoFall = null; this.fx.dust(F.position, 10); this.audio.play('land', F.position); this.fx.shake = 0.8; } }
      if (this.shakeOn) this.player.shake = Math.max(this.player.shake, this.fx.shake);
      G.uFlash.value = this.fx.flash; G.uFlashColor.value.copy(this.fx.flashColor); G.uChroma.value *= Math.exp(-dt * 4); G.uChroma.value = Math.max(G.uChroma.value, this.fx.shake * 0.01);
      G.uDamage.value = this.player.hp < 30 ? 0.35 + Math.sin(this.time * 6) * 0.1 : Math.max(0, G.uDamage.value - dt);
      const L = this.audio.listener; L.x = this.player.pos.x; L.y = this.player.pos.y + 1.6; L.z = this.player.pos.z; L.yaw = this.player.yaw;
      this.audio.setIntensity(this.enemies.alive.length > 6 ? 1 : this.enemies.alive.length > 0 ? 0.6 : 0.2);
      if (this.state === 'playing' && this.nearShop() && this.input.wasPressed('KeyF') && !this.weapons.nearDrop) this.openShop();
      this.ui.update(dt);
    } else if (this.state === 'menu') {
      const t = this.time * 0.08; const cam = this.R.camera; cam.position.set(6.85 + Math.sin(t) * 0.5, 4.6, 10.5); cam.lookAt(-0.5 + Math.sin(t * 0.7) * 1.5, 1.5, -3);
      this.fx.update(dt, cam);
    } else if (this.state === 'paused' || this.state === 'shop') { this.player.updateCamera(dt); }
    this.world.update(dt, this.time, this.player.pos);
  }
}
