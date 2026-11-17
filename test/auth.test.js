const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { fakeMongo } = require("./helpers/fake-mongo");
const { createAuthStore } = require("../server/auth-store");
const { hashPassword } = require("../server/password");
const { createAuth, createRateLimiter } = require("../server/auth");

const GOOD = "contraseña-correcta";
const T0 = Date.UTC(2026, 0, 1);
const EXPIRED = "Tu sesión terminó. Vuelve a entrar.";
let HASH;
test.before(async () => { HASH = await hashPassword(GOOD); });

async function start({ secure = false, storeOverrides = {}, noUser = false } = {}) {
  const db = fakeMongo();
  const clock = { t: T0 };
  const now = () => clock.t;
  const authStore = { ...createAuthStore(db, { now }) };
  if (!noUser) await authStore.createUser(HASH);
  Object.assign(authStore, storeOverrides);
  const events = [];
  const auth = createAuth({ authStore, now, secure, log: (e) => events.push(e) });
  const app = express();
  app.use("/api/auth", auth.router);
  app.get("/api/x", auth.requireSession, (_req, res) => res.json({ ok: true }));
  app.get("/", auth.requireSession, (_req, res) => res.send("portal"));
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;
  const close = () => new Promise((r) => { server.close(r); server.closeAllConnections(); });
  return { db, clock, authStore, events, port, base, close };
}

function raw(port, { method = "GET", path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const J = { "Content-Type": "application/json" };
const login = (s, password, extra = {}) =>
  fetch(s.base + "/api/auth/login", { method: "POST", headers: J, body: JSON.stringify({ password, ...extra }), redirect: "manual" });
const loginBody = (s, body, headers = J) =>
  fetch(s.base + "/api/auth/login", { method: "POST", headers, body });
const tokenOf = (r) => /nu_session=([^;]*)/.exec(r.headers.get("set-cookie"))[1];
const getX = (s, cookie) => fetch(s.base + "/api/x", { headers: cookie ? { Cookie: cookie } : {} });
const getRoot = (s, cookie) => fetch(s.base + "/", { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });

test("login correcto: 204, cookie con los atributos correctos y sin Secure", async () => {
  const s = await start();
  const r = await login(s, GOOD);
  assert.equal(r.status, 204);
  const c = r.headers.get("set-cookie");
  for (const part of ["nu_session=", "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=2592000"]) assert.ok(c.includes(part), part);
  assert.ok(!/secure/i.test(c));
  assert.equal(r.headers.get("cache-control"), "no-store");
  const token = tokenOf(r);
  assert.equal(token.length, 43);
  assert.equal((await getX(s, "nu_session=" + token)).status, 200);
  assert.equal((await getRoot(s, "otra=1; nu_session=" + token)).status, 200);
  await s.close();
});

test("con secure: true la cookie lleva Secure", async () => {
  const s = await start({ secure: true });
  const r = await login(s, GOOD);
  assert.equal(r.status, 204);
  assert.ok(r.headers.get("set-cookie").includes("Secure"));
  await s.close();
});

test("cookies faltantes, inventadas, vacías, repetidas o largas: 401 en /api y 302 en páginas", async () => {
  const s = await start();
  const token = tokenOf(await login(s, GOOD));
  const cases = [
    null,
    "nu_session=inventada",
    "nu_session=",
    "nu_session",
    `nu_session=${token}; nu_session=${token}`,
    "nu_session=" + "a".repeat(200),
    "nu_session=%zz; ;;=",
  ];
  for (const c of cases) {
    const a = await getX(s, c);
    assert.equal(a.status, 401, String(c));
    assert.equal((await a.json()).error, EXPIRED);
    const p = await getRoot(s, c);
    assert.equal(p.status, 302, String(c));
    assert.equal(p.headers.get("location"), "/login");
  }
  await s.close();
});

test("contraseña mala 401; al 5.º fallo queda bloqueada 15 min; luego entra", async () => {
  const s = await start();
  const r1 = await login(s, "contraseña-mala!");
  assert.equal(r1.status, 401);
  assert.equal((await r1.json()).error, "Contraseña incorrecta");
  assert.equal(r1.headers.get("set-cookie"), null);
  for (let i = 0; i < 4; i++) await login(s, "contraseña-mala!");
  const locked = await login(s, GOOD);
  assert.equal(locked.status, 429);
  assert.match((await locked.json()).error, /Intenta en 15 minutos/);
  assert.equal(locked.headers.get("set-cookie"), null);
  s.clock.t += 14 * 60000 + 1;
  assert.match((await (await login(s, GOOD)).json()).error, /Intenta en 1 minutos/);
  s.clock.t = T0 + 15 * 60000 + 1;
  const ok = await login(s, GOOD);
  assert.equal(ok.status, 204);
  const u = await s.authStore.getUser();
  assert.equal(u.failedCount, 0);
  await s.close();
});

test("el intento 21 desde la misma IP recibe 429 aunque la contraseña sea correcta", async () => {
  const s = await start();
  for (let i = 0; i < 20; i++) assert.equal((await loginBody(s, "{}")).status, 400);
  const r = await login(s, GOOD);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, "Demasiados intentos. Intenta más tarde.");
  assert.equal(r.headers.get("set-cookie"), null);
  assert.ok(s.events.some((e) => e.event === "login_limited"));
  await s.close();
});

test("createRateLimiter: false desde el intento max+1 y se libera al pasar la ventana", () => {
  let t = 0;
  const rl = createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
  assert.equal(rl.hit("a"), true);
  assert.equal(rl.hit("a"), true);
  assert.equal(rl.hit("a"), true);
  assert.equal(rl.hit("a"), false);
  assert.equal(rl.hit("b"), true);
  t = 1001;
  assert.equal(rl.hit("a"), true);
});

test("cuerpos inválidos: 400 'Escribe tu contraseña.' sin contar como fallo", async () => {
  const s = await start();
  const bodies = [
    ["{}", J],
    [JSON.stringify({ password: 123 }), J],
    [JSON.stringify({ password: "a".repeat(1025) }), J],
    [JSON.stringify({ password: "" }), J],
    ["[1]", J],
    ["null", J],
    ["{roto", J],
    [JSON.stringify({ password: GOOD }), { "Content-Type": "text/plain" }],
    [JSON.stringify({ password: "a".repeat(5000) }), J],
  ];
  for (const [b, h] of bodies) {
    const r = await loginBody(s, b, h);
    assert.equal(r.status, 400, b.slice(0, 40));
    assert.equal((await r.json()).error, "Escribe tu contraseña.");
    assert.equal(r.headers.get("set-cookie"), null);
  }
  assert.equal((await s.authStore.getUser()).failedCount, 0);
  await s.close();
});

test("si la base falla en el login: 500 sin cookie", async () => {
  const boom = async () => { throw new Error("db caída"); };
  for (const storeOverrides of [{ recordFailure: boom }, { getUser: boom }, { createSession: boom }]) {
    const s = await start({ storeOverrides });
    const r = await login(s, Object.keys(storeOverrides)[0] === "recordFailure" ? "contraseña-mala!" : GOOD);
    assert.equal(r.status, 500);
    assert.equal((await r.json()).error, "No se pudo iniciar sesión. Intenta de nuevo.");
    assert.equal(r.headers.get("set-cookie"), null);
    await s.close();
  }
});

test("si la base falla al revisar la sesión: 500 y no se pasa a la ruta", async () => {
  const s = await start({ storeOverrides: { findSession: async () => { throw new Error("x"); } } });
  const a = await getX(s, "nu_session=algo");
  assert.equal(a.status, 500);
  assert.equal((await a.json()).error, "No se pudo verificar tu sesión. Intenta de nuevo.");
  const p = await getRoot(s, "nu_session=algo");
  assert.equal(p.status, 500);
  assert.notEqual(await p.text(), "portal");
  await s.close();
});

test("sin usuaria creada el login responde 401", async () => {
  const s = await start({ noUser: true });
  const r = await login(s, GOOD);
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("set-cookie"), null);
  await s.close();
});

