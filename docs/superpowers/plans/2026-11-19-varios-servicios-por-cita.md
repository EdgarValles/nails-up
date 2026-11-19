# Varios servicios por cita: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una cita tenga una lista de servicios que se arma al agendar, se ajusta al cobrar y se muestra desglosada.

**Architecture:** Las reglas de la lista (leer citas viejas, resumen, sumas, campos de compatibilidad) van en `src/logic.js` con pruebas. Un editor de líneas reutilizable en `src/app.js` sirve al formulario de cita (precios fijos) y al de cobro (precios editables). Las vistas leen siempre a través de `L.apptServices` y `L.servicesSummary`.

**Tech Stack:** JavaScript sin dependencias en el navegador, Node 22+, `node --test`, Playwright (MCP) para comprobar en navegador.

**Spec:** `docs/superpowers/specs/2026-11-19-varios-servicios-por-cita-design.md`

## Global Constraints
- Línea de servicio: `{ serviceId, name, color, price, durationMin }`; la cita la guarda en `services`.
- Al guardar, la cita también escribe `serviceId` y `serviceColor` (del primer servicio), `serviceName` (texto resumen) y `price` (suma de precios).
- Texto resumen: nombre del primero y, si hay más, `" + N"` (ej. "Manicure en gel + 2").
- Textos fijos: "Servicios", "Agregar servicio", "Total estimado: …", "Agrega al menos un servicio.", "El total de los servicios es $0; escribe los precios."
- Duración legible: `"45 min"`, `"1 h"`, `"1 h 30 min"`.
- Las citas viejas no se migran; todo se lee con `L.apptServices`.
- Guardar sigue siendo un solo `Store.save` por cita, con `busyBtn` e id fijo por formulario.
- `npm test` en verde; `npm run build` y reiniciar `e2e/serve-memory.mjs` antes de cada prueba en navegador.

## Review Focus
1. Cita vieja (sin `services`) pendiente: se ve, se edita y se cobra; su precio aparece como la línea. Tarea 1 (pruebas de `apptServices`) y paso de navegador de la Tarea 3.
2. Editar una cita pendiente después de cambiar el precio en el catálogo: sus líneas conservan el precio guardado. Paso de navegador de la Tarea 2.
3. Duración editada a mano y después agregar un servicio: no se sobrescribe. Paso de navegador de la Tarea 2.
4. Cobrar con todas las líneas en $0, o quitando todas: muestra el aviso y no cobra. Paso de navegador de la Tarea 3.
5. Cita cobrada antes de este cambio: Cobros, Resumen y el detalle muestran el mismo total que antes. Paso de navegador de la Tarea 4.

---

### Task 1: Reglas de la lista de servicios

**Files:**
- Modify: `src/logic.js` (después de `api.canDeleteAppointment`)
- Test: `test/servicios-cita.test.js` (nuevo)

**Interfaces:**
- Produces:
  - `L.serviceLine(svc) -> { serviceId, name, color, price, durationMin }` desde un servicio del catálogo (`{ id, name, color, price, durationMin }`); `price` y `durationMin` numéricos, `0` si faltan.
  - `L.apptServices(appt) -> line[]` — copia de `appt.services` si es arreglo no vacío; si no, una línea con `serviceId`, `serviceName` (o "Servicio"), `serviceColor`, `price` (0 si falta) y `durationMin`; `[]` si la cita no tiene ni `services` ni `serviceId` ni `serviceName`.
  - `L.servicesTotals(lines) -> { price: number, durationMin: number }`.
  - `L.servicesSummary(lines) -> string` — `""` si vacía.
  - `L.withServices(appt, lines) -> appt` — copia con `services: lines` y los campos de compatibilidad de las Global Constraints.
  - `L.formatDuration(min) -> string`.

