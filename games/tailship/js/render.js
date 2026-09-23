(function (root) {
  const orbs = Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * 1620,
    y: Math.random() * 1040,
    r: 4 + Math.random() * 10,
    s: 0.3 + Math.random() * 0.7,
    p: Math.random() * 6
  }));

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawStation(ctx, t, now) {
    const x = t.x, y = t.y;
    const blink = 0.55 + 0.45 * Math.sin(now * 0.006 + x * 0.01);
    const kind = t.kind || "breakers";

    // large floor mat so it never reads as a lone dot
    ctx.fillStyle = "rgba(20,28,36,0.9)";
    roundRect(ctx, x - 28, y - 8, 56, 36, 4);
    ctx.fill();
    ctx.strokeStyle = "#86e07a88";
    ctx.lineWidth = 2;
    ctx.stroke();

    // cabinet body
    ctx.fillStyle = "#243040";
    roundRect(ctx, x - 24, y - 2, 48, 26, 3);
    ctx.fill();
    ctx.strokeStyle = "#5a6a80";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // monitor stand
    ctx.fillStyle = "#1a222c";
    ctx.fillRect(x - 4, y - 8, 8, 8);

    // monitor bezel
    ctx.fillStyle = "#0e141c";
    roundRect(ctx, x - 22, y - 40, 44, 32, 3);
    ctx.fill();

    let screen = "#1a4030";
    if (kind === "lanterns") screen = "#403818";
    else if (kind === "cables") screen = "#301848";
    else if (kind === "fuel") screen = "#401810";
    else if (kind === "scan") screen = "#184038";
    ctx.fillStyle = screen;
    roundRect(ctx, x - 18, y - 36, 36, 22, 2);
    ctx.fill();

    // bright UI chrome on screen
    ctx.fillStyle = "rgba(134,224,122," + (0.55 + 0.4 * blink) + ")";
    ctx.fillRect(x - 14, y - 32, 16, 3);
    ctx.fillRect(x - 14, y - 26, 28, 2);
    ctx.fillRect(x - 14, y - 22, 22, 2);
    ctx.fillStyle = "rgba(240,211,107," + (0.5 + 0.5 * blink) + ")";
    ctx.beginPath();
    ctx.arc(x + 12, y - 28, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // keyboard
    ctx.fillStyle = "#2a3544";
    roundRect(ctx, x - 16, y + 6, 32, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#6a7a90";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillRect(x - 14 + c * 5, y + 7.5 + r * 4, 3.5, 2.5);
      }
    }

    // kind props
    if (kind === "lanterns") {
      for (const ox of [-30, 30]) {
        ctx.fillStyle = "rgba(240,211,107,0.9)";
        ctx.beginPath();
        ctx.arc(x + ox, y - 12, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c4922a";
        ctx.stroke();
      }
    } else if (kind === "cables") {
      const cols = ["#ff4fa3", "#7ec8e3", "#f0d36b"];
      cols.forEach((col, i) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 26, y + 18);
        ctx.quadraticCurveTo(x - 36 - i * 2, y - 6, x - 20, y - 38);
        ctx.stroke();
      });
    } else if (kind === "fuel") {
      ctx.fillStyle = "#ff7a3d";
      roundRect(ctx, x + 26, y - 6, 12, 22, 2);
      ctx.fill();
      ctx.fillStyle = "#f0d36b";
      ctx.fillRect(x + 29, y - 2, 6, 6 + 6 * blink);
    } else if (kind === "breakers") {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#86e07a" : "#a05060";
        roundRect(ctx, x - 30, y - 2 + i * 6, 8, 5, 1);
        ctx.fill();
      }
    } else if (kind === "scan") {
      ctx.strokeStyle = "rgba(143,212,184," + (0.5 + 0.4 * blink) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + 22, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(143,212,184,0.18)";
      ctx.fill();
    }

    // label under station
    ctx.fillStyle = "#c8e8c0";
    ctx.font = "10px Trebuchet MS";
    ctx.textAlign = "center";
    const label = (t.name || kind).slice(0, 18);
    ctx.fillText(label, x, y + 40);
    ctx.textAlign = "left";
  }

