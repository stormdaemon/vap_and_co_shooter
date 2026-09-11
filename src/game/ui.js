// HUD, announcements, minimap, overlays.
const $ = s => document.querySelector(s);
const COMBO_NAMES = [[2, 'DOUBLE ZINZIN'], [3, 'TRIPLÉ DE LA VAPE'], [5, 'CARNAGE AU COMPTOIR'], [8, 'FOLIE FURIEUSE'], [12, 'LÉGENDE DU 50 ML'], [16, 'DIEU DU CLOUD'], [24, 'ASILE COMPLET']];

export class UI {
  constructor(game) {
    this.g = game; this.el = {
      hp: $('#hp'), hpFill: $('#hpFill'), healthcard: $('#healthcard'), stamFill: $('#stamFill'), stamLabel: $('#stamLabel'),
      wave: $('#waveNum'), waveState: $('#waveState'), score: $('#score'), combo: $('#combo'), comboLabel: $('#comboLabel'), enemies: $('#enemiesLeft'), kills: $('#killCount'),
      wname: $('#weaponName'), wdesc: $('#weaponDesc'), mag: $('#ammoMag'), res: $('#ammoRes'), reload: $('#reloadFill'), slots: $('#wslots'), wcard: $('#weaponcard'),
      prompt: $('#prompt'), promptName: $('#promptName'), promptSub: $('#promptSub'), toast: $('#toast'), announce: $('#announce'), aMain: $('#announceMain'), aSub: $('#announceSub'),
      vign: $('#dmgVignette'), dir: $('#dmgDir'), lowhp: $('#lowhp'), fps: $('#fps'), cross: $('#crosshair'), hit: $('#hitmarker'), pus: $('#powerups'), minimap: $('#minimap'),
    };
    this.toastT = 0; this.announceT = 0; this.vign = 0; this.dirT = 0; this.hitT = 0; this.tick = 0; this.fpsAcc = 0; this.fpsN = 0; this.showFps = false;
    this.mm = this.el.minimap.getContext('2d');
  }
  setWaveState(t) { this.el.waveState.textContent = t; }
  announce(main, sub = '') { this.el.aMain.textContent = main; this.el.aSub.textContent = sub; this.el.announce.classList.remove('on'); void this.el.announce.offsetWidth; this.el.announce.classList.add('on'); this.announceT = 2.6; }
  toast(msg, dur = 3) { this.el.toast.textContent = msg; this.el.toast.classList.add('on'); this.toastT = dur; }
  hitmarker(kill = false) { this.el.hit.classList.add('on'); this.el.hit.classList.toggle('kill', kill); this.hitT = 0.12; }
  damageFrom(pos) {
    const P = this.g.player; if (!pos) { this.vign = 1; return; }
    const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z; const ang = Math.atan2(dx, -dz) - P.yaw; this.el.dir.style.transform = `rotate(${-ang}rad)`; this.dirT = 0.9; this.vign = 1;
  }
  comboName(n) { let name = ''; for (const [k, v] of COMBO_NAMES) if (n >= k) name = v; return name; }
  weaponChanged() { this.refreshWeapon(true); }
  refreshWeapon(force) {
    const W = this.g.weapons; if (!W) return; const D = W.def, a = W.ammo; const e = this.el;
    e.wname.textContent = D.name; e.wdesc.textContent = D.desc;
    if (D.melee) { e.mag.textContent = '∞'; e.res.textContent = D.key === 'flamingo' ? 'Balayage large · E = poing' : 'E ou clic gauche'; e.wcard.classList.remove('lowammo'); }
    else { e.mag.textContent = a.mag; e.res.textContent = W.infinite ? '∞ · BOOST' : `/ ${a.reserve}`; e.wcard.classList.toggle('lowammo', a.mag <= Math.ceil(D.mag * 0.25)); }
    let h = ''; for (let i = 0; i < 5; i++) { const k = W.slots[i]; const has = k && W.has(k); h += `<span class="${has ? 'has' : ''} ${k === W.cur ? 'cur' : ''}">${i + 1}</span>`; } e.slots.innerHTML = h;
  }
  update(dt) {
    const g = this.g, P = g.player, e = this.el; this.tick += dt;
    // fast items every frame
    this.vign = Math.max(0, this.vign - dt * 1.6); e.vign.style.opacity = this.vign * 0.9; this.dirT -= dt; e.dir.style.opacity = Math.max(0, Math.min(1, this.dirT));
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) e.hit.classList.remove('on'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.remove('on'); }
    if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) e.announce.classList.remove('on'); }
    e.cross.classList.toggle('ads', P.ads > 0.5); e.cross.style.setProperty('--gap', `${6 + Math.min(14, P.moving * 1.5 + (P.onGround ? 0 : 8)) * (1 - P.ads * 0.7)}px`);
    const W = g.weapons; if (W.reloading > 0) e.reload.style.width = `${(1 - W.reloading / W.reloadTotal) * 100}%`; else e.reload.style.width = '0';
    // prompt
    const nd = W.nearDrop; if (nd) { e.prompt.classList.remove('hidden'); e.promptName.textContent = `Ramasser : ${nd.label}`; e.promptSub.textContent = nd.key === 'flamingo' ? 'Arme de mêlée légendaire' : (W.inv[nd.key] ? 'Ajoute des munitions' : 'Nouvelle arme'); } else e.prompt.classList.add('hidden');
    this.fpsAcc += dt; this.fpsN++;
    if (this.tick < 0.1) return; this.tick = 0;
    // 10 Hz items
    e.hp.textContent = Math.ceil(P.hp); e.hpFill.style.width = `${P.hp / P.maxHp * 100}%`; e.healthcard.classList.toggle('crit', P.hp < 30); e.lowhp.classList.toggle('on', P.hp < 30 && !P.dead);
    e.stamFill.style.width = `${P.stamina * 100}%`; e.stamLabel.textContent = P.stamina >= 0.99 ? 'DASH PRÊT' : 'RECHARGE…';
    e.wave.textContent = g.wave; e.score.textContent = g.score.toLocaleString('fr-FR');
    e.combo.textContent = `×${g.combo}`; e.combo.classList.toggle('hot', g.combo >= 5); e.comboLabel.textContent = g.combo >= 2 ? this.comboName(g.combo) : '';
    const alive = g.enemies.alive.length; e.enemies.textContent = alive; e.kills.textContent = `${g.stats.kills} hors combat`;
    this.refreshWeapon();
    // powerups
    let h = ''; for (const k in g.powerups) { const p = g.powerups[k]; if (p.t > 0) h += `<div class="pu" style="color:${p.color}">${p.name}<i style="width:${p.t / p.max * 100}%"></i></div>`; } e.pus.innerHTML = h;
    if (this.showFps) { e.fps.style.display = 'block'; e.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} FPS · ${g.R.r.info.render.calls} appels · ${(g.R.r.info.render.triangles / 1000).toFixed(0)}k tris · ${Math.round(g.R.dynamicScale * 100)}%`; } else e.fps.style.display = 'none';
    this.fpsAcc = 0; this.fpsN = 0;
    this.drawMinimap();
  }
  drawMinimap() {
    const c = this.mm, W = this.g.world, P = this.g.player; const w = 200, h = 150; c.clearRect(0, 0, w, h);
    const sx = w / 17.6, sz = h / 26.4; const X = x => (x + 8.8) * sx, Z = z => (z + 13.2) * sz;
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(X(-8.6), Z(-12.9), 17.2 * sx, 25.8 * sz);
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const b of W.colliders) { if (b.kind === 'rail' || b.top < 0.5) continue; c.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sx, (b.z1 - b.z0) * sz); }
    for (const d of this.g.weapons.drops) { c.fillStyle = d.kind === 'powerup' ? '#d7f06a' : '#5ef2ff'; c.beginPath(); c.arc(X(d.pos.x), Z(d.pos.z), 2.5, 0, 6.28); c.fill(); }
    for (const e of this.g.enemies.list) { if (!e.alive) continue; c.fillStyle = e.T.boss ? '#ff4fa3' : '#ff7a5c'; c.beginPath(); c.arc(X(e.pos.x), Z(e.pos.z), e.T.boss ? 4 : 2.5, 0, 6.28); c.fill(); }
    // player + view cone
    c.save(); c.translate(X(P.pos.x), Z(P.pos.z)); c.rotate(-P.yaw); c.fillStyle = 'rgba(215,240,106,.25)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 22, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); c.closePath(); c.fill(); c.fillStyle = '#d7f06a'; c.beginPath(); c.arc(0, 0, 3.5, 0, 6.28); c.fill(); c.restore();
  }
  overlay(kind, stats) {
    const ov = $('#overlay'); ov.classList.remove('hidden'); const g = this.g;
    const st = `<div>Vague atteinte <b>${g.wave}</b></div><div>Score <b>${g.score.toLocaleString('fr-FR')}</b></div><div>Zinzins neutralisés <b>${g.stats.kills}</b></div><div>Meilleur combo <b>×${g.stats.bestCombo}</b></div><div>Tirs <b>${g.stats.shots}</b></div><div>Précision <b>${g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) : 0}%</b></div><div>Bouteilles cassées <b>${g.stats.bottles}</b></div><div>Temps <b>${Math.floor(g.stats.time / 60)}:${String(Math.floor(g.stats.time % 60)).padStart(2, '0')}</b></div>`;
    $('#ovStats').innerHTML = st;
    if (kind === 'pause') { $('#ovLabel').textContent = 'PAUSE'; $('#ovTitle').textContent = 'Respire.'; $('#ovText').textContent = 'Les zinzins attendent poliment. Échap ou Reprendre pour continuer.'; $('#btnResume').classList.remove('hidden'); }
    else { $('#ovLabel').textContent = 'HORS COMBAT'; $('#ovTitle').textContent = kind === 'record' ? 'Nouveau record !' : 'Le magasin est tombé.'; $('#ovText').textContent = 'Les zinzins ont vidé les rayons. Votre score est sauvegardé. Rejouez et montez plus haut.'; $('#btnResume').classList.add('hidden'); }
  }
  hideOverlay() { $('#overlay').classList.add('hidden'); }
}
