# Portal Nails Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página web privada, en español y pensada para celular, con la que la dueña de Nails Up lleva agenda, clientas, cobros, descuentos y promociones.

**Architecture:** Una sola página HTML publicada como artifact. La lógica de negocio (descuentos, lealtad, fechas, reactivación) vive en `src/logic.js` como funciones puras probadas con `node:test`. `build.mjs` junta `src/logic.js`, `src/styles.css` y `src/app.js` en un único `dist/index.html`. Los datos se guardan con la capacidad `db` del artifact (colecciones `clients`, `services`, `appointments`, `promos`, `settings`), con acceso solo para la dueña.

**Tech Stack:** HTML/CSS/JS sin framework ni dependencias, Node 22 (`node:test`) para las pruebas, capacidad `db` y `user` del artifact para guardar datos.

**Spec:** `docs/superpowers/specs/2026-11-17-nails-up-portal-design.md`

## Global Constraints

- Interfaz en español de México, oraciones en minúscula inicial salvo la primera palabra, verbos simples; botones con la acción exacta ("Guardar cita", "Cobrar") y el mismo nombre en el aviso de confirmación ("Cita guardada").
- Moneda MXN con `Intl.NumberFormat("es-MX")`; fechas día/mes/año; zona America/Mexico_City.
- Pagos: solo `efectivo` y `transferencia`.
- Solo la dueña ve los datos: reglas de `db` con `read:"admin"` y `write:"admin"` en todas las colecciones.
- Diseño primero para celular (≥360 px); foco de teclado visible; `prefers-reduced-motion` respetado; contraste AA.
- Paleta base: ciruela oscuro `#2B1B3D`, rosa orquídea `#D6459A`, lila suave `#CDB8F0`, blanco perlado `#FAF7FB`, dorado discreto `#B8924A`. No usar crema con terracota ni negro con acento neón.
- Sin dependencias externas de npm ni CDN en la página final.
- Un solo descuento por cobro (el mayor aplicable); no se acumulan.
- No enviar mensajes automáticos: solo abrir enlaces `https://wa.me/` con texto preescrito.

## Review Focus

- Cita que se empalma con otra del mismo día: se avisa, no se bloquea.
- Anticipo mayor que el total tras el descuento: el saldo nunca queda negativo.
- Clienta sin cumpleaños o sin teléfono: no rompe ni la sugerencia de descuento ni el botón de WhatsApp.
- Teléfonos escritos de formas distintas (`55 1234 5678`, `+52 55-1234-5678`) deben dar el mismo enlace de WhatsApp y detectarse como la misma clienta.
- Promoción con vigencia que cruza de diciembre a enero, y fechas de inicio y fin inclusivas.
- Citas canceladas o no cobradas no cuentan como visitas.
- Si `claude.use("db")` devuelve `null` la página muestra un aviso claro en lugar de una pantalla vacía.

---

## File Structure

- `package.json`: scripts `test` y `build`.
- `build.mjs`: genera `dist/index.html`.
- `src/logic.js`: funciones puras (sin DOM ni db), exporta con `globalThis.NailsLogic` y `module.exports`.
- `src/data.js`: acceso a `db` y estado en memoria; expone `Store`.
- `src/styles.css`: tokens y estilos.
- `src/app.js`: pantallas y eventos.
- `test/*.test.js`: pruebas de `logic.js` y de `build.mjs`.

---

### Task 1: Esqueleto, compilación y repo

**Files:**
- Create: `package.json`, `build.mjs`, `src/logic.js`, `src/data.js`, `src/styles.css`, `src/app.js`, `src/index.template.html`, `test/build.test.js`, `.gitignore`

**Interfaces:**
- Produces: `node build.mjs` escribe `dist/index.html` con el contenido de `logic.js`, `data.js`, `styles.css` y `app.js` incrustado; `npm test` corre `node --test test/`.

- [ ] **Step 1: Escribir la prueba** `test/build.test.js` → `build inlines logic, data, styles and app into dist/index.html`: ejecuta `build.mjs`, lee `dist/index.html` y verifica que contiene `NailsLogic`, `Store`, `<style>` y que no contiene `<script src=` ni `<link rel="stylesheet"`.
- [ ] **Step 2: Correr** `node --test test/build.test.js`. Esperado: FALLA (no existe build).
- [ ] **Step 3: Implementar** `build.mjs` (lee la plantilla `src/index.template.html` con marcadores `/*STYLES*/`, `/*LOGIC*/`, `/*DATA*/`, `/*APP*/` y los reemplaza). Cada archivo de `src/` empieza con un comentario de una línea y expone su nombre global.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit**: `git init`, `.gitignore` con `dist/` y `node_modules/`, `git add -A && git commit -m "chore: scaffold portal and build"`.

