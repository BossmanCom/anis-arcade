import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CAB = {
  halfX: 1.05,
  halfZ: 0.85,
  floorY: 0,
  glassH: 1.55,
  clawY: 1.42,
  chuteX: 1.05,
  chuteZ: 0,
};

const GRAB_RADIUS = 0.22;
const GRAB_CHANCE = 0.5; // 50% when in range (RNG kept fair)
const CLAW_SPEED = 1.35; // max world units / sec
const CLAW_VEL_SMOOTH = 14; // damp toward target velocity (higher = snappier)
const LOWER_SPEED = 1.75; // snappy drop, still dt-based world speed
const LIFT_SPEED = 1.35;
const PRIZE_COUNT = 8;
const PRIZE_COUNT_LOW = 5; // when FPS struggles
const START_CREDITS = 5;

const IS_MOBILE =
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && Math.min(window.innerWidth, window.innerHeight) < 900);

const keys = Object.create(null);
const padDirs = Object.create(null);

const elCredits = document.querySelector('#credits b');
const elWins = document.querySelector('#wins b');
const elCreditsWrap = document.getElementById('credits');
const elWinsWrap = document.getElementById('wins');
const elStatus = document.getElementById('status');
const elBanner = document.getElementById('banner');
const dropBtn = document.getElementById('dropBtn');
const canvas = document.getElementById('game');
const elFlash = document.getElementById('fx-flash');
const elChroma = document.getElementById('fx-chroma');
const elConfetti = document.getElementById('confetti');
const elFps = document.getElementById('fps');

let credits = START_CREDITS;
let wins = 0;
let prizeProtos = [];
let prizes = [];
let clawRoot, clawArm, clawHead, clawL, clawR;
let state = 'boot'; // boot | idle | drop | grab | lift | toChute | release | return | empty
let heldPrize = null;
let grabRollOk = false;
let bannerTimer = 0;
let bannerNeedsEnter = false;
let clock = new THREE.Clock();

// Smooth claw velocity (world units / sec) — avoids stutter when FPS dips
const clawVel = { x: 0, z: 0 };

// FPS / adaptive quality
let fpsFrames = 0;
let fpsAccum = 0;
let fpsShown = 60;
let lowFpsStreak = 0;
let prizeCountLive = PRIZE_COUNT;
let basePixelRatio = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.25 : 1.75);
let livePixelRatio = basePixelRatio;
let shadowsEnabled = !IS_MOBILE;
let tipLightRef = null;

