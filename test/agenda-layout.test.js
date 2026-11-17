const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const cita = (id, hhmm, dur, status = "pendiente") => ({ id, start: "2026-11-17T" + hhmm, durationMin: dur, status });

test("layoutDay usa 9 a 20 h cuando no hay citas", () => {
  const r = L.layoutDay([]);
  assert.strictEqual(r.startMin, 9 * 60);
  assert.strictEqual(r.endMin, 20 * 60);
  assert.deepStrictEqual(r.items, []);
});
test("layoutDay ubica cada cita por minuto de inicio y duración", () => {
  const r = L.layoutDay([cita("a", "10:00", 45), cita("b", "13:30", 30)]);
  const a = r.items.find((x) => x.appt.id === "a"), b = r.items.find((x) => x.appt.id === "b");
  assert.strictEqual(a.top, 60);
  assert.strictEqual(a.height, 45);
  assert.strictEqual(b.top, 270);
  assert.strictEqual(b.height, 30);
  assert.strictEqual(a.lanes, 1);
});
test("layoutDay amplía el rango a horas completas si hay citas fuera de 9 a 20", () => {
  const r = L.layoutDay([cita("a", "07:30", 30), cita("b", "20:15", 60)]);
  assert.strictEqual(r.startMin, 7 * 60);
  assert.strictEqual(r.endMin, 22 * 60);
});
test("layoutDay pone en carriles distintos las citas que se empalman", () => {
  const r = L.layoutDay([cita("a", "10:00", 60), cita("b", "10:30", 60), cita("c", "12:00", 30)]);
  const by = Object.fromEntries(r.items.map((x) => [x.appt.id, x]));
  assert.strictEqual(by.a.lanes, 2);
  assert.strictEqual(by.b.lanes, 2);
  assert.notStrictEqual(by.a.lane, by.b.lane);
  assert.strictEqual(by.c.lanes, 1);
  assert.strictEqual(by.c.lane, 0);
});
test("layoutDay da altura mínima de 20 minutos y 30 si falta la duración", () => {
  const r = L.layoutDay([cita("a", "10:00", 10), { id: "b", start: "2026-11-17T11:00", status: "pendiente" }]);
  const by = Object.fromEntries(r.items.map((x) => [x.appt.id, x]));
  assert.strictEqual(by.a.height, 20);
  assert.strictEqual(by.b.height, 30);
});
test("layoutDay no reserva carril para canceladas que se empalman", () => {
  const r = L.layoutDay([cita("a", "10:00", 60), cita("x", "10:00", 60, "cancelada")]);
  const by = Object.fromEntries(r.items.map((x) => [x.appt.id, x]));
  assert.strictEqual(by.a.lanes, 1);
  assert.strictEqual(by.x, undefined);
});
