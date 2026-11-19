const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const gel = { serviceId: "s1", name: "Gel", color: "#c00", price: 350, durationMin: 45 };
const diseno = { serviceId: "s2", name: "Diseño", color: "#0c0", price: 120, durationMin: 30 };

test("serviceLine copia el servicio del catálogo y pone 0 si falta el precio", () => {
  assert.deepStrictEqual(L.serviceLine({ id: "s1", name: "Gel", color: "#c00", price: 350, durationMin: 45 }), { ...gel, qty: 1 });
  assert.strictEqual(L.serviceLine({ id: "s1", name: "Gel", color: "#c00", durationMin: 45 }).price, 0);
});

test("apptServices lee una cita vieja como una línea", () => {
  const vieja = { serviceId: "s1", serviceName: "Gel", serviceColor: "#c00", price: 300, durationMin: 45 };
  assert.deepStrictEqual(L.apptServices(vieja), [{ serviceId: "s1", name: "Gel", color: "#c00", price: 300, durationMin: 45 }]);
  assert.strictEqual(L.apptServices({ serviceId: "s1", serviceName: "Gel", durationMin: 45 })[0].price, 0);
});

test("apptServices devuelve una copia de la lista de la cita", () => {
  const cita = { services: [gel, diseno] };
  const r = L.apptServices(cita);
  assert.deepStrictEqual(r, [gel, diseno]);
  r[0].price = 1; r.push(gel);
  assert.strictEqual(cita.services.length, 2);
  assert.strictEqual(cita.services[0].price, 350);
});

test("apptServices de una cita sin servicio es vacía", () => {
  assert.deepStrictEqual(L.apptServices({}), []);
});

test("servicesTotals suma precio y duración", () => {
  assert.deepStrictEqual(L.servicesTotals([gel, diseno]), { price: 470, durationMin: 75 });
  assert.deepStrictEqual(L.servicesTotals([]), { price: 0, durationMin: 0 });
});

test("servicesSummary: nombre del primero y + N", () => {
  assert.strictEqual(L.servicesSummary([gel]), "Gel");
  assert.strictEqual(L.servicesSummary([gel, diseno, diseno]), "Gel + 2");
  assert.strictEqual(L.servicesSummary([]), "");
});

test("withServices guarda la lista y los campos de compatibilidad", () => {
  const r = L.withServices({ id: "a", status: "pendiente" }, [gel, diseno]);
  assert.strictEqual(r.id, "a");
  assert.strictEqual(r.status, "pendiente");
  assert.deepStrictEqual(r.services, [gel, diseno]);
  assert.strictEqual(r.serviceId, "s1");
  assert.strictEqual(r.serviceColor, "#c00");
  assert.strictEqual(r.serviceName, "Gel + 1");
  assert.strictEqual(r.price, 470);
});

test("formatDuration en horas y minutos", () => {
  assert.strictEqual(L.formatDuration(45), "45 min");
  assert.strictEqual(L.formatDuration(60), "1 h");
  assert.strictEqual(L.formatDuration(90), "1 h 30 min");
  assert.strictEqual(L.formatDuration(0), "0 min");
});

test("apptServices de una cita vieja cobrada usa el precio cobrado", () => {
  const vieja = { serviceId: "s1", serviceName: "Gel", serviceColor: "#c00", price: 300, subtotal: 450, status: "cobrada", durationMin: 45 };
  assert.strictEqual(L.apptServices(vieja)[0].price, 450);
  assert.strictEqual(L.apptServices({ ...vieja, status: "pendiente" })[0].price, 300);
});
