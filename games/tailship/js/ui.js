(function (root) {
  const $ = (id) => document.getElementById(id);

  function setText(el, s) {
    if (!el) return;
    el.textContent = s == null ? "" : String(s);
  }

  function show(id, on) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", !on);
  }

  function skins(selected, onPick) {
    const box = $("skins");
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    root.SKIN_IDS.forEach((id) => {
      const d = document.createElement("div");
      d.className = "skin" + (id === selected ? " on" : "");
      const c = document.createElement("canvas");
      c.width = 80; c.height = 80;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, 80, 80);
      root.drawSkin(ctx, id, 40, 48, 1, 0, { scale: 1.4 });
      const n = document.createElement("div");
      n.textContent = root.SKINS[id].name;
      d.appendChild(c); d.appendChild(n);
      d.addEventListener("click", () => onPick(id));
      box.appendChild(d);
    });
  }

  function hud(h) {
    const kill = $("killBtn"), vent = $("ventBtn"), use = $("useBtn");
    if (!kill) return;
    const shade = h.role === "shade";
    kill.style.display = shade ? "inline-block" : "none";
    vent.style.display = shade ? "inline-block" : "none";
    kill.disabled = !h.killReady;
    vent.disabled = !h.ventReady;
    use.disabled = !h.useReady;
    setText(use, h.useLabel || "USE");
    setText($("roleTag"), shade ? "SHADE" : "DECKHAND");
    $("roleTag").style.color = shade ? "#ff4fa3" : "#8fd4b8";
  }

  function hostButtons(hasHost, iAmHost) {
    const lobby = $("claimHostLobby");
    const hud = $("claimHostHud");
    const start = $("btnStart");
    if (lobby) lobby.classList.toggle("hidden", !!hasHost);
    if (hud) hud.classList.toggle("hidden", !!hasHost);
    if (start) start.style.display = iAmHost ? "inline-block" : "none";
  }

  function tasks(assigned, done) {
    const el = $("taskList");
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    const title = document.createElement("div");
    title.textContent = "Activities";
    el.appendChild(title);
    assigned.forEach((id) => {
      const t = root.TAILMAP.TASKS.find((x) => x.id === id);
      const row = document.createElement("div");
      const mark = done.has ? done.has(id) : done[id];
      row.textContent = (mark ? "OK " : "o ") + (t ? t.name : id);
      row.style.opacity = mark ? 0.5 : 1;
      el.appendChild(row);
    });
  }

  function rolePop(role) {
    const el = $("rolePop");
    if (!el) return;
    el.className = "role-pop show " + (role === "shade" ? "shade" : "deck");
    setText(el, role === "shade" ? "SHADE" : "DECKHAND");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function banner(msg) {
    const el = $("banner");
    if (!el) return;
    const h = $("bannerText");
    setText(h || el, msg);
    el.classList.remove("hidden");
  }

  let meetPick = null;
  let meetSubmitted = false;
  let meetLiving = [];
  let meetOnSubmit = null;

  function nameOf(id, living) {
    if (id === "skip") return "Skip";
    const list = living || meetLiving || [];
    const p = list.find((x) => x.id === id);
    return (p && p.name) || id || "?";
  }

  function renderVoteBoard(votes, living, pendingId) {
    const board = $("voteBoard");
    if (!board) return;
    while (board.firstChild) board.removeChild(board.firstChild);
    const title = document.createElement("div");
    title.className = "vb-title";
    title.textContent = "Votes";
    board.appendChild(title);
    const people = living || meetLiving || [];
    people.forEach((p) => {
      const row = document.createElement("div");
      const target = votes && votes[p.id];
      if (target) {
        row.textContent = p.name + " → " + nameOf(target, people);
      } else if (pendingId && p.id === pendingId) {
        row.className = "vb-waiting";
        row.textContent = p.name + " → (picked, not submitted)";
      } else {
        row.className = "vb-waiting";
        row.textContent = p.name + " → …";
      }
      board.appendChild(row);
    });
  }

  function showMeet(on, why, living, handlers) {
    const el = $("meet");
    if (!el) return;
    el.classList.toggle("show", !!on);
    if (!on) {
      meetPick = null;
      meetSubmitted = false;
      meetOnSubmit = null;
      return;
    }
    handlers = handlers || {};
    meetLiving = living || [];
    meetPick = null;
    meetSubmitted = false;
    meetOnSubmit = handlers.onSubmit || null;
    setText($("meetWhy"), why || "Meeting");
    const box = $("votes");
    while (box.firstChild) box.removeChild(box.firstChild);
    function select(id, btn) {
      if (meetSubmitted) return;
      meetPick = id;
      [...box.querySelectorAll(".vote")].forEach((c) => c.classList.remove("on"));
      if (btn) btn.classList.add("on");
      const sub = $("btnSubmitVote");
      if (sub) sub.disabled = false;
      if (handlers.onPick) handlers.onPick(id);
      renderVoteBoard(handlers.votes || Object.create(null), meetLiving, handlers.myId || "you");
    }
    living.forEach((p) => {
      const b = document.createElement("button");
      b.className = "vote";
      b.type = "button";
      b.textContent = p.name;
      b.addEventListener("click", () => select(p.id, b));
      box.appendChild(b);
    });
    const skip = document.createElement("button");
    skip.className = "vote";
    skip.type = "button";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => select("skip", skip));
    box.appendChild(skip);
    const sub = $("btnSubmitVote");
    if (sub) {
      sub.disabled = true;
      sub.classList.remove("locked");
      setText(sub, "Submit vote");
      sub.onclick = () => {
        if (meetSubmitted || !meetPick || !meetOnSubmit) return;
        meetSubmitted = true;
        sub.disabled = true;
        sub.classList.add("locked");
        setText(sub, "VOTE LOCKED");
        [...box.querySelectorAll(".vote")].forEach((c) => { c.disabled = true; });
        meetOnSubmit(meetPick);
        if (root.FX) root.FX.voteLocked();
      };
    }
    const log = $("chatlog");
    while (log && log.firstChild) log.removeChild(log.firstChild);
    renderVoteBoard(handlers.votes || Object.create(null), meetLiving, null);
  }

  function chatLine(name, text) {
    const log = $("chatlog");
    if (!log) return;
    const row = document.createElement("div");
    const a = document.createElement("strong");
    a.textContent = name + ": ";
    const b = document.createElement("span");
    b.textContent = text;
    row.appendChild(a); row.appendChild(b);
    log.appendChild(row);
    while (log.childNodes.length > 40) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  function hideMenu(on) {
    show("menu", !on);
  }

  root.UI = { $, setText, show, skins, hud, hostButtons, tasks, rolePop, banner, showMeet, renderVoteBoard, chatLine, hideMenu };
})(typeof window !== "undefined" ? window : globalThis);