test("logout con cookie válida: 204, Max-Age=0 y la cookie deja de servir", async () => {
  const s = await start();
  const cookie = "nu_session=" + tokenOf(await login(s, GOOD));
  assert.equal((await getX(s, cookie)).status, 200);
  const r = await fetch(s.base + "/api/auth/logout", { method: "POST", headers: { Cookie: cookie } });
  assert.equal(r.status, 204);
  assert.ok(r.headers.get("set-cookie").includes("Max-Age=0"));
  assert.ok(r.headers.get("set-cookie").includes("nu_session=;"));
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await getX(s, cookie)).status, 401);
  await s.close();
});

test("logout sin cookie o con cookie inválida: 204 y Max-Age=0", async () => {
  const s = await start({ secure: true });
  for (const headers of [{}, { Cookie: "nu_session=" + "x".repeat(300) }, { Cookie: "nu_session=a; nu_session=b" }]) {
    const r = await fetch(s.base + "/api/auth/logout", { method: "POST", headers });
    assert.equal(r.status, 204);
    const c = r.headers.get("set-cookie");
    assert.ok(c.includes("Max-Age=0"));
    assert.ok(c.includes("Secure"));
  }
  await s.close();
});

test("log recibe login_ok, login_fail y login_locked sin contraseña ni token", async () => {
  const s = await start();
  const r = await login(s, GOOD);
  const token = tokenOf(r);
  for (let i = 0; i < 5; i++) await login(s, "contraseña-mala!");
  await login(s, GOOD);
  const kinds = s.events.map((e) => e.event);
  for (const k of ["login_ok", "login_fail", "login_locked"]) assert.ok(kinds.includes(k), k);
  const dump = JSON.stringify(s.events);
  assert.ok(!dump.includes(GOOD));
  assert.ok(!dump.includes("contraseña-mala!"));
  assert.ok(!dump.includes(token));
  for (const e of s.events) {
    assert.deepEqual(Object.keys(e).sort(), ["event", "ip", "t"]);
    assert.equal(typeof e.ip, "string");
  }
  await s.close();
});

test("raw: cabecera Cookie extraña no truena el servidor", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/x", headers: { Cookie: "=;=;nu_session==x=" } });
  assert.equal(r.status, 401);
  await s.close();
});
