// 8-connected A* on a uniform grid with string pulling. Height-aware via world.floorHeight.
export class NavGrid {
  constructor(world, step = 0.4) {
    this.world = world; this.step = step;
    this.x0 = -8.2; this.z0 = -12.4; this.w = Math.ceil(16.4 / step); this.h = Math.ceil(24.9 / step);
    this.free = new Uint8Array(this.w * this.h);
    this.rebuild();
  }
  rebuild() {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.x0 + (i + 0.5) * this.step, z = this.z0 + (j + 0.5) * this.step;
      this.free[j * this.w + i] = this.world.isBlocked(x, z, 0.3, this.world.floorHeight(x, z)) ? 0 : 1;
    }
  }
  cell(x, z) { return [Math.floor((x - this.x0) / this.step), Math.floor((z - this.z0) / this.step)]; }
  isFree(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.free[j * this.w + i] === 1; }
  center(i, j) { return [this.x0 + (i + 0.5) * this.step, this.z0 + (j + 0.5) * this.step]; }
  nearestFree(x, z) {
    const [ci, cj] = this.cell(x, z);
    if (this.isFree(ci, cj)) return [x, z];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (this.isFree(ci + di, cj + dj)) return this.center(ci + di, cj + dj);
    }
    return [x, z];
  }
  // returns array of [x,z] waypoints (excluding start), or null
  find(sx, sz, tx, tz, maxIter = 6000) {
    const [si, sj] = this.cell(sx, sz); let [ti, tj] = this.cell(tx, tz);
    if (!this.isFree(ti, tj)) { const n = this.nearestFree(tx, tz); [ti, tj] = this.cell(n[0], n[1]); }
    if (!this.isFree(si, sj) || !this.isFree(ti, tj)) return null;
    const W = this.w, H = this.h, N = W * H;
    if (!this._g) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._closed = new Uint8Array(N); }
    const g = this._g.fill(Infinity), from = this._from.fill(-1), closed = this._closed.fill(0);
    const start = sj * W + si, goal = tj * W + ti;
    g[start] = 0;
    const heap = [[0, start]];
    const hx = (n) => { const i = n % W, j = (n / W) | 0; const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    const push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    let iter = 0, found = false;
    while (heap.length && iter++ < maxIter) {
      const [, n] = pop(); if (closed[n]) continue; closed[n] = 1;
      if (n === goal) { found = true; break; }
      const i = n % W, j = (n / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj;
        if (!this.isFree(ni, nj)) continue;
        if (di && dj && (!this.isFree(i + di, j) || !this.isFree(i, j + dj))) continue; // no corner cutting
        const nn = nj * W + ni; if (closed[nn]) continue;
        const ng = g[n] + (di && dj ? 1.4142 : 1);
        if (ng < g[nn]) { g[nn] = ng; from[nn] = n; push(ng + hx(nn), nn); }
      }
    }
    if (!found) return null;
    const cells = []; for (let n = goal; n !== -1 && n !== start; n = from[n]) cells.push(n);
    cells.reverse();
    const pts = cells.map(n => this.center(n % W, (n / W) | 0));
    pts[pts.length - 1] = [tx, tz];
    // string pulling
    const out = []; let cur = [sx, sz]; let k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) { if (this.clearWalk(cur[0], cur[1], pts[m][0], pts[m][1])) { far = m; break; } }
      out.push(pts[far]); cur = pts[far]; k = far + 1;
    }
    return out;
  }
  clearWalk(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(d / 0.2));
    let py = this.world.floorHeight(ax, az);
    for (let i = 1; i <= n; i++) { const t = i / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; const y = this.world.floorHeight(x, z); if (Math.abs(y - py) > 0.5) return false; py = y; if (this.world.isBlocked(x, z, 0.3, y)) return false; }
    return true;
  }
  randomFree(rng = Math.random) {
    for (let k = 0; k < 50; k++) { const i = (rng() * this.w) | 0, j = (rng() * this.h) | 0; if (this.isFree(i, j)) return this.center(i, j); }
    return [0, 0];
  }
}
