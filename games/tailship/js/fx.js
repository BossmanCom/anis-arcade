(function (root) {
  const layerId = "fxLayer";
  const flashId = "fxFlash";
  let morale = 40;
  let streak = 0;
  let shakeTimer = 0;

  function $(id) { return document.getElementById(id); }

  function paintMorale() {
    const el = $("moraleVal");
    const st = $("streakVal");
    if (el) el.textContent = String(Math.max(0, Math.min(99, morale | 0)));
    if (st) {
      if (streak >= 2) st.textContent = "STREAK ×" + streak;
      else if (streak === 1) st.textContent = "first clear";
      else st.textContent = "";
    }
    const card = $("moraleCard");
    if (card) card.classList.toggle("hot", streak >= 3);
  }

  function bumpMorale(n) {
    morale = Math.max(0, Math.min(99, morale + n));
    paintMorale();
  }

  function pop(text, opts) {
    opts = opts || {};
    const layer = $(layerId);
    if (!layer || !text) return;
    const el = document.createElement("div");
    el.className = "fx-pop" + (opts.tone ? " " + opts.tone : " gold");
    el.textContent = text;
    if (opts.x != null && opts.y != null) {
      el.style.left = opts.x + "px";
      el.style.top = opts.y + "px";
      el.style.transform = "translate(-50%, -50%)";
    }
    layer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  }

  function flash(tone) {
    const el = $(flashId);
    if (!el) return;
    el.className = "fx-flash on " + (tone || "gold");
    el.addEventListener("animationend", () => {
      el.className = "fx-flash";
    }, { once: true });
  }

  function shake(ms) {
    const stage = $("stage");
    if (!stage) return;
    stage.classList.remove("shake");
    void stage.offsetWidth;
    stage.classList.add("shake");
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => stage.classList.remove("shake"), ms || 320);
  }

  function taskClear() {
    streak += 1;
    bumpMorale(8);
    pop("TASK CLEAR", { tone: "gold" });
    setTimeout(() => pop("+" + (6 + Math.min(6, streak)), { tone: "goldnum" }), 90);
    flash("gold");
    shake(220);
  }

  function crewTask() {
    bumpMorale(3);
    pop("CREW CLEAR", { tone: "mint" });
  }

  function kill() {
    streak = 0;
    paintMorale();
    pop("SHADE STRIKE", { tone: "pink" });
    flash("red");
    shake(280);
  }

  function struck() {
    streak = 0;
    paintMorale();
    pop("STRUCK", { tone: "pink" });
    flash("red");
    shake(340);
  }

  function reported() {
    bumpMorale(4);
    pop("REPORTED", { tone: "paper" });
    flash("white");
    shake(240);
  }

  function emergency() {
    bumpMorale(2);
    pop("EMERGENCY", { tone: "gold" });
    flash("gold");
    shake(300);
  }

  function voteLocked() {
    bumpMorale(2);
    pop("VOTE LOCKED", { tone: "gold" });
    flash("gold");
    const board = $("voteBoard");
    if (board) {
      board.classList.remove("pulse");
      void board.offsetWidth;
      board.classList.add("pulse");
    }
  }

  function reset() {
    morale = 40;
    streak = 0;
    paintMorale();
  }

  root.FX = {
    pop, flash, shake, bumpMorale, paintMorale, reset,
    taskClear, crewTask, kill, struck, reported, emergency, voteLocked
  };
})(typeof window !== "undefined" ? window : globalThis);
