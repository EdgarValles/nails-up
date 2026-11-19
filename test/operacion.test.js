const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const H = L.DEFAULT_HOURS;
const cita = (start, durationMin) => ({ start, durationMin });
const comida = { date: "2026-11-23", endDate: "2026-11-23", start: "14:00", end: "15:00", allDay: false, reason: "Comida" };
const vacaciones = { date: "2026-12-20", endDate: "2026-12-27", allDay: true, reason: "Vacaciones" };

test("dayHours: domingo cerrado y lunes de 8 a 18 por omisión", () => {
  assert.deepStrictEqual(L.dayHours(undefined, "2026-11-22"), { open: false, start: "08:00", end: "18:00" });
  assert.deepStrictEqual(L.dayHours(H, "2026-11-23"), { open: true, start: "08:00", end: "18:00" });
});

test("agendaRange toma la apertura más temprana y el cierre más tarde de los días abiertos", () => {
  assert.deepStrictEqual(L.agendaRange(H), { startMin: 480, endMin: 1080 });
  const h = H.map((d) => ({ ...d }));
  h[6] = { open: true, start: "09:00", end: "14:00" };
  h[1] = { open: true, start: "07:00", end: "18:00" };
  assert.strictEqual(L.agendaRange(h).startMin, 420);
  assert.deepStrictEqual(L.agendaRange(H.map((d) => ({ ...d, open: false }))), { startMin: 480, endMin: 1080 });
});

test("layoutDay acepta el rango del horario y se amplía con citas fuera", () => {
  const r = L.layoutDay([], { startMin: 480, endMin: 1080 });
  assert.strictEqual(r.startMin, 480);
  assert.strictEqual(r.endMin, 1080);
  const r2 = L.layoutDay([{ id: "a", start: "2026-11-23T07:30", durationMin: 30, status: "pendiente" }], { startMin: 480, endMin: 1080 });
  assert.strictEqual(r2.startMin, 420);
});

test("blocksOn incluye los días intermedios de un bloqueo largo y ordena por hora", () => {
  assert.deepStrictEqual(L.blocksOn([vacaciones], "2026-12-23"), [vacaciones]);
  assert.deepStrictEqual(L.blocksOn([vacaciones], "2026-12-28"), []);
  const tarde = { ...comida, start: "16:00", end: "16:30", reason: "Médico" };
  assert.deepStrictEqual(L.blocksOn([tarde, comida], "2026-11-23").map((b) => b.reason), ["Comida", "Médico"]);
});

test("scheduleWarnings: descanso, fuera de horario y bloqueos", () => {
  const w = (start, dur, blocks = []) => L.scheduleWarnings(cita(start, dur), { hours: H, blocks });
  assert.deepStrictEqual(w("2026-11-22T10:00", 60), ["El domingo es tu día de descanso."]);
  assert.deepStrictEqual(w("2026-11-23T17:30", 60), ["Está fuera de tu horario (8:00 a 18:00)."]);
  assert.deepStrictEqual(w("2026-11-23T07:30", 30), ["Está fuera de tu horario (8:00 a 18:00)."]);
  assert.deepStrictEqual(w("2026-11-23T10:00", 60), []);
  assert.deepStrictEqual(w("2026-11-23T14:30", 30, [comida]), ["Choca con el bloqueo «Comida» de 14:00 a 15:00."]);
  assert.deepStrictEqual(w("2026-11-23T15:00", 30, [comida]), []);
  assert.deepStrictEqual(w("2026-12-22T10:00", 30, [vacaciones]), ["Choca con el bloqueo «Vacaciones» de todo el día."]);
});

test("nextVisitDate suma semanas y salta días cerrados", () => {
  assert.strictEqual(L.nextVisitDate({ today: "2026-11-02", weeks: 3, hours: H }), "2026-11-23");
  assert.strictEqual(L.nextVisitDate({ today: "2026-11-01", weeks: 3, hours: H }), "2026-11-23");
});

test("suggestedWeeks usa el menor intervalo de sus servicios, o 3", () => {
  const services = [{ id: "s1", returnWeeks: 4 }, { id: "s2", returnWeeks: 2 }, { id: "s3" }];
  assert.strictEqual(L.suggestedWeeks([{ serviceId: "s1" }, { serviceId: "s2" }], services), 2);
  assert.strictEqual(L.suggestedWeeks([{ serviceId: "s3" }], services), 3);
  assert.strictEqual(L.suggestedWeeks([{ serviceId: "borrado" }], services), 3);
});

test("reminderMessage usa el primer nombre y la hora", () => {
  assert.strictEqual(L.reminderMessage("Ana López", "10:00"), "Hola Ana, te recuerdo tu cita mañana a las 10:00 en Nails Up. ¿Me confirmas, por favor?");
});