---

### Task 2: Dinero, fechas y teléfonos

**Files:**
- Modify: `src/logic.js`
- Test: `test/logic-basics.test.js`

**Interfaces:**
- Produces:
  - `formatMXN(amount: number): string`
  - `normalizePhone(raw: string): string` → solo dígitos de 10 números (quita `+52`, espacios, guiones); `""` si no hay 10 dígitos.
  - `whatsappLink(phone: string, text: string): string` → `https://wa.me/52<10 dígitos>?text=<encodeURIComponent(text)>`; `""` si el teléfono no es válido.
  - `appointmentsOverlap(a: {start: string, durationMin: number}, b: {...}): boolean` (`start` en ISO local `YYYY-MM-DDTHH:mm`; tocarse en el borde no es empalme).
  - `dateKey(d: Date): string` → `YYYY-MM-DD` en hora de México.

- [ ] **Step 1: Escribir las pruebas**: `formatMXN(1234.5)` contiene `1,234.50`; `normalizePhone("+52 55-1234-5678")` y `normalizePhone("55 1234 5678")` dan `"5512345678"`; `normalizePhone("123")` da `""`; `whatsappLink("55 1234 5678","Hola Ana")` es `https://wa.me/525512345678?text=Hola%20Ana`; `whatsappLink("", "x")` es `""`; dos citas 10:00 de 60 min y 10:30 de 30 min se empalman; 10:00 de 60 min y 11:00 no.
- [ ] **Step 2: Correr** `node --test test/logic-basics.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** las cinco funciones en `src/logic.js`.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: money, phone and overlap helpers`.

---

### Task 3: Motor de descuentos y lealtad

**Files:**
- Modify: `src/logic.js`
- Test: `test/discounts.test.js`

**Interfaces:**
- Consumes: `dateKey` de la Task 2.
- Produces:
  - `paidVisitCount(clientId: string, appointments: Appointment[]): number` → solo cuentan citas con `status === "cobrada"`.
  - `suggestDiscount(input: {client: Client, paidVisits: number, promos: Promo[], settings: Settings, today: string, subtotal: number}): {kind: "lealtad"|"temporada"|"cumpleanos"|"ninguno", label: string, amount: number}`.
  - `computeCharge(input: {subtotal: number, discountAmount: number, advance: number}): {total: number, balance: number}` → `total = max(0, subtotal - discountAmount)`, `balance = max(0, total - advance)`.
- Tipos: `Promo = {id, name, type: "temporada"|"cumpleanos", percent: number, startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", active: boolean}`; `Settings = {loyaltyEvery: 6, loyaltyPercent: 15, inactiveWeeks: 5}` (valores iniciales); `Client.birthday` es `"MM-DD"` opcional.

- [ ] **Step 1: Escribir las pruebas** con estos casos: con 5 visitas pagadas y `loyaltyEvery 6`, la visita actual es la 6.ª → `kind "lealtad"`, `amount = subtotal*0.15`; con 4 visitas → `ninguno`; promoción de temporada con vigencia `2026-12-20` a `2027-01-05` aplica en `2026-12-31` y en `2027-01-05` (inclusive) y no en `2027-01-06`; cumpleaños en el mes de `today` aplica la promoción activa de tipo `cumpleanos`; sin `birthday` no aplica; si hay lealtad 15 % y temporada 20 %, gana el mayor (20 %) y no se suman; promoción con `active:false` se ignora; `paidVisitCount` ignora citas `cancelada` y `pendiente`; `computeCharge({subtotal:500, discountAmount:600, advance:100})` da `{total:0, balance:0}`; `computeCharge({subtotal:500, discountAmount:50, advance:200})` da `{total:450, balance:250}`.
- [ ] **Step 2: Correr** `node --test test/discounts.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** las tres funciones; el descuento se redondea a pesos con dos decimales.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: discount and loyalty engine`.

---

### Task 4: Captación (reactivación y textos de promoción)

**Files:**
- Modify: `src/logic.js`
- Test: `test/outreach.test.js`

**Interfaces:**
- Consumes: `whatsappLink`, `dateKey`.
- Produces:
  - `inactiveClients(clients: Client[], appointments: Appointment[], today: string, weeks: number): {client: Client, lastVisit: string|null, weeksAway: number}[]` → clientas con al menos una visita cobrada y última visita hace `weeks` o más; ordenadas de mayor a menor tiempo; nunca incluye clientas sin visitas cobradas.
  - `reactivationMessage(client: Client): string` → saludo con el nombre y una invitación breve a agendar.
  - `promoText(promo: Promo, businessName: "Nails Up"): string` → texto listo para copiar con nombre, porcentaje y vigencia en formato día/mes/año.
  - `findClientByPhone(clients: Client[], rawPhone: string): Client|undefined` → compara con `normalizePhone`.

