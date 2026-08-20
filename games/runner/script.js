// ============================================================
// Pixel Fox Runner - Manual Platformer + Soft Stages
// Pure HTML5 Canvas + vanilla JS
// 8-bit style fox girl (Ani)
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// -------------------- CONFIG --------------------
const GAME_WIDTH = 480;
const GAME_HEIGHT = 270;
const BASE_GROUND = 220;
const GRAVITY = 0.55;
const JUMP_FORCE = -10.5;
const MOVE_SPEED = 3.2;
const MAX_FALL = 12;

// -------------------- CHARACTERS (light gacha) --------------------
const CHARACTERS = [
  {
    id: 'ani',
    name: 'Ani',
    cost: 0,
    colors: { skin: '#ffccaa', hair: '#22cc66', hairDark: '#118844', onesie: '#ff8800', white: '#ffffff', purple: '#aa44ff', tail: '#cc6622' }
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    cost: 50,
    colors: { skin: '#ffccaa', hair: '#44aaff', hairDark: '#2266cc', onesie: '#3388ff', white: '#ffffff', purple: '#66ccff', tail: '#2266aa' }
  },
  {
    id: 'sakura',
    name: 'Sakura',
    cost: 80,
    colors: { skin: '#ffccbb', hair: '#ff66aa', hairDark: '#cc3388', onesie: '#ff99cc', white: '#ffffff', purple: '#ff44aa', tail: '#ee5599' }
  },
  {
    id: 'ember',
    name: 'Ember',
    cost: 120,
    colors: { skin: '#ffe0c0', hair: '#ffcc33', hairDark: '#cc8800', onesie: '#ff5522', white: '#ffffff', purple: '#ffaa00', tail: '#cc4411' }
  },
  {
    id: 'shadow',
    name: 'Shadow',
    cost: 150,
    colors: { skin: '#e8d0f0', hair: '#8844cc', hairDark: '#552288', onesie: '#331144', white: '#ddddff', purple: '#cc66ff', tail: '#6622aa' }
  }
];

function loadSave() {
  try {
    const raw = localStorage.getItem('pfr_save');
    if (!raw) return { bank: 0, unlocked: ['ani'], selected: 'ani' };
    const data = JSON.parse(raw);
    return {
      bank: data.bank || 0,
      unlocked: data.unlocked && data.unlocked.length ? data.unlocked : ['ani'],
      selected: data.selected || 'ani'
    };
  } catch (e) {
    return { bank: 0, unlocked: ['ani'], selected: 'ani' };
  }
}

function saveData() {
  localStorage.setItem('pfr_save', JSON.stringify({
    bank: bankCoins,
    unlocked: unlockedChars,
    selected: selectedCharId
  }));
}

let save = loadSave();
let bankCoins = save.bank;
let unlockedChars = save.unlocked;
let selectedCharId = save.selected;
if (!unlockedChars.includes('ani')) unlockedChars.push('ani');
if (!CHARACTERS.find(c => c.id === selectedCharId)) selectedCharId = 'ani';

function getSelectedChar() {
  return CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
}

function getCharColors() {
  return getSelectedChar().colors;
}

let selectIndex = Math.max(0, CHARACTERS.findIndex(c => c.id === selectedCharId));
let floatTexts = [];
let unlockFlash = 0;
let milestoneFlash = 0;

function spawnFloatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 45, maxLife: 45, vy: -1.2 });
}

function tryUnlockCurrent() {
  const ch = CHARACTERS[selectIndex];
  if (unlockedChars.includes(ch.id)) {
    selectedCharId = ch.id;
    saveData();
    return;
  }
  if (bankCoins >= ch.cost) {
    bankCoins -= ch.cost;
    unlockedChars.push(ch.id);
    selectedCharId = ch.id;
    unlockFlash = 60;
    saveData();
    playBeep(660, 0.1, 'square', 0.1);
    playBeep(990, 0.12, 'square', 0.08);
    playBeep(1320, 0.15, 'square', 0.07);
  } else {
    playBeep(120, 0.15, 'sawtooth', 0.08);
  }
}


let canvasScale = 1;
let cameraX = 0;

