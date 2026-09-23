(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  function fitCanvas() {
    const w = Math.max(640, stage.clientWidth | 0);
    const h = Math.max(360, stage.clientHeight | 0);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  document.addEventListener("fullscreenchange", fitCanvas);
  TASKUI.mount(document.getElementById("taskOverlay"));

  let skin = "neon";
  let mode = "menu";
  let practice = null;
  let netState = null;
  let myId = null;
  let iAmHost = false;
  let keys = Object.create(null);
  let running = false;
  let menuRunning = true;
  let prevBodies = 0;
  let prevPhase = null;

  function dismissSplash() {
    const splash = document.getElementById("splash");
    if (!splash || splash.classList.contains("out")) return;
    splash.classList.add("out");
    setTimeout(() => splash.classList.add("hidden"), 480);
  }
  setTimeout(dismissSplash, 2200);
  ["click", "keydown", "touchstart"].forEach((ev) => {
    document.addEventListener(ev, dismissSplash, { passive: true });
  });

  function maybeArcadeBack() {
    if (!/\/games\/tailship\/?/.test(location.pathname || "")) return;
    const header = document.querySelector("header.bar");
    if (!header || document.getElementById("arcadeBack")) return;
    const a = document.createElement("a");
    a.id = "arcadeBack";
    a.className = "arcade-back";
    a.href = "../../index.html";
    a.textContent = "◀ Arcade";
    header.insertBefore(a, header.firstChild);
  }
  maybeArcadeBack();

  function menuLoop(now) {
    if (!menuRunning) return;
    fitCanvas();
    if (typeof renderMenuBackdrop === "function") renderMenuBackdrop(ctx, now);
    requestAnimationFrame(menuLoop);
  }
  requestAnimationFrame(menuLoop);

  function nameVal() {
    return PROTO.sanitizeName(document.getElementById("nameIn").value) || "Pilot";
  }

  function redrawSkins() {
    UI.skins(skin, (id) => {
      skin = id;
      window.selectedSkin = id;
      redrawSkins();
    });
  }

  window.selectedSkin = skin;
  window.playerName = "Pilot";
  redrawSkins();

  document.getElementById("nameIn").addEventListener("input", (e) => {
    window.playerName = PROTO.sanitizeName(e.target.value) || "";
  });

  function camFor(me) {
    if (!me) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(TAILMAP.WORLD.w - canvas.width, me.x - canvas.width / 2)),
      y: Math.max(0, Math.min(TAILMAP.WORLD.h - canvas.height, me.y - canvas.height / 2))
    };
  }

  function loop(now) {
    if (!running) return;
    fitCanvas();
    requestAnimationFrame(loop);
    let state;
    if (mode === "practice" && practice) {
      state = practice.step(now);
    } else if (mode === "net" && netState) {
      const me = (netState.players || []).find((p) => p.id === myId);
      if (me && !TASKUI.isOpen() && netState.phase === "playing") {
        let dx = 0, dy = 0;
        if (keys.w || keys.W || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.S || keys.ArrowDown) dy += 1;
        if (keys.a || keys.A || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.D || keys.ArrowRight) dx += 1;
        if (dx || dy) Net.move(dx, dy);
      }
      state = {
        me: (netState.players || []).find((p) => p.id === myId),
        players: netState.players || [],
        bodies: netState.bodies || [],
        lights: netState.lights !== false
      };
      if (state.me) {
        const nbot = (netState.players || []).find((p) => p.id !== myId && p.alive && Math.hypot(p.x - state.me.x, p.y - state.me.y) < 46);
        const nv = TAILMAP.nearVent(state.me.x, state.me.y);
        const nbody = (netState.bodies || []).find((b) => Math.hypot(b.x - state.me.x, b.y - state.me.y) < 42);
        const nbell = TAILMAP.nearBell(state.me.x, state.me.y);
        const assigned = state.me.tasks || [];
        const done = new Set(state.me.done || []);
        const ntask = TAILMAP.TASKS.find((t) => assigned.includes(t.id) && !done.has(t.id) && TAILMAP.nearTask(state.me.x, state.me.y, t));
        UI.hud({
          role: state.me.role,
          killReady: state.me.role === "shade" && state.me.killReady && !!nbot && !state.me.inVent,
          ventReady: state.me.role === "shade" && (!!nv || state.me.inVent),
          useLabel: state.me.inVent ? "EXIT" : nbody ? "REPORT" : nbell ? "BELL" : ntask ? "TASK" : "USE",
          useReady: !!(state.me.inVent || nbody || nbell || ntask || (nv && state.me.role === "shade"))
        });
      }
    } else return;
    const me = state.me;
    renderWorld(ctx, camFor(me), state, now);
  }

  function startLoop() {
    if (running) return;
    menuRunning = false;
    running = true;
    const stage = document.getElementById("stage");
    if (stage) stage.classList.add("playing");
    requestAnimationFrame(loop);
  }

  function goPractice(role) {
    window.playerName = nameVal();
    window.selectedSkin = skin;
    dismissSplash();
    UI.hideMenu(true);
    document.getElementById("hud").style.display = "flex";
    UI.hostButtons(true, false);
    practice = Practice.start(role);
    mode = "practice";
    startLoop();
  }

  document.getElementById("btnPracticeShade").addEventListener("click", () => goPractice("shade"));
  document.getElementById("btnPracticeDeck").addEventListener("click", () => goPractice("deck"));

  document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (mode === "practice" && practice) practice.onKey(e, true);
    if (mode === "net") {
      if (e.key === "e" || e.key === "E") netUse();
      if (e.key === "q" || e.key === "Q") Net.kill();
      if (e.key === "v" || e.key === "V") Net.vent("");
    }
  });
  document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
    if (mode === "practice" && practice) practice.onKey(e, false);
  });

  function netUse() {
    const me = netState && (netState.players || []).find((p) => p.id === myId);
    if (!me) { Net.use(); return; }
    const assigned = me.tasks || [];
    const done = new Set(me.done || []);
    const ntask = TAILMAP.TASKS.find((t) => assigned.includes(t.id) && !done.has(t.id) && TAILMAP.nearTask(me.x, me.y, t));
    if (ntask) Net.taskStart(ntask.id);
    else Net.use();
  }

  document.getElementById("useBtn").addEventListener("click", () => {
    if (practice) practice.tryUse();
    else netUse();
  });
  document.getElementById("killBtn").addEventListener("click", () => {
    if (practice) practice.tryKill();
    else Net.kill();
  });
  document.getElementById("ventBtn").addEventListener("click", () => {
    if (practice) {
      const ev = { key: "v" };
      practice.onKey(ev, true);
    } else Net.vent("");
  });

  document.getElementById("chatSend").addEventListener("click", () => {
    const inp = document.getElementById("chatIn");
    const t = PROTO.sanitizeChat(inp.value);
    if (!t) return;
    if (mode === "net") Net.chat(t);
    else UI.chatLine(window.playerName || "You", t);
    inp.value = "";
  });

  window.onTaskDone = (id, token) => {
    if (mode === "net") {
      Net.taskDone(id, token);
      const me = netState && (netState.players || []).find((p) => p.id === myId);
      if (window.FX) {
        if (me && me.role === "shade") FX.pop("LOOKS BUSY", { tone: "mint" });
        else FX.taskClear();
      }
    }
  };

  async function bindNet() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = proto + "//" + location.host + "/ws";
    Net.on("hello", (m) => { myId = m.id; });
    Net.on("hosted", (m) => {
      if (m.id) myId = m.id;
      iAmHost = true;
      if (m.code) UI.setText(document.getElementById("roomCode"), m.code);
      UI.hostButtons(true, true);
    });
    Net.on("task_open", (m) => {
      const spec = TAILMAP.TASKS.find((x) => x.id === m.id);
      if (spec && !TASKUI.isOpen()) TASKUI.open(spec, m.token);
    });
    await Net.connect(url);
    Net.on("state", (m) => {
      netState = m;
      const bodies = (m.bodies || []).length;
      if (bodies > prevBodies) {
        if (window.FX) FX.kill();
      }
      prevBodies = bodies;
      if (prevPhase === "playing" && m.phase === "meeting") {
        const why = String(m.meetWhy || "").toLowerCase();
        if (window.FX) {
          if (why.includes("bell") || why.includes("emergency")) FX.emergency();
          else FX.reported();
        }
      }
      if (prevPhase !== "playing" && m.phase === "playing" && window.FX) FX.reset();
      prevPhase = m.phase;
      if (m.phase === "meeting") {
        const living = (m.players || []).filter((p) => p.alive).map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
        if (!document.getElementById("meet").classList.contains("show")) {
          UI.showMeet(true, m.meetWhy || "Meeting", living, {
            votes: m.votes || {},
            myId: myId,
            onPick: () => UI.renderVoteBoard(m.votes || {}, living, myId),
            onSubmit: (id) => Net.vote(id)
          });
        } else {
          UI.renderVoteBoard(m.votes || {}, living, null);
        }
      }
      if (m.phase === "playing") UI.showMeet(false);
      if (m.phase === "playing" || m.phase === "meeting" || m.phase === "ended") {
        document.getElementById("lobby").classList.add("hidden");
        document.getElementById("hud").style.display = "flex";
      }
      if (m.phase === "ended") UI.banner(m.winner || "Game over");
      const me = (m.players || []).find((p) => p.id === myId);
      if (me && me.tasks) UI.tasks(me.tasks, new Set(me.done || []));
      if (!m.hasHost) iAmHost = false;
      UI.hostButtons(!!m.hasHost, iAmHost);
    });
    Net.on("chat", (m) => UI.chatLine(m.name, m.text));
    Net.on("role", (m) => UI.rolePop(m.role));
    Net.on("error", (m) => UI.banner(m.message || "error"));
  }

  document.getElementById("btnHost").addEventListener("click", async () => {
    try {
      await bindNet();
    } catch (err) {
      UI.banner("Start the local host first: python3 server.py");
      return;
    }
    Net.host(nameVal(), skin);
    UI.hideMenu(true);
    document.getElementById("lobby").classList.remove("hidden");
    mode = "net";
    startLoop();
  });

  document.getElementById("btnJoin").addEventListener("click", async () => {
    const code = PROTO.sanitizeCode(document.getElementById("codeIn").value);
    if (!code) { UI.banner("Need a 4-letter room code"); return; }
    try { await bindNet(); }
    catch (err) { UI.banner("Start the local host first: python3 server.py"); return; }
    Net.join(code, nameVal(), skin);
    iAmHost = false;
    UI.hostButtons(true, false);
    UI.hideMenu(true);
    document.getElementById("lobby").classList.remove("hidden");
    mode = "net";
    startLoop();
  });


  function claimHost() {
    Net.host(nameVal(), skin);
  }
  const chLobby = document.getElementById("claimHostLobby");
  const chHud = document.getElementById("claimHostHud");
  if (chLobby) chLobby.addEventListener("click", claimHost);
  if (chHud) chHud.addEventListener("click", claimHost);

  document.getElementById("btnStart").addEventListener("click", () => Net.start());

  Net.on && null;
})();
