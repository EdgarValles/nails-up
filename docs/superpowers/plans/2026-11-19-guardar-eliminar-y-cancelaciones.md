# Guardar sin duplicar, eliminar y cancelaciones: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que guardar no duplique registros aunque el servidor tarde, poder eliminar clientas y citas capturadas por error, y registrar el tipo y motivo de cada cancelación con un aviso de tendencia a cancelar.

**Architecture:** Las reglas puras (conteos, tendencia, si se puede borrar) van en `src/logic.js` con pruebas `node --test`. La interfaz (botones ocupados, errores dentro del formulario, pantallas de cancelar y eliminar) va en `src/app.js`, que construye el DOM con `h()`; las hojas (`openSheet`) se construyen una vez, así que un botón conserva su estado mientras la hoja está abierta. El servidor ya tiene `DELETE /api/:col/:id` y `Store.remove(name, id)` ya existe en `src/data.js`.

**Tech Stack:** JavaScript sin dependencias en el navegador, Node 22+, `node --test`, Playwright (MCP) para comprobar en navegador.

**Spec:** `docs/superpowers/specs/2026-11-19-guardar-eliminar-y-cancelaciones-design.md`

## Global Constraints
- Todo texto visible en español, con los textos exactos de la spec cuando la spec los fija.
- Sin `innerHTML` ni estilos en línea nuevos que rompan la CSP (`style:` como atributo vía `h()` ya se usa y está permitido; no agregar `<style>` ni `<script>`).
- Campos nuevos de cita cancelada: `cancelKind` (`"aviso"` | `"no_llego"`), `cancelReason` (texto, puede ser `""`), `cancelledAt` (`"AAAA-MM-DD"`, de `todayKey()`). El `status` sigue siendo `"cancelada"`.
- Una cita `"cancelada"` sin `cancelKind` (anterior a este cambio) cuenta como `"aviso"`.
- Pendiente = `status === "pendiente"`, sin importar la fecha.
- Las citas `"cobrada"` nunca se pueden eliminar.
- `npm test` debe quedar en verde; `npm run build` antes de probar en navegador y reiniciar `e2e/serve-memory.mjs` después de cada build.

## Review Focus
1. Doble clic rápido en cualquier botón de guardar (incluido "Guardar de todos modos" y "Cobrar") con el servidor lento: debe crearse un solo registro. Lo cubre la prueba en navegador de la Tarea 2.
2. Error del servidor al guardar con la hoja abierta: el mensaje debe verse dentro de la hoja y el botón volver a su texto. Tarea 2, paso de navegador con la base apagada (`LENTO_MS` + parar el servidor).
3. Clienta con una cita pendiente de fecha pasada: no debe poder borrarse. Prueba de `canDeleteClient` en Tarea 1.
4. Tendencia con historial corto (2 citas cerradas, ambas canceladas) y con citas pendientes mezcladas, que no deben contar. Pruebas de `cancelTendency` en Tarea 1.
5. Clienta eliminada con citas cobradas: Cobros y el detalle siguen mostrando "Clienta eliminada" sin errores de consola. Paso de navegador en Tarea 4.

---

### Task 1: Reglas en logic.js

