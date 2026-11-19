const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("../server/app.js");
const { buildCsp } = require("../server/security.js");
const { fakeMongo } = require("./helpers/fake-mongo");
const { createAuthStore } = require("../server/auth-store");
const { hashPassword } = require("../server/password");

const PASSWORD = "portal-de-prueba-1";
const root = path.join(__dirname, "..");
let HASH;
let CSP;
test.before(async () => {
  require("node:child_process").execFileSync("node", ["build.mjs"], { cwd: root });
  CSP = JSON.parse(fs.readFileSync(path.join(root, "dist", "csp.json"), "utf8"));
  HASH = await hashPassword(PASSWORD);
});

function memoryStore() {
  const cols = {};
  let n = 0;
  return {
    async list(c) { return Object.entries(cols[c] || {}).map(([id, b]) => ({ id, ...b })); },
    async put(c, id, body) { (cols[c] = cols[c] || {})[id] = body; },
    async add(c, body) { const id = "gen" + ++n; (cols[c] = cols[c] || {})[id] = body; return id; },
    async remove(c, id) { delete (cols[c] || {})[id]; },
  };
}
function raw(port, { method = "GET", path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let data = ""; res.on("data", (d) => (data += d)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject); if (body) req.write(body); req.end();
  });
}
const J = { "Content-Type": "application/json" };

// Arranca el portal con una usuaria y deja la sesión iniciada; s.fetch agrega Cookie y Origin
async function start(store = memoryStore(), { publicOrigin = "", login = true } = {}) {
  const authStore = createAuthStore(fakeMongo());
  await authStore.createUser(HASH);
  const app = createApp(store, { authStore, publicOrigin, csp: CSP, log: () => {} });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;
  let cookie = "";
  if (login) {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { ...J, Origin: base }, body: JSON.stringify({ password: PASSWORD }),
    });
    assert.strictEqual(r.status, 204);
    cookie = /nu_session=[^;]*/.exec(r.headers.get("set-cookie"))[0];
  }
  const withAuth = (url, opts = {}) =>
    fetch(url, { redirect: "manual", ...opts, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: base, ...(opts.headers || {}) } });
  return { port, base, cookie, fetch: withAuth, close: () => new Promise((r) => { server.close(r); server.closeAllConnections(); }) };
}

test("PUT then GET returns the stored document with its id", async () => {
  const s = await start();
  assert.strictEqual((await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ name: "Ana" }) })).status, 204);
  const list = await (await s.fetch(s.base + "/api/clients")).json();
  assert.deepStrictEqual(list, [{ id: "a", name: "Ana" }]);
  await s.close();
});
test("POST returns a new id and the document is listed", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/api/services", { method: "POST", headers: J, body: JSON.stringify({ name: "Retoque" }) });
  assert.strictEqual(r.status, 201);
  const { id } = await r.json();
  assert.ok(id);
  assert.strictEqual((await (await s.fetch(s.base + "/api/services")).json())[0].id, id);
  await s.close();
});
test("DELETE removes the document", async () => {
  const s = await start();
  await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ name: "Ana" }) });
  assert.strictEqual((await s.fetch(s.base + "/api/clients/a", { method: "DELETE" })).status, 204);
  assert.deepStrictEqual(await (await s.fetch(s.base + "/api/clients")).json(), []);
  await s.close();
});
test("unknown collection is rejected with 400", async () => {
  const s = await start();
  assert.strictEqual((await s.fetch(s.base + "/api/users")).status, 400);
  await s.close();
});
test("ids with odd characters are rejected with 400", async () => {
  const s = await start();
  for (const id of ["a$b", "a%20b", "a.b", "a%2Fb", "x".repeat(65)]) {
    const r = await s.fetch(s.base + "/api/clients/" + id, { method: "PUT", headers: J, body: "{}" });
    assert.strictEqual(r.status, 400, id);
  }
  await s.close();
});
test("PUT without JSON content type is rejected with 415", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "{}" });
  assert.strictEqual(r.status, 415);
  await s.close();
});
test("a foreign Host header is rejected with 403 (DNS rebinding)", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/clients", headers: { Host: "evil.com", Cookie: s.cookie } });
  assert.strictEqual(r.status, 403);
  await s.close();
});
test("a request with a foreign Origin is rejected with 403", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/clients", headers: { Host: "127.0.0.1:" + s.port, Origin: "http://evil.com", Cookie: s.cookie } });
  assert.strictEqual(r.status, 403);
  await s.close();
});
test("an id or _id inside the body cannot change the document id", async () => {
  const store = memoryStore();
  const s = await start(store);
  await s.fetch(s.base + "/api/clients/real", { method: "PUT", headers: J, body: JSON.stringify({ id: "otro", _id: "x", name: "Ana" }) });
  const list = await store.list("clients");
  assert.deepStrictEqual(list, [{ id: "real", name: "Ana" }]);
  await s.close();
});
test("a body over 256 KB is rejected with 413", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ x: "a".repeat(300 * 1024) }) });
  assert.strictEqual(r.status, 413);
  await s.close();
});
test("a store failure returns 500 with a Spanish message", async () => {
  const store = { ...memoryStore(), put: async () => { throw new Error("boom"); } };
  const s = await start(store);
  const r = await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: "{}" });
  assert.strictEqual(r.status, 500);
  assert.match((await r.json()).error, /No se pudo guardar/);
  await s.close();
});
test("GET / serves the built page as html", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  await s.close();
});

