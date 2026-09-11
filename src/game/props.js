// Dynamic physics props (stools, jars): get shot, fly, bounce, and bonk zinzins on the way.
import * as THREE from 'three';

class Prop {
  constructor(sys, spec) {
    this.sys = sys; this.g = sys.g; this.spec = spec; const M = this.g.world.M; this.kind = spec.kind;
    const grp = new THREE.Group();
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    if (spec.kind === 'stool') {
      mk(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), M.metalDark, 0, 0.4, 0); mk(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), M.metalDark, 0, 0.02, 0);
      mk(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), M.fabric, 0, 0.82, 0); mk(new THREE.BoxGeometry(0.32, 0.36, 0.04), M.fabric, 0, 1.12, -0.16);
      this.radius = 0.22; this.height = 1.3; this.mass = 1.2; this.hp = 40; this.origin = new THREE.Vector3(spec.x, 0, spec.z);
    } else {
      mk(new THREE.CylinderGeometry(0.07, 0.065, 0.16, 14), M.jar, 0, 0.08, 0); mk(new THREE.CylinderGeometry(0.072, 0.072, 0.02, 14), M.black, 0, 0.17, 0);
      for (let k = 0; k < 5; k++) mk(new THREE.SphereGeometry(0.025, 6, 6), M.gummy, (Math.random() - 0.5) * 0.06, 0.03 + k * 0.028, (Math.random() - 0.5) * 0.06);
      this.radius = 0.09; this.height = 0.18; this.mass = 0.4; this.hp = 10; this.origin = new THREE.Vector3(spec.x, spec.y, spec.z);
    }
    this.mesh = grp; this.g.R.scene.add(grp);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.rot = new THREE.Euler(); this.angVel = new THREE.Vector3(); this.alive = true; this.resting = true; this.airTime = 0;
    this.reset();
  }
  reset() { this.pos.copy(this.origin); this.vel.set(0, 0, 0); this.rot.set(0, 0, 0); this.angVel.set(0, 0, 0); this.alive = true; this.resting = true; this.mesh.visible = true; this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, 0, 0); this.hp = this.kind === 'stool' ? 40 : 10; }
  capsule() { return { x: this.pos.x, z: this.pos.z, y0: this.pos.y, y1: this.pos.y + this.height, r: this.radius }; }
  hit(dmg, dir, knock = 3) {
    if (!this.alive) return; this.hp -= dmg;
    const k = Math.max(2, knock) * 1.4 / this.mass; this.vel.addScaledVector(dir.clone().normalize(), k); this.vel.y += k * 0.35 + 1.5;
    this.angVel.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12); this.resting = false; this.airTime = 0;
    this.g.audio.play(this.kind === 'jar' ? 'bottle' : 'ricochet', this.pos); this.g.fx.dust(this.pos, 2);
    if (this.kind === 'jar' && this.hp <= 0) this.shatter();
  }
  shatter() {
    this.alive = false; this.mesh.visible = false; this.g.fx.bottleBreak(this.pos.clone(), new THREE.Color(0xff7bb0)); this.g.audio.play('bottle', this.pos);
    for (let i = 0; i < 8; i++) this.g.fx.chunk(this.pos, new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), { size: 0.04, color: [0xff4fa3, 0xd7f06a, 0x5ef2ff][i % 3], life: 3 });
    this.g.score += 10;
  }
  update(dt) {
    if (!this.alive || this.resting) return;
    const W = this.g.world; this.vel.y -= 14 * dt; this.pos.addScaledVector(this.vel, dt); this.airTime += dt;
    // world bounds / colliders (simple: bounce off AABBs)
    const B = W.bounds, r = this.radius; if (this.pos.x < B.x0 + r) { this.pos.x = B.x0 + r; this.vel.x *= -0.4; } if (this.pos.x > B.x1 - r) { this.pos.x = B.x1 - r; this.vel.x *= -0.4; } if (this.pos.z < B.z0 + r) { this.pos.z = B.z0 + r; this.vel.z *= -0.4; } if (this.pos.z > B.z1 - r) { this.pos.z = B.z1 - r; this.vel.z *= -0.4; }
    for (const c of W.colliders) { if (c.kind === 'rail' || c.top <= this.pos.y) continue; const cx = Math.max(c.x0, Math.min(c.x1, this.pos.x)), cz = Math.max(c.z0, Math.min(c.z1, this.pos.z)); const dx = this.pos.x - cx, dz = this.pos.z - cz; const d2 = dx * dx + dz * dz; if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x += dx / d * (r - d); this.pos.z += dz / d * (r - d); const n = new THREE.Vector3(dx / d, 0, dz / d); const vn = this.vel.dot(n); if (vn < 0) this.vel.addScaledVector(n, -vn * 1.4); this.g.audio.play('ricochet', this.pos); } }
    const fy = W.floorHeight(this.pos.x, this.pos.z);
    if (this.pos.y < fy) { this.pos.y = fy; if (this.vel.y < -2) { this.g.audio.play(this.kind === 'jar' ? 'ricochet' : 'land', this.pos); if (this.kind === 'jar' && this.vel.y < -6) { this.shatter(); return; } } this.vel.y = -this.vel.y * 0.35; this.vel.x *= 0.7; this.vel.z *= 0.7; this.angVel.multiplyScalar(0.5); if (Math.abs(this.vel.y) < 0.6 && this.vel.lengthSq() < 0.3) { this.resting = true; this.vel.set(0, 0, 0); this.rot.x = Math.round(this.rot.x / (Math.PI / 2)) * (Math.PI / 2); this.rot.z = Math.round(this.rot.z / (Math.PI / 2)) * (Math.PI / 2); } }
    this.rot.x += this.angVel.x * dt; this.rot.y += this.angVel.y * dt; this.rot.z += this.angVel.z * dt;
    // bonk zinzins
    const sp = this.vel.length();
    if (sp > 4) for (const e of this.g.enemies.list) { if (!e.alive) continue; const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); if (d < e.radius + r && this.pos.y < e.pos.y + e.height && this.pos.y + this.height > e.pos.y) { this.g.hitEnemy(e, 18 * this.mass + sp * 2, this.vel.clone().normalize(), 6, false, 'prop', e.chest); this.g.fx.text(e.headPos, 'BONK', { color: '#ffb347', size: 16 }); this.vel.multiplyScalar(-0.3); this.vel.y = 2; break; } }
    this.mesh.position.copy(this.pos); this.mesh.rotation.copy(this.rot);
  }
}

export class Props {
  constructor(game) { this.g = game; this.list = game.world.propSpecs.map(s => new Prop(this, s)); }
  update(dt) { for (const p of this.list) p.update(dt); }
  reset() { for (const p of this.list) p.reset(); }
  // explosions push props around
  blast(p, radius, force) { for (const pr of this.list) { if (!pr.alive) continue; const d = pr.pos.distanceTo(p); if (d < radius + 0.5) { const dir = pr.pos.clone().sub(p).setY(0.6).normalize(); pr.hit(20, dir, force * (1 - d / (radius + 0.5))); } } }
}
