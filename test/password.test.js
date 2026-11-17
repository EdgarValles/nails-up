const test = require("node:test");
const assert = require("node:assert");
const { hashPassword, verifyPassword, validatePassword, MAX_PASSWORD } = require("../server/password.js");

test("verifyPassword acepta la correcta y rechaza otra", async () => {
  const h = await hashPassword("contraseña-segura-1");
  assert.strictEqual(await verifyPassword("contraseña-segura-1", h), true);
  assert.strictEqual(await verifyPassword("otra-contraseña-2", h), false);
});

test("hashPassword usa sal distinta y el formato esperado", async () => {
  const a = await hashPassword("misma-contraseña-1");
  const b = await hashPassword("misma-contraseña-1");
  assert.notStrictEqual(a, b);
  assert.ok(a.startsWith("scrypt$16384$8$1$"));
  assert.ok(b.startsWith("scrypt$16384$8$1$"));
});

test("validatePassword aplica mínimo y máximo", () => {
  assert.strictEqual(MAX_PASSWORD, 1024);
  assert.strictEqual(validatePassword("a".repeat(11)), false);
  assert.strictEqual(validatePassword("a".repeat(12)), true);
  assert.strictEqual(validatePassword("a".repeat(1024)), true);
  assert.strictEqual(validatePassword("a".repeat(1025)), false);
  assert.strictEqual(validatePassword(12345678901234), false);
});

test("verifyPassword devuelve false con formatos inválidos sin lanzar", async () => {
  assert.strictEqual(await verifyPassword("x", "basura"), false);
  assert.strictEqual(await verifyPassword("x", ""), false);
  assert.strictEqual(await verifyPassword("x", "scrypt$1$1$1$AA$AA"), false);
  assert.strictEqual(await verifyPassword("x", undefined), false);
});