// -------------------- AUDIO --------------------
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playBeep(freq, duration, type = 'square', volume = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxJump()    { playBeep(480, 0.08, 'square', 0.07); setTimeout(() => playBeep(620, 0.1, 'square', 0.05), 40); }
function sfxCoin()    { playBeep(880, 0.06, 'square', 0.06); setTimeout(() => playBeep(1200, 0.1, 'square', 0.05), 50); }
function sfxHit()     { playBeep(180, 0.15, 'sawtooth', 0.09); setTimeout(() => playBeep(120, 0.2, 'sawtooth', 0.06), 60); }
function sfxStomp()   { playBeep(220, 0.06, 'square', 0.08); setTimeout(() => playBeep(160, 0.12, 'triangle', 0.07), 40); }
function sfxHeart()   { playBeep(660, 0.08, 'sine', 0.07); setTimeout(() => playBeep(880, 0.12, 'sine', 0.05), 70); }
function sfxGameOver(){ playBeep(300, 0.2, 'sawtooth', 0.08); setTimeout(() => playBeep(200, 0.3, 'sawtooth', 0.07), 150); setTimeout(() => playBeep(120, 0.4, 'sawtooth', 0.06), 320); }
function sfxWater()   { playBeep(140, 0.12, 'triangle', 0.07); setTimeout(() => playBeep(90, 0.18, 'sawtooth', 0.05), 50); }

function playStartJingle() {
  const notes = [
    {f: 523, d: 0.12}, {f: 659, d: 0.12}, {f: 784, d: 0.12},
    {f: 1047, d: 0.18}, {f: 784, d: 0.1}, {f: 880, d: 0.15}, {f: 1047, d: 0.25}
  ];
  let t = 0;
  notes.forEach(n => {
    setTimeout(() => playBeep(n.f, n.d, 'square', 0.06), t * 1000);
    t += n.d * 0.85;
  });
}

// -------------------- STATE --------------------
let state = 'start';
let score = 0;
let distance = 0;
let coins = 0;
let lives = 3;
let invuln = 0;
let frameCount = 0;
let lastObstacleX = 0;
let lastCollectibleX = 0;

// -------------------- PLAYER --------------------
const player = {
  x: 70,
  y: BASE_GROUND,
  w: 16,
  h: 24,
  vx: 0,
  vy: 0,
  onGround: true,
  facing: 1,
  animFrame: 0,
  animTimer: 0
};

// -------------------- INPUT --------------------
const keys = { left: false, right: false };

function onJump() {
  initAudio();
  if (state === 'start') { startGame(); return; }
  if (state === 'gameover') { restartGame(); return; }
  if (state === 'playing' && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    sfxJump();
  }
}

window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    window.location.href = '../../index.html';
    return;
  }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    if (state === 'start' || state === 'gameover') {
      selectIndex = (selectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
      playBeep(400, 0.05, 'square', 0.05);
    } else {
      keys.left = true;
    }
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    if (state === 'start' || state === 'gameover') {
      selectIndex = (selectIndex + 1) % CHARACTERS.length;
      playBeep(400, 0.05, 'square', 0.05);
    } else {
      keys.right = true;
    }
  }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    onJump();
  }
  if (e.code === 'KeyE' || e.code === 'Enter') {
    if (state === 'start' || state === 'gameover') {
      e.preventDefault();
      tryUnlockCurrent();
    }
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

let touchLeft = false;
let touchRight = false;

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const tx = (e.clientX - rect.left) / canvasScale;
  if (state === 'start' || state === 'gameover') {
    if (tx < GAME_WIDTH * 0.28) {
      selectIndex = (selectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
      playBeep(400, 0.05, 'square', 0.05);
    } else if (tx > GAME_WIDTH * 0.72) {
      selectIndex = (selectIndex + 1) % CHARACTERS.length;
      playBeep(400, 0.05, 'square', 0.05);
    } else if (tx > GAME_WIDTH * 0.35 && tx < GAME_WIDTH * 0.65 && e.clientY - rect.top > 150 * canvasScale) {
      // lower center = try unlock/select
      tryUnlockCurrent();
    } else {
      onJump();
    }
    return;
  }
  if (tx < GAME_WIDTH * 0.4) touchLeft = true;
  else if (tx > GAME_WIDTH * 0.6) touchRight = true;
  else onJump();
});

canvas.addEventListener('pointerup', () => { touchLeft = false; touchRight = false; });
canvas.addEventListener('pointercancel', () => { touchLeft = false; touchRight = false; });