**Files:**
- Modify: `src/logic.js` (agregar después de `api.findClientByPhone`)
- Test: `test/cancelaciones.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `L.cancelKind(appt) -> "aviso" | "no_llego" | null` — `null` si no está cancelada; cancelada sin `cancelKind` → `"aviso"`.
  - `L.cancelStats(clientId, appointments) -> { aviso: number, noLlego: number }`
  - `L.cancelTendency(clientId, appointments) -> null | { total: number, canceladas: number, noLlego: number }` — toma sus citas cerradas (`cobrada` o `cancelada`), ordenadas por `start` descendente, las primeras 5; `total` es cuántas se tomaron; devuelve `null` si `canceladas < 2`.
  - `L.canDeleteClient(clientId, appointments) -> { ok: true, historial: number } | { ok: false, pendientes: number }` — `historial` = número de citas de la clienta.
  - `L.canDeleteAppointment(appt) -> boolean` — `false` solo si `status === "cobrada"`.

- [ ] **Step 1: Escribe las pruebas que fallan** en `test/cancelaciones.test.js` con el estilo de `test/agenda-layout.test.js` (helper `cita(id, clientId, start, status, extra)`):
  - `cancelKind`: pendiente → `null`; cancelada sin tipo → `"aviso"`; `{cancelKind:"no_llego"}` → `"no_llego"`.
  - `cancelStats("ana", …)` con 2 avisos (uno sin tipo), 1 no_llego, 1 cobrada y 1 cancelada de otra clienta → `{ aviso: 2, noLlego: 1 }`.
  - `cancelTendency`: 6 citas cerradas donde las 5 más recientes tienen 3 canceladas (1 no_llego) y la más vieja es cancelada → `{ total: 5, canceladas: 3, noLlego: 1 }`.
  - `cancelTendency`: 1 cancelada entre 5 cerradas → `null`.
  - `cancelTendency`: solo 2 cerradas, ambas canceladas, más 1 pendiente reciente → `{ total: 2, canceladas: 2, noLlego: 0 }`.
  - `cancelTendency` sin citas → `null`.
  - `canDeleteClient`: una pendiente con fecha pasada (`"2020-01-01T10:00"`) → `{ ok: false, pendientes: 1 }`.
  - `canDeleteClient`: 2 cobradas y 1 cancelada → `{ ok: true, historial: 3 }`; sin citas → `{ ok: true, historial: 0 }`.
  - `canDeleteAppointment`: cobrada → `false`; pendiente y cancelada → `true`.

- [ ] **Step 2: Corre y confirma que fallan**
  Run: `node --test test/cancelaciones.test.js`
  Expected: FAIL (`L.cancelKind is not a function`).

- [ ] **Step 3: Implementa las cinco funciones** en `src/logic.js` con las firmas de arriba.

- [ ] **Step 4: Corre todo**
  Run: `npm test`
  Expected: todo en verde.

- [ ] **Step 5: Commit**
  `git add src/logic.js test/cancelaciones.test.js && git commit -m "feat: reglas de cancelaciones y de eliminar clientas y citas"`

---

### Task 2: Botones ocupados y errores dentro del formulario

**Files:**
- Modify: `src/app.js` (`run` en ~línea 88; cada sitio que guarda: `apptForm.save` y "Guardar de todos modos", `confirmCancel`, `clientForm.save`, `serviceForm.save`, `chargeForm.cobrar`, `saveSettings` y sus dos botones, `promoForm.save`)
- Modify: `e2e/serve-memory.mjs` (retraso opcional)

**Interfaces:**
- Produces (en `src/app.js`, usados por Tareas 3 y 4):
  - `run(promise, okMsg, msg?) -> Promise<boolean>` — si recibe `msg` (el contenedor `aria-live` del formulario), el error se muestra ahí como `h("div", { class: "note", role: "alert" }, texto)` en lugar de `S.error`.
  - `busyBtn(attrs, label, handler, busyLabel = "Guardando…") -> HTMLButtonElement` — al hacer clic: si ya está ocupado no hace nada; si no, `disabled = true`, texto `busyLabel`, `await handler()`, y en `finally` vuelve a `disabled = false` y a su `label` (si la hoja se cerró, no importa). `label` puede ser texto o un arreglo de nodos (para "Cobrar" con su ícono).
- Consumes: nada nuevo.

- [ ] **Step 1: Retraso de prueba.** En `e2e/serve-memory.mjs`, si `process.env.LENTO_MS` tiene un número, `put`, `add` y `remove` esperan ese tiempo antes de responder.

- [ ] **Step 2: Implementa `busyBtn` y el `msg` opcional de `run`** junto a `run`.

- [ ] **Step 3: Cambia cada botón que guarda por `busyBtn`** y pasa el `msg` de su formulario a `run`. Todo el `save()` corre dentro del handler (así también la creación de clienta nueva desde el formulario de cita queda protegida). "Guardar de todos modos" también es `busyBtn`. Los dos botones de configuración (lealtad, plazo) usan `busyBtn` sin `msg` (su error sigue yendo a `S.error`, porque no están en una hoja).

- [ ] **Step 4: `npm test` y `npm run build`.** Expected: verde y build sin errores.

- [ ] **Step 5: Prueba en navegador con servidor lento.** Arranca `LENTO_MS=1500 node e2e/serve-memory.mjs`, entra con `portal-de-prueba-1`, Clientas > Nueva clienta, llena nombre, y haz 3 clics seguidos en "Guardar clienta". Expected: el botón dice "Guardando…" y está desactivado; al terminar hay **una** clienta en la lista y aparece "Clienta guardada". Repite con Nueva cita + "+ Nueva clienta": una cita y una clienta. Sin errores en consola.

- [ ] **Step 6: Error dentro de la hoja.** Con una hoja de "Nueva clienta" abierta, detén el servidor y toca "Guardar clienta". Expected: dentro de la hoja aparece una nota con el error y el botón vuelve a "Guardar clienta".

- [ ] **Step 7: Commit**
  `git add src/app.js e2e/serve-memory.mjs && git commit -m "fix: guardar bloquea el botón mientras responde el servidor"`

---

### Task 3: Cancelar con tipo y motivo, y tendencia

**Files:**
- Modify: `src/app.js` (`confirmCancel`, `apptDetail`, `clientCard`, `apptForm`), `src/styles.css` solo si hace falta para el grupo de opciones

**Interfaces:**
- Consumes: `L.cancelKind`, `L.cancelStats`, `L.cancelTendency` (Tarea 1); `busyBtn`, `run(…, msg)` (Tarea 2).

- [ ] **Step 1: `confirmCancel`.** Título "¿Cancelar esta cita?". Dos radios con nombre `cancel-kind`: "Avisó que no viene" (`aviso`) y "No llegó" (`no_llego`), ninguno marcado. Campo "Motivo (opcional)" (`textarea` `#cancel-reason`). Botones "Sí, cancelar cita" (`busyBtn`) y "Volver". Si no eligió tipo: nota "Elige qué pasó: si avisó o si no llegó." Guarda `{ ...a, status: "cancelada", cancelKind, cancelReason: texto.trim(), cancelledAt: todayKey() }`; aviso "Cita cancelada".

