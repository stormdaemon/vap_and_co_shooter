// Renderer + post-processing stack (bloom, optional GTAO, final grade with vignette / chroma / grain / flash).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.35 },
    uChroma: { value: 0.0 },
    uGrain: { value: 0.035 },
    uFlash: { value: 0.0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDamage: { value: 0.0 },
    uSlow: { value: 0.0 },
    uDisco: { value: 0.0 },
    uSat: { value: 1.08 },
    uContrast: { value: 1.06 },
    uLift: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    toneMappingExposure: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uVignette,uChroma,uGrain,uFlash,uDamage,uSlow,uDisco,uSat,uContrast,uLift; uniform vec3 uFlashColor; uniform vec2 uResolution;
    #include <tonemapping_pars_fragment>
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float r2 = dot(c,c);
      float ca = uChroma * (0.6 + r2 * 4.0) + uSlow * 0.004;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;
      col = ACESFilmicToneMapping(col);
      // grade
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      // slow-mo: cool tint + desat
      col = mix(col, vec3(l) * vec3(0.75,0.9,1.15), uSlow * 0.6);
      // damage: red tint at edges
      col = mix(col, vec3(0.8,0.05,0.02), uDamage * smoothstep(0.05, 0.6, r2));
      // disco: hue cycling rim
      if (uDisco > 0.0) { vec3 d = 0.5 + 0.5 * cos(uTime * 3.0 + vec3(0.0,2.1,4.2) + uv.x * 6.0); col = mix(col, col * d * 1.6, uDisco * 0.45 * smoothstep(0.0,0.5,r2)); }
      // vignette
      col *= 1.0 - uVignette * smoothstep(0.15, 0.9, r2 * 1.6);
      // grain
      float g = hash(uv * uResolution + fract(uTime * 13.7)) - 0.5;
      col += g * uGrain * (0.5 + 0.5 * (1.0 - l));
      // flash
      col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = sRGBTransferOETF(vec4(col, 1.0));
    }`
};

export class Renderer {
  constructor(canvas, quality = 'med') {
    this.canvas = canvas;
    this.quality = quality;
    const low = quality === 'low', high = quality === 'high';
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    if (!r.capabilities.isWebGL2) throw new Error('WebGL 2 requis');
    this.r = r;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false; this.shadowEvery = low ? 3 : 2; this.frameNo = 0;
    r.info.autoReset = false;
    // Potato-friendly: never render above native 1x on low/med; high may go to 1.5x on HiDPI.
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, high ? 1.5 : low ? 0.9 : 1);
    this.dynamicScale = 1; this.minScale = low ? 0.5 : 0.6;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(82, 1, 0.05, 80);
    this.camera.rotation.order = 'YXZ';
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    // 8-bit intermediate targets on low (half the bandwidth); half-float elsewhere so bloom keeps HDR highlights.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: low ? THREE.UnsignedByteType : THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.gtao = null;
    if (high) {
      this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 12 });
      this.gtao.blendIntensity = 0.85;
      this.composer.addPass(this.gtao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), low ? 0.22 : 0.3, 0.45, 0.95);
    this.composer.addPass(this.bloom);
    // grade pass does tone mapping + sRGB itself (no separate OutputPass)
    this.grade = new ShaderPass(GradeShader); this.grade.material.toneMapped = false;
    this.composer.addPass(this.grade);
    if (high) { this.smaa = new SMAAPass(); this.composer.addPass(this.smaa); }
    else { this.fxaa = new ShaderPass(FXAAShader); this.fxaa.material.toneMapped = false; this.composer.addPass(this.fxaa); }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.fpsHist = []; this.lastAdapt = 0;
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.pixelRatio * this.dynamicScale;
    this.r.setPixelRatio(pr);
    this.r.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.grade.uniforms.uResolution.value.set(w * pr, h * pr);
    if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    if (this.gtao) this.gtao.setSize(w * pr, h * pr);
  }
  // adaptive resolution: keep ~55 fps by scaling the internal resolution between minScale and 1
  adapt(dt, now) {
    this.fpsHist.push(dt); if (this.fpsHist.length > 45) this.fpsHist.shift();
    if (now - this.lastAdapt < 1500 || this.fpsHist.length < 40) return;
    const avg = this.fpsHist.reduce((a, b) => a + b, 0) / this.fpsHist.length;
    let s = this.dynamicScale;
    if (avg > 1 / 48 && s > this.minScale) s -= 0.1; else if (avg < 1 / 70 && s < 1) s += 0.1;
    s = Math.round(s * 10) / 10;
    if (s !== this.dynamicScale) { this.dynamicScale = s; this.resize(); }
    this.lastAdapt = now;
  }
  // compile every material/program up front so the first spawn or shot does not stutter
  precompile() { this.r.compile(this.scene, this.camera); }
  render(t) {
    this.grade.uniforms.uTime.value = t; this.grade.uniforms.toneMappingExposure.value = this.r.toneMappingExposure;
    this.r.info.reset();
    if (this.frameNo % this.shadowEvery === 0) this.r.shadowMap.needsUpdate = true; this.frameNo++;
    this.composer.render();
  }
}
