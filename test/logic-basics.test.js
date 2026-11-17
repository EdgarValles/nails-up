const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

test("formatMXN formats pesos with thousands and cents", () => {
  assert.ok(L.formatMXN(1234.5).includes("1,234.50"));
});
test("normalizePhone strips country code and symbols", () => {
  assert.strictEqual(L.normalizePhone("+52 55-1234-5678"), "5512345678");
  assert.strictEqual(L.normalizePhone("55 1234 5678"), "5512345678");
});
test("normalizePhone returns empty for invalid numbers", () => {
  assert.strictEqual(L.normalizePhone("123"), "");
  assert.strictEqual(L.normalizePhone(undefined), "");
});
test("whatsappLink builds a wa.me link", () => {
  assert.strictEqual(L.whatsappLink("55 1234 5678", "Hola Ana"), "https://wa.me/525512345678?text=Hola%20Ana");
});
test("whatsappLink is empty without a valid phone", () => {
  assert.strictEqual(L.whatsappLink("", "x"), "");
});
test("appointmentsOverlap detects overlap", () => {
  const a = { start: "2026-11-17T10:00", durationMin: 60 };
  assert.strictEqual(L.appointmentsOverlap(a, { start: "2026-11-17T10:30", durationMin: 30 }), true);
});
test("appointmentsOverlap allows back-to-back appointments", () => {
  const a = { start: "2026-11-17T10:00", durationMin: 60 };
  assert.strictEqual(L.appointmentsOverlap(a, { start: "2026-11-17T11:00", durationMin: 30 }), false);
});
test("dateKey uses Mexico City date", () => {
  // 2026-11-18T05:30Z is still Nov 17 at 23:30 in Mexico City (UTC-6)
  assert.strictEqual(L.dateKey(new Date("2026-11-18T05:30:00Z")), "2026-11-17");
});