- [ ] **Step 1: Escribir las pruebas**: una clienta cuya última cobrada fue hace 6 semanas con `weeks=5` aparece con `weeksAway 6`; una con 2 semanas no; una sin visitas no aparece; el orden es descendente; `promoText` incluye `Nails Up`, `20%` y `31/12/2026`; `findClientByPhone` encuentra `+52 55-1234-5678` contra `5512345678`.
- [ ] **Step 2: Correr** `node --test test/outreach.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** las cuatro funciones.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: outreach helpers`.

---

### Task 5: Capa de datos

**Files:**
- Modify: `src/data.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `Store.init(dbOrNull)`; `Store.subscribe(collection: string, cb: (docs: any[]) => void): () => void`; `Store.save(collection: string, doc: {id?: string, ...}): Promise<string>` (devuelve el id); `Store.remove(collection, id): Promise<void>`; `Store.ready: boolean`. Colecciones: `clients`, `services`, `appointments`, `promos`, `settings` (documento único `main`).
- `Store.seedDefaults(): Promise<void>` crea `settings/main` con los valores de la Task 3 y servicios iniciales `Manicure en gel` (45 min), `Diseño de uñas` (30 min), `Retoque` (30 min) solo si las colecciones están vacías, con precios en `0` para que la dueña los complete.

- [ ] **Step 1: Escribir pruebas con una `db` falsa en memoria** (objeto con `collection(name).doc(id).get/set/delete` y `onSnapshot`): `save` sin id genera id y notifica a los suscriptores; `remove` borra y notifica; `seedDefaults` no duplica si se llama dos veces; con `Store.init(null)` `Store.ready === false` y `save` rechaza con mensaje `No hay conexión con la base de datos`.
- [ ] **Step 2: Correr** `node --test test/data.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `Store` con la API de la capacidad `db` (`db.collection(name).doc(id)`, `onSnapshot`, `set`, `delete`), suscribiéndose una sola vez por colección. Leer `describe_capabilities` con `capability:"db"` si hay duda de firmas.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: data store over db capability`.

---

### Task 6: Estilos, estructura y agenda

**Files:**
- Modify: `src/styles.css`, `src/app.js`, `src/index.template.html`

**Interfaces:**
- Consumes: `Store`, `appointmentsOverlap`, `formatMXN`.
- Produces: navegación inferior con cinco pestañas (Agenda, Clientas, Cobros, Promociones, Resumen); funciones `render()` por pestaña; formulario de cita con campos clienta (buscar por nombre o teléfono, o crear nueva), servicio, fecha, hora, notas del diseño y anticipo.

Comportamiento exigido:
- Tokens de color de Global Constraints como variables CSS. Cada servicio tiene un tono propio (campo `color` de `services`, elegido de seis tonos de esmalte) y las citas se dibujan como bloques de ese color; es el único elemento "llamativo", el resto es sobrio.
- Tipografía: una familia con carácter para títulos y otra limpia para datos, ambas incluidas dentro del archivo (fuentes del sistema como respaldo; sin CDN). Evitar eyebrows en mayúsculas y acentos de una sola palabra en títulos.
- Vista día y semana con botón "Hoy"; al guardar una cita que se empalma, mostrar aviso "Se empalma con la cita de <nombre> a las <hora>" y dejar guardar con "Guardar de todos modos".
- Estado vacío de la agenda: "No hay citas este día. Agenda la primera." con botón "Nueva cita".
- Botón "Guardar cita" → aviso "Cita guardada". Cancelar cita pide confirmación y deja la cita con `status: "cancelada"`.

- [ ] **Step 1: Implementar** estructura y estilos de celular primero.
- [ ] **Step 2: Compilar** con `node build.mjs` y abrir `dist/index.html` con el navegador integrado a 390 px de ancho; con una `db` simulada en memoria confirmar: crear cita, ver el bloque de color, aviso de empalme y estado vacío. Esperado: sin errores en consola.
- [ ] **Step 3: Commit** `feat: layout, styles and agenda`.

---

### Task 7: Clientas y servicios

**Files:**
- Modify: `src/app.js`, `src/styles.css`

**Interfaces:**
- Consumes: `findClientByPhone`, `paidVisitCount`, `whatsappLink`, `Store`.

Comportamiento exigido:
- Clientas: lista con búsqueda; ficha con nombre, teléfono, cumpleaños (día y mes), canal (`whatsapp` | `facebook` | `otro`), notas, visitas cobradas e historial de citas; botón "Abrir WhatsApp" que se oculta si el teléfono no es válido.
- Al guardar una clienta con un teléfono ya registrado, avisar "Ya existe <nombre> con ese teléfono" y ofrecer abrir su ficha en lugar de duplicarla.
- Servicios: alta y edición con nombre, precio, duración y color; no se borran servicios usados por citas, solo se marcan como inactivos.

- [ ] **Step 1: Implementar** ambas pantallas.
- [ ] **Step 2: Verificar** en el navegador integrado con la `db` simulada: crear clienta, intentar duplicar por teléfono con formato distinto, ficha sin cumpleaños ni teléfono sin errores. Esperado: sin errores en consola.
- [ ] **Step 3: Commit** `feat: clients and services screens`.

---

### Task 8: Cobros, promociones, captación y resumen

**Files:**
- Modify: `src/app.js`, `src/styles.css`

**Interfaces:**
- Consumes: `suggestDiscount`, `computeCharge`, `paidVisitCount`, `inactiveClients`, `reactivationMessage`, `promoText`, `whatsappLink`, `Store`.

Comportamiento exigido:
- **Cobrar:** desde una cita, pantalla con subtotal (precio del servicio, editable), descuento sugerido con su etiqueta y botón "Quitar descuento", anticipo recibido, método (`efectivo` | `transferencia`) y total y saldo mostrados con `computeCharge`. "Cobrar" guarda `status: "cobrada"`, `total`, `method`, `discountKind`, `discountAmount` y muestra "Cobrado". La cita cobrada ya no se puede cobrar otra vez.
- **Promociones:** alta y edición de promociones de temporada y de cumpleaños (nombre, porcentaje, vigencia, activa); sección de lealtad que edita `loyaltyEvery` y `loyaltyPercent` en `settings/main`; botón "Copiar texto" por promoción activa con `promoText`.
- **Captación:** lista de `inactiveClients` con el plazo `inactiveWeeks` editable y botón "Escribir por WhatsApp" con `reactivationMessage` que abre `whatsappLink` en una pestaña nueva.
- **Resumen:** ingresos del día y del mes sumando solo citas `cobrada`, número de citas pendientes de hoy, promociones activas hoy.
- Si `Store.ready` es falso, toda la página muestra "No se pudo abrir la base de datos. Recarga la página o abre el portal desde tu cuenta."

- [ ] **Step 1: Implementar** las cuatro pantallas.
- [ ] **Step 2: Verificar** en el navegador con la `db` simulada: cobro con descuento de lealtad en la 6.ª visita; anticipo mayor al total (saldo 0); cobro doble bloqueado; cita cancelada no suma ingresos; mensaje de base de datos no disponible. Esperado: cifras correctas y sin errores en consola.
- [ ] **Step 3: Commit** `feat: payments, promotions, outreach and summary`.

---

### Task 9: Publicar, proteger datos y comprobar

**Files:**
- Modify: ninguno (publicación y configuración).

**Interfaces:**
- Consumes: `dist/index.html` de `node build.mjs`.

- [ ] **Step 1: Compilar y probar** con `npm test && node build.mjs`. Esperado: todas las pruebas pasan y existe `dist/index.html`.
- [ ] **Step 2: Publicar** con `mcp__claude-artifacts__guide` (tema `pages`) leída antes y luego `publish_files` con título "Nails Up" desde `dist/index.html` como `index.html` (artifact nuevo, privado).
- [ ] **Step 3: Declarar capacidades** con `declare_capabilities`: `{db:{rules:[{path:"clients",read:"admin",write:"admin"},{path:"services",read:"admin",write:"admin"},{path:"appointments",read:"admin",write:"admin"},{path:"promos",read:"admin",write:"admin"},{path:"settings",read:"admin",write:"admin"}]},user:{}}`.
- [ ] **Step 4: Comprobar reglas** con `db_rules_get` y confirmar las cinco rutas con `read` y `write` de `admin`.
- [ ] **Step 5: Cargar datos iniciales** abriendo el portal una vez (llama `Store.seedDefaults()`), y confirmar con `db_list` que existen `settings/main` y los tres servicios.
- [ ] **Step 6: Recorrido final** en el navegador integrado a 390 px: crear clienta, cita, cobrarla con transferencia, ver el resumen. Esperado: todo funciona con datos reales y sin errores en consola.
- [ ] **Step 7: Entregar** el enlace del portal a la dueña y dejar las instrucciones de uso en dos líneas.