// -------------------- RESIZE --------------------
function resize() {
  const scaleX = window.innerWidth / GAME_WIDTH;
  const scaleY = window.innerHeight / GAME_HEIGHT;
  canvasScale = Math.min(scaleX, scaleY) * 0.95;
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  canvas.style.width = (GAME_WIDTH * canvasScale) + 'px';
  canvas.style.height = (GAME_HEIGHT * canvasScale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// -------------------- DRAW HELPERS --------------------
// C is now dynamic per character
function getC() { return getCharColors(); }

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function drawFox(pxX, pxY, frame, scale = 1, facing = 1) {
  const s = scale;
  const x = Math.floor(pxX);
  const y = Math.floor(pxY);
  const C = getCharColors(); // cache once per draw

  ctx.save();
  if (facing < 0) {
    ctx.translate(x + 16 * s, 0);
    ctx.scale(-1, 1);
    px(0 - 4*s, y + 12*s, 6*s, 4*s, C.tail);
    px(0 - 6*s, y + 10*s, 4*s, 4*s, C.tail);
    px(0 + 3*s, y + 10*s, 10*s, 10*s, C.onesie);
    px(0 + 2*s, y + 11*s, 12*s, 8*s, C.onesie);
    px(0 + 2*s, y + 4*s, 12*s, 8*s, C.onesie);
    px(0 + 1*s, y + 5*s, 14*s, 6*s, C.onesie);
    px(0 + 2*s, y + 1*s, 4*s, 5*s, C.onesie);
    px(0 + 10*s, y + 1*s, 4*s, 5*s, C.onesie);
    px(0 + 3*s, y + 2*s, 2*s, 3*s, C.white);
    px(0 + 11*s, y + 2*s, 2*s, 3*s, C.white);
    px(0 + 4*s, y + 6*s, 8*s, 6*s, C.skin);
    px(0 + 1*s, y + 5*s, 3*s, 8*s, C.hair);
    px(0 + 12*s, y + 5*s, 3*s, 8*s, C.hair);
    px(0 + 0*s, y + 7*s, 2*s, 6*s, C.hairDark);
    px(0 + 14*s, y + 7*s, 2*s, 6*s, C.hairDark);
    px(0 + 5*s, y + 7*s, 2*s, 2*s, C.purple);
    px(0 + 9*s, y + 7*s, 2*s, 2*s, C.purple);
    px(0 + 5*s, y + 7*s, 1*s, 1*s, C.white);
    px(0 + 9*s, y + 7*s, 1*s, 1*s, C.white);
    if (frame === 0) {
      px(0 + 4*s, y + 20*s, 3*s, 4*s, C.onesie);
      px(0 + 9*s, y + 20*s, 3*s, 4*s, C.onesie);
    } else if (frame === 1) {
      px(0 + 3*s, y + 19*s, 3*s, 5*s, C.onesie);
      px(0 + 10*s, y + 20*s, 3*s, 4*s, C.onesie);
    } else if (frame === 2) {
      px(0 + 4*s, y + 20*s, 3*s, 4*s, C.onesie);
      px(0 + 9*s, y + 19*s, 3*s, 5*s, C.onesie);
    } else {
      px(0 + 3*s, y + 18*s, 4*s, 4*s, C.onesie);
      px(0 + 9*s, y + 18*s, 4*s, 4*s, C.onesie);
    }
    px(0 + 4*s, y + 23*s, 3*s, 1*s, C.white);
    px(0 + 9*s, y + 23*s, 3*s, 1*s, C.white);
  } else {
    px(x - 4*s, y + 12*s, 6*s, 4*s, C.tail);
    px(x - 6*s, y + 10*s, 4*s, 4*s, C.tail);
    px(x + 3*s, y + 10*s, 10*s, 10*s, C.onesie);
    px(x + 2*s, y + 11*s, 12*s, 8*s, C.onesie);
    px(x + 2*s, y + 4*s, 12*s, 8*s, C.onesie);
    px(x + 1*s, y + 5*s, 14*s, 6*s, C.onesie);
    px(x + 2*s, y + 1*s, 4*s, 5*s, C.onesie);
    px(x + 10*s, y + 1*s, 4*s, 5*s, C.onesie);
    px(x + 3*s, y + 2*s, 2*s, 3*s, C.white);
    px(x + 11*s, y + 2*s, 2*s, 3*s, C.white);
    px(x + 4*s, y + 6*s, 8*s, 6*s, C.skin);
    px(x + 1*s, y + 5*s, 3*s, 8*s, C.hair);
    px(x + 12*s, y + 5*s, 3*s, 8*s, C.hair);
    px(x + 0*s, y + 7*s, 2*s, 6*s, C.hairDark);
    px(x + 14*s, y + 7*s, 2*s, 6*s, C.hairDark);
    px(x + 5*s, y + 7*s, 2*s, 2*s, C.purple);
    px(x + 9*s, y + 7*s, 2*s, 2*s, C.purple);
    px(x + 5*s, y + 7*s, 1*s, 1*s, C.white);
    px(x + 9*s, y + 7*s, 1*s, 1*s, C.white);
    if (frame === 0) {
      px(x + 4*s, y + 20*s, 3*s, 4*s, C.onesie);
      px(x + 9*s, y + 20*s, 3*s, 4*s, C.onesie);
    } else if (frame === 1) {
      px(x + 3*s, y + 19*s, 3*s, 5*s, C.onesie);
      px(x + 10*s, y + 20*s, 3*s, 4*s, C.onesie);
    } else if (frame === 2) {
      px(x + 4*s, y + 20*s, 3*s, 4*s, C.onesie);
      px(x + 9*s, y + 19*s, 3*s, 5*s, C.onesie);
    } else {
      px(x + 3*s, y + 18*s, 4*s, 4*s, C.onesie);
      px(x + 9*s, y + 18*s, 4*s, 4*s, C.onesie);
    }
    px(x + 4*s, y + 23*s, 3*s, 1*s, C.white);
    px(x + 9*s, y + 23*s, 3*s, 1*s, C.white);
  }
  ctx.restore();
}

// -------------------- STAGES (soft) --------------------
function getStage() {
  return Math.floor(score / 450);
}

const STAGE_PALETTES = [
  // Area 1 - cool night
  { sky: '#1a1a2e', mountain: '#16213e', treeTrunk: '#3d2914', treeLeaf: '#1b4332', ground: '#2d1b0e', grass: '#40916c', style: 0 },
  // Area 2 - deep violet
  { sky: '#12081c', mountain: '#2a1040', treeTrunk: '#3a1830', treeLeaf: '#4a2060', ground: '#1e0c18', grass: '#6a3080', style: 1 },
  // Area 3 - teal swamp
  { sky: '#061820', mountain: '#0c3040', treeTrunk: '#1a3028', treeLeaf: '#1a5040', ground: '#0e2018', grass: '#208060', style: 2 },
  // Area 4 - crimson
  { sky: '#180808', mountain: '#301010', treeTrunk: '#3a1810', treeLeaf: '#502018', ground: '#1c0c08', grass: '#803020', style: 3 },
  // Area 5 - void cyan
  { sky: '#040810', mountain: '#081828', treeTrunk: '#102030', treeLeaf: '#183848', ground: '#081018', grass: '#206080', style: 4 }
];

function getPalette() {
  const s = Math.min(getStage(), STAGE_PALETTES.length - 1);
  return STAGE_PALETTES[s];
}

// -------------------- TERRAIN --------------------
let terrain = [];

function initTerrain() {
  terrain = [];
  terrain.push({ x: -80, w: 280, top: BASE_GROUND, type: 'ground' });
  generateMoreTerrain();
}

function generateMoreTerrain() {
  while (true) {
    const last = terrain[terrain.length - 1];
    if (last.x + last.w > cameraX + GAME_WIDTH + 500) break;

    const nextX = last.x + last.w;
    const roll = Math.random();

    if (roll < 0.20 && last.type === 'ground') {
      const waterW = 22 + Math.floor(Math.random() * 14);
      terrain.push({ x: nextX, w: waterW, top: BASE_GROUND + 6, type: 'water' });
      continue;
    }

    let newTop = last.top;
    const heightRoll = Math.random();

    if (heightRoll < 0.36) {
      newTop = Math.max(130, last.top - (22 + Math.floor(Math.random() * 36)));
    } else if (heightRoll < 0.60) {
      newTop = Math.min(BASE_GROUND, last.top + (18 + Math.floor(Math.random() * 30)));
    }

    newTop = Math.max(125, Math.min(BASE_GROUND, newTop));
    const segW = 40 + Math.floor(Math.random() * 90);
    terrain.push({ x: nextX, w: segW, top: newTop, type: 'ground' });
  }
}

function getTerrainUnder(px) {
  for (let i = 0; i < terrain.length; i++) {
    const t = terrain[i];
    if (px >= t.x && px < t.x + t.w) return t;
  }
  return null;
}

function getGroundY(px) {
  const t = getTerrainUnder(px);
  if (!t) return BASE_GROUND + 90;
  return t.top;
}

// -------------------- WORLD OBJECTS --------------------
let obstacles = [];
let collectibles = [];
let particles = [];

function spawnObstacle() {
  const aheadX = cameraX + GAME_WIDTH + 50 + Math.random() * 40;
  const t = getTerrainUnder(aheadX);
  if (t && t.type === 'water') return;

  const groundY = getGroundY(aheadX);
  const type = Math.random();
  let o;

  if (type < 0.38) {
    o = { type: 'crate', x: aheadX, y: groundY - 20, w: 20, h: 20 };
  } else if (type < 0.68) {
    o = { type: 'spikes', x: aheadX, y: groundY - 12, w: 24, h: 12 };
  } else {
    o = { type: 'bird', x: aheadX, y: groundY - 55 - Math.random() * 50, w: 18, h: 12, bob: Math.random() * 6 };
  }
  obstacles.push(o);
  lastObstacleX = aheadX;
}

function spawnCollectible() {
  const aheadX = cameraX + GAME_WIDTH + 40 + Math.random() * 60;
  const groundY = getGroundY(aheadX);
  const type = Math.random() < 0.72 ? 'coin' : 'heart';

  collectibles.push({
    type,
    x: aheadX,
    y: groundY - 28 - Math.random() * 60,
    w: 12,
    h: 12,
    collected: false
  });
  lastCollectibleX = aheadX;
}

// -------------------- DRAW WORLD --------------------
function drawWorld() {
  const pal = getPalette();

  // Full clear every frame - no leftover night scene
  ctx.fillStyle = pal.sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Parallax mountains - different silhouette per style
  ctx.fillStyle = pal.mountain;
  const mCount = pal.style >= 3 ? 6 : 8;
  for (let i = -1; i < mCount; i++) {
    const bx = ((i * 130) - (cameraX * 0.15 % 130));
    const peak = pal.style === 0 ? 155 : (pal.style === 1 ? 145 : (pal.style === 2 ? 160 : 150));
    ctx.beginPath();
    ctx.moveTo(bx, 200);
    ctx.lineTo(bx + 45, peak);
    ctx.lineTo(bx + 90, peak + 20);
    ctx.lineTo(bx + 130, 200);
    ctx.fill();
  }

  // Trees - density and shape shift with area
  const treeCount = pal.style >= 2 ? 7 : 10;
  for (let i = -1; i < treeCount; i++) {
    const tx = ((i * (pal.style >= 2 ? 90 : 75)) - (cameraX * 0.4 % (pal.style >= 2 ? 90 : 75)));
    px(tx + 14, 170, 6, 50, pal.treeTrunk);
    ctx.fillStyle = pal.treeLeaf;
    ctx.beginPath();
    if (pal.style === 1) {
      // wider / fluffier trees for purple area
      ctx.moveTo(tx - 4, 175);
      ctx.lineTo(tx + 17, 135);
      ctx.lineTo(tx + 38, 175);
    } else if (pal.style >= 3) {
      // taller thin trees
      ctx.moveTo(tx + 4, 175);
      ctx.lineTo(tx + 17, 130);
      ctx.lineTo(tx + 30, 175);
    } else {
      ctx.moveTo(tx, 175);
      ctx.lineTo(tx + 17, 140);
      ctx.lineTo(tx + 34, 175);
    }
    ctx.fill();
  }

  // Terrain
  for (const t of terrain) {
    const sx = t.x - cameraX;
    if (sx + t.w < -20 || sx > GAME_WIDTH + 20) continue;

    if (t.type === 'ground') {
      ctx.fillStyle = pal.ground;
      ctx.fillRect(sx, t.top, t.w + 1, GAME_HEIGHT - t.top + 12);
      ctx.fillStyle = pal.grass;
      ctx.fillRect(sx, t.top, t.w + 1, 6);
      ctx.fillStyle = '#3d2914';
      for (let gx = sx + 8; gx < sx + t.w - 4; gx += 16) {
        px(gx, t.top + 8, 5, 3, '#3d2914');
      }
    } else {
      ctx.fillStyle = '#0a3d62';
      ctx.fillRect(sx, t.top, t.w + 1, GAME_HEIGHT - t.top + 12);
      ctx.fillStyle = '#1e90ff';
      ctx.fillRect(sx, t.top, t.w + 1, 5);
      ctx.fillStyle = '#4fc3f7';
      for (let wx = sx + 2; wx < sx + t.w; wx += 7) {
        px(wx, t.top + 1, 3, 2, '#4fc3f7');
      }
    }
  }
}

function drawObstacle(o) {
  const sx = o.x - cameraX;
  if (o.type === 'crate') {
    px(sx, o.y, o.w, o.h, '#8B4513');
    px(sx + 2, o.y + 2, o.w - 4, o.h - 4, '#A0522D');
    ctx.strokeStyle = '#5c3317';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 4, o.y + 4);
    ctx.lineTo(sx + o.w - 4, o.y + o.h - 4);
    ctx.moveTo(sx + o.w - 4, o.y + 4);
    ctx.lineTo(sx + 4, o.y + o.h - 4);
    ctx.stroke();
  } else if (o.type === 'spikes') {
    ctx.fillStyle = '#555';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * 6, o.y + o.h);
      ctx.lineTo(sx + i * 6 + 3, o.y);
      ctx.lineTo(sx + i * 6 + 6, o.y + o.h);
      ctx.fill();
    }
  } else if (o.type === 'bird') {
    o.bob += 0.15;
    const by = o.y + Math.sin(o.bob) * 4;
    px(sx, by + 4, 14, 6, '#222');
    px(sx + 10, by + 2, 6, 4, '#222');
    px(sx + 2, by + 2, 4, 2, '#fff');
    px(sx + 4, by, 8, 3, '#444');
  }
}

