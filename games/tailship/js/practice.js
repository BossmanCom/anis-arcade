(function (root) {
  const M = () => root.TAILMAP;
  const SPEED = 2.6;
  const BOT_SPEED = 1.55;
  const KILL_CD = 8000;
  const KILL_R = 46;

  function roomCenters() {
    return M().ROOMS.map((r) => ({
      id: r.id,
      x: r.x + r.w / 2,
      y: r.y + r.h / 2
    }));
  }

  function steerToward(b, tx, ty, speed) {
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 8) {
      b.vx = 0; b.vy = 0; b.moving = false;
      return true;
    }
    let nx = b.x + (dx / d) * speed;
    let ny = b.y + (dy / d) * speed;
    if (M().walkable(nx, b.y)) b.x = nx;
    if (M().walkable(b.x, ny)) b.y = ny;
    // if stuck, nudge toward a random hall/room
    if (!M().walkable(nx, b.y) && !M().walkable(b.x, ny)) {
      const c = roomCenters()[Math.floor(Math.random() * roomCenters().length)];
      b.target = { x: c.x, y: c.y, kind: "wander" };
    }
    b.facing = dx < 0 ? -1 : 1;
    b.moving = true;
    return false;
  }

  function pickWander(b) {
    const c = roomCenters()[Math.floor(Math.random() * roomCenters().length)];
    b.target = { x: c.x, y: c.y, kind: "wander" };
  }

  function start(role) {
    const spots = M().SPOTS;
    const meSkin = root.selectedSkin || "neon";
    const pool = ["shiro","midori","tora","shika","kuro","aoi","kin"].filter((s) => s !== meSkin);
    const me = {
      id: "you", name: root.playerName || "You", skin: meSkin,
      x: spots[0].x, y: spots[0].y, facing: 1, alive: true,
      role: role || "shade", inVent: false, moving: false, killAt: 0, ventId: null
    };
    const bots = [];
    const nBots = 4;
    for (let i = 0; i < nBots; i++) {
      const skin = pool[i % pool.length];
      const isShade = me.role === "deck" && i === 0;
      bots.push({
        id: "b" + i,
        name: (root.SKINS[skin] && root.SKINS[skin].name) || skin,
        skin,
        x: spots[i + 1].x,
        y: spots[i + 1].y,
        facing: 1,
        alive: true,
        role: isShade ? "shade" : "deck",
        inVent: false,
        moving: false,
        vx: 0, vy: 0,
        body: false,
        killAt: 0,
        taskId: null,
        taskProg: 0,
        target: null,
        suspicion: Object.create(null)
      });
    }

    // ship-wide crew tasks (player + deck bots share progress when player is deck)
    const assigned = M().TASKS.slice(0, 5).map((t) => t.id);
    const done = new Set();
    const botTaskBook = Object.create(null);
    bots.forEach((b, i) => {
      if (b.role !== "deck") return;
      const picks = M().TASKS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      botTaskBook[b.id] = picks.map((t) => t.id);
    });

    const bodies = [];
    let meeting = null;
    let ended = null;
    let keys = Object.create(null);
    let botReportCooldown = 0;

    const tasksLeft = () => assigned.filter((id) => !done.has(id));

    function livingPlayers() {
      return [me, ...bots].filter((p) => p.alive);
    }

    function nearestEnemyFor(shade) {
      let best = null, bd = 1e9;
      for (const p of livingPlayers()) {
        if (p.id === shade.id || p.role === "shade") continue;
        const d = Math.hypot(p.x - shade.x, p.y - shade.y);
        if (d < bd) { bd = d; best = p; }
      }
      return { target: best, dist: bd };
    }

    function killPlayer(killer, victim, now) {
      if (!victim || !victim.alive) return;
      victim.alive = false;
      victim.body = true;
      victim.moving = false;
      bodies.push({ x: victim.x, y: victim.y, skin: victim.skin, name: victim.name, id: victim.id });
      killer.killAt = now + KILL_CD;
      if (root.FX) {
        if (victim.id === "you") root.FX.struck();
        else root.FX.kill();
      }
      checkWin();
    }

    function assignDeckTarget(b) {
      const book = botTaskBook[b.id] || [];
      const next = book.find((id) => !done.has(id));
      if (next) {
        const t = M().TASKS.find((x) => x.id === next);
        if (t) {
          b.target = { x: t.x, y: t.y, kind: "task", taskId: t.id };
          return;
        }
      }
      pickWander(b);
    }

    function assignShadeTarget(b, now) {
      const hunt = nearestEnemyFor(b);
      if (hunt.target && hunt.dist < 520) {
        b.target = { x: hunt.target.x, y: hunt.target.y, kind: "hunt", prey: hunt.target.id };
        return;
      }
      // lurk near a task / room
      const t = M().TASKS[Math.floor(Math.random() * M().TASKS.length)];
      b.target = { x: t.x, y: t.y, kind: "lurk" };
    }

    function tickBots(now) {
      // bots notice bodies
      if (now > botReportCooldown) {
        for (const b of bots) {
          if (!b.alive || b.role === "shade") continue;
          const body = bodies.find((bd) => Math.hypot(bd.x - b.x, bd.y - b.y) < 70);
          if (body) {
            botReportCooldown = now + 20000;
            openMeet("Body reported by " + b.name);
            return;
          }
        }
      }

      for (const b of bots) {
        if (!b.alive) continue;
        if (!b.target || Math.random() < 0.004) {
          if (b.role === "shade") assignShadeTarget(b, now);
          else assignDeckTarget(b);
        }
        if (b.target && b.target.kind === "hunt") {
          const prey = livingPlayers().find((p) => p.id === b.target.prey);
          if (prey) { b.target.x = prey.x; b.target.y = prey.y; }
          else assignShadeTarget(b, now);
        }
        if (!b.target) continue;
        const arrived = steerToward(b, b.target.x, b.target.y, BOT_SPEED);

        if (b.role === "shade" && now >= b.killAt && !b.inVent) {
          const hunt = nearestEnemyFor(b);
          if (hunt.target && hunt.dist < KILL_R) {
            if (hunt.target.id === "you") {
              killPlayer(b, me, now);
            } else {
              killPlayer(b, hunt.target, now);
            }
            assignShadeTarget(b, now);
            continue;
          }
        }

        if (arrived && b.role === "deck" && b.target.kind === "task") {
          b.taskProg = (b.taskProg || 0) + 1 / 60;
          if (b.taskProg > 2.2) {
            const tid = b.target.taskId;
            if (tid && !done.has(tid) && assigned.includes(tid)) {
              done.add(tid);
              root.UI.tasks(assigned, done);
              if (root.FX) root.FX.crewTask();
              checkWin();
            }
            // also mark bot personal book
            b.taskProg = 0;
            assignDeckTarget(b);
          }
        } else if (arrived && b.target.kind !== "task") {
          if (b.role === "shade") assignShadeTarget(b, now);
          else pickWander(b);
        }
      }
    }

    function nearestBot() {
      let best = null, bd = 1e9;
      for (const b of bots) {
        if (!b.alive) continue;
        if (me.role === "shade" && b.role === "shade") continue;
        const d = Math.hypot(b.x - me.x, b.y - me.y);
        if (d < bd) { bd = d; best = b; }
      }
      return bd < KILL_R ? best : null;
    }

    function tryUse() {
      if (meeting) return;
      if (me.inVent) {
        me.inVent = false;
        me.ventId = null;
        return;
      }
      const v = M().nearVent(me.x, me.y);
      if (v && me.role === "shade") {
        me.inVent = true;
        me.ventId = v.id;
        return;
      }
      const body = bodies.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 42);
      if (body && me.alive) { openMeet("Body reported"); return; }
      if (M().nearBell(me.x, me.y) && me.alive) { openMeet("Emergency bell"); return; }
      const t = M().TASKS.find((t) => !done.has(t.id) && assigned.includes(t.id) && M().nearTask(me.x, me.y, t));
      if (t && !TASKUI.isOpen() && me.role === "deck") TASKUI.open(t);
      // shade can fake-stand on tasks visually — open UI optional
      else if (t && !TASKUI.isOpen() && me.role === "shade") TASKUI.open(t);
    }

    function tryKill(now) {
      if (me.role !== "shade" || !me.alive || me.inVent || meeting) return;
      if (now < me.killAt) return;
      const v = nearestBot();
      if (!v) return;
      killPlayer(me, v, now);
    }

    function tryVentHop(dir) {
      if (!me.inVent) return;
      const v = M().VENTS.find((x) => x.id === me.ventId);
      if (!v || !v.links.length) return;
      const nextId = v.links[dir < 0 ? 0 : v.links.length - 1] || v.links[0];
      const n = M().VENTS.find((x) => x.id === nextId);
      if (!n) return;
      me.ventId = n.id;
      me.x = n.x; me.y = n.y;
    }

    function botPick(p) {
      if (p.role === "shade") {
        const decks = livingPlayers().filter((x) => x.role === "deck" && x.id !== p.id);
        return decks.length ? decks[Math.floor(Math.random() * decks.length)].id : "skip";
      }
      const others = livingPlayers().filter((x) => x.id !== p.id);
      let pick = others[Math.floor(Math.random() * others.length)];
      if (me.role === "shade" && Math.random() < 0.35) pick = me;
      return pick ? pick.id : "skip";
    }

    function refreshVoteBoard() {
      if (!meeting) return;
      const living = livingPlayers().map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
      root.UI.renderVoteBoard(meeting.votes, living, meeting.pendingYou ? "you" : null);
    }

    function tryEarlyResolve() {
      if (!meeting || meeting.resolved) return;
      const living = livingPlayers();
      if (living.every((p) => meeting.votes[p.id])) resolveMeet();
    }

    function openMeet(why) {
      if (meeting || ended) return;
      if (root.FX) {
        const w = String(why || "").toLowerCase();
        if (w.includes("bell") || w.includes("emergency")) root.FX.emergency();
        else root.FX.reported();
      }
      meeting = {
        why, t: 22, votes: Object.create(null), resolved: false,
        pendingYou: null, botDelay: Object.create(null)
      };
      // stagger bot submits so the open ballot fills in over a few seconds
      livingPlayers().forEach((p) => {
        if (p.id === "you") return;
        meeting.botDelay[p.id] = 0.6 + Math.random() * 4.5;
      });
      root.UI.showMeet(true, why, livingPlayers().map((p) => ({ id: p.id, name: p.name, skin: p.skin })), {
        votes: meeting.votes,
        onPick: (id) => {
          meeting.pendingYou = id;
          refreshVoteBoard();
        },
        onSubmit: (id) => {
          meeting.votes.you = id;
          meeting.pendingYou = null;
          refreshVoteBoard();
          tryEarlyResolve();
        }
      });
    }

    function resolveMeet() {
      if (!meeting || meeting.resolved) return;
      meeting.resolved = true;
      const counts = Object.create(null);
      Object.keys(meeting.votes).forEach((k) => {
        const v = meeting.votes[k] || "skip";
        counts[v] = (counts[v] || 0) + 1;
      });
      let best = "skip", bestN = 0;
      Object.keys(counts).forEach((k) => {
        if (counts[k] > bestN) { bestN = counts[k]; best = k; }
      });
      const tied = Object.keys(counts).filter((k) => counts[k] === bestN);
      if (tied.length === 1 && best !== "skip") {
        if (best === "you") {
          me.alive = false;
        } else {
          const b = bots.find((x) => x.id === best);
          if (b) b.alive = false;
        }
      }
      bodies.length = 0;
      root.UI.showMeet(false);
      meeting = null;
      checkWin();
    }

    function checkWin() {
      if (ended) return;
      const liveShade = [me, ...bots].filter((p) => p.alive && p.role === "shade").length;
      const liveDeck = [me, ...bots].filter((p) => p.alive && p.role === "deck").length;
      if (liveShade === 0) ended = "Deckhands win — every Shade is gone.";
      else if (liveShade >= liveDeck) ended = "Shade wins — the deck is empty.";
      else if (tasksLeft().length === 0) ended = "Deckhands win — activities done.";
      if (ended) root.UI.banner(ended);
    }

    root.onTaskDone = (id) => {
      // shade faking a task does not count
      if (me.role === "shade") {
        if (root.FX) root.FX.pop("LOOKS BUSY", { tone: "mint" });
        return;
      }
      done.add(id);
      root.UI.tasks(assigned, done);
      if (root.FX) root.FX.taskClear();
      checkWin();
    };

    function snapshot() {
      const plist = [me, ...bots].map((p) => ({
        id: p.id, name: p.name, skin: p.skin, x: p.x, y: p.y,
        facing: p.facing, alive: p.alive, inVent: p.inVent, moving: p.moving,
        role: p.id === "you" ? p.role : undefined, body: p.body
      }));
      return { me, players: plist, bodies, lights: true };
    }

    function onKey(e, down) {
      keys[e.key] = down;
      if (!down) return;
      if (e.key === "e" || e.key === "E") tryUse();
      if (e.key === "q" || e.key === "Q") tryKill(performance.now());
      if (e.key === "v" || e.key === "V") {
        if (me.inVent) { me.inVent = false; me.ventId = null; }
        else if (me.role === "shade" && M().nearVent(me.x, me.y)) {
          const v = M().nearVent(me.x, me.y);
          me.inVent = true; me.ventId = v.id;
        }
      }
      if (me.inVent && (e.key === "a" || e.key === "ArrowLeft")) tryVentHop(-1);
      if (me.inVent && (e.key === "d" || e.key === "ArrowRight")) tryVentHop(1);
    }

    function step(now) {
      if (ended) return snapshot();
      if (!meeting && !TASKUI.isOpen() && me.alive && !me.inVent) {
        let dx = 0, dy = 0;
        if (keys.w || keys.W || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.S || keys.ArrowDown) dy += 1;
        if (keys.a || keys.A || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.D || keys.ArrowRight) dx += 1;
        if (dx || dy) {
          const l = Math.hypot(dx, dy) || 1;
          const nx = me.x + (dx / l) * SPEED;
          const ny = me.y + (dy / l) * SPEED;
          if (M().walkable(nx, me.y)) me.x = nx;
          if (M().walkable(me.x, ny)) me.y = ny;
          me.facing = dx < 0 ? -1 : dx > 0 ? 1 : me.facing;
          me.moving = true;
        } else me.moving = false;
      } else if (!me.alive) me.moving = false;

      if (!meeting) tickBots(now);
      if (meeting) {
        meeting.t -= 1 / 60;
        Object.keys(meeting.botDelay || {}).forEach((id) => {
          if (meeting.votes[id]) return;
          meeting.botDelay[id] -= 1 / 60;
          if (meeting.botDelay[id] <= 0) {
            const bot = bots.find((b) => b.id === id);
            if (bot && bot.alive) meeting.votes[id] = botPick(bot);
            refreshVoteBoard();
            tryEarlyResolve();
          }
        });
        if (meeting.t <= 0) resolveMeet();
        else if (Math.floor(meeting.t * 10) % 5 === 0) refreshVoteBoard();
      }

      const nbot = nearestBot();
      const nv = M().nearVent(me.x, me.y);
      const nbody = bodies.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 42);
      const nbell = M().nearBell(me.x, me.y);
      const ntask = M().TASKS.find((t) => assigned.includes(t.id) && !done.has(t.id) && M().nearTask(me.x, me.y, t));
      root.UI.hud({
        role: me.role,
        killReady: me.role === "shade" && me.alive && now >= me.killAt && !!nbot && !me.inVent,
        ventReady: me.role === "shade" && me.alive && (!!nv || me.inVent),
        useLabel: me.inVent ? "EXIT" : nbody ? "REPORT" : nbell ? "BELL" : ntask ? "TASK" : nv && me.role === "shade" ? "VENT" : "USE",
        useReady: !!(me.alive && (me.inVent || nbody || nbell || ntask || (nv && me.role === "shade"))),
        killCd: Math.max(0, me.killAt - now)
      });
      return snapshot();
    }

    if (root.FX) root.FX.reset();
    root.UI.tasks(assigned, done);
    root.UI.rolePop(me.role);
    return { onKey, step, snapshot, tryUse, tryKill: () => tryKill(performance.now()), me };
  }

  root.Practice = { start };
})(typeof window !== "undefined" ? window : globalThis);
