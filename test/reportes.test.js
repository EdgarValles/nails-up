const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const clients = [{ id: "ana", name: "Ana López" }, { id: "eva", name: "Eva Ruiz" }];
const line = (name, price) => ({ serviceId: name, name, color: "#c00", price, durationMin: 30 });
const appts = [
  { id: "c1", clientId: "ana", start: "2026-11-05T10:00", status: "cobrada", method: "efectivo", total: 500, paidAt: "2026-11-05", services: [line("Gel", 350), line("Diseño", 150)] },
  { id: "c2", clientId: "ana", start: "2026-11-10T12:00", status: "cobrada", method: "transferencia", total: 300, subtotal: 300, paidAt: "2026-11-10", serviceId: "m", serviceName: "Manicure en gel", price: 250 },
  { id: "c3", clientId: "eva", start: "2026-11-12T09:00", status: "cobrada", method: "efectivo", total: 200, paidAt: "2026-11-12", services: [line("Retoque", 200)] },
  { id: "x1", clientId: "eva", start: "2026-11-11T09:00", status: "cancelada", cancelKind: "aviso", advance: 100, advanceKept: true, cancelledAt: "2026-11-10" },
  { id: "x2", clientId: "eva", start: "2026-11-14T09:00", status: "cancelada", cancelKind: "no_llego", advance: 50, advanceKept: false, cancelledAt: "2026-11-14" },
  { id: "x3", clientId: "ana", start: "2026-11-15T09:00", status: "cancelada", advance: 80 },
  { id: "p1", clientId: "ana", start: "2026-11-20T09:00", status: "pendiente", advance: 0 },
  { id: "o1", clientId: "ana", start: "2026-10-20T09:00", status: "cobrada", method: "efectivo", total: 500, paidAt: "2026-10-20", services: [line("Gel", 500)] },
];

test("incomeOn suma cobros del día y anticipos retenidos por fecha de cancelación", () => {
  assert.strictEqual(L.incomeOn(appts, "2026-11-10"), 400);
  assert.strictEqual(L.incomeOn(appts, "2026-11-14"), 0);
});

test("monthReport: ingresos, comparación y ticket promedio", () => {
  const r = L.monthReport({ appts, clients, month: "2026-11" });
  assert.strictEqual(r.income, 1100);
  assert.strictEqual(r.prevIncome, 500);
  assert.strictEqual(r.changePct, 120);
  assert.strictEqual(r.paidCount, 3);
  assert.strictEqual(r.avgTicket, 333.33);
});

test("monthReport: ventas por servicio con la línea de la cita vieja", () => {
  const r = L.monthReport({ appts, clients, month: "2026-11" });
  assert.deepStrictEqual(r.byService, [
    { name: "Gel", count: 1, amount: 350 },
    { name: "Manicure en gel", count: 1, amount: 300 },
    { name: "Retoque", count: 1, amount: 200 },
    { name: "Diseño", count: 1, amount: 150 },
  ]);
});

test("monthReport: por método cuadra con los ingresos", () => {
  const r = L.monthReport({ appts, clients, month: "2026-11" });
  assert.deepStrictEqual(r.byMethod, [
    { method: "efectivo", amount: 700 },
    { method: "transferencia", amount: 300 },
    { method: "retenidos", amount: 100 },
  ]);
  assert.strictEqual(r.byMethod.reduce((n, m) => n + m.amount, 0), r.income);
});

test("monthReport: mejores clientas, cancelaciones y anticipos retenidos", () => {
  const r = L.monthReport({ appts, clients, month: "2026-11" });
  assert.deepStrictEqual(r.topClients[0], { clientId: "ana", name: "Ana López", visits: 2, amount: 800 });
  assert.deepStrictEqual(r.topClients[1], { clientId: "eva", name: "Eva Ruiz", visits: 1, amount: 200 });
  assert.deepStrictEqual(r.cancel, { closed: 6, aviso: 2, noLlego: 1, avisoPct: 33, noLlegoPct: 17 });
  assert.deepStrictEqual(r.retained, { count: 1, amount: 100 });
});

test("monthReport: clienta borrada sale como Clienta eliminada", () => {
  const r = L.monthReport({ appts: [{ id: "z", clientId: "nadie", start: "2026-11-05T10:00", status: "cobrada", method: "efectivo", total: 90, paidAt: "2026-11-05" }], clients, month: "2026-11" });
  assert.strictEqual(r.topClients[0].name, "Clienta eliminada");
});

test("monthReport: mes sin datos", () => {
  const r = L.monthReport({ appts, clients, month: "2026-01" });
  assert.strictEqual(r.income, 0);
  assert.strictEqual(r.changePct, null);
  assert.strictEqual(r.paidCount, 0);
  assert.strictEqual(r.avgTicket, 0);
  assert.deepStrictEqual(r.byService, []);
  assert.deepStrictEqual(r.byMethod, []);
  assert.deepStrictEqual(r.topClients, []);
  assert.deepStrictEqual(r.cancel, { closed: 0, aviso: 0, noLlego: 0, avisoPct: 0, noLlegoPct: 0 });
});
