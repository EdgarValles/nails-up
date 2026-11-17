const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { fakeMongo } = require("./helpers/fake-mongo");
const {
  createAuthStore, sessionValid, applyFailure,
  IDLE_MS, MAX_MS, TOUCH_MS, LOCK_AFTER, LOCK_BASE_MS, LOCK_MAX_MS,
} = require("../server/auth-store");

const T0 = Date.UTC(2026, 0, 1);
function setup() {
  const db = fakeMongo();
  const clock = { t: T0 };
  const store = createAuthStore(db, { now: () => clock.t });
  return { db, clock, store };
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

test("createSession guarda solo el hash del token", async () => {
  const { db, store } = setup();
  await store.createUser("h");
  const token = await store.createSession();
  assert.equal(token.length, 43);
  const doc = await db.collection("sessions").findOne({ _id: sha(token) });
  assert.ok(doc);
  assert.equal(await db.collection("sessions").findOne({ _id: token }), null);
  assert.ok(doc.createdAt instanceof Date);
  assert.equal((await store.findSession(token))._id, sha(token));
});

test("sesión sin uso por más de 7 días expira y se borra", async () => {
  const { db, clock, store } = setup();
  await store.createUser("h");
  const token = await store.createSession();
  clock.t += IDLE_MS + 1;
  assert.equal(await store.findSession(token), null);
  assert.equal(await db.collection("sessions").findOne({ _id: sha(token) }), null);
});

test("uso cada 6 días: válida hasta 30 días exactos, nula un ms después", async () => {
  const { clock, store } = setup();
  await store.createUser("h");
  const token = await store.createSession();
  for (let i = 0; i < 5; i++) {
    clock.t += 6 * 864e5;
    assert.ok(await store.findSession(token));
  }
  clock.t = T0 + MAX_MS;
  assert.ok(await store.findSession(token));
  clock.t = T0 + MAX_MS + 1;
  assert.equal(await store.findSession(token), null);
});

test("cambiar la contraseña invalida sesiones anteriores", async () => {
  const { clock, store } = setup();
  await store.createUser("h");
  const token = await store.createSession();
  clock.t += 1000;
  await store.setPassword("h2");
  assert.equal(await store.findSession(token), null);
});

test("setPassword reinicia contadores y bloqueo", async () => {
  const { clock, store } = setup();
  await store.createUser("h");
  for (let i = 0; i < 5; i++) await store.recordFailure();
  clock.t += 5;
  await store.setPassword("h2");
  const u = await store.getUser();
  assert.equal(u.passwordHash, "h2");
  assert.equal(u.failedCount, 0);
  assert.equal(u.lockCount, 0);
  assert.equal(u.lockedUntil, null);
  assert.equal(u.passwordChangedAt.getTime(), clock.t);
});

test("lastSeenAt se actualiza como máximo una vez por minuto", async () => {
  const { clock, store } = setup();
  await store.createUser("h");
  const token = await store.createSession();
  clock.t += 30000;
  assert.equal((await store.findSession(token)).lastSeenAt.getTime(), T0);
  clock.t = T0 + TOUCH_MS + 1000;
  await store.findSession(token);
  assert.equal((await store.findSession(token)).lastSeenAt.getTime(), T0 + TOUCH_MS + 1000);
});

test("tokens inválidos devuelven null sin tocar la base", async () => {
  const store = createAuthStore({ collection() { throw new Error("no debe tocarse"); } });
  assert.equal(await store.findSession(undefined), null);
  assert.equal(await store.findSession(""), null);
  assert.equal(await store.findSession(42), null);
  assert.equal(await store.findSession("x".repeat(101)), null);
});

test("applyFailure: bloqueo tras 5 fallos y crece hasta 24 h", () => {
  let u = { failedCount: 0, lockCount: 0, lockedUntil: null };
  for (let i = 0; i < LOCK_AFTER - 1; i++) {
    u = { ...u, ...applyFailure(u, T0) };
    assert.equal(u.lockedUntil, null);
  }
  u = { ...u, ...applyFailure(u, T0) };
  assert.equal(u.lockedUntil.getTime(), T0 + LOCK_BASE_MS);
  assert.equal(u.lockCount, 1);
  assert.equal(u.failedCount, 0);
  u = { ...u, failedCount: 4 };
  assert.equal(applyFailure(u, T0).lockedUntil.getTime(), T0 + 30 * 60000);
  u = { ...u, failedCount: 4, lockCount: 2 };
  assert.equal(applyFailure(u, T0).lockedUntil.getTime(), T0 + 60 * 60000);
  u = { ...u, failedCount: 4, lockCount: 10 };
  assert.equal(applyFailure(u, T0).lockedUntil.getTime(), T0 + LOCK_MAX_MS);
});

test("sessionValid con usuaria null es false", () => {
  const s = { createdAt: new Date(T0), lastSeenAt: new Date(T0) };
  assert.equal(sessionValid(s, null, T0), false);
});

test("createUser dos veces lanza error", async () => {
  const { store } = setup();
  await store.createUser("h");
  await assert.rejects(() => store.createUser("h"), /Ya existe una usuaria\./);
});

test("recordFailure, resetFailures y unlock", async () => {
  const { store } = setup();
  await store.createUser("h");
  for (let i = 0; i < 5; i++) await store.recordFailure();
  let u = await store.getUser();
  assert.ok(u.lockedUntil instanceof Date);
  assert.equal(u.lockCount, 1);
  await store.unlock();
  u = await store.getUser();
  assert.equal(u.lockedUntil, null);
  assert.equal(u.failedCount, 0);
  await store.recordFailure();
  assert.equal((await store.getUser()).failedCount, 1);
  await store.resetFailures();
  assert.equal((await store.getUser()).failedCount, 0);
});

test("deleteSession y deleteAllSessions", async () => {
  const { store } = setup();
  await store.createUser("h");
  const a = await store.createSession();
  await store.createSession();
  await store.deleteSession(a);
  assert.equal(await store.findSession(a), null);
  await store.createSession();
  assert.equal(await store.deleteAllSessions(), 2);
});

test("ensureIndexes crea los índices TTL", async () => {
  const { db, store } = setup();
  await store.ensureIndexes();
  const ttl = (field) => db.indexes.find((i) => i.collection === "sessions" && i.spec[field] === 1);
  assert.equal(ttl("lastSeenAt").opts.expireAfterSeconds, 604800);
  assert.equal(ttl("createdAt").opts.expireAfterSeconds, 2592000);
});

test("recordFailure en paralelo no pierde intentos", async () => {
  const { clock, store } = setup();
  await store.createUser("h");
  await Promise.all([1, 2, 3, 4, 5].map(() => store.recordFailure()));
  const u = await store.getUser();
  assert.equal(u.lockCount, 1);
  assert.equal(u.lockedUntil.getTime(), clock.t + LOCK_BASE_MS);
});

test("recordFailure sin usuaria devuelve null", async () => {
  const { store } = setup();
  assert.equal(await store.recordFailure(), null);
});