// Juice FX refs
let ambientCycle = []; // { light, phase, speed, colors[] }
let rimMats = [];
let marqueeMat = null;
let prizeGlowGroup = null;
let floorGlow = null;
let scenePulse = 0; // brief bg brighten on grab success

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120810);
scene.fog = new THREE.Fog(0x120810, 6, 14);
const bgBase = new THREE.Color(0x120810);
const bgPulse = new THREE.Color(0x2a1840);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
camera.position.set(0, 2.35, 3.55);
camera.lookAt(0, 0.55, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_MOBILE,
  alpha: false,
  powerPreference: IS_MOBILE ? 'low-power' : 'high-performance',
});
renderer.setPixelRatio(livePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = shadowsEnabled;
renderer.shadowMap.type = THREE.PCFShadowMap; // cheaper than PCFSoft, still readable
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

function resize() {
  const wrap = document.getElementById('canvas-wrap');
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// —— Lights (base + cycling arcade neons) ——
const hemi = new THREE.HemisphereLight(0xffe0c0, 0x2a1020, 0.8);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0e0, 1.05);
key.position.set(2.2, 4.5, 2.8);
key.castShadow = shadowsEnabled;
if (shadowsEnabled) {
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
}
scene.add(key);

const fill = new THREE.PointLight(0xff7a1a, 0.45, 8);
fill.position.set(-1.2, 1.6, 1.4);
scene.add(fill);

function addCycleLight(color, pos, phase, speed) {
  const L = new THREE.PointLight(color, 0.42, 7);
  L.position.set(...pos);
  scene.add(L);
  ambientCycle.push({
    light: L,
    phase,
    speed,
    // cyan → magenta → gold → cyan
    hues: [0x44e0ff, 0xff44cc, 0xffc040],
  });
  return L;
}
addCycleLight(0x44e0ff, [1.15, 1.35, -0.7], 0, 0.28);
addCycleLight(0xff44cc, [-1.05, 1.15, 0.9], 2.1, 0.22);
if (!IS_MOBILE) {
  addCycleLight(0xffc040, [0.15, 0.55, 0.05], 4.0, 0.18);
}

function makeCabinet() {
  const root = new THREE.Group();

  // Base / pedestal
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a1620, roughness: 0.7, metalness: 0.15 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 2.0), baseMat);
  base.position.y = -0.14;
  base.receiveShadow = true;
  root.add(base);

  // Floor tray
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2838, roughness: 0.85, metalness: 0.05 });
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(CAB.halfX * 2 - 0.06, 0.04, CAB.halfZ * 2 - 0.06),
    floorMat
  );
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  root.add(floor);

  // Soft floor padding (felt) + subtle emissive underglow sheet
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(CAB.halfX * 2 - 0.12, 0.02, CAB.halfZ * 2 - 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1e3a28, roughness: 1 })
  );
  felt.position.y = 0.045;
  felt.receiveShadow = true;
  root.add(felt);

  floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(CAB.halfX * 2 - 0.2, CAB.halfZ * 2 - 0.2),
    new THREE.MeshBasicMaterial({
      color: 0x44e0ff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.058;
  root.add(floorGlow);

  // Neon rim frame (emissive posts + thin edge strips)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xff7a1a,
    roughness: 0.4,
    metalness: 0.4,
    emissive: 0xff5a00,
    emissiveIntensity: 0.55,
  });
  rimMats.push(frameMat);
  const postGeo = new THREE.BoxGeometry(0.08, CAB.glassH, 0.08);
  const corners = [
    [-CAB.halfX, CAB.halfZ],
    [CAB.halfX, CAB.halfZ],
    [-CAB.halfX, -CAB.halfZ],
    [CAB.halfX, -CAB.halfZ],
  ];
  for (const [x, z] of corners) {
    const p = new THREE.Mesh(postGeo, frameMat);
    p.position.set(x, CAB.glassH / 2, z);
    p.castShadow = true;
    root.add(p);

    // Inner neon tube along post
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x7dfffa,
      emissive: 0x44e0ff,
      emissiveIntensity: 1.1,
      roughness: 0.3,
      metalness: 0.2,
    });
    rimMats.push(tubeMat);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.03, CAB.glassH - 0.08, 0.03), tubeMat);
    tube.position.set(x * 0.96, CAB.glassH / 2, z * 0.96);
    root.add(tube);
  }

  // Top frame
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(CAB.halfX * 2 + 0.12, 0.1, CAB.halfZ * 2 + 0.12),
    frameMat
  );
  top.position.y = CAB.glassH + 0.05;
  root.add(top);

  // Neon edge strips on top rim (cyan / magenta accents)
  const edgeColors = [
    { c: 0x44e0ff, e: 0x2288aa },
    { c: 0xff44cc, e: 0xaa2288 },
  ];
  const edgeSpecs = [
    { s: [CAB.halfX * 2 + 0.06, 0.04, 0.04], p: [0, CAB.glassH + 0.12, CAB.halfZ + 0.04], i: 0 },
    { s: [CAB.halfX * 2 + 0.06, 0.04, 0.04], p: [0, CAB.glassH + 0.12, -CAB.halfZ - 0.04], i: 1 },
    { s: [0.04, 0.04, CAB.halfZ * 2 + 0.06], p: [CAB.halfX + 0.04, CAB.glassH + 0.12, 0], i: 0 },
    { s: [0.04, 0.04, CAB.halfZ * 2 + 0.06], p: [-CAB.halfX - 0.04, CAB.glassH + 0.12, 0], i: 1 },
  ];
  for (const es of edgeSpecs) {
    const col = edgeColors[es.i];
    const mat = new THREE.MeshStandardMaterial({
      color: col.c,
      emissive: col.e,
      emissiveIntensity: 1.2,
      roughness: 0.25,
      metalness: 0.3,
    });
    rimMats.push(mat);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(...es.s), mat);
    edge.position.set(...es.p);
    root.add(edge);
  }

  // Marquee bar
  marqueeMat = new THREE.MeshStandardMaterial({
    color: 0xff9a2a,
    emissive: 0xff6a00,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  rimMats.push(marqueeMat);
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.18), marqueeMat);
  marquee.position.set(0, CAB.glassH + 0.28, CAB.halfZ + 0.02);
  root.add(marquee);

  // Glass panels (slightly transparent)
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaaddee,
    transparent: true,
    opacity: 0.16,
    roughness: 0.15,
    metalness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const walls = [
    { s: [CAB.halfX * 2, CAB.glassH, 0.03], p: [0, CAB.glassH / 2, CAB.halfZ] },
    { s: [CAB.halfX * 2, CAB.glassH, 0.03], p: [0, CAB.glassH / 2, -CAB.halfZ] },
    { s: [0.03, CAB.glassH, CAB.halfZ * 2], p: [-CAB.halfX, CAB.glassH / 2, 0] },
    { s: [0.03, CAB.glassH, CAB.halfZ * 2], p: [CAB.halfX, CAB.glassH / 2, 0] },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...w.s), glassMat);
    m.position.set(...w.p);
    root.add(m);
  }

  // Prize chute (right side pocket)
  const chuteMat = new THREE.MeshStandardMaterial({ color: 0x3a1e18, roughness: 0.7 });
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.55), chuteMat);
  chute.position.set(CAB.halfX + 0.28, 0.28, 0);
  root.add(chute);
  const chuteHole = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.08, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x050308 })
  );
  chuteHole.position.set(CAB.halfX - 0.08, 0.08, 0);
  root.add(chuteHole);

  // Soft chute neon ring (skip point light on mobile — keep juice via emissive rims)
  if (!IS_MOBILE) {
    const chuteGlow = new THREE.PointLight(0xffc040, 0.35, 2.5);
    chuteGlow.position.set(CAB.halfX + 0.1, 0.35, 0);
    root.add(chuteGlow);
  }

  // Signage
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 96;
  const ctx = signCanvas.getContext('2d');
  ctx.fillStyle = '#1a0c04';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#ff8a1a';
  ctx.shadowColor = '#ff4ad8';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("ANI'S CLAW", 256, 48);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.3),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  sign.position.set(0, CAB.glassH + 0.28, CAB.halfZ + 0.12);
  root.add(sign);

  scene.add(root);

  // Prize underglow group (soft pulsing discs under each prize)
  prizeGlowGroup = new THREE.Group();
  scene.add(prizeGlowGroup);
}

