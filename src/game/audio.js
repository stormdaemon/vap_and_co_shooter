// Procedural WebAudio: SFX synth + synthwave music loop. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.master = null; this.musicOn = true; this.sfxGain = null; this.musicGain = null; this.listener = { x: 0, y: 0, z: 0, yaw: 0 }; this.started = false; this.slow = 1; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = new (window.AudioContext || window.webkitAudioContext)(); this.ctx = C;
    this.master = C.createGain(); this.master.gain.value = 0.8;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    this.master.connect(comp); comp.connect(C.destination);
    this.sfxGain = C.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.musicGain = C.createGain(); this.musicGain.gain.value = this.musicOn ? 0.32 : 0; this.musicGain.connect(this.master);
    // noise buffer
    const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // ambience: brown noise lowpass
    const b2 = C.createBuffer(1, len, C.sampleRate), d2 = b2.getChannelData(0); let acc = 0; for (let i = 0; i < len; i++) { acc = (acc + (Math.random() * 2 - 1) * 0.04) / 1.04; d2[i] = acc * 4; }
    const amb = C.createBufferSource(); amb.buffer = b2; amb.loop = true; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const ag = C.createGain(); ag.gain.value = 0.05; amb.connect(lp); lp.connect(ag); ag.connect(this.master); amb.start();
    this.started = true;
  }
  setMusic(on) { this.musicOn = on; if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1); }
  // spatialisation: returns [gain, pan]
  spatial(pos) {
    if (!pos) return [1, 0];
    const L = this.listener; const dx = pos.x - L.x, dz = pos.z - L.z, dist = Math.hypot(dx, pos.y - L.y, dz);
    const g = 1 / (1 + dist * 0.18);
    // right vector of the listener: (cos yaw, -sin yaw)
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw); const pan = dist > 0.3 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist * 0.8)) : 0;
    return [g, pan];
  }
  out(pos, vol = 1) {
    const C = this.ctx; const [g, pan] = this.spatial(pos);
    const gn = C.createGain(); gn.gain.value = vol * g; const p = C.createStereoPanner(); p.pan.value = pan; gn.connect(p); p.connect(this.sfxGain); return gn;
  }
  noiseBurst({ dur = 0.15, freq = 2000, freqEnd = 300, type = 'lowpass', q = 1, vol = 0.5, pos = null, attack = 0.002 }) {
    const C = this.ctx; if (!C) return; const src = C.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 1 / this.slow;
    const f = C.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, C.currentTime); f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), C.currentTime + dur);
    const env = C.createGain(); env.gain.setValueAtTime(0, C.currentTime); env.gain.linearRampToValueAtTime(1, C.currentTime + attack); env.gain.exponentialRampToValueAtTime(0.001, C.currentTime + dur);
    src.connect(f); f.connect(env); env.connect(this.out(pos, vol)); src.start(); src.stop(C.currentTime + dur + 0.05);
  }
  tone({ freq = 440, freqEnd = null, dur = 0.2, type = 'sine', vol = 0.3, pos = null, attack = 0.005, delay = 0 }) {
    const C = this.ctx; if (!C) return; const o = C.createOscillator(); o.type = type; const t0 = C.currentTime + delay;
    o.frequency.setValueAtTime(freq / this.slow, t0); if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd / this.slow), t0 + dur);
    const env = C.createGain(); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1, t0 + attack); env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(env); env.connect(this.out(pos, vol)); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // ---- named effects
  play(name, pos = null, opt = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'shot_vapo': this.noiseBurst({ dur: 0.12, freq: 5000, freqEnd: 400, vol: 0.5, pos }); this.tone({ freq: 900, freqEnd: 120, dur: 0.12, type: 'square', vol: 0.18, pos }); this.tone({ freq: 2400, freqEnd: 1800, dur: 0.06, type: 'sine', vol: 0.12, pos }); break;
      case 'shot_fumi': this.noiseBurst({ dur: 0.32, freq: 2800, freqEnd: 150, vol: 0.9, pos }); this.tone({ freq: 140, freqEnd: 35, dur: 0.3, type: 'triangle', vol: 0.5, pos }); break;
      case 'shot_gummy': this.tone({ freq: 700 + Math.random() * 300, freqEnd: 300, dur: 0.07, type: 'square', vol: 0.12, pos }); this.noiseBurst({ dur: 0.05, freq: 3000, freqEnd: 800, vol: 0.2, pos }); break;
      case 'shot_flamant': this.noiseBurst({ dur: 0.5, freq: 1500, freqEnd: 100, vol: 0.8, pos }); this.tone({ freq: 400, freqEnd: 60, dur: 0.5, type: 'sawtooth', vol: 0.35, pos }); this.tone({ freq: 1200, freqEnd: 2400, dur: 0.35, type: 'sine', vol: 0.15, pos }); break;
      case 'shot_enemy': this.noiseBurst({ dur: 0.14, freq: 3500, freqEnd: 300, vol: 0.45, pos }); this.tone({ freq: 500, freqEnd: 90, dur: 0.14, type: 'square', vol: 0.15, pos }); break;
      case 'empty': this.tone({ freq: 220, dur: 0.06, type: 'square', vol: 0.1 }); break;
      case 'reload': this.tone({ freq: 800, dur: 0.04, type: 'square', vol: 0.12 }); this.tone({ freq: 500, dur: 0.05, type: 'square', vol: 0.12, delay: 0.25 }); this.tone({ freq: 1100, dur: 0.05, type: 'square', vol: 0.12, delay: 0.55 }); break;
      case 'rack': this.noiseBurst({ dur: 0.06, freq: 4000, freqEnd: 2000, vol: 0.25 }); this.tone({ freq: 1400, dur: 0.05, type: 'square', vol: 0.1 }); break;
      case 'punch_hit': this.noiseBurst({ dur: 0.12, freq: 900, freqEnd: 200, vol: 0.6, pos }); this.tone({ freq: 130, freqEnd: 45, dur: 0.14, type: 'sine', vol: 0.5, pos }); break;
      case 'punch_miss': this.noiseBurst({ dur: 0.1, freq: 1200, freqEnd: 600, type: 'bandpass', q: 2, vol: 0.3 }); break;
      case 'flamingo_hit': this.noiseBurst({ dur: 0.25, freq: 600, freqEnd: 120, vol: 0.7, pos }); this.tone({ freq: 90, freqEnd: 30, dur: 0.3, type: 'sine', vol: 0.6, pos }); this.tone({ freq: 1800, freqEnd: 400, dur: 0.15, type: 'sawtooth', vol: 0.1, pos }); break;
      case 'hit': this.tone({ freq: 1800, freqEnd: 1200, dur: 0.04, type: 'sine', vol: 0.14 }); break;
      case 'kill': this.tone({ freq: 600, freqEnd: 1400, dur: 0.1, type: 'sine', vol: 0.14 }); this.tone({ freq: 900, freqEnd: 2000, dur: 0.12, type: 'sine', vol: 0.12, delay: 0.05 }); break;
      case 'headshot': this.tone({ freq: 2200, freqEnd: 3200, dur: 0.08, type: 'triangle', vol: 0.18 }); this.noiseBurst({ dur: 0.08, freq: 6000, freqEnd: 3000, vol: 0.2 }); break;
      case 'hurt': this.tone({ freq: 95, freqEnd: 40, dur: 0.25, type: 'sine', vol: 0.5 }); this.noiseBurst({ dur: 0.15, freq: 800, freqEnd: 200, vol: 0.3 }); break;
      case 'explosion': this.noiseBurst({ dur: 0.9, freq: 1200, freqEnd: 40, vol: 1.2, pos }); this.tone({ freq: 90, freqEnd: 25, dur: 0.8, type: 'sine', vol: 0.9, pos }); break;
      case 'bottle': this.noiseBurst({ dur: 0.18, freq: 6000, freqEnd: 2500, type: 'highpass', vol: 0.35, pos }); this.tone({ freq: 2600 + Math.random() * 800, freqEnd: 1800, dur: 0.12, type: 'triangle', vol: 0.12, pos }); break;
      case 'pickup': this.tone({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.2 }); this.tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.2, delay: 0.08 }); this.tone({ freq: 1320, dur: 0.16, type: 'triangle', vol: 0.2, delay: 0.16 }); break;
      case 'powerup': for (let i = 0; i < 5; i++) this.tone({ freq: 440 * Math.pow(2, i / 5), dur: 0.2, type: 'sine', vol: 0.18, delay: i * 0.06 }); break;
      case 'footstep': this.noiseBurst({ dur: 0.07, freq: 500, freqEnd: 150, vol: opt.run ? 0.16 : 0.09 }); this.tone({ freq: 70, freqEnd: 40, dur: 0.06, type: 'sine', vol: 0.08 }); break;
      case 'jump': this.noiseBurst({ dur: 0.1, freq: 700, freqEnd: 200, vol: 0.15 }); break;
      case 'land': this.noiseBurst({ dur: 0.12, freq: 500, freqEnd: 100, vol: 0.3 }); this.tone({ freq: 80, freqEnd: 40, dur: 0.1, type: 'sine', vol: 0.2 }); break;
      case 'dash': this.noiseBurst({ dur: 0.25, freq: 400, freqEnd: 3000, type: 'bandpass', q: 1.5, vol: 0.35 }); break;
      case 'slide': this.noiseBurst({ dur: 0.5, freq: 900, freqEnd: 300, vol: 0.3 }); break;
      case 'grunt': { const f = 120 + Math.random() * 80; this.tone({ freq: f, freqEnd: f * 0.6, dur: 0.22, type: 'sawtooth', vol: 0.12, pos }); this.tone({ freq: f * 2.01, freqEnd: f * 1.2, dur: 0.18, type: 'square', vol: 0.05, pos }); break; }
      case 'laugh': for (let i = 0; i < 4; i++) this.tone({ freq: 260 + Math.random() * 60, freqEnd: 180, dur: 0.1, type: 'sawtooth', vol: 0.1, pos, delay: i * 0.13 }); break;
      case 'scream': this.tone({ freq: 500, freqEnd: 200, dur: 0.5, type: 'sawtooth', vol: 0.14, pos }); this.tone({ freq: 760, freqEnd: 300, dur: 0.45, type: 'square', vol: 0.05, pos }); break;
      case 'vapor': this.noiseBurst({ dur: 0.5, freq: 2000, freqEnd: 400, vol: 0.3, pos, attack: 0.05 }); break;
      case 'wave': this.tone({ freq: 220, dur: 0.5, type: 'sawtooth', vol: 0.2 }); this.tone({ freq: 330, dur: 0.5, type: 'sawtooth', vol: 0.2, delay: 0.15 }); this.tone({ freq: 440, dur: 0.9, type: 'sawtooth', vol: 0.25, delay: 0.3 }); this.noiseBurst({ dur: 1.2, freq: 300, freqEnd: 4000, type: 'bandpass', q: 3, vol: 0.3, attack: 0.3 }); break;
      case 'combo': this.tone({ freq: 880 * Math.pow(1.06, Math.min(24, opt.n || 0)), dur: 0.12, type: 'square', vol: 0.12 }); break;
      case 'boss': this.tone({ freq: 55, dur: 1.5, type: 'sawtooth', vol: 0.5 }); this.tone({ freq: 82.4, dur: 1.5, type: 'sawtooth', vol: 0.4, delay: 0.5 }); this.noiseBurst({ dur: 2, freq: 100, freqEnd: 2000, type: 'bandpass', q: 4, vol: 0.4, attack: 0.5 }); break;
      case 'slowmo': this.tone({ freq: 1200, freqEnd: 200, dur: 0.8, type: 'sine', vol: 0.25 }); break;
      case 'slowmo_end': this.tone({ freq: 200, freqEnd: 1200, dur: 0.5, type: 'sine', vol: 0.2 }); break;
      case 'gameover': this.tone({ freq: 330, freqEnd: 110, dur: 1.6, type: 'sawtooth', vol: 0.3 }); this.tone({ freq: 415, freqEnd: 140, dur: 1.6, type: 'square', vol: 0.15 }); break;
      case 'door': this.noiseBurst({ dur: 0.4, freq: 300, freqEnd: 1200, type: 'bandpass', q: 2, vol: 0.2, pos, attack: 0.1 }); break;
      case 'coin': this.tone({ freq: 1975, dur: 0.06, type: 'square', vol: 0.1 }); this.tone({ freq: 2637, dur: 0.25, type: 'square', vol: 0.1, delay: 0.06 }); break;
      case 'laser_start': this.tone({ freq: 300, freqEnd: 1800, dur: 0.25, type: 'sawtooth', vol: 0.15 }); break;
      case 'laser_stop': this.tone({ freq: 1400, freqEnd: 200, dur: 0.2, type: 'sawtooth', vol: 0.1 }); break;
      case 'laser_loop': this.tone({ freq: 1200 + Math.random() * 200, freqEnd: 1100, dur: 0.12, type: 'sawtooth', vol: 0.05 }); break;
      case 'overheat': this.noiseBurst({ dur: 0.8, freq: 3000, freqEnd: 300, vol: 0.4, attack: 0.05 }); this.tone({ freq: 220, freqEnd: 80, dur: 0.6, type: 'square', vol: 0.12 }); break;
      case 'bubble': this.tone({ freq: 500, freqEnd: 1600, dur: 0.25, type: 'sine', vol: 0.25, pos }); this.noiseBurst({ dur: 0.15, freq: 2000, freqEnd: 4000, type: 'bandpass', q: 2, vol: 0.12, pos }); break;
      case 'bubble_pop': this.tone({ freq: 1800, freqEnd: 400, dur: 0.1, type: 'sine', vol: 0.25, pos }); this.noiseBurst({ dur: 0.08, freq: 5000, freqEnd: 2000, vol: 0.25, pos }); break;
      case 'ult': this.tone({ freq: 60, freqEnd: 30, dur: 1.6, type: 'sine', vol: 0.9 }); this.noiseBurst({ dur: 1.6, freq: 300, freqEnd: 6000, type: 'bandpass', q: 1.5, vol: 0.6, attack: 0.2 }); for (let i = 0; i < 6; i++) this.tone({ freq: 220 * Math.pow(2, i / 6), dur: 0.5, type: 'sawtooth', vol: 0.12, delay: i * 0.08 }); break;
      case 'ult_ready': this.tone({ freq: 880, dur: 0.12, type: 'square', vol: 0.12 }); this.tone({ freq: 1320, dur: 0.25, type: 'square', vol: 0.12, delay: 0.12 }); break;
      case 'buy': this.tone({ freq: 1200, dur: 0.06, type: 'square', vol: 0.12 }); this.tone({ freq: 1600, dur: 0.12, type: 'square', vol: 0.12, delay: 0.07 }); this.tone({ freq: 2400, dur: 0.2, type: 'sine', vol: 0.1, delay: 0.14 }); break;
      case 'deny': this.tone({ freq: 200, freqEnd: 120, dur: 0.2, type: 'square', vol: 0.12 }); break;
      case 'beep': this.tone({ freq: 2000, dur: 0.05, type: 'square', vol: 0.1, pos }); break;
      case 'blackout': this.noiseBurst({ dur: 0.6, freq: 800, freqEnd: 60, vol: 0.5 }); this.tone({ freq: 120, freqEnd: 30, dur: 0.9, type: 'sine', vol: 0.4 }); break;
      case 'pee_start': this.tone({ freq: 300, freqEnd: 900, dur: 0.3, type: 'sine', vol: 0.1 }); break;
      case 'pee_loop': this.noiseBurst({ dur: 0.25, freq: 1800, freqEnd: 1400, type: 'bandpass', q: 1.2, vol: 0.12, attack: 0.05 }); break;
      case 'pee_stop': this.tone({ freq: 900, freqEnd: 250, dur: 0.3, type: 'sine', vol: 0.1 }); break;
      case 'poop': this.tone({ freq: 180, freqEnd: 60, dur: 0.35, type: 'sawtooth', vol: 0.2 }); this.noiseBurst({ dur: 0.3, freq: 400, freqEnd: 150, vol: 0.25 }); this.tone({ freq: 90, freqEnd: 120, dur: 0.25, type: 'square', vol: 0.06, delay: 0.3 }); break;
      case 'squish': this.noiseBurst({ dur: 0.18, freq: 900, freqEnd: 200, type: 'lowpass', vol: 0.3, pos }); this.tone({ freq: 160, freqEnd: 70, dur: 0.2, type: 'sine', vol: 0.2, pos }); break;
      case 'slip': this.tone({ freq: 1400, freqEnd: 300, dur: 0.35, type: 'sine', vol: 0.18, pos }); this.noiseBurst({ dur: 0.2, freq: 3000, freqEnd: 500, vol: 0.15, pos }); break;
      case 'flush': this.noiseBurst({ dur: 1.6, freq: 500, freqEnd: 2500, type: 'bandpass', q: 0.8, vol: 0.4, attack: 0.3 }); this.tone({ freq: 220, freqEnd: 90, dur: 1.4, type: 'sine', vol: 0.15, delay: 0.2 }); break;
      case 'coo': this.tone({ freq: 420, freqEnd: 380, dur: 0.16, type: 'sine', vol: 0.14, pos }); this.tone({ freq: 500, freqEnd: 360, dur: 0.22, type: 'sine', vol: 0.12, pos, delay: 0.18 }); break;
      case 'plop': this.tone({ freq: 500, freqEnd: 120, dur: 0.12, type: 'sine', vol: 0.2, pos }); break;
      case 'honk': this.tone({ freq: 240, freqEnd: 200, dur: 0.45, type: 'sawtooth', vol: 0.22, pos }); this.tone({ freq: 480, freqEnd: 400, dur: 0.45, type: 'square', vol: 0.06, pos }); break;
      case 'event': this.tone({ freq: 660, dur: 0.12, type: 'square', vol: 0.15 }); this.tone({ freq: 880, dur: 0.12, type: 'square', vol: 0.15, delay: 0.14 }); this.tone({ freq: 1320, dur: 0.3, type: 'square', vol: 0.15, delay: 0.28 }); this.noiseBurst({ dur: 0.5, freq: 400, freqEnd: 4000, type: 'bandpass', q: 3, vol: 0.2, attack: 0.1 }); break;
      case 'scream_player': this.tone({ freq: 400, freqEnd: 650, dur: 0.6, type: 'sawtooth', vol: 0.3 }); this.tone({ freq: 800, freqEnd: 1300, dur: 0.6, type: 'square', vol: 0.08 }); this.noiseBurst({ dur: 0.6, freq: 1500, freqEnd: 3000, type: 'bandpass', q: 1, vol: 0.2 }); break;
      case 'shutter': this.noiseBurst({ dur: 0.05, freq: 6000, freqEnd: 3000, vol: 0.3, pos }); this.tone({ freq: 2200, dur: 0.05, type: 'square', vol: 0.12, pos }); this.noiseBurst({ dur: 0.05, freq: 6000, freqEnd: 3000, vol: 0.25, pos, attack: 0.001 }); break;
      case 'dryer_start': this.tone({ freq: 120, freqEnd: 520, dur: 0.5, type: 'sawtooth', vol: 0.12 }); break;
      case 'dryer_loop': this.noiseBurst({ dur: 0.3, freq: 900, freqEnd: 800, type: 'bandpass', q: 0.6, vol: 0.16, attack: 0.05 }); this.tone({ freq: 500 + Math.random() * 30, dur: 0.25, type: 'sawtooth', vol: 0.05 }); break;
      case 'ricochet': this.tone({ freq: 3000 + Math.random() * 2000, freqEnd: 400, dur: 0.15, type: 'sine', vol: 0.12, pos }); break;
    }
  }

  // ------------------------------------------------------------- music
  startMusic() {
    if (!this.ctx || this.music) return;
    const C = this.ctx; this.music = { step: 0, next: C.currentTime + 0.1, intensity: 0 };
    const tick = () => {
      if (!this.music) return;
      const M = this.music; const bpm = 128, spb = 60 / bpm / 4; // 16th notes
      while (M.next < C.currentTime + 0.25) { this.musicStep(M.step, M.next, spb); M.step++; M.next += spb; }
      this.musicTimer = setTimeout(tick, 80);
    };
    tick();
  }
  stopMusic() { if (this.musicTimer) clearTimeout(this.musicTimer); this.music = null; }
  musicStep(step, t, spb) {
    const C = this.ctx, g = this.musicGain; const bar = Math.floor(step / 16) % 8, s16 = step % 16;
    const prog = [0, 0, 5, 5, 3, 3, 7, 8]; // semitone roots for A minor-ish progression
    const root = 55 * Math.pow(2, prog[bar] / 12); // A1
    const inten = this.music.intensity;
    const osc = (type, f, dur, vol, at = t, filt = null) => { const o = C.createOscillator(); o.type = type; o.frequency.value = f; const e = C.createGain(); e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(vol, at + 0.01); e.gain.exponentialRampToValueAtTime(0.001, at + dur); o.connect(e); if (filt) { e.connect(filt); filt.connect(g); } else e.connect(g); o.start(at); o.stop(at + dur + 0.02); };
    // kick on 4-on-the-floor
    if (s16 % 4 === 0) { const o = C.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const e = C.createGain(); e.gain.setValueAtTime(0.9, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(e); e.connect(g); o.start(t); o.stop(t + 0.3); }
    // snare / clap on 2 and 4
    if (s16 % 8 === 4) { const src = C.createBufferSource(); src.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8; const e = C.createGain(); e.gain.setValueAtTime(0.35, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.18); src.connect(f); f.connect(e); e.connect(g); src.start(t); src.stop(t + 0.2); }
    // hats (16ths, accent on off-beats)
    { const src = C.createBufferSource(); src.buffer = this.noise; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const e = C.createGain(); e.gain.setValueAtTime(s16 % 2 ? 0.12 : 0.06, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.05); src.connect(f); f.connect(e); e.connect(g); src.start(t); src.stop(t + 0.06); }
    // bass: driving 8ths, octave jumps
    if (s16 % 2 === 0) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400 + inten * 900; osc('sawtooth', root * (s16 % 4 === 2 ? 2 : 1), spb * 1.8, 0.35, t, f); }
    // arpeggio (minor triad + 7th) 16ths, more active with intensity
    if (inten > 0.15 || s16 % 4 === 0) { const arp = [0, 3, 7, 10, 12, 10, 7, 3]; const n = arp[(step + bar) % 8]; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500 + inten * 3000; osc('square', root * 4 * Math.pow(2, n / 12), spb * 0.9, 0.09 + inten * 0.06, t, f); }
    // pad / lead every bar
    if (s16 === 0) { for (const n of [0, 3, 7]) osc('triangle', root * 2 * Math.pow(2, n / 12), spb * 16, 0.06, t); }
    if (inten > 0.5 && s16 % 8 === 6) { const lead = [12, 15, 19, 22, 24][(bar + Math.floor(step / 32)) % 5]; osc('sawtooth', root * 4 * Math.pow(2, lead / 12), spb * 3, 0.07, t); }
  }
  setIntensity(v) { if (this.music) this.music.intensity += (v - this.music.intensity) * 0.1; }
}
