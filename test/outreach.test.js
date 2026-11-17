const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const clients = [
  { id: "a", name: "Ana", phone: "55 1234 5678" },
  { id: "b", name: "Beto", phone: "5599998888" },
  { id: "c", name: "Cris", phone: "5511112222" },
  { id: "d", name: "Dani", phone: "5533334444" },
];
const appts = [
  { clientId: "a", status: "cobrada", start: "2026-10-06T10:00" }, // ~6 semanas
  { clientId: "b", status: "cobrada", start: "2026-11-03T10:00" }, // 2 semanas
  { clientId: "d", status: "cobrada", start: "2026-09-01T10:00" }, // ~11 semanas
  { clientId: "c", status: "cancelada", start: "2026-08-01T10:00" }, // sin visitas cobradas
];

test("inactiveClients lists clients away for the configured weeks, longest first", () => {
  const r = L.inactiveClients(clients, appts, "2026-11-17", 5);
  assert.deepStrictEqual(r.map((x) => x.client.id), ["d", "a"]);
  assert.strictEqual(r[1].weeksAway, 6);
  assert.strictEqual(r[1].lastVisit, "2026-10-06");
});
test("inactiveClients never includes clients without paid visits", () => {
  const r = L.inactiveClients(clients, appts, "2026-11-17", 1);
  assert.ok(!r.some((x) => x.client.id === "c"));
});
test("reactivationMessage greets by first name", () => {
  assert.ok(L.reactivationMessage({ name: "Ana López" }).includes("Ana"));
});
test("promoText includes name, percent and end date in dd/mm/yyyy", () => {
  const t = L.promoText({ name: "Fin de año", percent: 20, startDate: "2026-12-20", endDate: "2026-12-31" }, "Nails Up");
  assert.ok(t.includes("Nails Up"));
  assert.ok(t.includes("20%"));
  assert.ok(t.includes("31/12/2026"));
});
test("promoText works for promos without dates", () => {
  const t = L.promoText({ name: "Cumpleaños", percent: 10 }, "Nails Up");
  assert.ok(t.includes("10%"));
});
test("findClientByPhone matches different phone formats", () => {
  assert.strictEqual(L.findClientByPhone(clients, "+52 55-1234-5678").id, "a");
  assert.strictEqual(L.findClientByPhone(clients, "123"), undefined);
});