// --- sesión obligatoria ---
test("GET /api/clients without a cookie is 401", async () => {
  const s = await start(memoryStore(), { login: false });
  const r = await s.fetch(s.base + "/api/clients");
  assert.strictEqual(r.status, 401);
  await s.close();
});
test("GET / without a cookie redirects to /login", async () => {
  const s = await start(memoryStore(), { login: false });
  const r = await s.fetch(s.base + "/");
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get("location"), "/login");
  await s.close();
});
test("GET /login serves the login page with its own CSP", async () => {
  const s = await start(memoryStore(), { login: false });
  const r = await s.fetch(s.base + "/login");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  const csp = r.headers.get("content-security-policy");
  assert.strictEqual(csp, buildCsp(CSP["login.html"]));
  for (const h of [...CSP["login.html"].script, ...CSP["login.html"].style]) assert.ok(csp.includes(h), h);
  assert.strictEqual(r.headers.get("cache-control"), "no-store");
  assert.match(await r.text(), /<form|password/i);
  await s.close();
});
test("GET /login with a session redirects to /", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/login");
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get("location"), "/");
  await s.close();
});
test("PUT with a cookie but no Origin is 403", async () => {
  const s = await start();
  const r = await raw(s.port, {
    method: "PUT", path: "/api/clients/a",
    headers: { Host: "127.0.0.1:" + s.port, Cookie: s.cookie, "Content-Type": "application/json" }, body: "{}",
  });
  assert.strictEqual(r.status, 403);
  await s.close();
});
test("login and logout without Origin are 403", async () => {
  const s = await start(memoryStore(), { login: false });
  for (const p of ["/api/auth/login", "/api/auth/logout"]) {
    const r = await raw(s.port, {
      method: "POST", path: p, headers: { Host: "127.0.0.1:" + s.port, "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.strictEqual(r.status, 403, p);
    assert.ok(!r.headers["set-cookie"], p);
  }
  await s.close();
});
test("POST /api/auth/login with a foreign Origin is 403", async () => {
  const s = await start(memoryStore(), { login: false });
  const r = await s.fetch(s.base + "/api/auth/login", {
    method: "POST", headers: { ...J, Origin: "http://evil.com" }, body: JSON.stringify({ password: PASSWORD }),
  });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.headers.get("set-cookie"), null);
  await s.close();
});

// --- encabezados ---
test("GET / with a session has the page CSP and security headers", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/");
  assert.strictEqual(r.status, 200);
  const csp = r.headers.get("content-security-policy");
  assert.strictEqual(csp, buildCsp(CSP["index.html"]));
  assert.ok(!csp.includes("unsafe-inline"));
  assert.strictEqual(r.headers.get("x-frame-options"), "DENY");
  assert.strictEqual(r.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(r.headers.get("referrer-policy"), "no-referrer");
  assert.strictEqual(r.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.strictEqual(r.headers.get("cache-control"), "no-store");
  assert.strictEqual(r.headers.get("strict-transport-security"), null);
  await s.close();
});
test("API responses are no-store with a minimal CSP", async () => {
  const s = await start();
  const r = await s.fetch(s.base + "/api/clients");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get("cache-control"), "no-store");
  assert.strictEqual(r.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  await s.close();
});
test("security headers are present even on a 403", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/clients", headers: { Host: "evil.com" } });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.headers["x-content-type-options"], "nosniff");
  assert.strictEqual(r.headers["x-frame-options"], "DENY");
  await s.close();
});
test("buildCsp produces the exact policy", () => {
  assert.strictEqual(
    buildCsp({ script: ["'sha256-a'", "'sha256-b'"], style: ["'sha256-c'"] }),
    "default-src 'none'; script-src 'sha256-a' 'sha256-b'; style-src 'sha256-c'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
});

// --- detrás de Caddy ---
test("with a public https origin the proxied host works, with HSTS and Secure cookie", async () => {
  const s = await start(memoryStore(), { publicOrigin: "https://portal.ejemplo.com", login: false });
  const pub = { Host: "portal.ejemplo.com", Origin: "https://portal.ejemplo.com" };
  const login = await raw(s.port, {
    method: "POST", path: "/api/auth/login", headers: { ...pub, ...J }, body: JSON.stringify({ password: PASSWORD }),
  });
  assert.strictEqual(login.status, 204);
  const setCookie = String(login.headers["set-cookie"]);
  assert.match(setCookie, /; Secure/);
  const cookie = /nu_session=[^;]*/.exec(setCookie)[0];
  const put = await raw(s.port, {
    method: "PUT", path: "/api/clients/a", headers: { ...pub, ...J, Cookie: cookie }, body: JSON.stringify({ name: "Ana" }),
  });
  assert.strictEqual(put.status, 204);
  const page = await raw(s.port, { path: "/", headers: { Host: "portal.ejemplo.com", Cookie: cookie } });
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.headers["strict-transport-security"], "max-age=31536000");
  const evil = await raw(s.port, { path: "/", headers: { Host: "evil.com", Cookie: cookie } });
  assert.strictEqual(evil.status, 403);
  await s.close();
});
test("with a public origin, localhost keeps working and a foreign origin is rejected", async () => {
  const s = await start(memoryStore(), { publicOrigin: "https://portal.ejemplo.com" });
  assert.strictEqual((await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: "{}" })).status, 204);
  const r = await s.fetch(s.base + "/api/clients/a", { method: "PUT", headers: { ...J, Origin: "https://otro.ejemplo.com" }, body: "{}" });
  assert.strictEqual(r.status, 403);
  await s.close();
});

