// Entry point: boot, menu, game loop.
import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { buildTextureLibrary } from './engine/textures.js';
import { World } from './world/store.js';
import { Bottles } from './world/bottles.js';
import { Input } from './game/input.js';
import { Player } from './game/player.js';
import { Game } from './game/game.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);

window.__bootStart = performance.now();
async function boot() {
  const canvas = $('#view');
  const quality = params.get('q') || localStorage.getItem('vc_quality') || 'med';
  document.querySelectorAll('#quality button').forEach(b => b.classList.toggle('selected', b.dataset.q === quality));
  const setProgress = (t, p) => { $('#progressText').textContent = t; $('#progressFill').style.width = `${Math.round(p * 100)}%`; };
  setProgress('Initialisation du moteur graphique…', 0.02);
  let R;
  try { R = new Renderer(canvas, quality); } catch (e) { fatal(e); return; }
  const lib = await buildTextureLibrary(quality, (t, p) => setProgress(t, 0.05 + p * 0.6));
  setProgress('Construction du magasin…', 0.7); await tick();
  const world = new World(R.scene, lib, quality);
  setProgress('Mise en rayon des e-liquides…', 0.82); await tick();
  const bottles = new Bottles(R.scene, world, quality);
  const input = new Input(canvas);
  const player = new Player(world, R.camera, input);
  setProgress('Réveil des zinzins…', 0.9); await tick();
  const game = new Game({ R, world, bottles, input, player, lib, quality });
  await game.init();
  setProgress('Compilation des shaders…', 0.94); await tick();
  game.warmup(); // compiles every shader variant up front (hidden reference objects stay alive so programs are never released)
  // warm-up: compile shaders by rendering one frame
  R.camera.position.set(6.95, 4.6, 10.5); R.camera.lookAt(-0.5, 1.5, -3); R.render(0.04);
  setProgress('Prêt.', 1);
  $('#loader').classList.add('hidden'); $('#menuActions').classList.remove('hidden');
  window.__game = game; // for tests
  game.showMenu();
  if (params.get('auto')) game.start();
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
    game.frame(dt, now / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
const tick = () => new Promise(r => setTimeout(r, 0));
function fatal(e) { console.error(e); $('#fatal').classList.remove('hidden'); $('#fatalMsg').textContent = e.message || String(e); $('#intro').classList.add('hidden'); }
boot().catch(fatal);
