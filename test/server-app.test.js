const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { createApp } = require("../server/app.js");

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
async function start(store = memoryStore()) {
  const app = createApp(store);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const port = server.address().port;
  return { port, base: "http://127.0.0.1:" + port, close: () => new Promise((r) => { server.close(r); server.closeAllConnections(); }) };
}
function raw(port, { method = "GET", path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let data = ""; res.on("data", (d) => (data += d)); res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject); if (body) req.write(body); req.end();
  });
}
const J = { "Content-Type": "application/json" };

test("PUT then GET returns the stored document with its id", async () => {
  const s = await start();
  assert.strictEqual((await fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ name: "Ana" }) })).status, 204);
  const list = await (await fetch(s.base + "/api/clients")).json();
  assert.deepStrictEqual(list, [{ id: "a", name: "Ana" }]);
  await s.close();
});
test("POST returns a new id and the document is listed", async () => {
  const s = await start();
  const r = await fetch(s.base + "/api/services", { method: "POST", headers: J, body: JSON.stringify({ name: "Retoque" }) });
  assert.strictEqual(r.status, 201);
  const { id } = await r.json();
  assert.ok(id);
  assert.strictEqual((await (await fetch(s.base + "/api/services")).json())[0].id, id);
  await s.close();
});
test("DELETE removes the document", async () => {
  const s = await start();
  await fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ name: "Ana" }) });
  assert.strictEqual((await fetch(s.base + "/api/clients/a", { method: "DELETE" })).status, 204);
  assert.deepStrictEqual(await (await fetch(s.base + "/api/clients")).json(), []);
  await s.close();
});
test("unknown collection is rejected with 400", async () => {
  const s = await start();
  assert.strictEqual((await fetch(s.base + "/api/users")).status, 400);
  await s.close();
});
test("ids with odd characters are rejected with 400", async () => {
  const s = await start();
  for (const id of ["a$b", "a%20b", "a.b", "a%2Fb", "x".repeat(65)]) {
    const r = await fetch(s.base + "/api/clients/" + id, { method: "PUT", headers: J, body: "{}" });
    assert.strictEqual(r.status, 400, id);
  }
  await s.close();
});
test("PUT without JSON content type is rejected with 415", async () => {
  const s = await start();
  const r = await fetch(s.base + "/api/clients/a", { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "{}" });
  assert.strictEqual(r.status, 415);
  await s.close();
});
test("a foreign Host header is rejected with 403 (DNS rebinding)", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/clients", headers: { Host: "evil.com" } });
  assert.strictEqual(r.status, 403);
  await s.close();
});
test("a request with a foreign Origin is rejected with 403", async () => {
  const s = await start();
  const r = await raw(s.port, { path: "/api/clients", headers: { Host: "127.0.0.1:" + s.port, Origin: "http://evil.com" } });
  assert.strictEqual(r.status, 403);
  await s.close();
});
test("an id or _id inside the body cannot change the document id", async () => {
  const store = memoryStore();
  const s = await start(store);
  await fetch(s.base + "/api/clients/real", { method: "PUT", headers: J, body: JSON.stringify({ id: "otro", _id: "x", name: "Ana" }) });
  const list = await store.list("clients");
  assert.deepStrictEqual(list, [{ id: "real", name: "Ana" }]);
  await s.close();
});
test("a body over 256 KB is rejected with 413", async () => {
  const s = await start();
  const r = await fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: JSON.stringify({ x: "a".repeat(300 * 1024) }) });
  assert.strictEqual(r.status, 413);
  await s.close();
});
test("a store failure returns 500 with a Spanish message", async () => {
  const store = { ...memoryStore(), put: async () => { throw new Error("boom"); } };
  const s = await start(store);
  const r = await fetch(s.base + "/api/clients/a", { method: "PUT", headers: J, body: "{}" });
  assert.strictEqual(r.status, 500);
  assert.match((await r.json()).error, /No se pudo guardar/);
  await s.close();
});
test("GET / serves the built page as html", async () => {
  require("node:child_process").execFileSync("node", ["build.mjs"], { cwd: require("node:path").join(__dirname, "..") });
  const s = await start();
  const r = await fetch(s.base + "/");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/html/);
  await s.close();
});