function drawCollectible(c) {
  if (c.collected) return;
  const sx = c.x - cameraX;
  if (c.type === 'coin') {
    // Round coin
    ctx.beginPath();
    ctx.arc(sx + 6, c.y + 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 6, c.y + 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffec8b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 6, c.y + 6, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  } else {
    px(sx + 1, c.y + 3, 4, 4, '#ff3366');
    px(sx + 7, c.y + 3, 4, 4, '#ff3366');
    px(sx + 3, c.y + 5, 6, 6, '#ff3366');
  }
}

// -------------------- PARTICLES --------------------
function spawnHitParticles(x, y, color1 = '#ff8800', color2 = '#22cc66') {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5 - 2,
      life: 18 + Math.random()*12, color: Math.random()>0.5 ? color1 : color2, size: 2+Math.random()*2
    });
  }
}
function spawnStompParticles(x, y) {
  for (let i = 0; i < 14; i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*6, vy: -Math.random()*5 - 1,
      life: 20 + Math.random()*15, color: Math.random()>0.4 ? '#ffee88' : '#ffffff', size: 2+Math.random()*3
    });
  }
}
function spawnWaterSplash(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*4, vy: -Math.random()*4 - 1,
      life: 15 + Math.random()*10, color: Math.random()>0.5 ? '#4fc3f7' : '#1e90ff', size: 2+Math.random()*2
    });
  }
}

