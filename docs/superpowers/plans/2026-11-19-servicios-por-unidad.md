# Servicios por unidad: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servicios cobrados por unidad (cantidad por línea que multiplica precio y duración) y duración de la cita editable con la sugerida visible.

**Architecture:** La línea de servicio gana `qty` (y `unitLabel`/`maxUnits` si es por unidad); `price` y `durationMin` pasan a leerse por unidad. Todas las sumas pasan por `L.lineTotal`. La interfaz reutiliza `servicesEditor` para agendar y cobrar.

**Tech Stack:** JavaScript sin dependencias, Node 22+, `node --test`, Playwright (MCP).

**Spec:** `docs/superpowers/specs/2026-11-19-servicios-por-unidad-design.md`

## Global Constraints
- Línea: `{ serviceId, name, color, price, durationMin, qty?, unitLabel?, maxUnits? }`; `qty` faltante = 1. `price`/`durationMin` por unidad.
- Servicio: `perUnit: true`, `unitLabel`, `maxUnits` (2 a 99, inicial 10) solo cuando es por unidad.
- Textos: "Cómo se cobra", "Único", "Por unidad", "Unidad", "Máximo", "Precio por <unidad>", "Duración por <unidad> (min)", "Escribe la unidad (por ejemplo, uña).", "El máximo debe ser un número de 2 a 99.", "Sugerido: … , según los servicios", "Usar sugerido", "Menos <unidades>", "Más <unidades>".
- Las citas y cobros existentes no cambian de monto.
- `npm test` en verde; `npm run build` y reiniciar `e2e/serve-memory.mjs` antes de cada prueba en navegador.

## Review Focus
1. Cita vieja (líneas sin `qty`): mismos totales en agenda, cobro, detalle y reportes. Pruebas de `lineTotal`/`servicesTotals` en Tarea 1.
2. Cantidad en los límites (1 y máximo): los botones no pasan de ahí. Paso de navegador en Tarea 3.
3. Cobro con cantidad y precio por unidad editados: total = suma de `precio × cantidad`, menos descuento. Paso de navegador en Tarea 3.
4. Cambiar un servicio de "Por unidad" a "Único" en el catálogo: las citas que ya lo tienen conservan su cantidad. Paso de navegador en Tarea 2.
5. "Usar sugerido" después de editar la duración: vuelve a la suma y la sigue. Paso de navegador en Tarea 3.

---

### Task 1: Reglas de unidades

**Files:** Modify `src/logic.js`; Test `test/unidades.test.js` (nuevo).

**Interfaces — Produces:**
- `L.serviceLine(svc)` — además `qty: 1`, y `unitLabel`/`maxUnits` si `svc.perUnit`.
- `L.lineTotal(line) -> { price, durationMin, qty }` — `qty` = entero ≥ 1 (1 si falta); `price` redondeado a 2 decimales.
- `L.servicesTotals(lines)` — suma de `lineTotal`.
- `L.unitText(n, label) -> string` — "1 uña", "4 uñas", "2 flores".
- `L.monthReport(...).byService` — cada elemento `{ name, count, amount, unitLabel? }`: `count` suma `qty`, `amount` suma totales de línea; `unitLabel` presente si alguna línea del servicio lo trae.

- [ ] **Step 1: Pruebas que fallan** (`test/unidades.test.js`):
  - `serviceLine({ id:"d", name:"Decoración", color:"#c00", price:30, durationMin:5, perUnit:true, unitLabel:"uña", maxUnits:10 })` → incluye `qty:1, unitLabel:"uña", maxUnits:10`; un servicio sin `perUnit` → `qty:1` y sin `unitLabel`.
  - `lineTotal({ price:30, durationMin:5, qty:4 })` → `{ price:120, durationMin:20, qty:4 }`; sin `qty` → por 1; `qty: 0` o `"x"` → 1.
  - `servicesTotals([gel350_45, deco30_5_x4])` → `{ price:470, durationMin:65 }`; las líneas viejas sin `qty` dan lo mismo que antes.
  - `unitText(1,"uña")` "1 uña"; `unitText(4,"uña")` "4 uñas"; `unitText(2,"flor")` "2 flores".
  - `monthReport` con una cobrada de Gel 350 + Decoración 30×4 y otra con Decoración 30×2 → `byService` incluye `{ name:"Decoración", count:6, amount:180, unitLabel:"uña" }` y `{ name:"Gel", count:1, amount:350 }`.