function makeClaw() {
  clawRoot = new THREE.Group();
  clawRoot.position.set(0, CAB.clawY, 0);
  scene.add(clawRoot);

  const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.85, roughness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffb040,
    metalness: 0.7,
    roughness: 0.35,
    emissive: 0x402000,
    emissiveIntensity: 0.25,
  });

  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), chrome);
  carriage.castShadow = shadowsEnabled;
  clawRoot.add(carriage);

  // Tiny carriage neon tip (desktop only — point lights are expensive on phone)
  if (!IS_MOBILE) {
    tipLightRef = new THREE.PointLight(0x7dfffa, 0.25, 1.8);
    tipLightRef.position.set(0, -0.05, 0);
    clawRoot.add(tipLightRef);
  }

  clawArm = new THREE.Group();
  clawRoot.add(clawArm);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 10), chrome);
  shaft.position.y = -0.5;
  shaft.castShadow = shadowsEnabled;
  clawArm.add(shaft);

  clawHead = new THREE.Group();
  clawHead.position.y = -1.0;
  clawArm.add(clawHead);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), gold);
  hub.castShadow = shadowsEnabled;
  clawHead.add(hub);

  clawL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.06), gold);
  clawL.position.set(-0.08, -0.14, 0);
  clawL.rotation.z = 0.35;
  clawL.castShadow = shadowsEnabled;
  clawHead.add(clawL);

  clawR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.06), gold);
  clawR.position.set(0.08, -0.14, 0);
  clawR.rotation.z = -0.35;
  clawR.castShadow = shadowsEnabled;
  clawHead.add(clawR);

  const clawB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.04), gold);
  clawB.position.set(0, -0.12, 0.07);
  clawB.rotation.x = -0.4;
  clawHead.add(clawB);

  setClawOpen(true);
  setArmLength(0.15);
}

