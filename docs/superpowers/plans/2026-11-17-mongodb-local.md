# Nails Up con MongoDB local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el portal guarde sus datos en el MongoDB local de la dueña mediante un servidor Node que corre en su computadora.

**Architecture:** `server/app.js` expone una API REST sobre un "almacén" inyectable (`list/put/add/remove`); `server/mongo-store.js` implementa ese almacén con el driver de MongoDB y `server/index.js` lo arranca en 127.0.0.1. En el navegador, `src/api-db.js` imita la interfaz de la capacidad `db` (`collection().onSnapshot/doc().set/delete`) usando `fetch`, así `src/data.js` y las pantallas no cambian.

**Tech Stack:** Node 22 (`node:test`, `--env-file-if-exists`), `express`, `mongodb`, JS sin framework en la página.

**Spec:** `docs/superpowers/specs/2026-11-17-mongodb-local-design.md`

## Global Constraints

- Colecciones permitidas, exactamente: `clients`, `services`, `appointments`, `promos`, `settings`.
- El servidor escucha solo en `127.0.0.1`, puerto `3000` por defecto (`PORT`).
- Variables de entorno: `MONGODB_URI` por defecto `mongodb://localhost:27017`, `MONGODB_DB` por defecto `nailsup`. `.env` no se sube a git; se incluye `.env.example`.
- Los ids de documento cumplen `^[A-Za-z0-9_-]{1,64}$`; los cuerpos son objetos JSON de máximo 256 KB.
- Mensajes de error al usuario en español, sin jerga.
- Sin cambios al comportamiento del artifact publicado.

## Review Focus

- Escritura o lectura desde otra página (otro `Origin`) o con `Host` ajeno (rebinding de DNS): el servidor responde 403 y no toca la base.
- `POST`/`PUT` sin `Content-Type: application/json` (petición "simple" entre sitios): 415.
- Colección fuera de la lista o id con caracteres raros (`../`, `$`): 400.
- MongoDB apagado al arrancar: el servidor termina con el mensaje "No se pudo conectar a MongoDB en <uri sin contraseña>. Revisa que esté encendido." y no imprime la contraseña.
- Un cuerpo con campo `id` o `_id` propio no puede cambiar el id del documento.

---

### Task 1: API del servidor con almacén inyectable

**Files:**
- Create: `server/app.js`, `test/server-app.test.js`
- Modify: `package.json` (dependencia `express`)

**Interfaces:**
- Produces:
  - `createApp(store: Store): express.Application` con `Store = { list(col): Promise<Array<{id: string, ...body}>>, put(col, id, body): Promise<void>, add(col, body): Promise<string>, remove(col, id): Promise<void> }`.
  - Rutas: `GET /api/:col` → `200 [{id,...}]`; `PUT /api/:col/:id` (JSON) → `204`; `POST /api/:col` (JSON) → `201 {id}`; `DELETE /api/:col/:id` → `204`; `GET /` sirve `dist/index.html`.

- [ ] **Step 1: Escribir pruebas** (`node:test`, `app.listen(0, "127.0.0.1")`, `fetch`, almacén en memoria definido en la prueba): GET devuelve lo guardado; PUT luego GET; POST devuelve `{id}` y queda listado; DELETE lo quita; colección `users` → 400; id `a$b` → 400; PUT sin `Content-Type: application/json` → 415; petición con `Host: evil.com` → 403; petición con `Origin: http://evil.com` → 403; PUT con cuerpo `{id:"otro", name:"x"}` guarda bajo el id de la URL; cuerpo mayor a 256 KB → 413; `GET /` responde 200 con `text/html`.
- [ ] **Step 2: Correr** `node --test test/server-app.test.js`. Esperado: FALLA.
- [ ] **Step 3: Instalar** `npm install express` e implementar `createApp`: middleware que exige `Host` ∈ {`localhost:<puerto>`, `127.0.0.1:<puerto>`} y rechaza cualquier `Origin` presente con 403; `express.json({limit:"256kb"})` solo con `type: "application/json"`; en `PUT`/`POST` sin ese tipo, 415; validar colección e id con la lista y la expresión de Global Constraints; errores del almacén → 500 con `{error: "No se pudo guardar. Intenta de nuevo."}`.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA (suite completa).
- [ ] **Step 5: Commit** `feat: local api server`.

---

### Task 2: Almacén MongoDB y arranque

**Files:**
- Create: `server/mongo-store.js`, `server/index.js`, `.env.example`, `test/mongo-store.test.js`
- Modify: `package.json` (dependencia `mongodb`, script `start`), `.gitignore` (`.env`)

**Interfaces:**
- Consumes: `createApp` y la forma de `Store` de la Task 1.
- Produces: `createMongoStore(db: { collection(name): Collection }): Store`; `server/index.js` arranca con `node --env-file-if-exists=.env server/index.js`; script `npm start` = `node build.mjs && node --env-file-if-exists=.env server/index.js`.