- [ ] **Step 2: Detalle de cita cancelada.** En `apptDetail`, si `L.cancelKind(a)`, agrega la fila "Cancelación" con "Canceló con aviso" o "No llegó", y si hay `cancelReason`, la fila "Motivo".

- [ ] **Step 3: Historial y conteos en la ficha.** En `clientCard`, la etiqueta de una cita cancelada dice "Canceló" o "No llegó", con `cancelReason` debajo en `muted small` si existe. La línea de datos agrega, tras "N visitas cobradas", " · N cancelaciones" (o "1 cancelación") y " · N no llegó" solo cuando no son cero.

- [ ] **Step 4: Aviso de tendencia en `apptForm`.** Un contenedor `aria-live` bajo el selector de clienta; se llena al construir el formulario (si viene `clientId`) y en cada `change` del selector. Con `t = L.cancelTendency(id, S.appts)` no nulo: nota "Ana canceló 3 de sus últimas 5 citas (1 sin llegar)." usando el primer nombre de la clienta; omite el paréntesis si `t.noLlego === 0`. No bloquea guardar. Para una cita existente, no se muestra.

- [ ] **Step 5: `npm test`, `npm run build`, reinicia el servidor de prueba y comprueba en navegador:** cancela una cita como "No llegó" con motivo "no contestó" y otra como "Avisó que no viene"; la ficha muestra "· 1 cancelación · 1 no llegó", el historial muestra las etiquetas y el motivo; al crear una cita nueva para esa clienta aparece "… canceló 2 de sus últimas 2 citas (1 sin llegar)." Intentar cancelar sin elegir tipo muestra la nota. Sin errores en consola.

- [ ] **Step 6: Commit**
  `git add src/app.js src/styles.css && git commit -m "feat: tipo y motivo de cancelación y aviso de tendencia a cancelar"`

---

### Task 4: Eliminar cita y eliminar clienta

**Files:**
- Modify: `src/app.js` (`apptDetail`, `clientCard`, funciones nuevas `confirmDeleteAppt(id)` y `confirmDeleteClient(id)`), `src/styles.css` si hace falta separar la zona de borrar

**Interfaces:**
- Consumes: `L.canDeleteClient`, `L.canDeleteAppointment` (Tarea 1); `busyBtn`, `run(…, msg)` (Tarea 2); `Store.remove(name, id)`.

- [ ] **Step 1: Eliminar cita.** En `apptDetail`, si `L.canDeleteAppointment(a)`, al final y separado, un botón discreto (`btn small ghost peligro`) "Eliminar cita" que abre `confirmDeleteAppt(a.id)`: título "¿Eliminar esta cita?", texto "Solo para citas capturadas por error. Si la clienta canceló, usa Cancelar cita para que quede en su historial.", botones "Sí, eliminar" (`busyBtn` con `busyLabel` "Eliminando…") y "Volver". Al confirmar: `Store.remove("appointments", id)`, aviso "Cita eliminada", cierra la hoja.

- [ ] **Step 2: Eliminar clienta.** En `clientCard`, después del historial y separado, botón discreto "Eliminar clienta" que abre `confirmDeleteClient(c.id)`:
  - Si `L.canDeleteClient` da `ok: false`: "Tiene N citas pendientes; cobra o cancela esas citas primero." (singular "Tiene 1 cita pendiente; …") y solo "Volver".
  - Si `ok: true`: "¿Eliminar a Ana López?" y "Sus N citas del historial se conservan." ("Su cita del historial se conserva." si es 1; "No tiene citas." si es 0), con "Sí, eliminar" (`busyBtn`, "Eliminando…") y "No" (vuelve a la ficha).
  - Al confirmar: `Store.remove("clients", id)`, aviso "Clienta eliminada", cierra la hoja.

- [ ] **Step 3: `npm test`, `npm run build`, reinicia el servidor de prueba y comprueba en navegador:**
  - Una cita cobrada no muestra "Eliminar cita"; una pendiente sí, y al eliminarla desaparece de la agenda.
  - Clienta con una cita pendiente: muestra el mensaje de pendientes y no se borra.
  - Clienta con una cita cobrada y ninguna pendiente: se borra; en Cobros esa cita sigue con "Clienta eliminada" y el total no cambia. Abrir su detalle no da error.
  - Sin errores en consola, a 1366 y 390 px de ancho.

- [ ] **Step 4: Commit**
  `git add src/app.js src/styles.css && git commit -m "feat: eliminar citas capturadas por error y eliminar clientas"`