/** armLen: how far the claw hangs below the rail (0 = retracted near top) */
function setArmLength(len) {
  const clamped = THREE.MathUtils.clamp(len, 0.12, 1.28);
  clawArm.userData.len = clamped;
  const shaft = clawArm.children[0];
  shaft.scale.y = clamped;
  shaft.position.y = -clamped / 2;
  clawHead.position.y = -clamped;
}

function getArmLength() {
  return clawArm.userData.len || 0.15;
}

function setClawOpen(open) {
  const t = open ? 0.42 : 0.12;
  clawL.rotation.z = t;
  clawR.rotation.z = -t;
  clawL.position.x = open ? -0.1 : -0.055;
  clawR.position.x = open ? 0.1 : 0.055;
}

function clawWorldPos() {
  const v = new THREE.Vector3();
  clawHead.getWorldPosition(v);
  return v;
}

function clearPrizeGlows() {
  if (!prizeGlowGroup) return;
  while (prizeGlowGroup.children.length) {
    const c = prizeGlowGroup.children[0];
    prizeGlowGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
}

function attachPrizeGlow(prize) {
  // Additive disc only — per-prize PointLights (×8) were a major GPU cost
  const segs = IS_MOBILE ? 12 : 16;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, segs),
    new THREE.MeshBasicMaterial({
      color: 0xffc040,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(prize.mesh.position.x, 0.055, prize.mesh.position.z);
  prizeGlowGroup.add(disc);
  prize.glow = disc;
  prize.glowLight = null;
}

function spawnPrizes() {
  prizes.forEach((p) => scene.remove(p.mesh));
  prizes = [];
  clearPrizeGlows();
  if (!prizeProtos.length) return;

  const count = prizeCountLive;
  for (let i = 0; i < count; i++) {
    const proto = prizeProtos[i % prizeProtos.length];
    const mesh = proto.clone(true);
    mesh.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = shadowsEnabled;
        c.receiveShadow = shadowsEnabled;
        // Share prototype materials on mobile (no per-instance mutate) — fewer GPU programs
        if (c.material && !IS_MOBILE) c.material = c.material.clone();
      }
    });
    const x = (Math.random() * 2 - 1) * (CAB.halfX - 0.28);
    const z = (Math.random() * 2 - 1) * (CAB.halfZ - 0.28);
    const yaw = Math.random() * Math.PI * 2;
    mesh.position.set(x, CAB.floorY + 0.045, z);
    mesh.rotation.y = yaw;
    mesh.scale.setScalar(1);
    // Frustum culling is on by default for Object3D
    scene.add(mesh);
    const prize = {
      mesh,
      alive: true,
      radius: 0.14,
      baseY: CAB.floorY + 0.045,
      kind: i % prizeProtos.length,
      glow: null,
      glowLight: null,
    };
    prizes.push(prize);
    attachPrizeGlow(prize);
  }
}

