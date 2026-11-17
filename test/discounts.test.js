const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const settings = { loyaltyEvery: 6, loyaltyPercent: 15, inactiveWeeks: 5 };
const client = { id: "c1", name: "Ana", phone: "5512345678" };
const base = { client, paidVisits: 0, promos: [], settings, today: "2026-11-17", subtotal: 400 };

test("paidVisitCount counts only cobrada appointments", () => {
  const appts = [
    { clientId: "c1", status: "cobrada" },
    { clientId: "c1", status: "cancelada" },
    { clientId: "c1", status: "pendiente" },
    { clientId: "c2", status: "cobrada" },
  ];
  assert.strictEqual(L.paidVisitCount("c1", appts), 1);
});
test("loyalty applies on the 6th visit", () => {
  const r = L.suggestDiscount({ ...base, paidVisits: 5 });
  assert.strictEqual(r.kind, "lealtad");
  assert.strictEqual(r.amount, 60);
});
test("no loyalty before the 6th visit", () => {
  assert.strictEqual(L.suggestDiscount({ ...base, paidVisits: 4 }).kind, "ninguno");
});
test("seasonal promo is inclusive at both ends and wraps the year", () => {
  const promo = { id: "p", name: "Fin de año", type: "temporada", percent: 20, startDate: "2026-12-20", endDate: "2027-01-05", active: true };
  const at = (today) => L.suggestDiscount({ ...base, promos: [promo], today }).kind;
  assert.strictEqual(at("2026-12-31"), "temporada");
  assert.strictEqual(at("2027-01-05"), "temporada");
  assert.strictEqual(at("2026-12-20"), "temporada");
  assert.strictEqual(at("2027-01-06"), "ninguno");
});
test("birthday promo applies during the birthday month", () => {
  const promo = { id: "b", name: "Cumple", type: "cumpleanos", percent: 10, active: true };
  const r = L.suggestDiscount({ ...base, client: { ...client, birthday: "11-30" }, promos: [promo] });
  assert.strictEqual(r.kind, "cumpleanos");
  assert.strictEqual(r.amount, 40);
});
test("birthday promo does not apply without a birthday", () => {
  const promo = { id: "b", name: "Cumple", type: "cumpleanos", percent: 10, active: true };
  assert.strictEqual(L.suggestDiscount({ ...base, promos: [promo] }).kind, "ninguno");
});
test("the highest discount wins and discounts never add up", () => {
  const promo = { id: "p", name: "Buen Fin", type: "temporada", percent: 20, startDate: "2026-11-01", endDate: "2026-11-30", active: true };
  const r = L.suggestDiscount({ ...base, paidVisits: 5, promos: [promo] });
  assert.strictEqual(r.kind, "temporada");
  assert.strictEqual(r.amount, 80);
});
test("inactive promos are ignored", () => {
  const promo = { id: "p", name: "x", type: "temporada", percent: 20, startDate: "2026-11-01", endDate: "2026-11-30", active: false };
  assert.strictEqual(L.suggestDiscount({ ...base, promos: [promo] }).kind, "ninguno");
});
test("computeCharge never goes below zero", () => {
  assert.deepStrictEqual(L.computeCharge({ subtotal: 500, discountAmount: 600, advance: 100 }), { total: 0, balance: 0 });
});
test("computeCharge subtracts discount and advance", () => {
  assert.deepStrictEqual(L.computeCharge({ subtotal: 500, discountAmount: 50, advance: 200 }), { total: 450, balance: 250 });
  assert.deepStrictEqual(L.computeCharge({ subtotal: 300, discountAmount: 0, advance: 500 }), { total: 300, balance: 0 });
});
