import * as THREE from 'three';

const GAMES = [
  {
    id: 'runner',
    name: 'Pixel Fox Runner',
    short: 'RUNNER',
    href: '/games/runner/',
    accent: 0xff8800,
    screen: 0x1a2a4e,
  },
  {
    id: 'snake',
    name: 'Fox Snake',
    short: 'SNAKE',
    href: '/games/snake/',
    accent: 0x44cc66,
    screen: 0x102818,
  },
  {
    id: 'tower',
    name: 'Tower Defender',
    short: 'TOWER',
    href: '/games/tower/',
    accent: 0xaa44ff,
    screen: 0x201030,
  },
  {
    id: 'chrono',
    name: 'Chrono Tail Rush',
    short: 'CHRONO',
    href: '/games/chrono/',
    accent: 0x44aaff,
    screen: 0x0b0014,
  },
  {
    id: 'tailship',
    name: 'Tailship',
    short: 'TAILSHIP',
    href: '/games/tailship/',
    accent: 0xf0d36b,
    screen: 0x2a1428,
  },
  {
    id: 'knockout',
    name: 'Fox Knockout',
    short: 'KNOCKOUT',
    href: '/games/fox-knockout/',
    accent: 0xd03040,
    screen: 0x1a1030,
  },
  {
    id: 'claw',
    name: 'Ani Claw',
    short: 'CLAW',
    href: '/games/claw/',
    accent: 0xff9a2a,
    screen: 0x1a1028,
  },
  {
    id: 'foxpac',
    name: 'FoxPac',
    short: 'FOXPAC',
    href: '/games/foxpac/',
    accent: 0x39ff14,
    screen: 0x050814,
  },
];

const canvas = document.getElementById('c');
const promptEl = document.getElementById('prompt');
const fpsEl = document.getElementById('fps');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08040c);
scene.fog = new THREE.Fog(0x08040c, 10, 28);

const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 60);
camera.position.set(0, 1.55, 7.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// Lights — few, no shadows
scene.add(new THREE.AmbientLight(0x302038, 0.55));
const hemi = new THREE.HemisphereLight(0xffc8a0, 0x1a1028, 0.55);
scene.add(hemi);

const cyan = new THREE.PointLight(0x40e0ff, 1.1, 18);
cyan.position.set(-5, 3.2, 2);
scene.add(cyan);

const magenta = new THREE.PointLight(0xff40c8, 1.0, 18);
magenta.position.set(5, 3.2, 2);
scene.add(magenta);

const orange = new THREE.PointLight(0xff7a1a, 1.15, 16);
orange.position.set(0, 2.8, 6);
scene.add(orange);

// Neon floor grid
function makeFloor() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    new THREE.MeshStandardMaterial({
      color: 0x120818,
      roughness: 0.92,
      metalness: 0.08,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  const grid = new THREE.GridHelper(22, 22, 0xff40c8, 0x2a1840);
  grid.position.y = 0.01;
  const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
  mats.forEach((m) => {
    m.transparent = true;
    m.opacity = 0.55;
  });
  group.add(grid);

  // Neon edge strips
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x40e0ff });
  const stripMat2 = new THREE.MeshBasicMaterial({ color: 0xff40c8 });
  const mkStrip = (w, d, x, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
    m.position.set(x, 0.03, z);
    group.add(m);
  };
  mkStrip(20, 0.08, 0, -8.5, stripMat);
  mkStrip(20, 0.08, 0, 8.5, stripMat2);
  mkStrip(0.08, 16, -10, 0, stripMat2);
  mkStrip(0.08, 16, 10, 0, stripMat);

  return group;
}
scene.add(makeFloor());

// Back wall + side walls (simple)
function makeWalls() {
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x140a16,
    roughness: 0.95,
    metalness: 0.05,
  });
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 0.3), wallMat);
  back.position.set(0, 2.5, -8.7);
  scene.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 18), wallMat);
  left.position.set(-10.7, 2.5, 0);
  scene.add(left);
  const right = left.clone();
  right.position.x = 10.7;
  scene.add(right);

  // Neon wall glow bars
  const barGeo = new THREE.BoxGeometry(0.08, 3.2, 0.08);
  const colors = [0x40e0ff, 0xff40c8, 0xff7a1a];
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(
      barGeo,
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
    );
    bar.position.set(-8 + i * 2.6, 2.2, -8.5);
    scene.add(bar);
  }
}
makeWalls();