function nearestPrize(pos) {
  let best = null;
  let bestD = Infinity;
  for (const p of prizes) {
    if (!p.alive) continue;
    const dx = p.mesh.position.x - pos.x;
    const dz = p.mesh.position.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { prize: best, dist: bestD };
}

function setStatus(msg) {
  elStatus.textContent = msg;
}

function punchHud(el) {
  if (!el) return;
  el.classList.remove('punch');
  // reflow to restart animation
  void el.offsetWidth;
  el.classList.add('punch');
  setTimeout(() => el.classList.remove('punch'), 500);
}

function triggerFlash(chroma = false) {
  if (elFlash) {
    elFlash.classList.remove('on');
    void elFlash.offsetWidth;
    elFlash.classList.add('on');
    setTimeout(() => elFlash.classList.remove('on'), 400);
  }
  if (chroma && elChroma) {
    elChroma.classList.remove('on');
    void elChroma.offsetWidth;
    elChroma.classList.add('on');
    setTimeout(() => elChroma.classList.remove('on'), 550);
  }
}

function spawnConfetti(n = 28) {
  if (!elConfetti) return;
  elConfetti.innerHTML = '';
  const colors = ['#7dfffa', '#ff4ad8', '#ffe08a', '#ff9a2a', '#2ecc71', '#ff6b9a'];
  for (let i = 0; i < n; i++) {
    const bit = document.createElement('div');
    bit.className = 'bit';
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 60 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40 - Math.random() * 80;
    bit.style.setProperty('--dx', `${dx}px`);
    bit.style.setProperty('--dy', `${dy}px`);
    bit.style.setProperty('--rot', `${(Math.random() * 540 - 270).toFixed(0)}deg`);
    bit.style.background = colors[i % colors.length];
    bit.style.left = `${48 + Math.random() * 4}%`;
    bit.style.top = `${38 + Math.random() * 8}%`;
    bit.style.animationDelay = `${(Math.random() * 0.12).toFixed(2)}s`;
    if (Math.random() > 0.5) {
      bit.style.width = '6px';
      bit.style.height = '12px';
      bit.style.borderRadius = '2px';
    }
    elConfetti.appendChild(bit);
  }
  setTimeout(() => {
    if (elConfetti) elConfetti.innerHTML = '';
  }, 1300);
}

function showBanner(text, miss = false) {
  if (!elBanner) return;
  elBanner.textContent = text;
  elBanner.classList.toggle('miss', !!miss);
  elBanner.classList.toggle('win', !miss);
  elBanner.classList.remove('hidden');
  // Both SO CLOSE and YOU WIN stay until Enter / Space / tap
  bannerNeedsEnter = true;
  bannerTimer = 0;
  elBanner.dataset.hint = '1';
  setStatus('PRESS ENTER TO CONTINUE');
  if (!miss) {
    spawnConfetti(32);
    triggerFlash(true);
    scenePulse = 0.55;
  }
}

function dismissBanner() {
  if (!elBanner) return;
  const visible = !elBanner.classList.contains('hidden');
  if (!visible && !bannerNeedsEnter) return;
  elBanner.classList.add('hidden');
  elBanner.classList.remove('win', 'miss');
  delete elBanner.dataset.hint;
  bannerNeedsEnter = false;
  bannerTimer = 0;
  if (state === 'idle' || state === 'return') {
    setStatus(credits > 0 ? 'MOVE CLAW · SPACE TO DROP · 3 PRIZES' : 'OUT OF CREDITS · ◀ ARCADE');
  }
}

function bannerIsUp() {
  return bannerNeedsEnter || (elBanner && !elBanner.classList.contains('hidden'));
}

function updateHud(opts = {}) {
  elCredits.textContent = String(credits);
  elWins.textContent = String(wins);
  dropBtn.disabled = state !== 'idle' || credits <= 0;
  if (opts.creditPunch) punchHud(elCreditsWrap);
  if (opts.winPunch) punchHud(elWinsWrap);
}

function tryStartDrop() {
  if (bannerIsUp()) return;
  if (state !== 'idle') return;
  if (credits <= 0) {
    setStatus('OUT OF CREDITS · ◀ ARCADE');
    showBanner('NO CREDITS', true);
    return;
  }
  // Immediate state change — drop feels snappy even before next render
  credits -= 1;
  clawVel.x = 0;
  clawVel.z = 0;
  state = 'drop';
  setClawOpen(true);
  setStatus('DROPPING…');
  updateHud({ creditPunch: true });
  dropBtn.classList.remove('drop-punch');
  void dropBtn.offsetWidth;
  dropBtn.classList.add('drop-punch');
  setTimeout(() => dropBtn.classList.remove('drop-punch'), 450);
  triggerFlash(false);
}

function attemptGrab() {
  const tip = clawWorldPos();
  tip.y -= 0.12;
  const { prize, dist } = nearestPrize(tip);
  grabRollOk = false;
  heldPrize = null;

  if (prize && dist <= GRAB_RADIUS) {
    // In range: 40–60% success (fixed 50% with slight jitter feel via RNG)
    const chance = 0.4 + Math.random() * 0.2; // 40–60%
    if (Math.random() < chance) {
      grabRollOk = true;
      heldPrize = prize;
      prize.alive = false;
      // Hide prize underglow while held
      if (prize.glow) prize.glow.visible = false;
      if (prize.glowLight) prize.glowLight.visible = false;
      setClawOpen(false);
      // Success juice — brief chroma without full confetti yet
      triggerFlash(true);
      scenePulse = 0.35;
      return true;
    }
  }
  setClawOpen(false); // close empty
  return false;
}

function updateHeldPrize() {
  if (!heldPrize) return;
  const tip = clawWorldPos();
  heldPrize.mesh.position.set(tip.x, tip.y - 0.18, tip.z);
}

function moveClaw(dt) {
  let mx = 0;
  let mz = 0;
  if (keys['ArrowLeft'] || keys['a'] || keys['A'] || padDirs.left) mx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D'] || padDirs.right) mx += 1;
  if (keys['ArrowUp'] || keys['w'] || keys['W'] || padDirs.up) mz -= 1;
  if (keys['ArrowDown'] || keys['s'] || keys['S'] || padDirs.down) mz += 1;

  let tx = 0;
  let tz = 0;
  if (mx || mz) {
    const len = Math.hypot(mx, mz) || 1;
    tx = (mx / len) * CLAW_SPEED;
    tz = (mz / len) * CLAW_SPEED;
  }

  // Damp velocity toward target — smooth on low FPS, still responsive
  clawVel.x = THREE.MathUtils.damp(clawVel.x, tx, CLAW_VEL_SMOOTH, dt);
  clawVel.z = THREE.MathUtils.damp(clawVel.z, tz, CLAW_VEL_SMOOTH, dt);

  // Snap tiny residual velocity to zero so it doesn't crawl forever
  if (!mx && !mz && Math.abs(clawVel.x) < 0.02 && Math.abs(clawVel.z) < 0.02) {
    clawVel.x = 0;
    clawVel.z = 0;
  }

  if (clawVel.x || clawVel.z) {
    clawRoot.position.x = THREE.MathUtils.clamp(
      clawRoot.position.x + clawVel.x * dt,
      -CAB.halfX + 0.2,
      CAB.halfX - 0.35
    );
    clawRoot.position.z = THREE.MathUtils.clamp(
      clawRoot.position.z + clawVel.z * dt,
      -CAB.halfZ + 0.2,
      CAB.halfZ - 0.2
    );
  }
}

function updateJuice(dt, t) {
  // Ambient color cycle (cyan / magenta / gold)
  for (const a of ambientCycle) {
    const u = (Math.sin(t * a.speed + a.phase) + 1) * 0.5;
    const v = (Math.sin(t * a.speed * 0.7 + a.phase + 1.7) + 1) * 0.5;
    const c0 = new THREE.Color(a.hues[0]);
    const c1 = new THREE.Color(a.hues[1]);
    const c2 = new THREE.Color(a.hues[2]);
    const mix = c0.clone().lerp(c1, u).lerp(c2, v * 0.45);
    a.light.color.copy(mix);
    a.light.intensity = 0.32 + Math.sin(t * a.speed * 1.4 + a.phase) * 0.12;
  }

  // Soft rim / marquee pulse (kept modest for phone contrast)
  const rimPulse = 0.9 + Math.sin(t * 1.6) * 0.2;
  for (const m of rimMats) {
    if (m.emissiveIntensity != null) {
      // Don't overwrite wildly — scale around stored base via userData
      if (m.userData.baseEmissive == null) m.userData.baseEmissive = m.emissiveIntensity;
      m.emissiveIntensity = m.userData.baseEmissive * rimPulse;
    }
  }

  // Floor wash breathe
  if (floorGlow && floorGlow.material) {
    const hueT = (Math.sin(t * 0.35) + 1) * 0.5;
    floorGlow.material.color.setHSL(0.5 + hueT * 0.25, 0.85, 0.55);
    floorGlow.material.opacity = 0.06 + Math.sin(t * 1.2) * 0.03;
  }

  // Prize underglow pulse + follow XY
  for (const p of prizes) {
    if (!p.alive || !p.glow) continue;
    const pulse = 0.2 + (Math.sin(t * 2.4 + p.mesh.position.x * 3) + 1) * 0.12;
    p.glow.material.opacity = pulse;
    p.glow.position.x = p.mesh.position.x;
    p.glow.position.z = p.mesh.position.z;
    if (p.glowLight) {
      p.glowLight.position.x = p.mesh.position.x;
      p.glowLight.position.z = p.mesh.position.z;
      p.glowLight.intensity = 0.14 + pulse * 0.35;
    }
  }

  // Brief scene chroma pulse on successful grab / win
  if (scenePulse > 0) {
    scenePulse = Math.max(0, scenePulse - dt * 1.8);
    scene.background.copy(bgBase).lerp(bgPulse, scenePulse);
    if (scene.fog) scene.fog.color.copy(scene.background);
  } else {
    scene.background.copy(bgBase);
    if (scene.fog) scene.fog.color.copy(bgBase);
  }
}

function tick(dt) {
  if (!bannerNeedsEnter && bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) {
      elBanner.classList.add('hidden');
      elBanner.classList.remove('win', 'miss');
    }
  }

  switch (state) {
    case 'idle':
      moveClaw(dt);
      break;

    case 'drop': {
      const next = getArmLength() + LOWER_SPEED * dt;
      setArmLength(next);
      const tip = clawWorldPos();
      if (tip.y <= 0.38 || getArmLength() >= 1.26) {
        state = 'grab';
      }
      break;
    }

    case 'grab': {
      const ok = attemptGrab();
      state = 'lift';
      setStatus(ok ? 'GOT ONE!?' : 'SQUEEZING…');
      break;
    }

    case 'lift': {
      const next = getArmLength() - LIFT_SPEED * dt;
      setArmLength(next);
      updateHeldPrize();
      if (getArmLength() <= 0.18) {
        setArmLength(0.15);
        if (grabRollOk && heldPrize) {
          state = 'toChute';
          setStatus('TO THE CHUTE!');
        } else {
          setClawOpen(true);
          state = 'return';
          setStatus('MISS…');
          showBanner('SO CLOSE!', true);
        }
      }
      break;
    }

    case 'toChute': {
      const tx = CAB.halfX - 0.22;
      const tz = 0;
      const p = clawRoot.position;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      const spd = 1.5 * dt;
      if (dist < spd) {
        p.x = tx;
        p.z = tz;
        state = 'release';
      } else {
        p.x += (dx / dist) * spd;
        p.z += (dz / dist) * spd;
      }
      updateHeldPrize();
      break;
    }

    case 'release': {
      setClawOpen(true);
      if (heldPrize) {
        scene.remove(heldPrize.mesh);
        if (heldPrize.glow) {
          prizeGlowGroup.remove(heldPrize.glow);
          heldPrize.glow = null;
        }
        if (heldPrize.glowLight) {
          prizeGlowGroup.remove(heldPrize.glowLight);
          heldPrize.glowLight = null;
        }
        heldPrize = null;
      }
      grabRollOk = false;
      wins += 1;
      updateHud({ winPunch: true });
      showBanner('YOU WIN!\nANI PLUSH');
      setStatus('PRIZE SECURED!');
      state = 'return';
      if (prizes.filter((p) => p.alive).length < 3) {
        setTimeout(() => {
          if (state === 'idle' || state === 'return') spawnPrizes();
        }, 800);
      }
      break;
    }

    case 'return': {
      const next = getArmLength() - LIFT_SPEED * 1.2 * dt;
      setArmLength(Math.max(0.15, next));
      setClawOpen(true);
      const tx = 0;
      const tz = 0.15;
      const p = clawRoot.position;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      const spd = 1.8 * dt;
      if (dist > spd) {
        p.x += (dx / dist) * spd;
        p.z += (dz / dist) * spd;
      } else {
        p.x = tx;
        p.z = tz;
      }
      if (getArmLength() <= 0.16 && dist <= spd) {
        setArmLength(0.15);
        if (credits <= 0) {
          state = 'empty';
          setStatus('OUT OF CREDITS · ◀ ARCADE');
        } else {
          state = 'idle';
          setStatus('MOVE CLAW · SPACE TO DROP');
        }
        updateHud();
      }
      break;
    }

    case 'empty':
      moveClaw(dt);
      break;

    default:
      break;
  }

  // Idle bob on prizes
  const t = clock.elapsedTime;
  for (const p of prizes) {
    if (!p.alive || p === heldPrize) continue;
    p.mesh.position.y = p.baseY + Math.sin(t * 2 + p.mesh.position.x * 4) * 0.008;
  }

  updateJuice(dt, t);
}

