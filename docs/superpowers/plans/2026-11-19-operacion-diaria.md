# Operación diaria: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recordatorios de mañana, anticipo al cancelar, agendar la siguiente cita, horario con bloqueos en la agenda y reportes por mes.

**Architecture:** Todas las reglas (horario, avisos, fecha sugerida, mensaje, ingresos y reporte del mes) van en `src/logic.js` con pruebas `node --test`. La interfaz en `src/app.js` solo las llama. Los bloqueos son una colección nueva `blocks`, aceptada por el servidor (`server/app.js`) y suscrita como las demás; el horario vive en `settings.main.hours`.

**Tech Stack:** JavaScript sin dependencias en el navegador, Express 5, Node 22+, `node --test`, Playwright (MCP) para comprobar en navegador.

**Spec:** `docs/superpowers/specs/2026-11-19-operacion-diaria-design.md`

## Global Constraints
- Fechas como `"AAAA-MM-DD"`, horas como `"HH:MM"`, día de la semana 0 = domingo (como `weekday()` en `app.js`).
- `hours`: arreglo de 7 elementos indexado por día de la semana: `{ open: boolean, start: "HH:MM", end: "HH:MM" }`. Valor inicial: domingo `{ open: false, start: "08:00", end: "18:00" }`, lunes a sábado `{ open: true, start: "08:00", end: "18:00" }`.
- Bloqueo: `{ date, endDate, start, end, allDay, reason }`; un bloqueo de horas tiene `endDate === date`.
- Campos nuevos de cita: `remindedAt` (`"AAAA-MM-DD"`), `advanceKept` (`true`/`false`, solo si la cita cancelada tenía anticipo). Campo nuevo de servicio: `returnWeeks` (entero o ausente).
- Textos fijos de la spec: "Recordatorios", "Citas de mañana", "Enviar WhatsApp", "Recordada", "Enviar de nuevo", "Sin teléfono", "¿Qué pasó con el anticipo de $N?", "Me lo quedo", "Lo devolví", "Anticipo retenido", "Anticipo devuelto", "Vuelve cada (semanas)", "Agendar siguiente cita", "Listo", "Sugerida: en N semanas", "Bloquear horario", "Todo el día", "Eliminar bloqueo", "Descanso", "Reportes", "Montos antes de descuentos", "Sin cobros este mes.", "Anticipos retenidos".
- Mensaje de recordatorio: "Hola Ana, te recuerdo tu cita mañana a las 10:00 en Nails Up. ¿Me confirmas, por favor?"
- Avisos: "El domingo es tu día de descanso." / "Está fuera de tu horario (8:00 a 18:00)." / "Choca con el bloqueo «Comida» de 14:00 a 15:00." / "Choca con el bloqueo «Vacaciones» de todo el día."
- Las cancelaciones anteriores (sin `advanceKept`) no cuentan como ingreso.
- Guardar sigue con `busyBtn`, `run(…, msg)` e id fijo por formulario (`Store.newId`).
- `npm test` en verde; `npm run build` y reiniciar `e2e/serve-memory.mjs` antes de cada prueba en navegador.

## Review Focus
1. Mes con anticipos retenidos y cobros: "Ingresos del mes" = suma de la tabla por método (incluida la fila "Anticipos retenidos"). Prueba de `monthReport` en Tarea 2.
2. Cita que cruza el cierre (17:30 de 60 min) y cita de domingo: aviso correcto. Pruebas de `scheduleWarnings` en Tarea 1.
3. Bloqueo de varios días (vacaciones) visto en un día intermedio, y cita encima. Pruebas de `blocksOn` y `scheduleWarnings` en Tarea 1.
4. Cita recordada que se mueve de hora: vuelve a "pendiente de recordar". Paso de navegador en Tarea 4.
5. Fecha sugerida que cae en domingo: pasa al lunes. Prueba de `nextVisitDate` en Tarea 1.

---