function makeLabelTexture(text, accentHex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(8,4,12,0.85)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 12;
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeCabinet(game) {
  const root = new THREE.Group();
  root.userData.game = game;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a1620,
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.1, 1.05), bodyMat);
  body.position.y = 1.05;
  body.userData.isCabinet = true;
  root.add(body);

  const topMat = new THREE.MeshStandardMaterial({
    color: game.accent,
    roughness: 0.45,
    metalness: 0.25,
    emissive: game.accent,
    emissiveIntensity: 0.25,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 1.12), topMat);
  top.position.y = 2.2;
  top.userData.isCabinet = true;
  root.add(top);

  const screenMat = new THREE.MeshStandardMaterial({
    color: game.screen,
    roughness: 0.35,
    metalness: 0.1,
    emissive: game.accent,
    emissiveIntensity: 0.55,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.72, 0.06), screenMat);
  screen.position.set(0, 1.45, 0.52);
  screen.userData.isCabinet = true;
  screen.userData.isScreen = true;
  root.add(screen);

  // Bezel
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.84, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x1a1014, roughness: 0.8 })
  );
  bezel.position.set(0, 1.45, 0.48);
  bezel.userData.isCabinet = true;
  root.add(bezel);

  // Control panel shelf
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.12, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x1a1018, roughness: 0.6, metalness: 0.3 })
  );
  panel.position.set(0, 0.72, 0.55);
  panel.userData.isCabinet = true;
  root.add(panel);

  // Joystick nub
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 })
  );
  stick.position.set(-0.28, 0.88, 0.55);
  root.add(stick);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshStandardMaterial({
      color: game.accent,
      emissive: game.accent,
      emissiveIntensity: 0.4,
    })
  );
  ball.position.set(-0.28, 0.98, 0.55);
  root.add(ball);

  // Buttons
  [0.12, 0.32].forEach((bx, i) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10),
      new THREE.MeshStandardMaterial({
        color: i === 0 ? 0xff4060 : 0x40ff80,
        emissive: i === 0 ? 0xff2040 : 0x20c060,
        emissiveIntensity: 0.35,
      })
    );
    btn.position.set(bx, 0.8, 0.55);
    root.add(btn);
  });

  // Floating label
  const accentHex = '#' + game.accent.toString(16).padStart(6, '0');
  const labelTex = makeLabelTexture(game.short, accentHex);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.38),
    new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  label.position.set(0, 2.65, 0);
  label.userData.billboard = true;
  root.add(label);

  // Soft ground glow disc
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({
      color: game.accent,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  root.add(glow);

  root.traverse((o) => {
    if (o.isMesh) o.userData.game = game;
  });

  return root;
}

// Layout: 4 left/back row, 3 right/front-ish — arc along back wall
const cabinets = [];
const positions = [
  { x: -7.2, z: -5.5, rot: 0.25 },
  { x: -4.3, z: -6.2, rot: 0.12 },
  { x: -1.4, z: -6.5, rot: 0.04 },
  { x: 1.4, z: -6.5, rot: -0.04 },
  { x: 4.3, z: -6.2, rot: -0.12 },
  { x: 7.2, z: -5.5, rot: -0.25 },
  { x: 0, z: -3.2, rot: 0 }, // claw center front
  { x: 3.2, z: -3.4, rot: -0.08 }, // foxpac
];

GAMES.forEach((game, i) => {
  const cab = makeCabinet(game);
  const p = positions[i];
  cab.position.set(p.x, 0, p.z);
  cab.rotation.y = p.rot;
  scene.add(cab);
  cabinets.push(cab);
});

// Fox-head billboard near entrance
const foxTex = new THREE.TextureLoader().load('../assets/fox-head.png');
foxTex.colorSpace = THREE.SRGBColorSpace;
const foxBill = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 1.4),
  new THREE.MeshBasicMaterial({
    map: foxTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
foxBill.position.set(-3.2, 1.6, 5.5);
foxBill.userData.billboard = true;
scene.add(foxBill);

const enterSignTex = makeLabelTexture("ANI'S ARCADE", '#ff8a1a');
const enterSign = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 0.6),
  new THREE.MeshBasicMaterial({
    map: enterSignTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
enterSign.position.set(0, 3.4, -8.4);
scene.add(enterSign);

// Player / camera controls
const keys = Object.create(null);
const padDirs = Object.create(null);
let yaw = 0;
let pitch = -0.08;
const eyeHeight = 1.55;
const moveSpeed = 4.2;
const lookSens = 0.0024;
const bounds = { minX: -9.2, maxX: 9.2, minZ: -7.2, maxZ: 7.8 };

let dragging = false;
let lastX = 0;
let lastY = 0;
let pointerId = null;
let suppressClick = false;
let dragDist = 0;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (hovered) enterGame(hovered);
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  pointerId = e.pointerId;
  lastX = e.clientX;
  lastY = e.clientY;
  dragDist = 0;
  suppressClick = false;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {}
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== pointerId) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  dragDist += Math.abs(dx) + Math.abs(dy);
  if (dragDist > 8) suppressClick = true;
  yaw -= dx * lookSens;
  pitch -= dy * lookSens;
  pitch = Math.max(-1.1, Math.min(0.85, pitch));
});
function endDrag(e) {
  if (e.pointerId !== pointerId) return;
  dragging = false;
  pointerId = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('click', (e) => {
  if (suppressClick) return;
  pickAt(e.clientX, e.clientY, true);
});

document.querySelectorAll('#pads button').forEach((btn) => {
  const dir = btn.dataset.dir;
  const on = (ev) => {
    ev.preventDefault();
    padDirs[dir] = true;
  };
  const off = (ev) => {
    ev.preventDefault();
    padDirs[dir] = false;
  };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

function pickAt(clientX, clientY, doEnter) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(cabinets, true);
  if (hits.length) {
    const game = hits[0].object.userData.game;
    if (game) {
      setHover(game);
      if (doEnter) enterGame(game);
      return game;
    }
  }
  return null;
}

function setHover(game) {
  hovered = game;
  if (game) {
    promptEl.textContent = `${game.name}  ·  ENTER / click`;
    promptEl.classList.add('hot');
    promptEl.classList.remove('idle');
  } else {
    promptEl.textContent = 'Walk the neon · tap a cabinet';
    promptEl.classList.remove('hot');
    promptEl.classList.add('idle');
  }
}

function enterGame(game) {
  if (!game || !game.href) return;
  window.location.href = game.href;
}

function updateCamera(dt) {
  let mx = 0;
  let mz = 0;
  if (keys.KeyW || keys.ArrowUp || padDirs.forward) mz -= 1;
  if (keys.KeyS || keys.ArrowDown || padDirs.back) mz += 1;
  if (keys.KeyA || keys.ArrowLeft || padDirs.left) mx -= 1;
  if (keys.KeyD || keys.ArrowRight || padDirs.right) mx += 1;

  if (mx || mz) {
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    // forward is -Z in yaw=0
    const dx = (mx * cos + mz * sin) * moveSpeed * dt;
    const dz = (-mx * sin + mz * cos) * moveSpeed * dt;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x + dx, bounds.minX, bounds.maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + dz, bounds.minZ, bounds.maxZ);
  }
  camera.position.y = eyeHeight;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function updateHoverProximity() {
  // Ray from camera center
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(cabinets, true);
  if (hits.length && hits[0].distance < 7.5) {
    const game = hits[0].object.userData.game;
    if (game) {
      setHover(game);
      return;
    }
  }
  // Near cabinet by distance
  let best = null;
  let bestD = 2.8;
  const cam = camera.position;
  for (const cab of cabinets) {
    const d = cam.distanceTo(cab.position);
    if (d < bestD) {
      bestD = d;
      best = cab.userData.game;
    }
  }
  setHover(best);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// Billboard labels face camera
function updateBillboards() {
  scene.traverse((o) => {
    if (o.userData.billboard) {
      o.quaternion.copy(camera.quaternion);
    }
  });
}

// Mild light pulse
const clock = new THREE.Clock();
let fpsAccum = 0;
let fpsFrames = 0;
let fpsTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  cyan.intensity = 1.0 + Math.sin(t * 1.7) * 0.15;
  magenta.intensity = 0.95 + Math.sin(t * 1.9 + 1) * 0.15;
  orange.intensity = 1.05 + Math.sin(t * 1.4 + 2) * 0.12;

  // Screen pulse
  for (const cab of cabinets) {
    cab.traverse((ch) => {
      if (ch.userData && ch.userData.isScreen && ch.material) {
        ch.material.emissiveIntensity = 0.45 + Math.sin(t * 3 + cab.position.x) * 0.15;
      }
    });
    // Bob labels slightly
    const label = cab.children.find((c) => c.userData.billboard);
    if (label) label.position.y = 2.65 + Math.sin(t * 2 + cab.position.x) * 0.05;
  }

  updateCamera(dt);
  updateBillboards();
  updateHoverProximity();
  renderer.render(scene, camera);

  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(fpsFrames / fpsTimer);
    fpsEl.textContent = `FPS ${fps}`;
    fpsFrames = 0;
    fpsTimer = 0;
  }
}
animate();