- [ ] **Step 1: Escribe las pruebas que fallan** en `test/servicios-cita.test.js`:
  - `serviceLine({ id: "s1", name: "Gel", color: "#c00", price: 350, durationMin: 45 })` → `{ serviceId: "s1", name: "Gel", color: "#c00", price: 350, durationMin: 45 }`; sin `price` → `price: 0`.
  - `apptServices` de una cita vieja `{ serviceId: "s1", serviceName: "Gel", serviceColor: "#c00", price: 300, durationMin: 45 }` → una línea con esos valores; sin `price` → `price: 0`; con `services` de 2 líneas → esas 2 (y modificar el resultado no cambia la cita); `{}` → `[]`.
  - `servicesTotals` de líneas 350/45 + 120/30 → `{ price: 470, durationMin: 75 }`; `[]` → `{ price: 0, durationMin: 0 }`.
  - `servicesSummary`: 1 línea "Gel" → `"Gel"`; 3 líneas empezando por "Gel" → `"Gel + 2"`; `[]` → `""`.
  - `withServices({ id: "a", status: "pendiente" }, [gel350, diseno120])` → incluye `services` (2), `serviceId: "s1"`, `serviceColor: "#c00"`, `serviceName: "Gel + 1"`, `price: 470`, y conserva `id` y `status`.
  - `formatDuration`: 45 → `"45 min"`, 60 → `"1 h"`, 90 → `"1 h 30 min"`, 0 → `"0 min"`.

- [ ] **Step 2: Corre y confirma que fallan.** Run: `node --test test/servicios-cita.test.js`. Expected: FAIL (`L.serviceLine is not a function`).

- [ ] **Step 3: Implementa las seis funciones** en `src/logic.js`.

- [ ] **Step 4: `npm test`.** Expected: verde.

- [ ] **Step 5: Commit** `feat: reglas de varios servicios por cita`.

---

### Task 2: Editor de servicios y formulario de cita

**Files:**
- Modify: `src/app.js` (`apptForm`, función nueva `servicesEditor`), `src/styles.css` (estilos del editor)

**Interfaces:**
- Consumes: Tarea 1 (`serviceLine`, `apptServices`, `servicesTotals`, `withServices`, `formatDuration`).
- Produces: `servicesEditor({ lines, editablePrice, onChange }) -> { el: HTMLElement, getLines: () => line[] }` en `src/app.js`. Pinta la lista (punto de color, nombre, duración, precio — texto fijo si `editablePrice` es falso o `input type=number` si es verdadero —, botón "Quitar" con `aria-label` "Quitar <nombre>") y debajo el selector "Agregar servicio" con los servicios activos del catálogo; al elegir uno agrega `L.serviceLine(svc)` y el selector vuelve a "Agregar servicio". Con la lista vacía muestra "Sin servicios todavía." Llama `onChange(lines)` en cada cambio (agregar, quitar, editar precio). Trabaja sobre su propia copia de `lines`.

- [ ] **Step 1: Implementa `servicesEditor`** y sus estilos (líneas como filas compactas; el precio editable de ~7rem; en 390 px no debe haber desbordamiento horizontal). Una línea con precio 0 y `editablePrice` falso no muestra precio.

- [ ] **Step 2: Cambia `apptForm`:**
  - Quita el selector de un servicio; usa `servicesEditor({ lines: existing ? L.apptServices(existing) : [], editablePrice: false, onChange })` con la etiqueta "Servicios".
  - Debajo, `Total estimado: $470 · 1 h 30 min` (solo la duración si la suma es 0) con `aria-live`.
  - Duración: se llena con la suma en cada cambio mientras no se haya editado a mano en este formulario (un `input` del usuario en `#f-dur` lo apaga). Al editar una cita existente empieza con su `durationMin` y la marca de "editada a mano" empieza apagada solo si `durationMin` es igual a la suma de sus líneas.
  - Al guardar: sin líneas → "Agrega al menos un servicio."; la cita se arma con `L.withServices({ ...lo de hoy sin serviceId/serviceName/serviceColor/price }, lines)`; `durationMin` = valor del campo o la suma si está vacío.

- [ ] **Step 3: `npm test` y `npm run build`.** Expected: verde, build sin errores.