function applyPixelRatio(pr) {
  const next = Math.max(0.75, Math.min(basePixelRatio, pr));
  if (Math.abs(next - livePixelRatio) < 0.04) return;
  livePixelRatio = next;
  renderer.setPixelRatio(livePixelRatio);
  resize();
}

function disableShadowsRuntime() {
  if (!shadowsEnabled) return;
  shadowsEnabled = false;
  renderer.shadowMap.enabled = false;
  key.castShadow = false;
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
}

function adaptQuality(fps) {
  if (fps < 28) {
    lowFpsStreak += 1;
    if (lowFpsStreak >= 3) {
      applyPixelRatio(livePixelRatio - 0.25);
      disableShadowsRuntime();
      if (prizeCountLive > PRIZE_COUNT_LOW) {
        prizeCountLive = PRIZE_COUNT_LOW;
        // Respawn only when idle so we don't yank mid-grab
        if (state === 'idle' || state === 'empty') spawnPrizes();
      }
    }
  } else if (fps > 48) {
    lowFpsStreak = 0;
    // Gently restore toward base (never re-enable shadows mid-session — too jarring)
    if (livePixelRatio < basePixelRatio - 0.05) {
      applyPixelRatio(Math.min(basePixelRatio, livePixelRatio + 0.15));
    }
  } else {
    lowFpsStreak = Math.max(0, lowFpsStreak - 1);
  }
}

