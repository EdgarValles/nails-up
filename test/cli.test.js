const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeMongo } = require("./helpers/fake-mongo");
const { createAuthStore } = require("../server/auth-store");
const { runCommand } = require("../server/cli");

function setup(answers = []) {
  const db = fakeMongo();
  const clock = { t: Date.UTC(2026, 0, 1) };
  const authStore = createAuthStore(db, { now: () => clock.t });
  const out = [];
  const queue = [...answers];
  const io = { authStore, readPassword: async () => queue.shift(), print: (m) => out.push(m) };
  return { db, clock, authStore, out, io };
}
const PW = "contraseña-larga-1";

test("crear-usuaria crea la usuaria", async () => {
  const { io, out, authStore } = setup([PW, PW]);
  await runCommand("crear-usuaria", io);
  assert.deepEqual(out, ["Usuaria creada."]);
  assert.ok(await authStore.getUser());
});

test("crear-usuaria con contraseñas distintas falla", async () => {
  const { io } = setup([PW, PW + "x"]);
  await assert.rejects(runCommand("crear-usuaria", io), { message: "Las contraseñas no coinciden." });
});

test("crear-usuaria con contraseña corta falla", async () => {
  const { io, authStore } = setup(["corta", "corta"]);
  await assert.rejects(runCommand("crear-usuaria", io), { message: "La contraseña debe tener al menos 12 caracteres." });
  assert.equal(await authStore.getUser(), null);
});

test("crear-usuaria con usuaria existente falla", async () => {
  const { io, authStore } = setup([PW, PW]);
  await authStore.createUser("h");
  await assert.rejects(runCommand("crear-usuaria", io), { message: "Ya existe una usuaria. Usa cambiar-contraseña." });
});

test("cambiar-contraseña invalida las sesiones", async () => {
  const { io, out, authStore, clock } = setup(["otra-contraseña-2", "otra-contraseña-2"]);
  await authStore.createUser("h");
  const token = await authStore.createSession();
  clock.t += 1000;
  await runCommand("cambiar-contraseña", io);
  assert.deepEqual(out, ["Contraseña cambiada."]);
  assert.equal(await authStore.findSession(token), null);
});

test("cambiar-contraseña sin usuaria falla", async () => {
  const { io } = setup(["otra-contraseña-2", "otra-contraseña-2"]);
  await assert.rejects(runCommand("cambiar-contraseña", io), { message: "No existe la usuaria. Usa crear-usuaria." });
});

test("cerrar-sesiones cuenta las sesiones", async () => {
  const { io, out, authStore } = setup();
  await authStore.createUser("h");
  await authStore.createSession();
  await authStore.createSession();
  await runCommand("cerrar-sesiones", io);
  assert.deepEqual(out, ["Se cerraron 2 sesiones."]);
});

test("desbloquear limpia el bloqueo", async () => {
  const { io, out, authStore, db } = setup();
  await authStore.createUser("h");
  await db.collection("users").updateOne({ _id: "owner" }, { $set: { failedCount: 5, lockedUntil: new Date() } });
  await runCommand("desbloquear", io);
  const u = await authStore.getUser();
  assert.equal(u.lockedUntil, null);
  assert.equal(u.failedCount, 0);
  assert.deepEqual(out, ["Cuenta desbloqueada."]);
});

test("comando desconocido imprime el uso", async () => {
  const { io, out } = setup();
  await runCommand("nada", io);
  const text = out.join("\n");
  for (const c of ["crear-usuaria", "cambiar-contraseña", "cerrar-sesiones", "desbloquear"]) assert.ok(text.includes(c), c);
});
