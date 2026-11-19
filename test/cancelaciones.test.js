const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

const cita = (id, clientId, start, status, extra = {}) => ({ id, clientId, start, status, durationMin: 30, ...extra });

test("cancelKind: null si no está cancelada, aviso si no tiene tipo, y el tipo guardado", () => {
  assert.strictEqual(L.cancelKind(cita("a", "ana", "2026-01-01T10:00", "pendiente")), null);
  assert.strictEqual(L.cancelKind(cita("b", "ana", "2026-01-01T10:00", "cancelada")), "aviso");
  assert.strictEqual(L.cancelKind(cita("c", "ana", "2026-01-01T10:00", "cancelada", { cancelKind: "no_llego" })), "no_llego");
});

test("cancelStats cuenta avisos (incluidos los sin tipo) y no llegó, solo de esa clienta", () => {
  const citas = [
    cita("1", "ana", "2026-01-01T10:00", "cancelada"),
    cita("2", "ana", "2026-01-02T10:00", "cancelada", { cancelKind: "aviso" }),
    cita("3", "ana", "2026-01-03T10:00", "cancelada", { cancelKind: "no_llego" }),
    cita("4", "ana", "2026-01-04T10:00", "cobrada"),
    cita("5", "eva", "2026-01-05T10:00", "cancelada"),
  ];
  assert.deepStrictEqual(L.cancelStats("ana", citas), { aviso: 2, noLlego: 1 });
});

test("cancelTendency mira las 5 citas cerradas más recientes", () => {
  const citas = [
    cita("viejo", "ana", "2026-01-01T10:00", "cancelada"),
    cita("1", "ana", "2026-02-01T10:00", "cancelada", { cancelKind: "no_llego" }),
    cita("2", "ana", "2026-02-02T10:00", "cobrada"),
    cita("3", "ana", "2026-02-03T10:00", "cancelada"),
    cita("4", "ana", "2026-02-04T10:00", "cobrada"),
    cita("5", "ana", "2026-02-05T10:00", "cancelada", { cancelKind: "aviso" }),
  ];
  assert.deepStrictEqual(L.cancelTendency("ana", citas), { total: 5, canceladas: 3, noLlego: 1 });
});

test("cancelTendency es null con una sola cancelación", () => {
  const citas = ["1", "2", "3", "4"].map((d) => cita(d, "ana", "2026-02-0" + d + "T10:00", "cobrada"))
    .concat(cita("5", "ana", "2026-02-05T10:00", "cancelada"));
  assert.strictEqual(L.cancelTendency("ana", citas), null);
});

test("cancelTendency con historial corto ignora las pendientes", () => {
  const citas = [
    cita("1", "ana", "2026-02-01T10:00", "cancelada"),
    cita("2", "ana", "2026-02-02T10:00", "cancelada"),
    cita("3", "ana", "2026-03-01T10:00", "pendiente"),
  ];
  assert.deepStrictEqual(L.cancelTendency("ana", citas), { total: 2, canceladas: 2, noLlego: 0 });
});

test("cancelTendency sin citas es null", () => {
  assert.strictEqual(L.cancelTendency("ana", []), null);
});

test("canDeleteClient no deja borrar con una pendiente aunque ya pasó su fecha", () => {
  assert.deepStrictEqual(L.canDeleteClient("ana", [cita("1", "ana", "2020-01-01T10:00", "pendiente")]), { ok: false, pendientes: 1 });
});

test("canDeleteClient deja borrar y cuenta su historial", () => {
  const citas = [
    cita("1", "ana", "2026-01-01T10:00", "cobrada"),
    cita("2", "ana", "2026-01-02T10:00", "cobrada"),
    cita("3", "ana", "2026-01-03T10:00", "cancelada"),
    cita("4", "eva", "2026-01-04T10:00", "pendiente"),
  ];
  assert.deepStrictEqual(L.canDeleteClient("ana", citas), { ok: true, historial: 3 });
  assert.deepStrictEqual(L.canDeleteClient("ana", []), { ok: true, historial: 0 });
});

test("canDeleteAppointment: nunca una cobrada", () => {
  assert.strictEqual(L.canDeleteAppointment(cita("1", "ana", "2026-01-01T10:00", "cobrada")), false);
  assert.strictEqual(L.canDeleteAppointment(cita("2", "ana", "2026-01-01T10:00", "pendiente")), true);
  assert.strictEqual(L.canDeleteAppointment(cita("3", "ana", "2026-01-01T10:00", "cancelada")), true);
});