function updateFpsHud(dt) {
  fpsFrames += 1;
  fpsAccum += dt;
  if (fpsAccum < 0.45) return;
  fpsShown = Math.round(fpsFrames / fpsAccum);
  fpsFrames = 0;
  fpsAccum = 0;
  if (elFps) {
    elFps.textContent = `FPS ${fpsShown}`;
    elFps.classList.toggle('low', fpsShown < 40 && fpsShown >= 28);
    elFps.classList.toggle('crit', fpsShown < 28);
  }
  if (state !== 'boot') adaptQuality(fpsShown);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  updateFpsHud(dt);
  if (state !== 'boot') tick(dt);
  renderer.render(scene, camera);
}

// Input
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
  const isSpace = e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space';
  if (isEnter || (isSpace && bannerIsUp())) {
    e.preventDefault();
    e.stopPropagation();
    if (bannerIsUp()) dismissBanner();
    return;
  }
  if (isSpace) {
    e.preventDefault();
    tryStartDrop();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

elBanner.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (bannerIsUp()) dismissBanner();
});

dropBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tryStartDrop();
});

document.querySelectorAll('#pads [data-dir]').forEach((btn) => {
  const dir = btn.getAttribute('data-dir');
  const on = (e) => {
    e.preventDefault();
    padDirs[dir] = true;
    btn.classList.add('held');
  };
  const off = (e) => {
    e.preventDefault();
    padDirs[dir] = false;
    btn.classList.remove('held');
  };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
}, { passive: false });

