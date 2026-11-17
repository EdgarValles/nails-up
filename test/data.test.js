const test = require("node:test");
const assert = require("node:assert");

function fakeDb() {
  const cols = {};
  const listeners = {};
  let n = 0;
  const notify = (name) => {
    const docs = Object.entries(cols[name] || {}).map(([id, body]) => ({ id, data: () => body }));
    (listeners[name] || []).forEach((cb) => cb({ docs }));
  };
  return {
    subscribeCount: {},
    collection(name) {
      cols[name] = cols[name] || {};
      const self = this;
      return {
        doc(id) {
          id = id || "auto" + ++n;
          return {
            id,
            async set(body) { cols[name][id] = body; notify(name); },
            async delete() { delete cols[name][id]; notify(name); },
          };
        },
        onSnapshot(cb) {
          self.subscribeCount[name] = (self.subscribeCount[name] || 0) + 1;
          (listeners[name] = listeners[name] || []).push(cb);
          notify(name);
          return () => {};
        },
      };
    },
  };
}
function fresh() {
  delete require.cache[require.resolve("../src/data.js")];
  return require("../src/data.js");
}

test("save without id creates a document and notifies subscribers", async () => {
  const Store = fresh(); const db = fakeDb(); Store.init(db);
  let last = [];
  Store.subscribe("clients", (docs) => (last = docs));
  const id = await Store.save("clients", { name: "Ana" });
  assert.ok(id);
  assert.deepStrictEqual(last, [{ id, name: "Ana" }]);
});
test("save with id overwrites the same document", async () => {
  const Store = fresh(); const db = fakeDb(); Store.init(db);
  let last = [];
  Store.subscribe("clients", (docs) => (last = docs));
  const id = await Store.save("clients", { name: "Ana" });
  await Store.save("clients", { id, name: "Ana López" });
  assert.deepStrictEqual(last, [{ id, name: "Ana López" }]);
});
test("remove deletes and notifies", async () => {
  const Store = fresh(); const db = fakeDb(); Store.init(db);
  let last = [];
  Store.subscribe("clients", (docs) => (last = docs));
  const id = await Store.save("clients", { name: "Ana" });
  await Store.remove("clients", id);
  assert.deepStrictEqual(last, []);
});
test("subscribing twice to a collection opens one listener", () => {
  const Store = fresh(); const db = fakeDb(); Store.init(db);
  Store.subscribe("clients", () => {});
  Store.subscribe("clients", () => {});
  assert.strictEqual(db.subscribeCount.clients, 1);
});
test("seedDefaults creates settings and services once", async () => {
  const Store = fresh(); const db = fakeDb(); Store.init(db);
  let services = [], settings = [];
  Store.subscribe("services", (d) => (services = d));
  Store.subscribe("settings", (d) => (settings = d));
  await Store.seedDefaults();
  await Store.seedDefaults();
  assert.strictEqual(services.length, 3);
  assert.deepStrictEqual(settings.map((s) => s.id), ["main"]);
  assert.strictEqual(settings[0].loyaltyEvery, 6);
});
test("without a database, ready is false and save rejects with a clear message", async () => {
  const Store = fresh(); Store.init(null);
  assert.strictEqual(Store.ready, false);
  await assert.rejects(() => Store.save("clients", { name: "x" }), /No hay conexión con la base de datos/);
});