// -------------------- GAME FLOW --------------------
function startGame() {
  // Apply selected character if unlocked
  const ch = CHARACTERS[selectIndex];
  if (unlockedChars.includes(ch.id)) {
    selectedCharId = ch.id;
    saveData();
  } else {
    // fallback to selected or ani
    selectIndex = CHARACTERS.findIndex(c => c.id === selectedCharId);
    if (selectIndex < 0) selectIndex = 0;
  }

  state = 'playing';
  score = 0;
  distance = 0;
  coins = 0;
  lives = 3;
  invuln = 0;
  cameraX = 0;
  lastObstacleX = 0;
  lastCollectibleX = 0;
  floatTexts = [];
  unlockFlash = 0;
  milestoneFlash = 0;
  player.x = 70;
  player.y = BASE_GROUND;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = 1;
  obstacles = [];
  collectibles = [];
  particles = [];
  initTerrain();
  playStartJingle();
}

function restartGame() {
  startGame();
}

function gameOver() {
  state = 'gameover';
  // Bank the run coins
  if (coins > 0) {
    bankCoins += coins;
    saveData();
  }
  sfxGameOver();
}

// -------------------- UPDATE --------------------
function update() {
  frameCount++;
  if (state !== 'playing') return;

  // Horizontal input
  let move = 0;
  if (keys.left || touchLeft) move -= 1;
  if (keys.right || touchRight) move += 1;

  player.vx = move * MOVE_SPEED;
  if (move !== 0) player.facing = move;

  // Gravity
  player.vy += GRAVITY;
  if (player.vy > MAX_FALL) player.vy = MAX_FALL;

  // Horizontal move + wall block
  const oldX = player.x;
  player.x += player.vx;

  if (player.vx > 0) {
    const checkX = player.x + player.w;
    const groundAtCheck = getGroundY(checkX);
    const groundAtFeet = getGroundY(player.x + player.w * 0.5);
    if (groundAtCheck < groundAtFeet - 6 && player.y > groundAtCheck + 2) {
      player.x = oldX;
      player.vx = 0;
    }
  } else if (player.vx < 0) {
    if (player.x < cameraX - 20) {
      player.x = cameraX - 20;
      player.vx = 0;
    }
  }

  // Vertical
  player.y += player.vy;

  const midX = player.x + player.w * 0.5;
  const groundUnder = getGroundY(midX);
  const under = getTerrainUnder(midX);

  if (player.y >= groundUnder - 1) {
    player.y = groundUnder;
    player.vy = 0;
    player.onGround = true;

    if (under && under.type === 'water' && invuln <= 0) {
      lives--;
      invuln = 50;
      spawnWaterSplash(player.x + 8, player.y - 4);
      sfxWater();
      if (lives <= 0) gameOver();
    }
  } else {
    player.onGround = false;
  }

  // Camera
  const targetCam = player.x - 110;
  cameraX += (targetCam - cameraX) * 0.12;
  if (cameraX < 0) cameraX = 0;

  generateMoreTerrain();
  while (terrain.length > 0 && terrain[0].x + terrain[0].w < cameraX - 200) {
    terrain.shift();
  }

  if (player.y > GAME_HEIGHT + 60) {
    lives = 0;
    gameOver();
  }

  // Animation
  player.animTimer++;
  if (player.onGround && Math.abs(player.vx) > 0.1) {
    if (player.animTimer > 5) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 3;
    }
  } else if (!player.onGround) {
    player.animFrame = 3;
  } else {
    player.animFrame = 0;
  }

  // Score
  distance = Math.max(distance, player.x * 0.12);
  score = Math.floor(distance) + coins * 15;

  // ===== EVEN DISTANCE-BASED SPAWNING =====
  const stage = getStage();
  // Gaps get tighter every stage so more obstacles appear
  const minObstacleGap = Math.max(110, 250 - stage * 32);
  const minCollectGap  = Math.max(120, 210 - stage * 18);

  if (player.x > lastObstacleX + minObstacleGap + Math.random() * 80) {
    spawnObstacle();
  }
  if (player.x > lastCollectibleX + minCollectGap + Math.random() * 100) {
    spawnCollectible();
  }

  // Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];

    const colliding =
      player.x < o.x + o.w &&
      player.x + player.w > o.x &&
      player.y - player.h < o.y + o.h &&
      player.y > o.y;

    if (colliding && invuln <= 0) {
      if (o.type === 'bird') {
        const birdMid = o.y + o.h * 0.45;
        if (player.vy > 0 && player.y < birdMid + 8) {
          obstacles.splice(i, 1);
          player.vy = -6.8;
          score += 50;
          spawnStompParticles(o.x + o.w / 2, o.y + 4);
          sfxStomp();
          continue;
        }
      }

      lives--;
      invuln = 55;
      spawnHitParticles(player.x + 8, player.y - 12);
      sfxHit();
      if (lives <= 0) gameOver();
    }

    if (o.x + o.w < cameraX - 40) obstacles.splice(i, 1);
  }

  // Collectibles
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];

    if (!c.collected &&
        player.x < c.x + c.w &&
        player.x + player.w > c.x &&
        player.y - player.h < c.y + c.h &&
        player.y > c.y) {
      c.collected = true;
      if (c.type === 'coin') {
        coins++;
        sfxCoin();
        spawnFloatText(c.x + 6, c.y, '+1', '#ffd700');
        spawnHitParticles(c.x + 6, c.y + 6, '#ffd700', '#ffee88');
        // Milestone juice
        if (coins > 0 && coins % 10 === 0) {
          milestoneFlash = 20;
          spawnFloatText(player.x + 8, player.y - 30, coins + ' COINS!', '#ffaa00');
          playBeep(1000, 0.08, 'square', 0.07);
        }
      } else {
        lives = Math.min(5, lives + 1);
        sfxHeart();
        spawnFloatText(c.x + 6, c.y, '+1 UP', '#ff6688');
        spawnHitParticles(c.x + 6, c.y + 6, '#ff3366', '#ff8899');
      }
    }

    if (c.x + c.w < cameraX - 30 || c.collected) collectibles.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Floating texts
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    floatTexts[i].y += floatTexts[i].vy;
    floatTexts[i].life--;
    if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
  }

  if (invuln > 0) invuln--;
  if (unlockFlash > 0) unlockFlash--;
  if (milestoneFlash > 0) milestoneFlash--;
}