async function boot() {
  makeCabinet();
  makeClaw();
  setStatus('LOADING PRIZE…');
  updateHud();

  const loader = new GLTFLoader();
  const PRIZE_PATHS = [
    'assets/ani_chibi_prize_v1_textured.glb',
    'assets/ani_chibi_prize_v1_black_hood.glb',
    'assets/ani_chibi_prize_v1_blue_hood.glb',
  ];
  try {
    prizeProtos = [];
    for (const path of PRIZE_PATHS) {
      const gltf = await loader.loadAsync(path);
      const root = gltf.scene;
      root.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = shadowsEnabled;
          c.receiveShadow = shadowsEnabled;
          if (c.material) {
            if (c.material.map) c.material.map.colorSpace = THREE.SRGBColorSpace;
            c.material.needsUpdate = true;
          }
        }
      });
      prizeProtos.push(root);
    }
    if (IS_MOBILE) prizeCountLive = Math.min(prizeCountLive, 6);
    spawnPrizes();
    state = 'idle';
    setStatus('MOVE CLAW · SPACE TO DROP · 3 PRIZES');
    updateHud();
  } catch (err) {
    console.error(err);
    setStatus('FAILED TO LOAD GLB');
    showBanner('LOAD ERROR', true);
    prizeProtos = [
      new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.32, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xff8800 })
      ),
    ];
    spawnPrizes();
    state = 'idle';
    updateHud();
  }
}

loop();
boot();
