(function (root) {
  const PROTO = root.PROTO;
  let ws = null;
  let handlers = Object.create(null);
  let lastSent = 0;
  let chatAt = 0;

  function send(obj) {
    if (!ws || ws.readyState !== 1) return;
    const now = performance.now();
    if (obj.type === "chat") {
      if (now - chatAt < 500) return;
      chatAt = now;
    }
    if (now - lastSent < 30 && obj.type === "move") {
      // allow moves at ~30hz
    }
    lastSent = now;
    ws.send(JSON.stringify(obj));
  }

  function connect(url) {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(url);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("socket"));
      ws.onmessage = (ev) => {
        const msg = PROTO.parseMsg(typeof ev.data === "string" ? ev.data : "");
        if (!msg) return;
        const fn = handlers[msg.type];
        if (fn) fn(msg);
        if (handlers["*"]) handlers["*"](msg);
      };
      ws.onclose = () => {
        if (handlers.close) handlers.close();
      };
    });
  }

  function on(type, fn) { handlers[type] = fn; }

  function host(name, skin) { send({ type: "host", name, skin }); }
  function join(code, name, skin) { send({ type: "join", code, name, skin }); }
  function start() { send({ type: "start" }); }
  function move(dx, dy) { send({ type: "move", dx, dy }); }
  function use() { send({ type: "use" }); }
  function kill() { send({ type: "kill" }); }
  function vent(to) { send({ type: "vent", to: to || "" }); }
  function vote(id) { send({ type: "vote", target: id }); }
  function chat(text) { send({ type: "chat", text }); }
  function taskStart(id) { send({ type: "task_start", id }); }
  function taskDone(id, token) { send({ type: "task_done", id, token: token || "" }); }
  function report() { send({ type: "report" }); }

  root.Net = { connect, on, host, join, start, move, use, kill, vent, vote, chat, taskStart, taskDone, report, send };
})(typeof window !== "undefined" ? window : globalThis);