// -------------------- DRAW --------------------
function draw() {
  drawWorld();

  obstacles.forEach(drawObstacle);
  collectibles.forEach(drawCollectible);

  particles.forEach(p => {
    px(p.x - cameraX, p.y, p.size || 3, p.size || 3, p.color);
  });

  if (invuln <= 0 || Math.floor(invuln / 4) % 2 === 0) {
    drawFox(player.x - cameraX, player.y - 24, player.animFrame, 1, player.facing);
  }

  // HUD
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Courier New';
  ctx.fillText(`SCORE ${score}`, 8, 16);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`COINS ${coins}`, 8, 28);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`BANK ${bankCoins}`, 8, 40);

  // Soft stage indicator
  const stage = getStage();
  if (stage > 0) {
    ctx.fillStyle = '#88aaff';
    ctx.fillText(`AREA ${stage + 1}`, 8, 52);
  }

  for (let i = 0; i < lives; i++) {
    px(GAME_WIDTH - 18 - i * 14, 8, 4, 4, '#ff3366');
    px(GAME_WIDTH - 14 - i * 14, 8, 4, 4, '#ff3366');
    px(GAME_WIDTH - 16 - i * 14, 11, 6, 5, '#ff3366');
  }

  // Floating score texts (during play)
  floatTexts.forEach(ft => {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x - cameraX, ft.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Milestone flash
  if (milestoneFlash > 0) {
    ctx.fillStyle = `rgba(255, 200, 50, ${milestoneFlash / 40})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  if (state === 'start' || state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.textAlign = 'center';

    if (state === 'start') {
      ctx.fillStyle = '#ff8800';
      ctx.font = 'bold 20px Courier New';
      ctx.fillText('PIXEL FOX RUNNER', GAME_WIDTH / 2, 28);
      ctx.fillStyle = '#88ffcc';
      ctx.font = '10px Courier New';
      ctx.fillText('UNLOCK CHARACTERS  •  RUN  •  COLLECT', GAME_WIDTH / 2, 44);
    } else {
      ctx.fillStyle = '#ff4466';
      ctx.font = 'bold 22px Courier New';
      ctx.fillText('GAME OVER', GAME_WIDTH / 2, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Courier New';
      ctx.fillText(`SCORE ${score}   +${coins} COINS BANKED`, GAME_WIDTH / 2, 48);
    }

    // Bank display
    ctx.fillStyle = '#ffd700';
    ctx.font = '11px Courier New';
    ctx.fillText(`BANK  ${bankCoins}`, GAME_WIDTH / 2, 66);

    // Character select
    const ch = CHARACTERS[selectIndex];
    const isUnlocked = unlockedChars.includes(ch.id);
    const isSelected = selectedCharId === ch.id;

    // Temporarily force colors for preview
    const prevSelected = selectedCharId;
    selectedCharId = ch.id;
    drawFox(GAME_WIDTH / 2 - 24, 78, 0, 2.8, 1);
    selectedCharId = prevSelected;

    // Name + status
    ctx.fillStyle = isUnlocked ? '#ffffff' : '#888888';
    ctx.font = 'bold 13px Courier New';
    ctx.fillText(ch.name.toUpperCase(), GAME_WIDTH / 2, 168);

    if (isUnlocked) {
      ctx.fillStyle = isSelected ? '#44ff88' : '#aaaaaa';
      ctx.font = '10px Courier New';
      ctx.fillText(isSelected ? '▼ SELECTED ▼' : 'OWNED  —  E/ENTER TO SELECT', GAME_WIDTH / 2, 184);
    } else {
      ctx.fillStyle = bankCoins >= ch.cost ? '#ffd700' : '#ff6666';
      ctx.font = '10px Courier New';
      ctx.fillText(`LOCKED  —  ${ch.cost} COINS  (E/ENTER)`, GAME_WIDTH / 2, 184);
    }

    // Arrows
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Courier New';
    ctx.fillText('<', GAME_WIDTH / 2 - 70, 130);
    ctx.fillText('>', GAME_WIDTH / 2 + 70, 130);

    // Dots for roster
    for (let i = 0; i < CHARACTERS.length; i++) {
      const owned = unlockedChars.includes(CHARACTERS[i].id);
      ctx.fillStyle = i === selectIndex ? '#ffffff' : (owned ? '#666666' : '#333333');
      ctx.beginPath();
      ctx.arc(GAME_WIDTH / 2 - (CHARACTERS.length - 1) * 6 + i * 12, 198, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (unlockFlash > 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${unlockFlash / 60})`;
      ctx.font = 'bold 14px Courier New';
      ctx.fillText('UNLOCKED!', GAME_WIDTH / 2, 215);
    }

    ctx.fillStyle = '#cccccc';
    ctx.font = '10px Courier New';
    ctx.fillText(state === 'start' ? 'SPACE / TAP  TO START' : 'SPACE / TAP  TO RETRY', GAME_WIDTH / 2, 240);
    ctx.fillStyle = '#666666';
    ctx.font = '8px Courier New';
    ctx.fillText('LEFT/RIGHT switch   E unlock/select', GAME_WIDTH / 2, 256);

    ctx.textAlign = 'left';
  }
}

// -------------------- LOOP --------------------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