- [ ] **Step 4: Navegador** (servidor de prueba, 1366 y 390 px):
  - Nueva cita con "Manicure en gel" + "Diseño de uñas": la duración se vuelve 75 y aparece el total estimado; quitar uno la recalcula.
  - Escribir 100 en duración y agregar otro servicio: la duración sigue en 100.
  - Guardar sin servicios: "Agrega al menos un servicio."
  - Pon precio 350 a "Manicure en gel" en Servicios, crea una cita con él; cambia el catálogo a 400 y edita la hora de esa cita: la línea sigue en $350.
  - Sin errores en consola.

- [ ] **Step 5: Commit** `feat: agendar una cita con varios servicios`.

---

### Task 3: Cobrar con líneas editables

**Files:**
- Modify: `src/app.js` (`chargeForm`)

**Interfaces:**
- Consumes: `servicesEditor` (Tarea 2); `apptServices`, `servicesTotals`, `withServices` (Tarea 1).

- [ ] **Step 1: Cambia `chargeForm`:**
  - Reemplaza "Precio del servicio" por `servicesEditor({ lines: L.apptServices(a0), editablePrice: true, onChange: recalc })` bajo la etiqueta "Servicios"; el anticipo queda en su propia fila.
  - `recalc` usa como subtotal `L.servicesTotals(lines).price`; muestra "Subtotal" encima de descuento y total.
  - Al cobrar: sin líneas → "Agrega al menos un servicio."; subtotal 0 → "El total de los servicios es $0; escribe los precios."; el documento es `L.withServices({ ...fresh, status: "cobrada", subtotal, … como hoy }, lines)` sin cambiar `durationMin`.
  - El encabezado deja de mostrar `a0.serviceName` y muestra solo "N visitas cobradas".

- [ ] **Step 2: `npm test` y `npm run build`.** Expected: verde.

- [ ] **Step 3: Navegador:**
  - Cita con 2 servicios: al cobrar aparecen las 2 líneas; agregar "Retoque", cambiar un precio y quitar otra actualiza subtotal, descuento y total.
  - Todas las líneas en 0 → aviso de $0; quitar todas → "Agrega al menos un servicio."; no se cobra.
  - Cita vieja: crea en el servidor de prueba una cita sin `services` (`PUT /api/appointments/<id>` con `serviceId`, `serviceName`, `serviceColor`, `price: 300`, `durationMin: 45`, `status: "pendiente"`); en la app se ve, al cobrar aparece una línea con $300 y se cobra.
  - Sin errores en consola, 1366 y 390 px.

- [ ] **Step 4: Commit** `feat: cobrar con varios servicios y precios por línea`.

---

### Task 4: Mostrar el desglose

**Files:**
- Modify: `src/app.js` (bloque de la agenda, marcas de la semana, panel del día, `apptRow`, lista de cobros recientes, historial de `clientCard`, `apptDetail`), `src/styles.css` si hace falta

**Interfaces:**
- Consumes: `apptServices`, `servicesSummary` (Tarea 1).

- [ ] **Step 1: Texto resumen** en lugar de `a.serviceName` en: bloque de la agenda (texto y `aria-label`), panel del día, `apptRow`, lista de cobros recientes e historial de la ficha. El color sigue siendo `serviceColor` (primer servicio) con el respaldo actual.

- [ ] **Step 2: Detalle de la cita:** la fila "Servicio" pasa a "Servicios" con una línea por servicio (punto de color, nombre y precio; sin precio si es 0). Se quita la fila "Precio". La fila "Cobrado" queda igual.

- [ ] **Step 3: `npm test` y `npm run build`.** Expected: verde.

- [ ] **Step 4: Navegador:**
  - Una cita con 3 servicios se ve "Manicure en gel + 2" en agenda (día y semana), panel del día, Cobros e historial; el detalle lista los 3 con precios.
  - Una cita cobrada vieja (creada por `PUT` como en la Tarea 3, con `status: "cobrada"`, `total: 300`) muestra su servicio y $300 en Cobros, Resumen y detalle.
  - Sin errores en consola, 1366 y 390 px.

- [ ] **Step 5: Commit** `feat: mostrar los servicios de cada cita`.
