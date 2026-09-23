(function (root) {
  let active = null;
  let token = null;
  let rootEl = null;

  function mount(el) { rootEl = el; }

  function close() {
    active = null;
    token = null;
    if (rootEl) {
      rootEl.classList.add("hidden");
      rootEl.innerHTML = "";
    }
  }

  function finish(ok) {
    const id = active && active.id;
    const tok = token;
    close();
    if (ok && id && root.onTaskDone) root.onTaskDone(id, tok);
  }

  function panel(title) {
    rootEl.classList.remove("hidden");
    rootEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "panel";
    const h = document.createElement("h2");
    h.textContent = title;
    card.appendChild(h);
    const p = document.createElement("p");
    p.textContent = "Finish the activity. Esc cancels.";
    card.appendChild(p);
    rootEl.appendChild(card);
    return card;
  }

  function lanterns(task) {
    const card = panel("Align lanterns");
    const row = document.createElement("div");
    row.className = "row";
    const sockets = [0,1,2,3];
    const orbs = [0,1,2,3].sort(() => Math.random() - 0.5);
    let placed = 0;
    orbs.forEach((orb, i) => {
      const b = document.createElement("button");
      b.textContent = "Lantern " + (orb + 1);
      b.style.background = ["#f0d36b","#ff4fa3","#86e07a","#7ec8e3"][orb];
      b.style.color = "#1a1008";
      b.addEventListener("click", () => {
        if (orb === placed) {
          placed++;
          b.disabled = true;
          if (placed === 4) finish(true);
        }
      });
      row.appendChild(b);
    });
    card.appendChild(row);
  }

  function cables(task) {
    const card = panel("Patch spirit cables");
    const colors = ["#ff4fa3","#7ec8e3","#f0d36b","#86e07a"];
    const left = colors.slice();
    const right = colors.slice().sort(() => Math.random() - 0.5);
    let pick = null;
    let done = 0;
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "8px";
    function col(list, side) {
      const wrap = document.createElement("div");
      list.forEach((c) => {
        const b = document.createElement("button");
        b.textContent = side === "L" ? "A" : "B";
        b.style.background = c;
        b.dataset.color = c;
        b.addEventListener("click", () => {
          if (side === "L") pick = c;
          else if (pick === c) {
            b.disabled = true;
            done++;
            pick = null;
            if (done === 4) finish(true);
          }
        });
        wrap.appendChild(b);
      });
      return wrap;
    }
    grid.appendChild(col(left, "L"));
    grid.appendChild(col(right, "R"));
    card.appendChild(grid);
  }

  function fuel(task) {
    const card = panel("Feed the kitsune core");
    const lab = document.createElement("p");
    lab.textContent = "Hold both in the foxfire band.";
    card.appendChild(lab);
    const a = document.createElement("input");
    a.type = "range"; a.min = 0; a.max = 100; a.value = 10;
    const b = document.createElement("input");
    b.type = "range"; b.min = 0; b.max = 100; b.value = 90;
    a.style.width = "100%"; b.style.width = "100%";
    card.appendChild(a); card.appendChild(b);
    let okMs = 0, last = performance.now();
    function tick(now) {
      if (!active || active.kind !== "fuel") return;
      const dt = now - last; last = now;
      const good = Math.abs(a.value - 55) < 12 && Math.abs(b.value - 55) < 12;
      if (good) okMs += dt; else okMs = 0;
      lab.textContent = good ? "Holding… " + Math.min(100, Math.floor(okMs / 12)) + "%" : "Find the green band (~55).";
      if (okMs > 1200) finish(true);
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function breakers(task) {
    const card = panel("Reset breakers");
    const order = [1,2,3,4,5];
    let n = 1;
    const row = document.createElement("div");
    row.className = "row";
    const shuffled = order.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach((num) => {
      const b = document.createElement("button");
      b.className = "secondary";
      b.textContent = String(num);
      b.addEventListener("click", () => {
        if (num === n) {
          n++;
          b.disabled = true;
          if (n > 5) finish(true);
        } else n = 1;
      });
      row.appendChild(b);
    });
    card.appendChild(row);
  }

  function scan(task) {
    const card = panel("Tail scan");
    const p = document.createElement("p");
    p.textContent = "Hold still on the pad…";
    card.appendChild(p);
    let left = 3.2;
    const iv = setInterval(() => {
      if (!active) { clearInterval(iv); return; }
      left -= 0.1;
      p.textContent = "Scanning… " + left.toFixed(1) + "s";
      if (left <= 0) { clearInterval(iv); finish(true); }
    }, 100);
  }

  function open(task, tkn) {
    active = task;
    token = tkn || null;
    const k = task.kind;
    if (k === "lanterns") lanterns(task);
    else if (k === "cables") cables(task);
    else if (k === "fuel") fuel(task);
    else if (k === "scan") scan(task);
    else breakers(task);
  }

  function isOpen() { return !!active; }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) close();
  });

  root.TASKUI = { mount, open, close, isOpen };
})(typeof window !== "undefined" ? window : globalThis);