### Task 1: Reglas de horario, bloqueos, siguiente cita y recordatorio

**Files:**
- Modify: `src/logic.js` (al final, antes de `root.NailsLogic = api`), `layoutDay` (rango opcional)
- Test: `test/operacion.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `L.DEFAULT_HOURS` — el arreglo de las Global Constraints.
  - `L.dayHours(hours, dateKey) -> { open, start, end }` — `hours` faltante o incompleto usa `DEFAULT_HOURS`.
  - `L.agendaRange(hours) -> { startMin, endMin }` — minutos del inicio más temprano y el cierre más tardío de los días abiertos; si ninguno está abierto, 8:00–18:00.
  - `L.layoutDay(appointments, range?)` — `range` = `{ startMin, endMin }` reemplaza el 9–20 de base; sin `range` se comporta como hoy.
  - `L.blocksOn(blocks, dateKey) -> block[]` — los que cubren esa fecha (`date <= dateKey <= endDate`), ordenados por `start` (los de todo el día primero).
  - `L.scheduleWarnings({ start, durationMin }, { hours, blocks }) -> string[]` — los avisos de la spec, en este orden: descanso, fuera de horario, bloqueos. "Fuera de horario" cuando empieza antes de la apertura o termina después del cierre de un día abierto; las horas del texto sin cero inicial ("8:00 a 18:00"). El nombre del día en minúscula ("El domingo es…").
  - `L.nextVisitDate({ today, weeks, hours }) -> "AAAA-MM-DD"` — `today` + `weeks`×7 días; si cae en día cerrado, avanza al siguiente abierto (máximo 7 días).
  - `L.suggestedWeeks(lines, services) -> number` — el menor `returnWeeks` (> 0) de los servicios del catálogo cuyos `id` están en `lines[].serviceId`; 3 si ninguno lo tiene.
  - `L.reminderMessage(clientName, time) -> string` — usa el primer nombre.

- [ ] **Step 1: Escribe las pruebas que fallan** en `test/operacion.test.js`:
  - `dayHours(undefined, "2026-11-22")` (domingo) → `{ open: false, start: "08:00", end: "18:00" }`; `dayHours(DEFAULT_HOURS, "2026-11-23")` (lunes) → abierto 08:00–18:00.
  - `agendaRange(DEFAULT_HOURS)` → `{ startMin: 480, endMin: 1080 }`; con el sábado 09:00–14:00 y el lunes 07:00–18:00 → `startMin: 420`.
  - `layoutDay([], { startMin: 480, endMin: 1080 })` → rango 480–1080; una cita 07:30 lo amplía a 420.
  - `blocksOn`: vacaciones `{ date: "2026-12-20", endDate: "2026-12-27", allDay: true }` aparece el `"2026-12-23"` y no el `"2026-12-28"`; dos bloqueos del mismo día salen ordenados por `start`.
  - `scheduleWarnings`:
    - cita domingo `"2026-11-22T10:00"` → `["El domingo es tu día de descanso."]`;
    - lunes `"2026-11-23T17:30"` de 60 min → `["Está fuera de tu horario (8:00 a 18:00)."]`;
    - lunes 07:30 de 30 → el mismo aviso;
    - lunes 10:00 de 60 → `[]`;
    - lunes 14:30 de 30 con bloqueo `{ date: "2026-11-23", endDate: "2026-11-23", start: "14:00", end: "15:00", reason: "Comida" }` → `["Choca con el bloqueo «Comida» de 14:00 a 15:00."]`;
    - lunes 15:00 de 30 con ese bloqueo → `[]` (no se toca);
    - un día dentro de vacaciones de todo el día → `["Choca con el bloqueo «Vacaciones» de todo el día."]`.
  - `nextVisitDate({ today: "2026-11-02", weeks: 3, hours: DEFAULT_HOURS })` → `"2026-11-23"`; si cae en domingo (`today: "2026-11-01"`, domingo + 3 semanas) → `"2026-11-23"` (lunes).
  - `suggestedWeeks`: líneas con servicios de `returnWeeks` 4 y 2 → 2; sin `returnWeeks` → 3; línea cuyo servicio ya no existe → 3.
  - `reminderMessage("Ana López", "10:00")` → el mensaje exacto de las Global Constraints.

- [ ] **Step 2: Corre y confirma que fallan.** Run: `node --test test/operacion.test.js`. Expected: FAIL (`L.dayHours is not a function`).

- [ ] **Step 3: Implementa** las funciones y el `range` opcional de `layoutDay`.

- [ ] **Step 4: `npm test`.** Expected: verde (las pruebas viejas de `layoutDay` siguen pasando).

- [ ] **Step 5: Commit** `feat: reglas de horario, bloqueos, siguiente cita y recordatorio`.

---

### Task 2: Reglas de ingresos y reporte del mes

**Files:**
- Modify: `src/logic.js`
- Test: `test/reportes.test.js` (nuevo)

**Interfaces:**
- Consumes: `L.apptServices`, `L.cancelKind` (ya existen).
- Produces:
  - `L.incomeOn(appts, dateKey) -> number` — totales de citas cobradas con `paidAt` (o fecha de la cita si falta) igual a `dateKey`, más `advance` de canceladas con `advanceKept === true` y `cancelledAt === dateKey`.
  - `L.monthReport({ appts, clients, month }) -> { income, prevIncome, changePct, paidCount, avgTicket, byService, byMethod, topClients, cancel, retained }` con `month` `"AAAA-MM"`:
    - `income`: igual que `incomeOn` pero por mes. `prevIncome` del mes anterior. `changePct`: entero redondeado de `(income − prev)/prev × 100`, o `null` si `prev` es 0.
    - `paidCount`: cobradas del mes; `avgTicket`: suma de sus `total` ÷ `paidCount` (0 si no hay), redondeado a 2 decimales.
    - `byService`: `[{ name, count, amount }]` sumando las líneas (`L.apptServices`) de las cobradas del mes por `name`, ordenado por `amount` descendente.
    - `byMethod`: `[{ method, amount }]` por `method` de las cobradas, más `{ method: "retenidos", amount }` si hay anticipos retenidos; suma = `income`.
    - `topClients`: hasta 5 `{ clientId, name, visits, amount }` por suma de `total` de cobradas; `name` "Clienta eliminada" si no existe.
    - `cancel`: `{ closed, aviso, noLlego, avisoPct, noLlegoPct }` sobre las citas del mes por fecha de la cita con estado cobrada o cancelada; porcentajes enteros (0 si `closed` es 0).
    - `retained`: `{ count, amount }` de anticipos retenidos del mes.

- [ ] **Step 1: Escribe las pruebas que fallan** en `test/reportes.test.js` con un conjunto de noviembre 2026: 3 cobradas (efectivo 500 de Ana con líneas Gel 350 + Diseño 150, transferencia 300 de Ana con una línea vieja sin `services` y `subtotal` 300, efectivo 200 de Eva), 1 cancelada `aviso` con `advance: 100, advanceKept: true, cancelledAt: "2026-11-10"`, 1 cancelada `no_llego` con `advance: 50, advanceKept: false`, 1 cancelada vieja sin `advanceKept` con `advance: 80`, 1 pendiente; y en octubre 1 cobrada de 500.
  - `incomeOn(appts, "2026-11-10")` → 100 más las cobradas de ese día (define fechas para que sea comprobable).
  - `monthReport(...).income` → 1100; `prevIncome` 500; `changePct` 120; `paidCount` 3; `avgTicket` 333.33.
  - `byService` → Gel 350 (1), Manicure vieja 300 (1), Diseño 150 (1)… ordenado por monto; incluye la línea de la cita vieja.
  - `byMethod` → efectivo 700, transferencia 300, retenidos 100; su suma es `income`.
  - `topClients[0]` → Ana, 2 visitas, 800; una clienta inexistente sale "Clienta eliminada".
  - `cancel` → `closed` 6, `aviso` 2 (incluye la vieja), `noLlego` 1, `avisoPct` 33, `noLlegoPct` 17.
  - `retained` → `{ count: 1, amount: 100 }`.
  - Mes sin datos → `income` 0, `changePct` null, listas vacías.

- [ ] **Step 2: Corre y confirma que fallan.** Run: `node --test test/reportes.test.js`. Expected: FAIL.

- [ ] **Step 3: Implementa `incomeOn` y `monthReport`.**

- [ ] **Step 4: `npm test`.** Expected: verde.

- [ ] **Step 5: Commit** `feat: reglas de ingresos y reporte del mes`.

---

### Task 3: Horario y bloqueos en la agenda

**Files:**
- Modify: `server/app.js` (`COLLECTIONS` + `"blocks"`), `src/app.js` (estado `S.blocks`, suscripción, pestaña "Horario" en Servicios, botón y hoja "Bloquear horario", detalle con "Eliminar bloqueo", sombreado y bloques en `calendar`, avisos en `apptForm`), `src/styles.css`
- Test: `test/server-app.test.js` (la colección `blocks` se puede guardar y listar)

**Interfaces:**
- Consumes: `L.DEFAULT_HOURS`, `L.dayHours`, `L.agendaRange`, `L.layoutDay(…, range)`, `L.blocksOn`, `L.scheduleWarnings` (Tarea 1).
- Produces: `hoursSetting() -> hours` en `src/app.js` (`settings().hours` o `L.DEFAULT_HOURS`), usado por Tareas 5.

- [ ] **Step 1: Prueba del servidor que falla:** en `test/server-app.test.js`, `PUT /api/blocks/b1` con un bloqueo responde 204 (o el código que hoy usa `PUT` con éxito) y `GET /api/blocks` lo devuelve. Run: `node --test test/server-app.test.js`. Expected: FAIL (403/404 por colección desconocida).
- [ ] **Step 2: Agrega `"blocks"` a `COLLECTIONS`.** Run de nuevo. Expected: PASS.
- [ ] **Step 3: Datos y horario.** `S.blocks` suscrito a `blocks` como las demás colecciones. En Servicios, un control segmentado "Servicios" / "Horario"; "Horario" lista los 7 días (empezando en lunes) con casilla "Abierto" y horas "De"/"A", y "Guardar horario" (`busyBtn`, guarda `hours` en `settings` con `saveSettings`). Valida que "De" sea antes que "A" en los días abiertos: "Revisa el horario del <día>: la hora de inicio debe ser antes que la de cierre."
- [ ] **Step 4: Agenda.** `calendar` usa `L.agendaRange(hoursSetting())` como rango de cada `layoutDay`. En cada columna, sombreado (clase `fuera`) antes de la apertura y después del cierre del día, y la columna entera si el día está cerrado; la cabecera de un día cerrado agrega "Descanso". Los bloqueos del día (`L.blocksOn`) se pintan como bloques `.bloqueo` con su motivo (los de todo el día cubren la columna). Tocar un bloqueo abre su hoja con motivo, fecha y horas, y "Eliminar bloqueo" (`busyBtn` "Eliminando…", `Store.remove("blocks", id)`, aviso "Bloqueo eliminado"). Los toques en zonas sombreadas siguen creando cita.
- [ ] **Step 5: Hoja "Bloquear horario"** (botón en la cabecera de la Agenda): Motivo (valor inicial "Comida"), Fecha (la del día que se ve), casilla "Todo el día"; sin ella, "De" y "A" (14:00 y 15:00 de inicio); con ella, "Hasta el día" (igual a la fecha). Validaciones: motivo vacío → "Escribe el motivo."; "A" no después de "De" → "La hora final debe ser después de la inicial."; "Hasta el día" antes de la fecha → "La fecha final no puede ser antes de la inicial." Guarda con id fijo; aviso "Horario bloqueado".
- [ ] **Step 6: Avisos al guardar una cita.** En `apptForm`, cuando no es `force`, junta los avisos de empalme (como hoy) y `L.scheduleWarnings(appt, { hours: hoursSetting(), blocks: S.blocks })` en una sola nota con un solo "Guardar de todos modos".
- [ ] **Step 7: `npm test`, `npm run build`, navegador** (1366 y 390 px): la agenda va de 8 a 18; el domingo se ve sombreado con "Descanso"; cambiar el sábado a 9–14 en Horario sombrea el sábado después de las 14; bloquear 14:00–15:00 "Comida" se ve en gris y al tocarlo se puede eliminar; vacaciones de 3 días se ven en los 3; una cita el domingo, a las 17:30 de 60 min, o encima de "Comida" muestra el aviso correspondiente y "Guardar de todos modos" la guarda. Sin errores en consola.
- [ ] **Step 8: Commit** `feat: horario de trabajo y bloqueos en la agenda`.

---

### Task 4: Recordatorios de mañana

**Files:**
- Modify: `src/app.js` (botón en la cabecera de la Agenda, hoja `remindersSheet()`, borrar `remindedAt` al cambiar fecha u hora en `apptForm`)

**Interfaces:**
- Consumes: `L.reminderMessage`, `L.whatsappLink`, `resumen(a)`, `busyBtn`, `run`.

- [ ] **Step 1: Botón "Recordatorios"** en la cabecera de la Agenda, con el número de citas pendientes de mañana sin `remindedAt` ("Recordatorios · 3"; sin número si es 0).
- [ ] **Step 2: Hoja "Citas de mañana"**: título con la fecha de mañana (`fullDate`), lista de pendientes de mañana por hora (hora, clienta, resumen). Por fila: con teléfono, un enlace "Enviar WhatsApp" (`L.whatsappLink(phone, L.reminderMessage(name, hora))`, `target=_blank`) que al tocarse guarda `remindedAt: todayKey()` en la cita (sin cerrar la hoja; la fila muestra "Recordada" y el enlace dice "Enviar de nuevo"); sin teléfono o clienta eliminada, "Sin teléfono". Sin citas: "No hay citas pendientes para mañana." Botón "Cerrar".
- [ ] **Step 3: En `apptForm`,** si la cita existente cambia de `start`, la cita guardada no lleva `remindedAt`.
- [ ] **Step 4: `npm test`, `npm run build`, navegador:** crea 2 citas para mañana (una clienta sin teléfono); el botón dice "Recordatorios · 2" (la sin teléfono también cuenta); enviar a la primera la marca "Recordada" y el contador baja; mover esa cita a otra hora la vuelve a contar; una cita cancelada de mañana no aparece. Sin errores en consola.
- [ ] **Step 5: Commit** `feat: recordatorios de las citas de mañana por WhatsApp`.

---

### Task 5: Anticipo al cancelar y siguiente cita

**Files:**
- Modify: `src/app.js` (`confirmCancel`, `apptDetail`, `serviceForm`, `chargeForm` + hoja "Cobrado", `apptForm` acepta servicios y fecha iniciales), `src/styles.css` si hace falta

**Interfaces:**
- Consumes: `L.nextVisitDate`, `L.suggestedWeeks` (Tarea 1); `hoursSetting()` (Tarea 3); `L.serviceLine`.
- Produces: `apptForm(init, existing)` acepta en `init` además `lines` (líneas iniciales) y `hint` (texto bajo la fecha).

- [ ] **Step 1: Anticipo al cancelar.** En `confirmCancel`, si `a.advance > 0`, un grupo obligatorio "¿Qué pasó con el anticipo de $200?" (monto con `L.formatMXN`) con "Me lo quedo" (`true`) y "Lo devolví" (`false`); sin elegir: "Elige qué pasó con el anticipo." Se guarda `advanceKept`. En `apptDetail` de una cancelada con anticipo: fila "Anticipo retenido $200" o "Anticipo devuelto $200" (reemplaza la fila "Anticipo"); sin `advanceKept`, la fila "Anticipo" de hoy.
- [ ] **Step 2: `returnWeeks`.** En `serviceForm`, campo "Vuelve cada (semanas)" (`number`, `min 1`, vacío permitido); se guarda como entero o se omite si está vacío.
- [ ] **Step 3: Hoja "Cobrado".** Al cobrar con éxito, en lugar de cerrar, `openSheet` con "Cobrado" (título), el total (`L.formatMXN`), "Agendar siguiente cita" y "Listo". Si la clienta ya no existe, solo "Listo".
- [ ] **Step 4: Siguiente cita.** "Agendar siguiente cita" abre `apptForm({ date: L.nextVisitDate({ today: todayKey(), weeks, hours: hoursSetting() }), time: hora de la cita cobrada, clientId, lines: líneas con precio de catálogo actual (`L.serviceLine(serviceOf(id))` cuando el servicio existe; si no, la línea cobrada), hint: "Sugerida: en N semanas" })` con `weeks = L.suggestedWeeks(lineasCobradas, S.services)`. `apptForm` usa `init.lines` como líneas iniciales y muestra `init.hint` en `muted small` bajo Fecha.
- [ ] **Step 5: `npm test`, `npm run build`, navegador:** cancelar una cita con anticipo exige elegir y el detalle muestra "Anticipo retenido"; una sin anticipo no pregunta. Con "Manicure en gel" en 3 semanas y "Diseño de uñas" en 2, cobrar una cita con ambos y tocar "Agendar siguiente cita" abre el formulario con la misma clienta, los dos servicios, la misma hora, la fecha de hoy + 2 semanas (o el siguiente día abierto) y "Sugerida: en 2 semanas". "Listo" cierra. Sin errores en consola, 390 px.
- [ ] **Step 6: Commit** `feat: anticipo al cancelar y agendar la siguiente cita al cobrar`.

---

### Task 6: Reportes

**Files:**
- Modify: `src/app.js` (`SECCIONES`: "Resumen" → "Reportes"; `screenResumen` → reporte), `src/styles.css`

**Interfaces:**
- Consumes: `L.incomeOn`, `L.monthReport` (Tarea 2).

- [ ] **Step 1: Pestaña "Reportes"** (mismo id interno `resumen`). Arriba, las tarjetas "Ingresos de hoy" (`L.incomeOn(S.appts, todayKey())`) y "Citas pendientes hoy" como hoy, y las promociones activas hoy debajo de todo.
- [ ] **Step 2: Reporte del mes** con flechas "Mes anterior"/"Mes siguiente" y el título "noviembre de 2026" (`S.reportMonth`, inicia en el mes actual):
  - Tarjetas: "Ingresos del mes" con el cambio ("+120% que octubre", "−10% que octubre" o "—" si `changePct` es null), "Citas cobradas", "Ticket promedio".
  - "Ventas por servicio" (nombre, veces, monto) con la nota "Montos antes de descuentos".
  - "Por método de pago" (Efectivo, Transferencia y "Anticipos retenidos").
  - "Mejores clientas" (nombre, visitas, total).
  - "Cancelaciones": "Canceló con aviso: N (P%)" y "No llegó: N (P%)" de M citas cerradas.
  - Sin cobros: "Sin cobros este mes." en lugar de las tablas.
- [ ] **Step 3: `npm test`, `npm run build`, navegador:** con citas cobradas en dos meses y un anticipo retenido, los números coinciden con los de la Tarea 2; las flechas cambian de mes; la suma por método coincide con los ingresos; 390 px sin desbordes; sin errores en consola.
- [ ] **Step 4: Commit** `feat: reportes por mes`.
