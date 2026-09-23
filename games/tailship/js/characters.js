(function (root) {
  const SKINS = {
    shiro: {
      id: "shiro", name: "Shiro",
      hair: "#f4f1ea", ear: "#f7f4ee", inner: "#f5c6d6",
      tail: ["#f7f4ee", "#ddd6cc"], jacket: "#7ba3c9", top: "#f3f3f3",
      bottom: "#9bb8d4", shoes: "#1a1a1a", stripe: null, antlers: false
    },
    midori: {
      id: "midori", name: "Midori",
      hair: "#1f4a32", ear: "#d07030", inner: "#2a1a12",
      tail: ["#c45e1a", "#f2efe8"], jacket: null, top: "#6b3a24",
      bottom: "#4f5c32", shoes: "#1a1a1a", stripe: null, antlers: false, pig: true
    },
    tora: {
      id: "tora", name: "Tora",
      hair: "#3b2418", ear: "#e39a3a", inner: "#1a1a1a",
      tail: ["#e39a3a", "#1a1a1a"], jacket: null, top: "#141414",
      bottom: "#8b8f96", shoes: "#111", stripe: true, antlers: false
    },
    shika: {
      id: "shika", name: "Shika",
      hair: "#2c4a2e", ear: "#c48a5a", inner: "#f2d2c0",
      tail: ["#3d2a1c", "#c48a5a"], jacket: null, top: "#1e3d28",
      bottom: "#8aa7c7", shoes: "#1a1a1a", stripe: null, antlers: true, plaid: true
    },
    neon: {
      id: "neon", name: "Neon",
      hair: "#ff4fa3", ear: "#ff4fa3", inner: "#b8ff4a",
      tail: ["#ff4fa3", "#b8ff4a"], jacket: null, top: "#111",
      bottom: "#ff4fa3", shoes: "#111", stripe: null, antlers: false, neon: true
    },
    kuro: {
      id: "kuro", name: "Kuro",
      hair: "#141414", ear: "#1a1a1a", inner: "#f0c36a",
      tail: ["#141414", "#222"], jacket: null, top: "#2a2a2a",
      bottom: "#3a3348", shoes: "#000", stripe: null, antlers: false
    },
    aoi: {
      id: "aoi", name: "Aoi",
      hair: "#c8e8ff", ear: "#e8f4ff", inner: "#7ec8e3",
      tail: ["#e8f4ff", "#9fd4f0"], jacket: "#dcefff", top: "#f7fbff",
      bottom: "#6aa0c8", shoes: "#1a1a1a", stripe: null, antlers: false
    },
    kin: {
      id: "kin", name: "Kin",
      hair: "#f0d36b", ear: "#f4e19a", inner: "#e05a4f",
      tail: ["#f0d36b", "#fff4c8"], jacket: null, top: "#7a1e16",
      bottom: "#3b221c", shoes: "#1a1a1a", stripe: null, antlers: false
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSkin(ctx, skinId, x, y, facing, t, opts) {
    const s = SKINS[skinId] || SKINS.shiro;
    opts = opts || {};
    const scale = opts.scale || 1;
    const ghost = !!opts.ghost;
    const dead = !!opts.dead;
    const vent = !!opts.vent;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing < 0 ? -scale : scale, scale);
    ctx.globalAlpha = ghost ? 0.4 : vent ? 0.35 : dead ? 0.9 : 1;

    if (dead) {
      ctx.rotate(1.2);
    }

    if (!dead && !ghost) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 22, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const bob = ghost || dead || vent ? 0 : Math.sin(t * 0.012) * 1.4;
    const walk = opts.moving ? Math.sin(t * 0.02) * 2 : 0;

    // tail
    ctx.save();
    ctx.translate(-10, 6 + bob);
    ctx.rotate(-0.5 + Math.sin(t * 0.008) * 0.15);
    ctx.fillStyle = s.tail[0];
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.tail[1];
    ctx.beginPath();
    ctx.ellipse(-12, -2, 7, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    if (s.stripe) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0.4, 0.2, 2.6);
      ctx.stroke();
    }
    ctx.restore();

    // legs
    ctx.fillStyle = s.bottom;
    roundRect(ctx, -8, 10 + bob, 6, 10 + walk, 2);
    ctx.fill();
    roundRect(ctx, 2, 10 + bob, 6, 10 - walk, 2);
    ctx.fill();
    ctx.fillStyle = s.shoes;
    roundRect(ctx, -8, 18 + bob + walk, 6, 4, 1);
    ctx.fill();
    roundRect(ctx, 2, 18 + bob - walk, 6, 4, 1);
    ctx.fill();

    // body
    ctx.fillStyle = s.top;
    roundRect(ctx, -9, -4 + bob, 18, 16, 4);
    ctx.fill();
    if (s.plaid) {
      ctx.strokeStyle = "#0d2014";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-9, 2 + bob); ctx.lineTo(9, 2 + bob);
      ctx.moveTo(-3, -4 + bob); ctx.lineTo(-3, 12 + bob);
      ctx.stroke();
    }
    if (s.jacket) {
      ctx.fillStyle = s.jacket;
      roundRect(ctx, -12, -4 + bob, 7, 15, 3);
      ctx.fill();
      roundRect(ctx, 5, -4 + bob, 7, 15, 3);
      ctx.fill();
    }

    // head
    ctx.fillStyle = "#f3d2c4";
    ctx.beginPath();
    ctx.arc(0, -14 + bob, 9, 0, Math.PI * 2);
    ctx.fill();

    // hair
    ctx.fillStyle = s.hair;
    ctx.beginPath();
    ctx.ellipse(0, -18 + bob, 10, 8, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, -12 + bob, 4, 0, Math.PI * 2);
    ctx.arc(6, -12 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    if (s.pig) {
      ctx.beginPath();
      ctx.arc(-8, -22 + bob, 3.2, 0, Math.PI * 2);
      ctx.arc(8, -22 + bob, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.neon) {
      ctx.fillStyle = "#b8ff4a";
      ctx.fillRect(-2, -22 + bob, 5, 8);
    }

    // ears
    ctx.fillStyle = s.ear;
    ctx.beginPath();
    ctx.moveTo(-8, -20 + bob); ctx.lineTo(-13, -32 + bob); ctx.lineTo(-2, -22 + bob);
    ctx.moveTo(8, -20 + bob); ctx.lineTo(13, -32 + bob); ctx.lineTo(2, -22 + bob);
    ctx.fill();
    ctx.fillStyle = s.inner;
    ctx.beginPath();
    ctx.moveTo(-8, -21 + bob); ctx.lineTo(-11, -28 + bob); ctx.lineTo(-5, -22 + bob);
    ctx.moveTo(8, -21 + bob); ctx.lineTo(11, -28 + bob); ctx.lineTo(5, -22 + bob);
    ctx.fill();

    if (s.antlers) {
      ctx.strokeStyle = "#c48a5a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -24 + bob); ctx.lineTo(-8, -34 + bob); ctx.lineTo(-12, -32 + bob);
      ctx.moveTo(4, -24 + bob); ctx.lineTo(8, -34 + bob); ctx.lineTo(12, -32 + bob);
      ctx.stroke();
    }

    // face
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-3, -14 + bob, 1.2, 0, Math.PI * 2);
    ctx.arc(3, -14 + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d08090";
    ctx.beginPath();
    ctx.arc(0, -11 + bob, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  root.SKINS = SKINS;
  root.drawSkin = drawSkin;
  root.SKIN_IDS = Object.keys(SKINS);
})(typeof window !== "undefined" ? window : globalThis);
