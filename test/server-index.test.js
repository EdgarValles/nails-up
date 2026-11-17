const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeMongo } = require("./helpers/fake-mongo");
const { createAuthStore } = require("../server/auth-store");
const { hashPassword } = require("../server/password");
const { start } = require("../server/index");

test("start sin usuaria rechaza con instrucciones", async () => {
  await assert.rejects(
    start({ db: fakeMongo(), env: { PORT: "0" }, csp: {} }),
    { message: "Crea la usuaria con: node server/cli.js crear-usuaria" }
  );
});

test("start con usuaria escucha solo en 127.0.0.1", async () => {
  const db = fakeMongo();
  await createAuthStore(db).createUser(await hashPassword("contraseña-larga-1"));
  const csp = { "index.html": { script: [], style: [] }, "login.html": { script: [], style: [] } };
  const server = await start({ db, env: { PORT: "0" }, csp });
  try {
    assert.equal(server.address().address, "127.0.0.1");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