function drawVent(ctx, v, me, now) {
    const x = v.x, y = v.y;
    const shade = me && me.role === "shade";
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005 + x);

    // floor plate
    ctx.fillStyle = "#141018";
    roundRect(ctx, x - 16, y - 12, 32, 28, 3);
    ctx.fill();
    ctx.strokeStyle = shade ? "rgba(255,79,163," + (0.45 + 0.4 * pulse) + ")" : "#e8b86a55";
    ctx.lineWidth = 2;
    ctx.stroke();

    // hatch grille
    ctx.fillStyle = "#0a0610";
    roundRect(ctx, x - 11, y - 6, 22, 16, 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3038";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 3 + i * 4);
      ctx.lineTo(x + 9, y - 3 + i * 4);
      ctx.stroke();
    }

    // fox-mask terminal nub
    ctx.fillStyle = "#2a2228";
    roundRect(ctx, x + 10, y - 14, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = shade ? "#ff4fa3" : "#e8b86a";
    ctx.fillRect(x + 13, y - 11, 6, 4);
    ctx.font = "9px sans-serif";
    ctx.fillStyle = "#e8b86a";
    ctx.fillText("狐", x - 5, y + 6);

    if (shade) {
      ctx.fillStyle = "rgba(255,79,163,0.15)";
      ctx.beginPath();
      ctx.arc(x, y, 20 + 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMinimap(ctx, me, players) {
    const mm = document.getElementById("minimap");
    if (!mm) return;
    const stage = document.getElementById("stage");
    if (!stage || !stage.classList.contains("playing")) return;
    const m = mm.getContext("2d");
    const M = root.TAILMAP;
    m.clearRect(0, 0, mm.width, mm.height);
    const sx = mm.width / M.WORLD.w, sy = mm.height / M.WORLD.h;
    m.fillStyle = "#0a0610";
    m.fillRect(0, 0, mm.width, mm.height);
    for (const r of M.ROOMS) {
      m.fillStyle = r.floor;
      m.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
    }
    for (const t of M.TASKS) {
      m.fillStyle = "#86e07a";
      m.fillRect(t.x * sx - 1, t.y * sy - 1, 2, 2);
    }
    for (const p of players) {
      if (p.inVent && !(me && me.role === "shade")) continue;
      m.fillStyle = p.id === (me && me.id) ? "#f0d36b" : "#ff4fa3";
      m.beginPath();
      m.arc(p.x * sx, p.y * sy, 2.4, 0, Math.PI * 2);
      m.fill();
    }
  }

  function render(ctx, cam, state, now) {
    const M = root.TAILMAP;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = "#120c18";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    const g = ctx.createLinearGradient(0, 0, 0, M.WORLD.h);
    g.addColorStop(0, "#4a2a38");
    g.addColorStop(0.45, "#241428");
    g.addColorStop(1, "#100c18");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, M.WORLD.w, M.WORLD.h);

    for (const o of orbs) {
      const y = (o.y + Math.sin(now * 0.001 * o.s + o.p) * 12);
      ctx.fillStyle = "rgba(240,211,107,0.55)";
      ctx.beginPath();
      ctx.arc(o.x, y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of M.ROOMS) {
      ctx.fillStyle = r.floor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = r.accent + "99";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.fillStyle = r.accent;
      ctx.font = "12px Trebuchet MS";
      ctx.fillText(r.name, r.x + 10, r.y + 18);
    }
    ctx.fillStyle = "#2a2230";
    for (const h of M.HALLS) ctx.fillRect(h.x, h.y, h.w, h.h);

    const B = M.BELL;
    const bellPulse = 0.55 + 0.45 * Math.sin(now * 0.005);
    ctx.fillStyle = "rgba(240,211,107," + (0.12 + 0.18 * bellPulse) + ")";
    ctx.beginPath();
    ctx.ellipse(B.x, B.y + 2, 28 + 4 * bellPulse, 18 + 2 * bellPulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c4922a";
    ctx.beginPath();
    ctx.ellipse(B.x, B.y, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0d36b";
    ctx.fillRect(B.x - 3, B.y - 28, 6, 20);
    ctx.fillStyle = "#fff4c8";
    ctx.beginPath();
    ctx.arc(B.x, B.y - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4e4c8";
    ctx.font = "11px Trebuchet MS";
    ctx.fillText("EMERGENCY BELL", B.x - 52, B.y + 28);

    for (const t of M.TASKS) drawStation(ctx, t, now);

    const me = state.me;
    for (const v of M.VENTS) drawVent(ctx, v, me, now);

    for (const b of state.bodies || []) {
      ctx.save();
      root.drawSkin(ctx, b.skin, b.x, b.y, 1, now, { dead: true, scale: 1.1 });
      ctx.restore();
      ctx.fillStyle = "#e05a4f";
      ctx.font = "11px Trebuchet MS";
      ctx.fillText("report", b.x - 16, b.y + 28);
    }

    const vis = state.lights === false ? 130 : 900;
    const players = state.players || [];
    for (const p of players) {
      if (p.inVent) {
        if (!(me && (me.role === "shade" || p.id === me.id))) continue;
      }
      if (me && p.id !== me.id && !p.inVent) {
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        if (d > vis) continue;
      }
      root.drawSkin(ctx, p.skin, p.x, p.y, p.facing || 1, now, {
        moving: p.moving, ghost: p.alive === false && !p.body, vent: p.inVent, scale: 1.15
      });
      if (p.alive !== false) {
        ctx.fillStyle = "#f4e4c8";
        ctx.font = "11px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(p.name || "", p.x, p.y - 38);
        ctx.textAlign = "left";
      }
    }

    ctx.restore();

    if (me && state.lights === false) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 130, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawMinimap(ctx, me, players);
  }

  function renderMenuBackdrop(ctx, now) {
    const cam = {
      x: 90 + Math.sin(now * 0.00011) * 220,
      y: 50 + Math.cos(now * 0.00009) * 140
    };
    render(ctx, cam, { me: null, players: [], bodies: [], lights: true }, now);
  }

  root.renderWorld = render;
  root.renderMenuBackdrop = renderMenuBackdrop;
})(typeof window !== "undefined" ? window : globalThis);
