const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const deco = { id: "d", name: "Decoración", color: "#c00", price: 30, durationMin: 5, perUnit: true, unitLabel: "uña", maxUnits: 10 };
const gel = { serviceId: "g", name: "Gel", color: "#0c0", price: 350, durationMin: 45 };

test("serviceLine copia la unidad y empieza en cantidad 1", () => {
  const l = L.serviceLine(deco);
  assert.strictEqual(l.qty, 1);
  assert.strictEqual(l.unitLabel, "uña");
  assert.strictEqual(l.maxUnits, 10);
  const u = L.serviceLine({ id: "g", name: "Gel", color: "#0c0", price: 350, durationMin: 45 });
  assert.strictEqual(u.qty, 1);
  assert.strictEqual(u.unitLabel, undefined);
});

test("lineTotal multiplica precio y duración por la cantidad", () => {
  assert.deepStrictEqual(L.lineTotal({ price: 30, durationMin: 5, qty: 4 }), { price: 120, durationMin: 20, qty: 4 });
  assert.deepStrictEqual(L.lineTotal({ price: 30, durationMin: 5 }), { price: 30, durationMin: 5, qty: 1 });
  assert.strictEqual(L.lineTotal({ price: 30, durationMin: 5, qty: 0 }).qty, 1);
  assert.strictEqual(L.lineTotal({ price: 30, durationMin: 5, qty: "x" }).qty, 1);
});

test("servicesTotals usa los totales de línea y no cambia líneas viejas", () => {
  assert.deepStrictEqual(L.servicesTotals([gel, { ...L.serviceLine(deco), qty: 4 }]), { price: 470, durationMin: 65 });
  assert.deepStrictEqual(L.servicesTotals([gel]), { price: 350, durationMin: 45 });
});

test("unitText pone el plural", () => {
  assert.strictEqual(L.unitText(1, "uña"), "1 uña");
  assert.strictEqual(L.unitText(4, "uña"), "4 uñas");
  assert.strictEqual(L.unitText(2, "flor"), "2 flores");
});

test("monthReport suma unidades por servicio", () => {
  const d = (q) => ({ ...L.serviceLine(deco), qty: q });
  const appts = [
    { id: "a", clientId: "c", start: "2026-11-05T10:00", status: "cobrada", method: "efectivo", total: 470, paidAt: "2026-11-05", services: [gel, d(4)] },
    { id: "b", clientId: "c", start: "2026-11-06T10:00", status: "cobrada", method: "efectivo", total: 60, paidAt: "2026-11-06", services: [d(2)] },
  ];
  const r = L.monthReport({ appts, clients: [], month: "2026-11" });
  assert.deepStrictEqual(r.byService.find((x) => x.name === "Decoración"), { name: "Decoración", count: 6, amount: 180, unitLabel: "uña" });
  assert.deepStrictEqual(r.byService.find((x) => x.name === "Gel"), { name: "Gel", count: 1, amount: 350 });
});

test("nextLines repite los servicios cobrados con precio de catálogo y la misma cantidad", () => {
  const services = [{ ...deco, price: 35 }, { id: "g", name: "Gel", color: "#0c0", price: 400, durationMin: 45 }];
  const cobradas = [{ ...gel, price: 300 }, { ...L.serviceLine(deco), price: 25, qty: 4 }, { serviceId: "borrado", name: "Viejo", price: 50, durationMin: 10 }];
  const r = L.nextLines(cobradas, services);
  assert.strictEqual(r[0].price, 400);
  assert.strictEqual(r[1].price, 35);
  assert.strictEqual(r[1].qty, 4);
  assert.strictEqual(r[2].name, "Viejo");
  // si el máximo bajó en el catálogo, no lo pasa
  assert.strictEqual(L.nextLines([{ ...L.serviceLine(deco), qty: 9 }], [{ ...deco, maxUnits: 5 }])[0].qty, 5);
  // si ya no es por unidad, vale 1
  assert.strictEqual(L.nextLines([{ ...L.serviceLine(deco), qty: 4 }], [{ ...deco, perUnit: false }])[0].qty, 1);
});
