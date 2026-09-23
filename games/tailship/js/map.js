/* Tailship map — original layout. Twilight kitsune/neko ship. */
(function (root) {
  const ROOMS = [
    { id: "tea", name: "Tea Deck", x: 40, y: 40, w: 420, h: 300, floor: "#3a2a22", accent: "#e8b86a" },
    { id: "bridge", name: "Bridge", x: 490, y: 40, w: 300, h: 220, floor: "#243044", accent: "#7ec8e3" },
    { id: "obs", name: "Observatory", x: 820, y: 40, w: 320, h: 220, floor: "#1c2438", accent: "#f0d36b" },
    { id: "shrine", name: "Inari Shrine", x: 1170, y: 40, w: 400, h: 320, floor: "#3b221c", accent: "#e05a4f" },
    { id: "lounge", name: "Neko Lounge", x: 40, y: 370, w: 360, h: 300, floor: "#2d2438", accent: "#f2a7c3" },
    { id: "clinic", name: "Tail Clinic", x: 430, y: 370, w: 300, h: 300, floor: "#24332d", accent: "#8fd4b8" },
    { id: "engine", name: "Kitsune Core", x: 760, y: 290, w: 360, h: 380, floor: "#3a1e18", accent: "#ff7a3d" },
    { id: "wires", name: "Spirit Wires", x: 40, y: 700, w: 360, h: 280, floor: "#1e2430", accent: "#c9a6ff" },
    { id: "cargo", name: "Cargo Hold", x: 430, y: 700, w: 380, h: 280, floor: "#2a261e", accent: "#c4a574" },
    { id: "garden", name: "Foxfire Bay", x: 1170, y: 390, w: 400, h: 300, floor: "#1e2e24", accent: "#86e07a" },
    { id: "dock", name: "Starboard Dock", x: 850, y: 700, w: 500, h: 280, floor: "#1a2430", accent: "#7ec8e3" }
  ];

  const WORLD = { w: 1620, h: 1040 };

  // Door corridors as walkable rects
  const HALLS = [
    { x: 430, y: 148, w: 90, h: 56 },
    { x: 760, y: 118, w: 90, h: 56 },
    { x: 1110, y: 138, w: 90, h: 56 },
    { x: 170, y: 310, w: 56, h: 90 },
    { x: 500, y: 230, w: 56, h: 170 },
    { x: 700, y: 420, w: 90, h: 56 },
    { x: 1090, y: 420, w: 110, h: 56 },
    { x: 170, y: 640, w: 56, h: 90 },
    { x: 550, y: 640, w: 56, h: 90 },
    { x: 880, y: 640, w: 90, h: 90 },
    { x: 790, y: 800, w: 80, h: 56 },
    { x: 960, y: 640, w: 70, h: 90 },
    { x: 1100, y: 640, w: 80, h: 90 },
    { x: 830, y: 230, w: 56, h: 90 }
  ];

  const BELL = { x: 250, y: 160, r: 28, room: "tea" };

  const TASKS = [
    { id: "lanterns", name: "Align lanterns", room: "shrine", x: 1370, y: 180, kind: "lanterns" },
    { id: "cables", name: "Patch spirit cables", room: "lounge", x: 180, y: 500, kind: "cables" },
    { id: "fuel", name: "Feed the core", room: "engine", x: 940, y: 470, kind: "fuel" },
    { id: "breakers", name: "Reset breakers", room: "wires", x: 200, y: 840, kind: "breakers" },
    { id: "scan", name: "Tail scan", room: "clinic", x: 580, y: 520, kind: "scan" },
    { id: "cargo", name: "Stow offering crates", room: "cargo", x: 620, y: 840, kind: "breakers" },
    { id: "stars", name: "Calibrate orb array", room: "obs", x: 980, y: 140, kind: "lanterns" },
    { id: "garden", name: "Trim foxfire", room: "garden", x: 1370, y: 540, kind: "fuel" },
    { id: "dock", name: "Seal the hatch", room: "dock", x: 1080, y: 840, kind: "breakers" }
  ];

  const VENTS = [
    { id: "v1", x: 100, y: 100, links: ["v2", "v5"] },
    { id: "v2", x: 1480, y: 100, links: ["v1", "v3"] },
    { id: "v3", x: 940, y: 600, links: ["v2", "v4"] },
    { id: "v4", x: 100, y: 900, links: ["v3", "v5"] },
    { id: "v5", x: 700, y: 840, links: ["v1", "v4", "v6"] },
    { id: "v6", x: 1480, y: 620, links: ["v5", "v3"] }
  ];

  const SPOTS = [
    { x: 180, y: 200 }, { x: 320, y: 220 }, { x: 200, y: 280 },
    { x: 600, y: 130 }, { x: 980, y: 160 }, { x: 1280, y: 220 },
    { x: 160, y: 520 }, { x: 560, y: 500 }, { x: 900, y: 420 },
    { x: 200, y: 820 }, { x: 640, y: 820 }, { x: 1360, y: 520 }
  ];

  function inRect(x, y, r, pad) {
    pad = pad || 0;
    return x >= r.x + pad && y >= r.y + pad && x <= r.x + r.w - pad && y <= r.y + r.h - pad;
  }

  function walkable(x, y) {
    for (const r of ROOMS) if (inRect(x, y, r, 6)) return true;
    for (const r of HALLS) if (inRect(x, y, r, 0)) return true;
    return false;
  }

  function roomAt(x, y) {
    for (const r of ROOMS) if (inRect(x, y, r, 0)) return r;
    return null;
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.hypot(dx, dy);
  }

  function nearBell(x, y) { return dist(x, y, BELL.x, BELL.y) < 46; }
  function nearTask(x, y, t) { return dist(x, y, t.x, t.y) < 42; }
  function nearVent(x, y) {
    for (const v of VENTS) if (dist(x, y, v.x, v.y) < 36) return v;
    return null;
  }

  root.TAILMAP = { ROOMS, HALLS, WORLD, BELL, TASKS, VENTS, SPOTS, walkable, roomAt, dist, nearBell, nearTask, nearVent, inRect };
})(typeof window !== "undefined" ? window : globalThis);
