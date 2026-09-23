(function (root) {
  const TYPES = [
    "host", "join", "start", "move", "use", "kill", "vent", "vote", "chat",
    "task_done", "task_start", "task_open", "report", "ping", "hello", "hosted", "state", "error", "kicked"
  ];
  const NAME_RE = /^[A-Za-z0-9 _.\-]{1,16}$/;
  const SKINS = ["shiro","midori","tora","shika","neon","kuro","aoi","kin"];

  function sanitizeName(s) {
    if (typeof s !== "string") return null;
    if (s.includes("<") || s.includes(">")) return null;
    const t = s.replace(/[^\w .\-]/g, "").trim().slice(0, 16);
    if (!NAME_RE.test(t)) return null;
    const low = t.toLowerCase();
    if (low.includes("__proto__") || low === "constructor" || low === "prototype") return null;
    return t;
  }

    function sanitizeChat(s) {
    if (typeof s !== "string") return null;
    if (/[<>"`\\]/.test(s)) return null;
    let t = s.replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, "");
    t = t.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!/^[A-Za-z0-9 .,!?'\-:;()\/+#@~]{1,80}$/.test(t)) return null;
    return t;
  }

function sanitizeCode(s) {
    if (typeof s !== "string") return null;
    const t = s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    return t.length === 4 ? t : null;
  }

  function parseMsg(raw, max) {
    max = max || 8192;
    if (typeof raw !== "string" || raw.length > max) return null;
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return null; }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    if (Object.prototype.hasOwnProperty.call(obj, "__proto__") ||
        Object.prototype.hasOwnProperty.call(obj, "constructor") ||
        Object.prototype.hasOwnProperty.call(obj, "prototype")) return null;
    if (typeof obj.type !== "string" || TYPES.indexOf(obj.type) < 0) return null;
    const clean = Object.create(null);
    clean.type = obj.type;
    for (const k of Object.keys(obj)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      const v = obj[k];
      const tv = typeof v;
      if (tv === "string" || tv === "number" || tv === "boolean" || v === null) clean[k] = v;
    }
    return clean;
  }

  root.PROTO = { TYPES, NAME_RE, SKINS, sanitizeName, sanitizeChat, sanitizeCode, parseMsg };
})(typeof window !== "undefined" ? window : globalThis);
