// First-person controller: fixed-timestep physics, capsule-vs-AABB, sprint, crouch, slide, jump, dash, head bob.
import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const RADIUS = 0.32, STAND = 1.7, CROUCH = 1.1, STEP = 0.36;

export class Player {
  constructor(world, camera, input) {
    this.world = world; this.camera = camera; this.input = input;
    this.pos = new THREE.Vector3(5.9, 0, 10.5); this.prev = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eye = STAND; this.eyeTarget = STAND;
    this.onGround = true; this.crouch = false; this.sliding = 0; this.slideDir = new THREE.Vector3();
    this.dashCd = 0; this.dashTime = 0; this.dashDir = new THREE.Vector3(); this.stamina = 1;
    this.hp = 100; this.maxHp = 100; this.lastHurt = -99; this.dead = false;
    this.speedMul = 1; this.bobPhase = 0; this.bobAmt = 0; this.landDip = 0; this.airTime = 0;
    this.kick = new THREE.Vector2(); this.kickVel = new THREE.Vector2(); this.shake = 0; this.shakeVec = new THREE.Vector3();
    this.fovBase = 82; this.fovKick = 0; this.ads = 0; this.adsTarget = 0;
    this.moving = 0; this.running = false; this.footstep = 0; this.onFootstep = null;
    this.acc = 0; this.step = 1 / 120; this.time = 0;
    this.lastGroundY = 0; this.noclip = false;
  }
  reset(x = 5.9, z = 10.5, yaw = 0) { this.pos.set(x, 0, z); this.prev.copy(this.pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.hp = this.maxHp; this.dead = false; this.sliding = 0; this.dashCd = 0; this.crouch = false; this.eye = this.eyeTarget = STAND; }

  get eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z); }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  lookDir(out = new THREE.Vector3()) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }

  // ground height under (x,z) for a body with feet at y (allows standing on collider tops within STEP)
  groundAt(x, z, y) {
    let g = this.world.floorHeight(x, z);
    for (const c of this.world.colliders) {
      if (c.kind === 'rail' || c.kind === 'under') continue;
      if (x + RADIUS * 0.6 > c.x0 && x - RADIUS * 0.6 < c.x1 && z + RADIUS * 0.6 > c.z0 && z - RADIUS * 0.6 < c.z1) {
        if (c.top > g && c.top <= y + STEP) g = c.top;
      }
    }
    return g;
  }
  // push the capsule (circle in XZ) out of AABB colliders that are taller than feet+STEP
  resolve(pos) {
    const B = this.world.bounds;
    pos.x = clamp(pos.x, B.x0 + RADIUS, B.x1 - RADIUS); pos.z = clamp(pos.z, B.z0 + RADIUS, B.z1 - RADIUS);
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const c of this.world.colliders) {
        if (c.top <= pos.y + STEP) continue;              // low enough to step onto
        if (c.bottom !== undefined && c.bottom > pos.y + 1.6) continue; // above our head
        if (c.kind === 'under' && pos.y > 3.0) continue;  // we're on the mezzanine, ignore its underside block
        const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
        let dx = pos.x - cx, dz = pos.z - cz; let d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        any = true;
        if (d2 < 1e-8) { // inside: push out along the smallest penetration axis
          const px = Math.min(pos.x - c.x0, c.x1 - pos.x), pz = Math.min(pos.z - c.z0, c.z1 - pos.z);
          if (px < pz) pos.x += (pos.x - c.x0 < c.x1 - pos.x ? -1 : 1) * (px + RADIUS); else pos.z += (pos.z - c.z0 < c.z1 - pos.z ? -1 : 1) * (pz + RADIUS);
        } else { const d = Math.sqrt(d2); const push = RADIUS - d; pos.x += dx / d * push; pos.z += dz / d * push; }
      }
      if (!any) break;
    }
  }

  update(dt, gameSpeed = 1, opts = {}) {
    const inp = this.input;
    // ---- look (frame rate independent, applied immediately)
    const sens = 0.0022 * inp.sens * (1 - this.ads * 0.45);
    this.yaw -= inp.mouse.dx * sens; this.pitch -= inp.mouse.dy * sens; this.pitch = clamp(this.pitch, -1.5, 1.5);
    this.ads += (this.adsTarget - this.ads) * (1 - Math.exp(-dt * 14));
    // ---- physics in fixed steps
    this.acc += Math.min(dt, 0.1) * gameSpeed;
    let steps = 0;
    while (this.acc >= this.step && steps++ < 12) { this.prev.copy(this.pos); this.fixed(this.step, opts); this.acc -= this.step; }
    // ---- camera
    this.updateCamera(dt);
  }
  fixed(h, opts) {
    const inp = this.input, fw = this.forward(), rt = this.right();
    const ax = inp.axes(); if (this.dead) { ax.x = ax.z = 0; }
    this.time += h;
    // crouch / slide
    const wantCrouch = inp.down('KeyC') || inp.down('ControlLeft');
    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    if (wantCrouch && !this.crouch && this.onGround && this.running && speedNow > 3.5 && this.sliding <= 0 && this.slideCd <= 0) {
      this.sliding = 0.75; this.slideDir.set(this.vel.x, 0, this.vel.z).normalize(); const boost = Math.max(speedNow * 1.25, 6.5); this.vel.x = this.slideDir.x * boost; this.vel.z = this.slideDir.z * boost; this.onSlide?.();
    }
    this.crouch = wantCrouch || this.sliding > 0;
    this.eyeTarget = this.crouch ? CROUCH : STAND;
    this.eye += (this.eyeTarget - this.eye) * (1 - Math.exp(-h * 12));
    this.slideCd = Math.max(0, (this.slideCd || 0) - h);
    // dash (double-tap direction or Ctrl+direction) — 2.4s cooldown, stamina
    this.dashCd = Math.max(0, this.dashCd - h);
    this.stamina = Math.min(1, this.stamina + h / (2.4 * (this.dashCdMul || 1)));
    const dashKeys = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (this.stamina >= 0.99 && inp.doubleTap && dashKeys[inp.doubleTap] && !this.dead) {
      const d = dashKeys[inp.doubleTap]; this.dashDir.set(0, 0, 0).addScaledVector(rt, d[0]).addScaledVector(fw, d[1]).normalize();
      this.dashTime = 0.16; this.stamina = 0; this.dashCd = 2.4; inp.doubleTap = null; this.onDash?.();
    }
    // movement
    this.running = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const base = this.crouch && this.sliding <= 0 ? 2.4 : this.running ? 6.4 : 4.2;
    const speed = base * this.speedMul * (1 - this.ads * 0.35);
    const want = new THREE.Vector3().addScaledVector(rt, ax.x).addScaledVector(fw, ax.z).multiplyScalar(speed);
    const accel = this.onGround ? 42 : 9, fric = this.onGround ? 12 : 0.6;
    if (this.sliding > 0) {
      this.sliding -= h; const f = 1 - Math.exp(-h * 2.2); this.vel.x -= this.vel.x * f * 0.9; this.vel.z -= this.vel.z * f * 0.9;
      // small steering
      this.vel.x += rt.x * ax.x * 3 * h; this.vel.z += rt.z * ax.x * 3 * h;
      if (this.sliding <= 0) this.slideCd = 0.5;
    } else if (this.dashTime > 0) {
      this.dashTime -= h; this.vel.x = this.dashDir.x * 22; this.vel.z = this.dashDir.z * 22;
    } else {
      // exponential approach to wanted velocity (silky, no overshoot)
      const k = 1 - Math.exp(-h * (ax.x || ax.z ? accel / 3 : fric));
      this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    }
    // gravity + jump
    const g = 16;
    if (this.onGround && inp.wasPressed('Space') && !this.dead) { this.vel.y = 5.6; this.onGround = false; this.onJump?.(); }
    if (inp.pressed.has('Space')) inp.pressed.delete('Space');
    if (!this.onGround) { this.vel.y -= g * h; this.airTime += h; } else this.airTime = 0;
    // integrate
    const next = this.pos.clone().addScaledVector(this.vel, h);
    // resolve horizontal
    this.resolve(next);
    // ground
    const gy = this.groundAt(next.x, next.z, this.pos.y);
    if (next.y <= gy + 0.001 && this.vel.y <= 0) {
      if (!this.onGround && this.vel.y < -6) { this.landDip = Math.min(0.18, -this.vel.y * 0.02); this.onLand?.(-this.vel.y); }
      next.y = gy; this.vel.y = 0; this.onGround = true;
    } else if (next.y > gy + 0.02) { this.onGround = false; }
    else { next.y = gy; this.onGround = true; }
    // dropping off a ledge: if ground is far below, fall
    this.pos.copy(next);
    // bob
    const sp = Math.hypot(this.vel.x, this.vel.z); this.moving = sp;
    if (this.onGround && sp > 0.5 && this.sliding <= 0) {
      const rate = (this.running ? 11 : 8.5) * (sp / (this.running ? 6.4 : 4.2)); const before = this.bobPhase;
      this.bobPhase += h * rate; this.bobAmt += (1 - this.bobAmt) * (1 - Math.exp(-h * 8));
      if (Math.floor(before / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) this.onFootstep?.(this.running);
    } else this.bobAmt *= Math.exp(-h * 8);
    this.landDip *= Math.exp(-h * 6);
    // recoil spring
    this.kickVel.addScaledVector(this.kick, -h * 380); this.kickVel.multiplyScalar(Math.exp(-h * 22)); this.kick.addScaledVector(this.kickVel, h);
    this.shake *= Math.exp(-h * 6);
    this.fovKick *= Math.exp(-h * 8);
    this.hpRegen(h);
  }
  hpRegen(h) { if (!this.dead && this.time - this.lastHurt > 6 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 6 * h); }
  damage(amount, from) {
    if (this.dead) return; this.hp -= amount; this.lastHurt = this.time; this.shake = Math.max(this.shake, Math.min(1, amount / 30));
    this.kickVel.x += (Math.random() - 0.5) * 6; this.kickVel.y += 3;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    this.onDamage?.(amount, from);
  }
  updateCamera(dt) {
    const alpha = clamp(this.acc / this.step, 0, 1);
    const p = this.prev.clone().lerp(this.pos, alpha);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.045 * this.bobAmt * (this.running ? 1.3 : 1);
    const bobX = Math.sin(this.bobPhase * 0.5) * 0.02 * this.bobAmt;
    const slideRoll = this.sliding > 0 ? 0.06 : 0;
    const sh = this.shake * 0.05;
    this.shakeVec.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0);
    const rt = this.right();
    this.camera.position.set(p.x + rt.x * bobX + this.shakeVec.x, p.y + this.eye + bobY - this.landDip + this.shakeVec.y, p.z + rt.z * bobX);
    this.camera.rotation.set(this.pitch + this.kick.y * 0.01 - this.landDip * 0.4, this.yaw + this.kick.x * 0.01, Math.sin(this.bobPhase * 0.5) * 0.006 * this.bobAmt + slideRoll + this.shakeVec.x * 2, 'YXZ');
    const fov = this.fovBase * (1 - this.ads * 0.3) + this.fovKick + (this.sliding > 0 || this.dashTime > 0 ? 6 : 0) + (this.running && this.moving > 4 ? 4 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 10)); this.camera.updateProjectionMatrix(); }
  }
}