- [ ] **Step 1: Escribir pruebas** con una colección falsa que implementa `find({}).toArray()`, `replaceOne({_id}, doc, {upsert:true})`, `insertOne(doc)` y `deleteOne({_id})`: `list` devuelve documentos con `id` en lugar de `_id`; `put` guarda `_id` igual al id de la URL y descarta `id`/`_id` del cuerpo; `add` devuelve un id de 20 a 24 caracteres que cumple la expresión de ids; `remove` borra por id.
- [ ] **Step 2: Correr** `node --test test/mongo-store.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `createMongoStore` y `server/index.js`: conecta con `MongoClient(MONGODB_URI, {serverSelectionTimeoutMS: 5000})`, hace `ping`; si falla, imprime el mensaje de Review Focus (con la URI sin credenciales) y sale con código 1; si conecta, `createApp(...).listen(PORT, "127.0.0.1")` e imprime `Portal listo en http://localhost:<PORT>`.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: mongodb store and server entry`.

---

### Task 3: Adaptador `db` para el navegador

**Files:**
- Create: `src/api-db.js`, `test/api-db.test.js`
- Modify: `build.mjs`, `src/index.template.html` (marcador `/*APIDB*/` antes de `/*DATA*/`)

**Interfaces:**
- Produces: `createApiDb(baseUrl: string, fetchFn = fetch)` → `{ collection(name) → { doc(id?) → { id, set(body): Promise<void>, delete(): Promise<void> }, onSnapshot(next, error?) → unsubscribe } }`. `next` recibe `{docs: [{id, data()}], metadata: {fromCache: false}}`. `doc()` sin id genera un id de 20 caracteres aleatorios `[a-z0-9]`. Tras cada `set` o `delete` se vuelve a pedir la colección y se avisa a sus suscriptores. Un fallo de red rechaza con `Error("No hay conexión con el servidor local. ¿Está encendido?")`. Se exporta como `globalThis.createApiDb` y `module.exports`.

- [ ] **Step 1: Escribir pruebas** con un `fetchFn` falso: `onSnapshot` entrega los documentos de `GET /api/clients`; `doc("a").set({name:"Ana"})` hace `PUT /api/clients/a` con `Content-Type: application/json` y luego notifica con la lista nueva; `delete` hace `DELETE`; `doc()` sin id genera ids válidos y distintos; si `fetchFn` lanza, `set` rechaza con el mensaje en español; el build incluye `createApiDb` en `dist/index.html`.
- [ ] **Step 2: Correr** `node --test test/api-db.test.js`. Esperado: FALLA.
- [ ] **Step 3: Implementar** `createApiDb` y ampliar `build.mjs`/plantilla con el marcador nuevo.
- [ ] **Step 4: Correr** `npm test`. Esperado: PASA.
- [ ] **Step 5: Commit** `feat: browser api adapter`.

---

### Task 4: Conectar la página, comprobar en navegador y documentar

**Files:**
- Modify: `src/app.js` (función `boot`), `README.md`
- Create: `e2e/local.py`, `e2e/serve-memory.mjs`

**Interfaces:**
- Consumes: `createApiDb`, `createApp`.
- Comportamiento de `boot`: orden de elección = hash `#demo` → base en memoria; `claude.use("db")` disponible → esa; si no, y `location.protocol` es `http:` → `createApiDb("")`; si no → `null` (aviso de base de datos no disponible). El aviso para el modo local cuando el servidor no responde: "No se pudo conectar con el servidor local. Revisa que `npm start` esté corriendo."

- [ ] **Step 1: Implementar** la elección en `boot` y el mensaje; `e2e/serve-memory.mjs` arranca `createApp` con un almacén en memoria en el puerto 3100.
- [ ] **Step 2: Verificar en navegador** (`e2e/local.py`, Playwright a 390 px, página en `http://localhost:3100`): crear clienta, crear cita, cobrarla, recargar la página y comprobar que los datos siguen ahí; apagar el servidor y comprobar que una escritura muestra el mensaje en español. Esperado: sin errores de consola, datos presentes tras recargar.
- [ ] **Step 3: README**: pasos para dueña en Windows (instalar Node 22, `npm install`, copiar `.env.example` a `.env`, encender MongoDB, `npm start`, abrir `http://localhost:3000`), y aclarar que el modo `#demo` es solo de prueba.
- [ ] **Step 4: Correr** `npm test && python3 e2e/agenda.py && python3 e2e/clientas.py && python3 e2e/cobros.py && python3 e2e/local.py`. Esperado: todo pasa y sin errores de consola.
- [ ] **Step 5: Commit** `feat: wire local api storage into the page`.