// En Render el proxy agrega la IP real al final de X-Forwarded-For; lo anterior lo pudo escribir quien sea
async function ipRegistrada(trustProxy) {
  const authStore = createAuthStore(fakeMongo());
  await authStore.createUser(HASH);
  const events = [];
  const app = createApp(memoryStore(), { authStore, csp: CSP, log: (e) => events.push(e), ...(trustProxy !== undefined ? { trustProxy } : {}) });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = server.address().port;
  try {
    await raw(port, {
      method: "POST", path: "/api/auth/login",
      headers: { ...J, Host: "127.0.0.1:" + port, Origin: "http://127.0.0.1:" + port, "X-Forwarded-For": "6.6.6.6, 203.0.113.9" },
      body: JSON.stringify({ password: "otra-contraseña-mala" }),
    });
  } finally {
    await new Promise((r) => { server.close(r); server.closeAllConnections(); });
  }
  return events[0].ip;
}
test("trustProxy 1 toma solo la IP que agregó el proxy, no la que inventa el cliente", async () => {
  assert.strictEqual(await ipRegistrada(1), "203.0.113.9");
});
test("trustProxy 0 ignora X-Forwarded-For", async () => {
  assert.strictEqual(await ipRegistrada(0), "127.0.0.1");
});

test("la colección blocks se guarda y se lista", async () => {
  const s = await start();
  const b = { date: "2026-11-23", endDate: "2026-11-23", start: "14:00", end: "15:00", allDay: false, reason: "Comida" };
  assert.strictEqual((await s.fetch(s.base + "/api/blocks/b1", { method: "PUT", headers: J, body: JSON.stringify(b) })).status, 204);
  const list = await (await s.fetch(s.base + "/api/blocks")).json();
  assert.deepStrictEqual(list, [{ id: "b1", ...b }]);
  await s.close();
});
