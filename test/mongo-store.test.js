const test = require("node:test");
const assert = require("node:assert");
const { createMongoStore, redactUri } = require("../server/mongo-store.js");
const { ID_RE } = require("../server/app.js");

function fakeDb() {
  const cols = {};
  const get = (n) => (cols[n] = cols[n] || new Map());
  return {
    cols,
    collection(name) {
      const c = get(name);
      return {
        find: () => ({ toArray: async () => [...c.values()] }),
        replaceOne: async (f, doc) => { c.set(f._id, { ...doc }); },
        insertOne: async (doc) => { c.set(doc._id, { ...doc }); },
        deleteOne: async (f) => { c.delete(f._id); },
      };
    },
  };
}

test("list returns documents with id instead of _id", async () => {
  const db = fakeDb();
  const store = createMongoStore(db);
  await store.put("clients", "a", { name: "Ana" });
  assert.deepStrictEqual(await store.list("clients"), [{ id: "a", name: "Ana" }]);
});
test("put stores under the given id and drops id/_id from the body", async () => {
  const db = fakeDb();
  const store = createMongoStore(db);
  await store.put("clients", "real", { id: "otro", _id: "x", name: "Ana" });
  assert.deepStrictEqual([...db.cols.clients.entries()], [["real", { _id: "real", name: "Ana" }]]);
});
test("add returns a valid generated id", async () => {
  const store = createMongoStore(fakeDb());
  const id = await store.add("services", { name: "Retoque" });
  assert.match(id, ID_RE);
  assert.ok(id.length >= 20 && id.length <= 24);
  assert.strictEqual((await store.list("services"))[0].id, id);
});
test("remove deletes by id", async () => {
  const store = createMongoStore(fakeDb());
  await store.put("clients", "a", { name: "Ana" });
  await store.remove("clients", "a");
  assert.deepStrictEqual(await store.list("clients"), []);
});
test("redactUri hides credentials", () => {
  assert.strictEqual(redactUri("mongodb://user:secreto@localhost:27017/x"), "mongodb://localhost:27017/x");
  assert.ok(!redactUri("mongodb+srv://u:p%40ss@cluster0.abc.mongodb.net").includes("p%40ss"));
  assert.strictEqual(redactUri("mongodb://localhost:27017"), "mongodb://localhost:27017");
});
