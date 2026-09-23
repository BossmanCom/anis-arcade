(() => {
  'use strict';

  // ——— Config ———
  const COLS = 19;
  const ROWS = 21;
  const TILE = 16;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  const DIRS = {
    none: { x: 0, y: 0, name: 'none' },
    left: { x: -1, y: 0, name: 'left' },
    right: { x: 1, y: 0, name: 'right' },
    up: { x: 0, y: -1, name: 'up' },
    down: { x: 0, y: 1, name: 'down' },
  };
  const DIR_LIST = [DIRS.left, DIRS.right, DIRS.up, DIRS.down];
  const OPP = { left: 'right', right: 'left', up: 'down', down: 'up', none: 'none' };

  // Maze: # wall · pellet o power  = empty - door G house
  const MAZE_SRC = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '   #.#       #.#   ',
    '####.# ##-## #.####',
    '    .  #GGG#  .    ',
    '####.# ##### #.####',
    '   #.#       #.#   ',
    '####.#.#####.#.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#...........#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ];

  const COLORS = {
    maze: '#1a5aff',
    mazeGlow: '#3a7aff',
    pellet: '#ffcc88',
    power: '#ffe8a0',
    bg: '#000814',
    fox: '#E87820',
    lime: '#39FF14',
    magenta: '#FF00AA',
  };

  const GHOST_DEFS = [
    { name: 'Blink', tint: null,          scatter: { x: 17, y: 1 },  personality: 'chase' },
    { name: 'Pinky', tint: '#ff66cc',      scatter: { x: 1, y: 1 },   personality: 'ambush' },
    { name: 'Inky',  tint: '#44ddff',      scatter: { x: 17, y: 19 }, personality: 'flank' },
    { name: 'Clyde', tint: '#ffdd44',      scatter: { x: 1, y: 19 },  personality: 'shy' },
  ];

  // ——— DOM ———
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const hiscoreEl = document.getElementById('hiscore');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const startBtn = document.getElementById('startBtn');

  // ——— Assets ———
  const foxImgs = {};
  const ghostImgs = {};
  let assetsReady = false;
  let assetsFailed = false;

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(src));
      img.src = src;
    });
  }

  async function loadAssets() {
    const foxDirs = ['right', 'left', 'up', 'down'];
    const ghostDirs = ['right', 'left', 'up', 'down'];
    const jobs = [];
    for (const d of foxDirs) {
      jobs.push(loadImg(`assets/fox/${d}_open.png`).then(i => { foxImgs[`${d}_open`] = i; }));
      jobs.push(loadImg(`assets/fox/${d}_closed.png`).then(i => { foxImgs[`${d}_closed`] = i; }));
    }
    for (const d of ghostDirs) {
      jobs.push(loadImg(`assets/ghosts/${d}_a.png`).then(i => { ghostImgs[`${d}_a`] = i; }));
      jobs.push(loadImg(`assets/ghosts/${d}_b.png`).then(i => { ghostImgs[`${d}_b`] = i; }));
    }
    jobs.push(loadImg('assets/ghosts/frightened_a.png').then(i => { ghostImgs.frightened_a = i; }));
    jobs.push(loadImg('assets/ghosts/frightened_b.png').then(i => { ghostImgs.frightened_b = i; }));
    // allSettled: keep successful sprites; still paint dark maze + fallbacks if some fail
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      console.warn('Sprite load failed', failed.map(r => r.reason && r.reason.message || r.reason));
      assetsFailed = true;
    }
    assetsReady = true;
  }

  // Offscreen tint cache
  const tintCache = new Map();
  function getTinted(img, tint) {
    if (!tint || !img) return img;
    const key = img.src + '|' + tint;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = tint;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    tintCache.set(key, c);
    return c;
  }

  // ——— Maze ———
  let grid = [];
  let pelletCount = 0;
  let totalPellets = 0;

  function buildMaze() {
    grid = [];
    pelletCount = 0;
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      const src = MAZE_SRC[y];
      for (let x = 0; x < COLS; x++) {
        const ch = src[x] || ' ';
        let cell = { wall: false, pellet: false, power: false, door: false, house: false };
        if (ch === '#') cell.wall = true;
        else if (ch === '.') { cell.pellet = true; pelletCount++; }
        else if (ch === 'o') { cell.power = true; pelletCount++; }
        else if (ch === '-') cell.door = true;
        else if (ch === 'G') cell.house = true;
        row.push(cell);
      }
      grid.push(row);
    }
    totalPellets = pelletCount;
  }

  function isWall(tx, ty, forGhost) {
    // Tunnel wrap
    if (ty < 0 || ty >= ROWS) return true;
    if (tx < 0 || tx >= COLS) return false; // tunnel
    const c = grid[ty][tx];
    if (c.wall) return true;
    if (c.door && !forGhost) return true;
    return false;
  }

  function wrapTile(tx) {
    if (tx < 0) return COLS - 1;
    if (tx >= COLS) return 0;
    return tx;
  }

  // ——— State ———
  let score = 0;
  let hiscore = parseInt(localStorage.getItem('foxpacHi') || '0', 10);
  let lives = 3;
  let level = 1;
  let state = 'ready'; // ready | playing | dying | levelclear | gameover
  let frightTimer = 0;
  let frightScore = 200;
  let modeTimer = 0;
  let globalMode = 'scatter'; // scatter | chase
  let invuln = 0;
  let floatScores = [];
  let animT = 0;

  hiscoreEl.textContent = String(hiscore);

  const player = {
    tx: 9, ty: 15,
    x: 9, y: 15,
    dir: DIRS.left,
    nextDir: DIRS.left,
    moving: false,
    speed: 6.2, // tiles/sec
    chomp: 0,
  };

  const ghosts = [];

  function baseSpeed() {
    return 6.0 + (level - 1) * 0.35;
  }
  function ghostSpeed() {
    return 5.2 + (level - 1) * 0.28;
  }
  function frightSpeed() {
    return 3.2;
  }

  function resetActors(full = false) {
    player.tx = 9; player.ty = 15;
    player.x = 9; player.y = 15;
    player.dir = DIRS.left;
    player.nextDir = DIRS.left;
    player.moving = false;
    player.speed = baseSpeed();
    player.chomp = 0;

    const starts = [
      { tx: 9, ty: 9 },
      { tx: 8, ty: 9 },
      { tx: 10, ty: 9 },
      { tx: 9, ty: 10 },
    ];
    ghosts.length = 0;
    for (let i = 0; i < 4; i++) {
      const def = GHOST_DEFS[i];
      const s = starts[i];
      ghosts.push({
        id: i,
        name: def.name,
        tint: def.tint,
        personality: def.personality,
        scatter: def.scatter,
        tx: s.tx, ty: s.ty,
        x: s.tx, y: s.ty,
        dir: DIRS.left,
        mode: 'house',
        leaveTimer: 0.6 + i * 1.8,
        eaten: false,
        bob: 0,
        speed: ghostSpeed(),
      });
    }
    frightTimer = 0;
    frightScore = 200;
    modeTimer = 0;
    globalMode = 'scatter';
    if (full) {
      invuln = 0;
    } else {
      invuln = 1.5;
    }
  }

  function resetLevel(fullScore = false) {
    buildMaze();
    if (fullScore) {
      score = 0;
      lives = 3;
      level = 1;
    }
    resetActors(true);
    updateHud();
    state = 'ready';
    showOverlay('FOXPAC', level === 1 && score === 0
      ? 'PRESS ENTER / TAP TO START'
      : `LEVEL ${level} · ENTER TO GO`);
    statusEl.textContent = 'READY';
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    levelEl.textContent = String(level);
    if (score > hiscore) {
      hiscore = score;
      hiscoreEl.textContent = String(hiscore);
      localStorage.setItem('foxpacHi', String(hiscore));
    }
  }

  function showOverlay(title, msg) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ——— Movement helpers ———
  function atTileCenter(ent, eps = 0.08) {
    return Math.abs(ent.x - ent.tx) < eps && Math.abs(ent.y - ent.ty) < eps;
  }

  function snapToTile(ent) {
    ent.x = ent.tx;
    ent.y = ent.ty;
  }

  function canEnter(tx, ty, isGhost) {
    tx = wrapTile(tx);
    if (ty < 0 || ty >= ROWS) return false;
    if (tx < 0 || tx >= COLS) return true;
    const c = grid[ty][tx];
    if (c.wall) return false;
    if (c.door && !isGhost) return false;
    return true;
  }

  function trySetDir(ent, dir, isGhost) {
    if (dir.name === 'none') return false;
    const ntx = wrapTile(ent.tx + dir.x);
    const nty = ent.ty + dir.y;
    if (!canEnter(ntx, nty, isGhost)) return false;
    // Only turn when roughly centered, or continuing same axis
    if (dir.name === ent.dir.name) return true;
    if (dir.name === OPP[ent.dir.name]) {
      ent.dir = dir;
      ent.tx = wrapTile(Math.round(ent.x));
      ent.ty = Math.round(ent.y);
      return true;
    }
    if (atTileCenter(ent, 0.2)) {
      snapToTile(ent);
      ent.dir = dir;
      return true;
    }
    return false;
  }

  function stepEntity(ent, dt, isGhost, speedMul) {
    const spd = (speedMul || ent.speed) * dt;

    // Apply buffered turn for player
    if (!isGhost && ent.nextDir && ent.nextDir.name !== 'none') {
      if (trySetDir(ent, ent.nextDir, false)) {
        // kept
      }
    }

    if (ent.dir.name === 'none') return;

    // Move toward next tile
    const targetX = ent.tx + ent.dir.x;
    const targetY = ent.ty + ent.dir.y;

    // Handle tunnel: if leaving map horizontally
    if (ent.dir.x !== 0) {
      ent.x += ent.dir.x * spd;
      // Crossing into next tile
      if ((ent.dir.x > 0 && ent.x >= ent.tx + 1) || (ent.dir.x < 0 && ent.x <= ent.tx - 1)) {
        ent.tx = wrapTile(ent.tx + ent.dir.x);
        ent.x = ent.tx === 0 && ent.dir.x > 0 ? 0 : (ent.tx === COLS - 1 && ent.dir.x < 0 ? COLS - 1 : ent.tx);
        // Actually after wrap from -1 or COLS:
        if (ent.dir.x > 0) {
          // was moving right past COLS-1
        }
        // Re-sync: after reaching next tile center boundary
        ent.x = ent.tx;
        ent.y = ent.ty;
        onArriveTile(ent, isGhost);
      } else if (ent.x < -0.5) {
        ent.tx = COLS - 1;
        ent.x = COLS - 1;
        onArriveTile(ent, isGhost);
      } else if (ent.x > COLS - 0.5) {
        ent.tx = 0;
        ent.x = 0;
        onArriveTile(ent, isGhost);
      }
    } else if (ent.dir.y !== 0) {
      ent.y += ent.dir.y * spd;
      if ((ent.dir.y > 0 && ent.y >= ent.ty + 1) || (ent.dir.y < 0 && ent.y <= ent.ty - 1)) {
        ent.ty = ent.ty + ent.dir.y;
        ent.x = ent.tx;
        ent.y = ent.ty;
        onArriveTile(ent, isGhost);
      }
    }
  }

  function onArriveTile(ent, isGhost) {
    // Decide next move for ghosts; player uses buffer
    if (!isGhost) {
      // Try buffered direction first
      if (ent.nextDir && ent.nextDir.name !== 'none' && ent.nextDir.name !== ent.dir.name) {
        const ntx = wrapTile(ent.tx + ent.nextDir.x);
        const nty = ent.ty + ent.nextDir.y;
        if (canEnter(ntx, nty, false)) {
          ent.dir = ent.nextDir;
        }
      }
      // If current dir blocked, stop
      const ntx = wrapTile(ent.tx + ent.dir.x);
      const nty = ent.ty + ent.dir.y;
      if (!canEnter(ntx, nty, false)) {
        ent.dir = DIRS.none;
      }
      eatAt(ent.tx, ent.ty);
      return;
    }

    // Ghost AI choose direction
    chooseGhostDir(ent);
  }

  function eatAt(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
    const c = grid[ty][tx];
    if (c.pellet) {
      c.pellet = false;
      pelletCount--;
      score += 10;
      updateHud();
      beep(520, 0.04, 'square', 0.04);
      if (pelletCount <= 0) levelClear();
    } else if (c.power) {
      c.power = false;
      pelletCount--;
      score += 50;
      updateHud();
      startFright();
      beep(220, 0.12, 'sawtooth', 0.08);
      if (pelletCount <= 0) levelClear();
    }
  }

  function startFright() {
    frightTimer = Math.max(6, 9 - level * 0.5);
    frightScore = 200;
    statusEl.textContent = 'POWER MODE!';
    for (const g of ghosts) {
      if (g.mode === 'eaten' || g.mode === 'house') continue;
      g.mode = 'frightened';
      // Reverse
      const rev = DIRS[OPP[g.dir.name]];
      if (rev && rev.name !== 'none') {
        const ntx = wrapTile(g.tx + rev.x);
        const nty = g.ty + rev.y;
        if (canEnter(ntx, nty, true)) g.dir = rev;
      }
    }
  }

  // ——— Ghost AI ———
  function getChaseTarget(g) {
    const px = player.tx, py = player.ty;
    if (g.personality === 'chase') return { x: px, y: py };
    if (g.personality === 'ambush') {
      return { x: px + player.dir.x * 4, y: py + player.dir.y * 4 };
    }
    if (g.personality === 'flank') {
      const blink = ghosts[0];
      const ax = px + player.dir.x * 2;
      const ay = py + player.dir.y * 2;
      return { x: ax * 2 - blink.tx, y: ay * 2 - blink.ty };
    }
    // shy: chase unless close
    const dist = Math.abs(px - g.tx) + Math.abs(py - g.ty);
    if (dist < 8) return g.scatter;
    return { x: px, y: py };
  }

  const HOUSE_DOOR = { x: 9, y: 8 };
  const HOUSE_HOME = { x: 9, y: 9 };
  const HOUSE_EXIT = { x: 9, y: 7 };

  function inGhostHouse(g) {
    const c = grid[g.ty] && grid[g.ty][g.tx];
    return !!(c && (c.house || c.door));
  }

  function respawnInHouse(g) {
    g.mode = 'house';
    g.eaten = false;
    g.leaveTimer = 1.4;
    g.tx = HOUSE_HOME.x;
    g.ty = HOUSE_HOME.y;
    g.x = HOUSE_HOME.x;
    g.y = HOUSE_HOME.y;
    g.dir = DIRS.left;
  }

  function bfsNextDir(sx, sy, gx, gy) {
    if (sx === gx && sy === gy) return DIRS.none;
    const key = (x, y) => y * COLS + x;
    const start = key(sx, sy);
    const goal = key(gx, gy);
    const prev = new Map(); // tileKey -> { x, y, dirName }
    const q = [{ x: sx, y: sy }];
    const seen = new Set([start]);
    let found = false;
    while (q.length) {
      const cur = q.shift();
      if (key(cur.x, cur.y) === goal) { found = true; break; }
      for (const d of DIR_LIST) {
        const nx = wrapTile(cur.x + d.x);
        const ny = cur.y + d.y;
        if (ny < 0 || ny >= ROWS) continue;
        if (!canEnter(nx, ny, true)) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        prev.set(k, { x: cur.x, y: cur.y, dir: d });
        q.push({ x: nx, y: ny });
      }
    }
    if (!found) return null;
    // Walk back to the step leaving start
    let cx = gx, cy = gy;
    let guard = 0;
    while (guard++ < 500) {
      const k = key(cx, cy);
      const p = prev.get(k);
      if (!p) return null;
      if (p.x === sx && p.y === sy) return p.dir;
      cx = p.x;
      cy = p.y;
    }
    return null;
  }

  function chooseGhostDir(g) {
    if (g.mode === 'house') {
      // Wait / bob inside, then climb out the door and release above it
      if (g.leaveTimer > 0) {
        if (g.tx === 8) g.dir = DIRS.right;
        else if (g.tx === 10) g.dir = DIRS.left;
        else g.dir = Math.random() < 0.5 ? DIRS.left : DIRS.right;
        return;
      }
      // Align under door, go up through door, release at exit tile
      if (g.ty > HOUSE_DOOR.y) {
        if (g.tx !== HOUSE_DOOR.x) g.dir = g.tx < HOUSE_DOOR.x ? DIRS.right : DIRS.left;
        else g.dir = DIRS.up;
        return;
      }
      if (g.ty === HOUSE_DOOR.y) {
        g.dir = DIRS.up;
        return;
      }
      // Past the door (ty <= 7) — free to roam
      g.tx = HOUSE_EXIT.x;
      g.ty = HOUSE_EXIT.y;
      g.x = HOUSE_EXIT.x;
      g.y = HOUSE_EXIT.y;
      g.dir = DIRS.left;
      g.mode = globalMode === 'frightened' ? 'scatter' : globalMode;
      return;
    }

    if (g.mode === 'eaten') {
      if (inGhostHouse(g) || (g.tx === HOUSE_DOOR.x && g.ty === HOUSE_DOOR.y)) {
        respawnInHouse(g);
        return;
      }
      // BFS next step toward door — greedy Manhattan loops in this maze
      const step = bfsNextDir(g.tx, g.ty, HOUSE_DOOR.x, HOUSE_DOOR.y);
      if (step) {
        g.dir = step;
      } else {
        // No path (shouldn't happen) — snap home
        respawnInHouse(g);
      }
      return;
    }

    let target;
    if (g.mode === 'frightened') {
      // Random
      const opts = validDirs(g, true);
      if (opts.length) g.dir = opts[Math.floor(Math.random() * opts.length)];
      return;
    }

    if (globalMode === 'scatter' || g.mode === 'scatter') {
      target = g.scatter;
    } else {
      target = getChaseTarget(g);
    }
    pickBestDir(g, target, false);
  }

  function validDirs(g, allowReverse) {
    const opts = [];
    for (const d of DIR_LIST) {
      if (!allowReverse && d.name === OPP[g.dir.name]) continue;
      const ntx = wrapTile(g.tx + d.x);
      const nty = g.ty + d.y;
      if (canEnter(ntx, nty, true)) opts.push(d);
    }
    // If no options (dead end), allow reverse
    if (!opts.length) {
      for (const d of DIR_LIST) {
        const ntx = wrapTile(g.tx + d.x);
        const nty = g.ty + d.y;
        if (canEnter(ntx, nty, true)) opts.push(d);
      }
    }
    return opts;
  }

  function pickBestDir(g, target, allowReverse) {
    const opts = validDirs(g, allowReverse);
    if (!opts.length) return;
    let best = opts[0];
    let bestDist = Infinity;
    for (const d of opts) {
      const nx = wrapTile(g.tx + d.x);
      const ny = g.ty + d.y;
      const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    g.dir = best;
  }

  // ——— Collisions ———
  function checkCollisions() {
    if (invuln > 0) return;
    for (const g of ghosts) {
      if (g.mode === 'house' || g.mode === 'eaten') continue;
      const dx = g.x - player.x;
      const dy = g.y - player.y;
      if (dx * dx + dy * dy < 0.55) {
        if (g.mode === 'frightened') {
          g.mode = 'eaten';
          g.eaten = true;
          g.eatenTimer = 0;
          g.stuckTicks = 0;
          g._lastTileKey = '';
          chooseGhostDir(g);
          score += frightScore;
          floatScores.push({
            x: g.x * TILE + TILE / 2,
            y: g.y * TILE,
            text: String(frightScore),
            life: 1.0,
          });
          frightScore *= 2;
          updateHud();
          beep(880, 0.1, 'square', 0.1);
          beep(1200, 0.12, 'square', 0.08);
          statusEl.textContent = 'ATE MALWARE!';
        } else {
          die();
          return;
        }
      }
    }
  }

  function die() {
    lives--;
    updateHud();
    state = 'dying';
    beep(160, 0.25, 'sawtooth', 0.12);
    setTimeout(() => beep(100, 0.3, 'sawtooth', 0.1), 150);
    if (lives <= 0) {
      setTimeout(() => {
        state = 'gameover';
        showOverlay('GAME OVER', 'ENTER / TAP TO RESTART');
        statusEl.textContent = 'GAME OVER';
      }, 900);
    } else {
      setTimeout(() => {
        resetActors(false);
        state = 'ready';
        showOverlay('FOXPAC', `LIVES ${lives} · ENTER TO CONTINUE`);
        statusEl.textContent = 'READY';
      }, 900);
    }
  }

  function levelClear() {
    state = 'levelclear';
    beep(660, 0.1, 'square', 0.1);
    setTimeout(() => beep(880, 0.12, 'square', 0.1), 120);
    setTimeout(() => beep(1100, 0.18, 'square', 0.1), 260);
    showOverlay('LEVEL CLEAR', `LEVEL ${level} DONE`);
    statusEl.textContent = 'LEVEL CLEAR';
    setTimeout(() => {
      level++;
      buildMaze();
      resetActors(true);
      player.speed = baseSpeed();
      updateHud();
      state = 'ready';
      showOverlay('FOXPAC', `LEVEL ${level} · ENTER TO GO`);
      statusEl.textContent = 'READY';
    }, 1800);
  }

  // ——— Audio ———
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(freq, dur, type = 'square', vol = 0.08) {
    try {
      ensureAudio();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* ignore */ }
  }

  // ——— Input ———
  function setPlayerDir(dir) {
    if (state === 'ready') startPlay();
    if (state !== 'playing') return;
    player.nextDir = dir;
    // Immediate reverse / start
    if (player.dir.name === 'none' || player.dir.name === OPP[dir.name] || atTileCenter(player, 0.25)) {
      trySetDir(player, dir, false);
    }
  }

  function startPlay() {
    if (state === 'gameover') {
      resetLevel(true);
    }
    if (state === 'ready') {
      hideOverlay();
      state = 'playing';
      statusEl.textContent = 'GO!';
      ensureAudio();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { window.location.href = '../../index.html'; return; }
    const map = {
      ArrowUp: DIRS.up, w: DIRS.up, W: DIRS.up,
      ArrowDown: DIRS.down, s: DIRS.down, S: DIRS.down,
      ArrowLeft: DIRS.left, a: DIRS.left, A: DIRS.left,
      ArrowRight: DIRS.right, d: DIRS.right, D: DIRS.right,
    };
    if (map[e.key]) {
      e.preventDefault();
      setPlayerDir(map[e.key]);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state === 'gameover') resetLevel(true);
      startPlay();
    }
  });

  document.querySelectorAll('.dpad button').forEach((btn) => {
    const dir = DIRS[btn.dataset.dir];
    const fire = (e) => { e.preventDefault(); setPlayerDir(dir); };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  });

  startBtn.addEventListener('click', () => {
    if (state === 'gameover') resetLevel(true);
    startPlay();
  });
  startBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === 'gameover') resetLevel(true);
    startPlay();
  }, { passive: false });

  overlay.addEventListener('click', () => {
    if (state === 'gameover') resetLevel(true);
    startPlay();
  });

  // Swipe on canvas
  let swipeX = 0, swipeY = 0, swiped = false;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    swipeX = t.clientX; swipeY = t.clientY; swiped = false;
    ensureAudio();
    if (state === 'ready' || state === 'gameover') {
      if (state === 'gameover') resetLevel(true);
      startPlay();
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (swiped || state !== 'playing') return;
    const t = e.touches[0];
    const dx = t.clientX - swipeX;
    const dy = t.clientY - swipeY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    swiped = true;
    if (Math.abs(dx) > Math.abs(dy)) setPlayerDir(dx > 0 ? DIRS.right : DIRS.left);
    else setPlayerDir(dy > 0 ? DIRS.down : DIRS.up);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); swiped = false; }, { passive: false });

  // ——— Drawing ———
  function drawMaze() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Walls as neon outlines
    ctx.strokeStyle = COLORS.maze;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = COLORS.mazeGlow;
    ctx.shadowBlur = 4;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (!c.wall) continue;
        const px = x * TILE;
        const py = y * TILE;
        // Draw inset rectangle edges only where neighbor is not wall
        ctx.beginPath();
        const inset = 2;
        const neighbors = [
          [0, -1, inset, inset, TILE - inset * 2, 0], // top edge
          [0, 1, inset, TILE - inset, TILE - inset * 2, 0], // bottom
          [-1, 0, inset, inset, 0, TILE - inset * 2], // left
          [1, 0, TILE - inset, inset, 0, TILE - inset * 2], // right
        ];
        // Simpler: filled block with dark center (classic double-wall look)
        ctx.fillStyle = COLORS.maze;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      }
    }
    ctx.shadowBlur = 0;

    // Door
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!grid[y][x].door) continue;
        ctx.fillStyle = '#ff9ad4';
        ctx.shadowColor = '#FF00AA';
        ctx.shadowBlur = 6;
        ctx.fillRect(x * TILE + 2, y * TILE + TILE / 2 - 1, TILE - 4, 3);
        ctx.shadowBlur = 0;
      }
    }

    // Pellets
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        if (c.pellet) {
          ctx.fillStyle = COLORS.pellet;
          ctx.fillRect(cx - 1, cy - 1, 2, 2);
        } else if (c.power) {
          const pulse = 3 + Math.sin(animT * 6) * 1.2;
          ctx.fillStyle = COLORS.power;
          ctx.shadowColor = '#fff0a0';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  function drawFox() {
    const px = player.x * TILE;
    const py = player.y * TILE;
    const facing = player.dir.name === 'none' ? 'left' : player.dir.name;
    const open = Math.floor(player.chomp * 11) % 2 === 0;
    const key = `${facing}_${open ? 'open' : 'closed'}`;
    const img = foxImgs[key];
    if (img) {
      ctx.drawImage(img, px, py, TILE, TILE);
    } else {
      // Fallback circle
      ctx.fillStyle = '#F5F5F5';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, TILE / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.fox;
      ctx.fillRect(px + 4, py + 1, 3, 4);
      ctx.fillRect(px + 9, py + 1, 3, 4);
    }
  }

  function drawGhost(g) {
    const px = g.x * TILE;
    const py = g.y * TILE;
    const bobFrame = Math.floor(g.bob * 9) % 2 === 0 ? 'a' : 'b';

    if (g.mode === 'eaten') {
      // Eyes only
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 3, py + 5, 4, 4);
      ctx.fillRect(px + 9, py + 5, 4, 4);
      ctx.fillStyle = '#2244ff';
      ctx.fillRect(px + 4, py + 6, 2, 2);
      ctx.fillRect(px + 10, py + 6, 2, 2);
      return;
    }

    let img = null;
    if (g.mode === 'frightened') {
      // Flash near end
      if (frightTimer < 2 && Math.floor(frightTimer * 6) % 2 === 0) {
        img = ghostImgs[`right_${bobFrame}`];
      } else {
        img = ghostImgs[`frightened_${bobFrame}`];
      }
      if (img) {
        ctx.drawImage(img, px, py, TILE, TILE);
        return;
      }
      // Fallback blue
      ctx.fillStyle = '#2244ff';
      ctx.fillRect(px + 1, py + 2, TILE - 2, TILE - 4);
      return;
    }

    const facing = g.dir.name === 'none' ? 'left' : g.dir.name;
    img = ghostImgs[`${facing}_${bobFrame}`];
    if (img) {
      const drawn = getTinted(img, g.tint);
      ctx.drawImage(drawn, px, py, TILE, TILE);
    } else {
      ctx.fillStyle = g.tint || COLORS.lime;
      ctx.fillRect(px + 1, py + 2, TILE - 2, TILE - 4);
    }
  }

  function drawFloats(dt) {
    for (let i = floatScores.length - 1; i >= 0; i--) {
      const f = floatScores[i];
      f.life -= dt;
      f.y -= 20 * dt;
      if (f.life <= 0) { floatScores.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#fff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawLivesIcons() {
    // tiny fox icons bottom — skip, HUD already shows lives
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    drawMaze();
    for (const g of ghosts) drawGhost(g);
    if (state !== 'dying' || Math.floor(animT * 8) % 2 === 0) {
      drawFox();
    }
    drawFloats(0);
  }

  // ——— Update ———
  function update(dt) {
    animT += dt;
    if (state !== 'playing') {
      // Still animate power pellets / bob for idle look
      for (const g of ghosts) g.bob += dt;
      return;
    }

    if (invuln > 0) invuln -= dt;

    // Mode timer scatter/chase
    modeTimer += dt;
    const scatterDur = 6;
    const chaseDur = 18;
    if (globalMode === 'scatter' && modeTimer > scatterDur) {
      globalMode = 'chase';
      modeTimer = 0;
      reverseGhosts();
    } else if (globalMode === 'chase' && modeTimer > chaseDur) {
      globalMode = 'scatter';
      modeTimer = 0;
      reverseGhosts();
    }

    // Frightened
    if (frightTimer > 0) {
      frightTimer -= dt;
      if (frightTimer <= 0) {
        frightTimer = 0;
        statusEl.textContent = 'GO!';
        for (const g of ghosts) {
          if (g.mode === 'frightened') g.mode = globalMode;
        }
      }
    }

    // Player
    if (player.dir.name !== 'none') {
      player.chomp += dt;
      player.moving = true;
    } else {
      player.moving = false;
    }
    movePlayer(dt);

    // Ghosts
    for (const g of ghosts) {
      g.bob += dt;
      if (g.mode === 'house') {
        g.leaveTimer -= dt;
        if (atTileCenter(g, 0.35) || g.dir.name === 'none') {
          chooseGhostDir(g);
        }
        moveGhost(g, dt, g.leaveTimer > 0 ? 0.45 : 0.85);
      } else if (g.mode === 'eaten') {
        g.eatenTimer = (g.eatenTimer || 0) + dt;
        const tileKey = g.tx + ',' + g.ty;
        if (tileKey === g._lastTileKey) g.stuckTicks = (g.stuckTicks || 0) + dt;
        else { g._lastTileKey = tileKey; g.stuckTicks = 0; }

        // Failsafe: too long as eyes, or parked on one tile too long
        if (g.eatenTimer > 4.5 || g.stuckTicks > 1.25) {
          respawnInHouse(g);
        } else if (inGhostHouse(g)) {
          respawnInHouse(g);
        } else {
          if (atTileCenter(g, 0.45) || g.dir.name === 'none') {
            chooseGhostDir(g);
          }
          moveGhost(g, dt, 2.4);
          if (inGhostHouse(g)) respawnInHouse(g);
        }
      } else if (g.mode === 'frightened') {
        moveGhost(g, dt, frightSpeed() / ghostSpeed());
      } else {
        g.mode = globalMode;
        moveGhost(g, dt, 1);
      }
    }

    checkCollisions();

    for (let i = floatScores.length - 1; i >= 0; i--) {
      floatScores[i].life -= dt;
      floatScores[i].y -= 20 * dt;
      if (floatScores[i].life <= 0) floatScores.splice(i, 1);
    }
  }

  function reverseGhosts() {
    for (const g of ghosts) {
      if (g.mode === 'house' || g.mode === 'eaten' || g.mode === 'frightened') continue;
      const rev = DIRS[OPP[g.dir.name]];
      if (rev) {
        const ntx = wrapTile(g.tx + rev.x);
        const nty = g.ty + rev.y;
        if (canEnter(ntx, nty, true)) g.dir = rev;
      }
    }
  }

  function movePlayer(dt) {
    const spd = player.speed * dt;

    // Try buffer when near center
    if (player.nextDir && player.nextDir.name !== player.dir.name) {
      if (atTileCenter(player, 0.2)) {
        snapToTile(player);
        const ntx = wrapTile(player.tx + player.nextDir.x);
        const nty = player.ty + player.nextDir.y;
        if (canEnter(ntx, nty, false)) {
          player.dir = player.nextDir;
        }
      } else if (player.nextDir.name === OPP[player.dir.name]) {
        player.dir = player.nextDir;
      }
    }

    if (player.dir.name === 'none') return;

    // Check if next tile blocked before moving past center
    const ntx = wrapTile(player.tx + player.dir.x);
    const nty = player.ty + player.dir.y;
    if (!canEnter(ntx, nty, false)) {
      // Approach center and stop
      const cx = player.tx;
      const cy = player.ty;
      const dx = cx - player.x;
      const dy = cy - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= spd || dist < 0.01) {
        snapToTile(player);
        player.dir = DIRS.none;
        eatAt(player.tx, player.ty);
      } else {
        player.x += Math.sign(dx) * Math.min(spd, Math.abs(dx));
        player.y += Math.sign(dy) * Math.min(spd, Math.abs(dy));
      }
      return;
    }

    player.x += player.dir.x * spd;
    player.y += player.dir.y * spd;

    // Tunnel wrap
    if (player.x < -0.05) { player.x = COLS - 0.05; player.tx = COLS - 1; }
    if (player.x >= COLS - 0.05 + 0.1) { player.x = 0; player.tx = 0; }

    // Crossed into new tile?
    const newTx = wrapTile(Math.round(player.x));
    const newTy = Math.round(player.y);
    // More precise: when we've fully entered next tile
    if (player.dir.x > 0 && player.x >= player.tx + 1) {
      player.tx = wrapTile(player.tx + 1);
      player.x = player.tx;
      player.y = player.ty;
      eatAt(player.tx, player.ty);
      applyBufferAtJunction();
    } else if (player.dir.x < 0 && player.x <= player.tx - 1) {
      player.tx = wrapTile(player.tx - 1);
      player.x = player.tx;
      player.y = player.ty;
      eatAt(player.tx, player.ty);
      applyBufferAtJunction();
    } else if (player.dir.y > 0 && player.y >= player.ty + 1) {
      player.ty += 1;
      player.x = player.tx;
      player.y = player.ty;
      eatAt(player.tx, player.ty);
      applyBufferAtJunction();
    } else if (player.dir.y < 0 && player.y <= player.ty - 1) {
      player.ty -= 1;
      player.x = player.tx;
      player.y = player.ty;
      eatAt(player.tx, player.ty);
      applyBufferAtJunction();
    } else {
      // Update tx loosely for collision
      // keep tx as current destination origin
    }
  }

  function applyBufferAtJunction() {
    if (player.nextDir && player.nextDir.name !== 'none') {
      const ntx = wrapTile(player.tx + player.nextDir.x);
      const nty = player.ty + player.nextDir.y;
      if (canEnter(ntx, nty, false)) {
        player.dir = player.nextDir;
      }
    }
    // Stop if forward blocked
    const ftx = wrapTile(player.tx + player.dir.x);
    const fty = player.ty + player.dir.y;
    if (!canEnter(ftx, fty, false)) {
      player.dir = DIRS.none;
    }
  }

  function moveGhost(g, dt, mul) {
    const spd = ghostSpeed() * mul * dt;

    if (g.dir.name === 'none') {
      chooseGhostDir(g);
      return;
    }

    const ntx = wrapTile(g.tx + g.dir.x);
    const nty = g.ty + g.dir.y;
    if (!canEnter(ntx, nty, true)) {
      snapToTile(g);
      chooseGhostDir(g);
      return;
    }

    g.x += g.dir.x * spd;
    g.y += g.dir.y * spd;

    if (g.x < -0.05) { g.x = COLS - 0.05; g.tx = COLS - 1; }
    if (g.x >= COLS + 0.05) { g.x = 0; g.tx = 0; }

    if (g.dir.x > 0 && g.x >= g.tx + 1) {
      g.tx = wrapTile(g.tx + 1);
      g.x = g.tx; g.y = g.ty;
      chooseGhostDir(g);
    } else if (g.dir.x < 0 && g.x <= g.tx - 1) {
      g.tx = wrapTile(g.tx - 1);
      g.x = g.tx; g.y = g.ty;
      chooseGhostDir(g);
    } else if (g.dir.y > 0 && g.y >= g.ty + 1) {
      g.ty += 1;
      g.x = g.tx; g.y = g.ty;
      chooseGhostDir(g);
    } else if (g.dir.y < 0 && g.y <= g.ty - 1) {
      g.ty -= 1;
      g.x = g.tx; g.y = g.ty;
      chooseGhostDir(g);
    }
  }

  // Fix drawFloats to use stored positions during render
  function renderFull() {
    ctx.imageSmoothingEnabled = false;
    drawMaze();
    for (const g of ghosts) drawGhost(g);
    if (state !== 'dying' || Math.floor(animT * 8) % 2 === 0) {
      if (!(invuln > 0 && Math.floor(animT * 10) % 2 === 0)) {
        drawFox();
      }
    }
    // floats
    for (const f of floatScores) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#39FF14';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  // ——— Loop ———
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    renderFull();
    requestAnimationFrame(frame);
  }

  // ——— Boot ———
  loadAssets().then(() => {
    resetLevel(true);
    if (assetsFailed) {
      showOverlay('FOXPAC', 'SOME SPRITES FAILED — MAZE STILL PLAYABLE');
      statusEl.textContent = 'ASSET WARN';
    }
    // Always start the loop so the dark maze paints even if sprites failed
    requestAnimationFrame(frame);
  }).catch((e) => {
    console.error(e);
    assetsFailed = true;
    assetsReady = true;
    resetLevel(true);
    showOverlay('FOXPAC', 'ASSET LOAD ERROR — PLAY WITH FALLBACKS');
    statusEl.textContent = 'ASSET ERROR';
    requestAnimationFrame(frame);
  });
})();
