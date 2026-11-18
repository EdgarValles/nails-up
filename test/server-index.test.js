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

test("loadCsp sin csp.json explica que falta construir", () => {
  const os = require("node:os");
  const { loadCsp } = require("../server/index");
  assert.throws(() => loadCsp(os.tmpdir() + "/no-existe-nails-up"), { message: "Falta la página construida. Corre npm run build y vuelve a intentar." });
});

test("start escucha en HOST cuando se indica (Render usa 0.0.0.0)", async () => {
  const db = fakeMongo();
  await createAuthStore(db).createUser(await hashPassword("contraseña-larga-1"));
  const csp = { "index.html": { script: [], style: [] }, "login.html": { script: [], style: [] } };
  const server = await start({ db, env: { PORT: "0", HOST: "0.0.0.0" }, csp });
  try {
    assert.equal(server.address().address, "0.0.0.0");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("parseTrustProxy: vacío es loopback, un número son saltos y lo demás se rechaza", () => {
  const { parseTrustProxy } = require("../server/index");
  assert.equal(parseTrustProxy(undefined), "loopback");
  assert.equal(parseTrustProxy(""), "loopback");
  assert.equal(parseTrustProxy("1"), 1);
  assert.equal(parseTrustProxy("0"), 0);
  for (const v of ["true", "-1", "1.5", "todos"]) {
    assert.throws(() => parseTrustProxy(v), { message: "TRUST_PROXY debe ser un número de saltos (por ejemplo 1) o quedar vacío." });
  }
});
