// Keyboard / mouse input with pointer lock. Layout-agnostic (uses e.code) so ZQSD and WASD both work.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
    this.locked = false; this.enabled = false; this.sens = 1;
    this.lastTap = {}; this.doubleTap = null;
    window.addEventListener('keydown', e => {
      if (e.repeat) return; if (!this.keys.has(e.code)) this.pressed.add(e.code); this.keys.add(e.code);
      const now = performance.now(); if (this.lastTap[e.code] && now - this.lastTap[e.code] < 260) this.doubleTap = e.code; this.lastTap[e.code] = now;
      if (this.enabled && ['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    document.addEventListener('mousemove', e => { if (!this.locked) return; this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; });
    document.addEventListener('mousedown', e => { if (!this.enabled) return; if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; } if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; } });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    document.addEventListener('wheel', e => { if (this.enabled) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('contextmenu', e => { if (this.enabled) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; this.onLockChange?.(this.locked); });
  }
  lock() { if (!this.locked) { try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => this.canvas.requestPointerLock()); } catch { this.canvas.requestPointerLock(); } } }
  unlock() { if (this.locked) document.exitPointerLock(); }
  // movement axes: x right, z forward (positive = forward)
  axes() {
    const k = this.keys; let x = 0, z = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) z += 1; if (k.has('KeyS') || k.has('ArrowDown')) z -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } return { x, z };
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouse.dx = this.mouse.dy = 0; this.mouse.leftPressed = this.mouse.rightPressed = false; this.mouse.wheel = 0; this.doubleTap = null; }
}