- [ ] **Step 2:** `node --test test/unidades.test.js` → FAIL.
- [ ] **Step 3:** Implementa; `withServices` sigue usando `servicesTotals` (ya multiplica).
- [ ] **Step 4:** `npm test` → verde (las pruebas viejas de servicios y reportes siguen pasando).
- [ ] **Step 5:** Commit `feat: reglas de servicios por unidad`.

---

### Task 2: Catálogo "Único / Por unidad"

**Files:** Modify `src/app.js` (`serviceForm`, `serviceList`).

- [ ] **Step 1:** En `serviceForm`, grupo de radios "Cómo se cobra" (Único/Por unidad); con "Por unidad" se muestran "Unidad" (`#s-unit`) y "Máximo" (`#s-max`, inicial 10) y las etiquetas de precio y duración cambian a "Precio por <unidad>" y "Duración por <unidad> (min)" (con "unidad" si está vacío). Validaciones de la spec. Guardado: `perUnit`, `unitLabel` (recortado), `maxUnits` (entero); con "Único" se borran esos tres.
- [ ] **Step 2:** En la lista de servicios, un servicio por unidad muestra el precio como "$30 por uña".
- [ ] **Step 3:** `npm test`, `npm run build`, navegador: crear "Decoración" por unidad (uña, 10, $30, 5 min); validación sin unidad y con máximo 1 o 100; la lista muestra "$30.00 por uña"; cambiarlo a "Único" y guardar quita la unidad. Sin errores en consola.
- [ ] **Step 4:** Commit `feat: servicios que se cobran por unidad en el catálogo`.

---

### Task 3: Cantidad en el editor y duración sugerida

**Files:** Modify `src/app.js` (`servicesEditor`, `apptForm`, `chargeForm`), `src/styles.css`.

**Interfaces — Consumes:** `L.lineTotal`, `L.unitText`, `L.servicesTotals` (Tarea 1).

- [ ] **Step 1: Editor.** Para líneas con `unitLabel`: control "−  N  +" (botones con `aria-label` "Menos uñas"/"Más uñas", deshabilitados en 1 y en `maxUnits`), texto "N uñas × $30" bajo el nombre y, a la derecha, el total de línea; el tiempo mostrado es el de la línea (`lineTotal`). Con `editablePrice` el input es el precio por unidad y el total de la línea se actualiza al escribir. Cada cambio llama `onChange`.
- [ ] **Step 2: Duración en `apptForm`.** Mueve "Duración (min)" al final de los datos (después de Fecha/Hora y Anticipo, antes de Notas) con "Sugerido: <formatDuration>, según los servicios" debajo. Mientras `durManual` sea falso sigue la suma. Si se edita, aparece "Usar sugerido" (botón de texto), que pone la suma y apaga `durManual`.
- [ ] **Step 3: `chargeForm`** no cambia de lógica (usa `servicesTotals`), solo hereda el editor.
- [ ] **Step 4:** `npm test`, `npm run build`, navegador (1366 y 390 px): agregar Decoración, subir a 4 → "4 uñas × $30", total estimado y duración suben; el "+" se deshabilita en 10 y el "−" en 1; editar duración a 90 muestra "Usar sugerido" y al tocarlo vuelve a la suma; al cobrar, cambiar a 5 uñas y precio 25 → subtotal correcto; una cita vieja se cobra igual que antes. Sin errores en consola.
- [ ] **Step 5:** Commit `feat: cantidad por línea y duración sugerida`.

---

### Task 4: Mostrar unidades

**Files:** Modify `src/app.js` (`apptDetail`, Reportes).

- [ ] **Step 1:** En el detalle, una línea con `unitLabel` dice "Decoración · 4 uñas" y su total de línea; las demás como hoy (total de línea).
- [ ] **Step 2:** En Reportes, "Ventas por servicio" muestra `L.unitText(count, unitLabel)` si hay `unitLabel`, si no "N veces".
- [ ] **Step 3:** `npm test`, `npm run build`, navegador: detalle y reporte con Decoración ×4 y ×2 → "6 uñas · $180". Sin errores en consola.
- [ ] **Step 4:** Commit `feat: mostrar unidades en el detalle y en reportes`.
