const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createApiDb } = require("../src/api-db.js");

function fakeFetch(initial = {}) {
  const cols = JSON.parse(JSON.stringify(initial));
  const calls = [];
  const fn = async (url, opts = {}) => {
    const m = String(url).match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
    const [, col, id] = m;
    const method = opts.method || "GET";
    calls.push({ method, url, headers: opts.headers, body: opts.body });
    cols[col] = cols[col] || {};
    if (method === "GET") return { ok: true, status: 200, json: async () => Object.entries(cols[col]).map(([i, b]) => ({ id: i, ...b })) };
    if (method === "PUT") { cols[col][id] = JSON.parse(opts.body); return { ok: true, status: 204 }; }
    if (method === "DELETE") { delete cols[col][id]; return { ok: true, status: 204 }; }
    throw new Error("método inesperado");
  };
  fn.calls = calls;
  return fn;
}
const tick = () => new Promise((r) => setTimeout(r, 10));

test("onSnapshot delivers the documents from GET /api/<col>", async () => {
  const db = createApiDb("", fakeFetch({ clients: { a: { name: "Ana" } } }));
  let snap;
  db.collection("clients").onSnapshot((s) => (snap = s));
  await tick();
  assert.deepStrictEqual(snap.docs.map((d) => ({ id: d.id, ...d.data() })), [{ id: "a", name: "Ana" }]);
  assert.strictEqual(snap.metadata.fromCache, false);
});
test("doc(id).set does PUT with JSON and notifies subscribers with the new list", async () => {
  const f = fakeFetch();
  const db = createApiDb("", f);
  let snap;
  db.collection("clients").onSnapshot((s) => (snap = s));
  await tick();
  await db.collection("clients").doc("a").set({ name: "Ana" });
  await tick();
  const put = f.calls.find((c) => c.method === "PUT");
  assert.strictEqual(put.url, "/api/clients/a");
  assert.strictEqual(put.headers["Content-Type"], "application/json");
  assert.deepStrictEqual(snap.docs.map((d) => d.id), ["a"]);
});
test("doc(id).delete does DELETE and notifies", async () => {
  const f = fakeFetch({ clients: { a: { name: "Ana" } } });
  const db = createApiDb("", f);
  let snap;
  db.collection("clients").onSnapshot((s) => (snap = s));
  await tick();
  await db.collection("clients").doc("a").delete();
  await tick();
  assert.ok(f.calls.some((c) => c.method === "DELETE" && c.url === "/api/clients/a"));
  assert.strictEqual(snap.docs.length, 0);
});
test("doc() without id generates distinct valid ids", () => {
  const db = createApiDb("", fakeFetch());
  const a = db.collection("clients").doc().id, b = db.collection("clients").doc().id;
  assert.match(a, /^[a-z0-9]{20}$/);
  assert.notStrictEqual(a, b);
});
test("a network failure rejects with a Spanish message", async () => {
  const db = createApiDb("", async () => { throw new TypeError("fetch failed"); });
  await assert.rejects(() => db.collection("clients").doc("a").set({}), /No hay conexión con el servidor\. Revisa tu internet e intenta de nuevo\./);
});
test("the build includes createApiDb in dist/index.html", () => {
  const root = path.join(__dirname, "..");
  execFileSync("node", ["build.mjs"], { cwd: root });
  assert.ok(fs.readFileSync(path.join(root, "dist/index.html"), "utf8").includes("createApiDb"));
});

const MSG401 = "Tu sesión terminó. Vuelve a entrar.";
const fetch401 = async () => ({ ok: false, status: 401, json: async () => ({ error: MSG401 }) });
test("un 401 en set llama onUnauthorized una vez y rechaza con el mensaje", async () => {
  let n = 0;
  const db = createApiDb("", fetch401, { onUnauthorized: () => n++ });
  await assert.rejects(() => db.collection("clients").doc("a").set({}), new RegExp(MSG401));
  assert.strictEqual(n, 1);
});
test("un 401 en onSnapshot llama onUnauthorized y avisa al suscriptor", async () => {
  let n = 0, err;
  const db = createApiDb("", fetch401, { onUnauthorized: () => n++ });
  db.collection("clients").onSnapshot(() => {}, (e) => (err = e));
  await tick();
  assert.strictEqual(n, 1);
  assert.strictEqual(err.message, MSG401);
});
