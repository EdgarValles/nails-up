# Nails Up: acceso seguro desde internet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el portal se pueda publicar en un VPS detrás de HTTPS y solo entre la dueña, con contraseña, sesiones revocables y encabezados de seguridad.

**Architecture:** `server/password.js` (hash `scrypt`), `server/auth-store.js` (usuaria y sesiones en MongoDB, con reglas puras de bloqueo y expiración) y `server/auth.js` (rutas de entrar/salir, `requireSession`, límite por IP) se conectan en `server/app.js`, que además aplica encabezados y CSP con hashes generados por `build.mjs`. `server/index.js` exporta `start()` y se niega a arrancar sin usuaria; `server/cli.js` administra la cuenta. La página redirige a `/login` ante un `401`.

**Tech Stack:** Node 22 (`node:test`, `node:crypto`), `express` 5, `mongodb` 7, JS sin framework en la página, Playwright (Python) para e2e, Caddy + systemd en Ubuntu 24.04.

**Spec:** `docs/superpowers/specs/2026-11-17-acceso-internet-design.md`

## Global Constraints

- Sin dependencias nuevas de npm. Cookies, hashes y límites se hacen con `node:crypto` y código propio.
- Una sola usuaria, `_id: "owner"` en la colección `users`. Sin registro ni recuperación por correo.
- Contraseña: mínimo 12 caracteres, máximo 1024.
- `scrypt` con `N=16384`, `r=8`, `p=1`, longitud 64, sal de 16 bytes. Formato: `scrypt$16384$8$1$<salBase64>$<hashBase64>`.
- Token de sesión: 32 bytes aleatorios en `base64url`. En la base solo se guarda `sha256(token)` en hex como `_id` de `sessions`.
- Cookie `nu_session`: `HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`, más `Secure` cuando `PUBLIC_ORIGIN` empieza con `https:`.
- Expiración: 7 días sin uso (`lastSeenAt`) o 30 días en total (`createdAt`), o `createdAt < passwordChangedAt`. `lastSeenAt` se actualiza como máximo una vez por minuto.
- Bloqueo: 5 fallos seguidos → `min(15 min × 2^lockCount, 24 h)`. Límite por IP: 20 intentos de login cada 15 minutos.
- Fechas en MongoDB como `Date`, para que funcionen los índices TTL. El reloj inyectable `now()` devuelve milisegundos.
- `POST`, `PUT` y `DELETE` exigen `Origin` dentro de los orígenes permitidos: `http://localhost:<puerto>`, `http://127.0.0.1:<puerto>` y `PUBLIC_ORIGIN` si existe.
- Todos los mensajes al usuario en español, sin jerga técnica.
- Nunca se escribe en los logs una contraseña, un token ni la URI de Mongo con credenciales.
- La versión publicada en claude.ai y el modo `#demo` no cambian.

## Review Focus

- Cookie basura, vacía, repetida o de más de 100 caracteres: `401` (o `302` a `/login`), sin excepción ni consulta rara. Prueba en Task 4.
- Login con cuerpo sin `password`, con `password` que no es texto, o con más de 1024 caracteres: `400` "Escribe tu contraseña." y no cuenta como intento fallido. Así nadie fuerza `scrypt` con textos enormes. Prueba en Task 4.
- La base falla durante el login: `500` "No se pudo iniciar sesión. Intenta de nuevo.", sin cookie y sin tocar el contador. Prueba en Task 4.
- Logout sin sesión o con cookie inválida: `204`, borra la cookie igual, no truena. Prueba en Task 4.
- El portal detrás de Caddy (`Host: portal.ejemplo.com`, `Origin: https://portal.ejemplo.com`) funciona; el mismo servidor con `PUBLIC_ORIGIN` vacío sigue funcionando en `localhost`. Prueba en Task 5.

---

### Task 1: Hash de contraseñas

**Files:**
- Create: `server/password.js`
- Test: `test/password.test.js`

**Interfaces:**
- Produces: `hashPassword(pw: string) => Promise<string>`, `verifyPassword(pw: string, stored: string) => Promise<boolean>`, `validatePassword(pw: unknown) => boolean`, constante `MAX_PASSWORD = 1024`.

- [ ] **Step 1: Write the failing tests** en `test/password.test.js`:
  - `verifyPassword` devuelve `true` con la contraseña correcta y `false` con otra.
  - Dos `hashPassword("misma-contraseña-1")` dan textos distintos y ambos empiezan con `"scrypt$16384$8$1$"`.
  - `validatePassword`: `"a".repeat(11)` → `false`, `"a".repeat(12)` → `true`, `"a".repeat(1025)` → `false`, `12345678901234` (número) → `false`.
  - `verifyPassword("x", "basura")`, `verifyPassword("x", "")` y `verifyPassword("x", "scrypt$1$1$1$AA$AA")` devuelven `false` sin lanzar error.

- [ ] **Step 2: Run** `node --test test/password.test.js`. Expected: FAIL, "Cannot find module '../server/password.js'".

- [ ] **Step 3: Implement** `server/password.js` con `crypto.scrypt` en su versión promesa. `verifyPassword` lee los parámetros del texto guardado, recalcula y compara con `crypto.timingSafeEqual`. Si el formato es inválido o las longitudes difieren, devuelve `false`. Sus parámetros deben coincidir con los de Global Constraints; si no, también `false`, para no aceptar costos absurdos.

- [ ] **Step 4: Run** `node --test test/password.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/password.js test/password.test.js
git commit -m "feat: hash de contraseñas con scrypt"
```

---

### Task 2: Almacén de usuaria y sesiones

**Files:**
- Create: `server/auth-store.js`
- Create: `test/helpers/fake-mongo.js` (no termina en `.test.js`, así que `npm test` no lo corre como prueba)
- Test: `test/auth-store.test.js`

**Interfaces:**
- Produces:
  - `fakeMongo() => db`, con `collection(name)` que soporta:
    - `findOne(filter)`, `insertOne(doc)` (lanza `{ code: 11000 }` si el `_id` ya existe), `updateOne(filter, { $set })`, `deleteOne(filter)` y `deleteMany(filter)` (devuelve `{ deletedCount }`), con filtros de igualdad exacta;
    - `createIndex(spec, opts)`, que registra la llamada en `db.indexes`.
  - Funciones puras `sessionValid(session, user, nowMs) => boolean` y `applyFailure(user, nowMs) => { failedCount, lockCount, lockedUntil }`.
  - Constantes `IDLE_MS = 7*864e5`, `MAX_MS = 30*864e5`, `TOUCH_MS = 60000`, `LOCK_AFTER = 5`, `LOCK_BASE_MS = 15*60000`, `LOCK_MAX_MS = 864e5`.
  - `createAuthStore(db, { now = Date.now } = {})`, que devuelve:
    - `ensureIndexes() => Promise<void>`
    - `getUser() => Promise<user|null>`
    - `createUser(passwordHash) => Promise<void>`: lanza `Error("Ya existe una usuaria.")` si ya hay una.
    - `setPassword(passwordHash) => Promise<void>`: actualiza `passwordChangedAt`, pone los contadores en 0 y `lockedUntil: null`.
    - `recordFailure() => Promise<user>`
    - `resetFailures() => Promise<void>`
    - `unlock() => Promise<void>`
    - `createSession() => Promise<string token>`
    - `findSession(token) => Promise<session|null>`
    - `deleteSession(token) => Promise<void>`
    - `deleteAllSessions() => Promise<number>`
  - Forma de `user`: `{ _id: "owner", passwordHash, failedCount, lockCount, lockedUntil: Date|null, passwordChangedAt: Date }`.
  - Forma de `session`: `{ _id: sha256hex, userId: "owner", createdAt: Date, lastSeenAt: Date }`.

- [ ] **Step 1: Write the failing tests** en `test/auth-store.test.js`, con un reloj falso `let t = Date.UTC(2026,0,1); const now = () => t;`:
  - `createSession` devuelve un token de 43 caracteres. En `sessions` el `_id` es el sha256 del token y nunca el token. `findSession(token)` lo encuentra.
  - Con `t += IDLE_MS + 1` sin uso, `findSession` devuelve `null` y borra la sesión.
  - Usando la sesión cada 6 días, `findSession` sigue devolviéndola hasta que pasan 30 días desde `createdAt`; ahí devuelve `null`.
  - `setPassword(...)` con `t` posterior a `createSession` → `findSession` devuelve `null`.
  - `lastSeenAt` no cambia si pasan 30 segundos y sí cambia si pasan 61.
  - `findSession(undefined)`, `findSession("")` y `findSession("x".repeat(101))` → `null`.
  - `applyFailure`: 4 fallos sin bloqueo; el 5.º da `lockedUntil = now + 15 min`, `lockCount: 1`, `failedCount: 0`. Las siguientes rondas dan 30 y 60 minutos, y con `lockCount: 10` el tope es 24 h.
  - `sessionValid` con `user` en `null` → `false`.
  - `createUser` dos veces lanza "Ya existe una usuaria.".
  - `deleteAllSessions` devuelve 2 tras crear 2 sesiones.
  - `ensureIndexes` crea TTL sobre `lastSeenAt` con `expireAfterSeconds: 604800` y sobre `createdAt` con `2592000`.

- [ ] **Step 2: Run** `node --test test/auth-store.test.js`. Expected: FAIL, falta el módulo.

- [ ] **Step 3: Implement** `test/helpers/fake-mongo.js` y `server/auth-store.js`. Solo se usan operaciones `$set`, para que el fake alcance. `recordFailure` lee la usuaria, aplica `applyFailure` y guarda.

- [ ] **Step 4: Run** `node --test test/auth-store.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/auth-store.js test/helpers/fake-mongo.js test/auth-store.test.js
git commit -m "feat: almacén de usuaria y sesiones"
```

---

### Task 3: Página de login y hashes CSP en el build

**Files:**
- Create: `src/login.template.html`, `src/login.js`
- Modify: `build.mjs`, `src/app.js:21` (función `h()`)
- Test: `test/build.test.js`

**Interfaces:**
- Produces:
  - `dist/login.html`.
  - `dist/csp.json` con la forma `{ "index.html": { "script": ["'sha256-…'", …], "style": ["'sha256-…'"] }, "login.html": { … } }`. Los valores ya vienen con comillas simples, listos para la cabecera.

- [ ] **Step 1: Write the failing tests** en `test/build.test.js`, después de correr `build.mjs`:
  - `dist/login.html` existe, contiene `<form` y `type="password"`, y no contiene `<script src=` ni `style="`.
  - `dist/csp.json` tiene 4 hashes de script y 1 de style para `index.html`, y al menos 1 de cada uno para `login.html`.
  - Por cada página, el sha256 en base64 de cada bloque `<script>…</script>` y `<style>…</style>` (contenido exacto entre etiquetas) aparece en `csp.json`.
  - `src/app.js` no contiene `setAttribute("style"`.

- [ ] **Step 2: Run** `node --test test/build.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `src/login.template.html`: `lang="es-MX"`, título "Nails Up · Entrar", bloque `<style>/*STYLES*/</style>`, marca "Nails Up", formulario con `<input type="password" id="pw" autocomplete="current-password" required>`, botón "Entrar", un `<p id="msg" role="alert">` y bloque `<script>/*LOGIN*/</script>`. Sin atributos `style`.
  - `src/login.js`: al enviar el formulario hace `fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })`.
    - Con `204` hace `location.assign("/")`.
    - Si la respuesta trae `error`, lo muestra en `#msg`.
    - Si la red falla, muestra "No hay conexión con el servidor."
    - Desactiva el botón mientras espera.
  - `build.mjs`: arma las dos páginas desde una tabla `{ "index.html": "index.template.html", "login.html": "login.template.html" }` y escribe `dist/csp.json`.
  - `src/app.js`: en `h()`, `style` pasa a `el.style.cssText = v`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS en todas las pruebas.

- [ ] **Step 5: Commit**
```bash
git add src/login.template.html src/login.js build.mjs src/app.js test/build.test.js
git commit -m "feat: página de login y hashes csp en el build"
```

---

### Task 4: Rutas de entrar y salir, y `requireSession`

**Files:**
- Create: `server/auth.js`
- Test: `test/auth.test.js`

**Interfaces:**
- Consumes: `createAuthStore` y `fakeMongo` (Task 2), `hashPassword`, `verifyPassword` y `MAX_PASSWORD` (Task 1).
- Produces:
  - `createRateLimiter({ max = 20, windowMs = 900000, now = Date.now }) => { hit(key) => boolean }`: devuelve `false` a partir del intento `max + 1` dentro de la ventana.
  - `createAuth({ authStore, now = Date.now, secure = false, log = defaultLog })`, que devuelve:
    - `router`: un `express.Router` que se monta en `/api/auth`.
    - `requireSession(req, res, next)`.
    - `currentSession(req) => Promise<session|null>`.
  - `defaultLog(event)` escribe una línea JSON `{ t, ip, event }` con `event` igual a `"login_ok"`, `"login_fail"`, `"login_locked"` o `"login_limited"`.

- [ ] **Step 1: Write the failing tests** en `test/auth.test.js`. Para cada prueba se monta una app mínima: `express()` con `app.use("/api/auth", auth.router)` y `app.get("/api/x", auth.requireSession, …)` y `app.get("/", auth.requireSession, …)`. Usa `fakeMongo`, una usuaria creada con `hashPassword("contraseña-correcta")` y el reloj falso.
  - Login correcto → `204`. El `set-cookie` contiene `nu_session=`, `HttpOnly`, `SameSite=Strict`, `Path=/` y `Max-Age=2592000`, y no contiene `Secure`. Con `secure: true` sí contiene `Secure`. Con esa cookie, `/api/x` → `200`.
  - Sin cookie, con `nu_session=inventada`, con `nu_session=` vacía, con dos cookies `nu_session` o con un valor de 200 caracteres: `/api/x` → `401` con el `error` "Tu sesión terminó. Vuelve a entrar.", y `/` → `302` con `location: /login`.
  - Contraseña mala → `401` "Contraseña incorrecta". Al 5.º fallo, la contraseña correcta recibe `429`, con un mensaje que coincide con `/Intenta en 15 minutos/`. Con `t += 15*60000 + 1`, la correcta → `204`.
  - El intento 21 desde la misma IP → `429` "Demasiados intentos. Intenta más tarde.", aunque la contraseña sea correcta.
  - Cuerpo `{}`, `{ password: 123 }` o `{ password: "a".repeat(1025) }` → `400` "Escribe tu contraseña.", y `failedCount` no cambia.
  - Con `recordFailure` y `getUser` que lanzan error → `500` "No se pudo iniciar sesión. Intenta de nuevo.", sin `set-cookie`.
  - Logout con cookie válida → `204` y la cookie deja de funcionar. Logout sin cookie → `204`. En ambos casos el `set-cookie` trae `Max-Age=0`.
  - `log` recibe `login_ok`, `login_fail` y `login_locked`, y ningún evento contiene la contraseña ni el token.

- [ ] **Step 2: Run** `node --test test/auth.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement** `server/auth.js`.
  - Usa `express.json({ limit: "4kb", type: "application/json" })` solo en `/login`.
  - Tiene un lector de cookies propio. Si hay más de una `nu_session`, la trata como inválida.
  - El minuto de bloqueo se redondea hacia arriba, con mínimo 1.
  - Orden de revisión en el login: límite por IP, validación del cuerpo, bloqueo, contraseña.

- [ ] **Step 4: Run** `node --test test/auth.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/auth.js test/auth.test.js
git commit -m "feat: entrar, salir y sesión obligatoria"
```

---

### Task 5: Conectar el login al servidor, con encabezados y CSP

**Files:**
- Create: `server/security.js`
- Modify: `server/app.js`, `e2e/serve-memory.mjs`
- Test: `test/server-app.test.js`

**Interfaces:**
- Consumes: `createAuth` (Task 4), `dist/csp.json` (Task 3).
- Produces:
  - `buildCsp(pageHashes) => string`, con exactamente: `default-src 'none'; script-src <hashes>; style-src <hashes>; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.
  - `securityHeaders({ https }) => middleware`.
  - `createApp(store, { authStore, publicOrigin = "", csp, now = Date.now, log })`. `csp` es el objeto de `csp.json`.

- [ ] **Step 1: Write the failing tests**. Se actualiza `test/server-app.test.js`:
  - `start()` crea una `fakeMongo` con usuaria, corre el build, lee `dist/csp.json` y hace login. El helper agrega `Cookie` y `Origin: http://127.0.0.1:<puerto>` a cada `fetch`.
  - Las pruebas existentes siguen pasando con ese helper.
  - Pruebas nuevas:
    - `GET /api/clients` sin cookie → `401`.
    - `GET /` sin cookie → `302` a `/login`.
    - `GET /login` → `200` HTML, con CSP que contiene los hashes de `login.html`.
    - `GET /login` con sesión → `302` a `/`.
    - `PUT /api/clients/a` con cookie pero sin `Origin` → `403`.
    - `POST /api/auth/login` con `Origin: http://evil.com` → `403`.
    - `GET /` con sesión trae:
      - `content-security-policy` igual a `buildCsp(csp["index.html"])`, sin `unsafe-inline`;
      - `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`;
      - `permissions-policy: camera=(), microphone=(), geolocation=()`;
      - `cache-control: no-store`;
      - y no trae `strict-transport-security`.
    - `/api/clients` trae `cache-control: no-store`.
    - Con `publicOrigin: "https://portal.ejemplo.com"`:
      - una petición `raw` con `Host: portal.ejemplo.com` y `Origin: https://portal.ejemplo.com` pasa la revisión;
      - `GET /` trae `strict-transport-security: max-age=31536000`;
      - el `set-cookie` del login trae `Secure`;
      - `Host: evil.com` → `403`.

- [ ] **Step 2: Run** `node --test test/server-app.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `server/security.js`.
  - `server/app.js`:
    - `app.set("trust proxy", "loopback")`.
    - La revisión de `Host`/`Origin` incluye `new URL(publicOrigin).host`. En métodos que no son `GET`/`HEAD`, exige `Origin`.
    - `securityHeaders` va en todo.
    - `/api/auth` se monta antes del router de colecciones.
    - `requireSession` protege `/` y `/api/:col`.
    - `GET /login` sirve `dist/login.html`.
    - Cada página lleva su CSP y `Cache-Control: no-store`.
    - `secure` en `createAuth` es `publicOrigin.startsWith("https:")`.
  - `e2e/serve-memory.mjs`: usa `fakeMongo` y `createAuthStore`, con una usuaria de contraseña `portal-de-prueba-1`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS en todas las pruebas.

- [ ] **Step 5: Commit**
```bash
git add server/security.js server/app.js e2e/serve-memory.mjs test/server-app.test.js
git commit -m "feat: login, encabezados y csp en el servidor"
```

---

### Task 6: Arranque y comandos de administración

**Files:**
- Modify: `server/index.js`, `.env.example`
- Create: `server/cli.js`
- Test: `test/server-index.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: `createAuthStore` (Task 2), `createApp` (Task 5), `hashPassword` y `validatePassword` (Task 1).
- Produces:
  - `start({ db, env, csp }) => Promise<http.Server>`. Escucha en `127.0.0.1` y en `env.PORT`, que por defecto es `3000`; `"0"` es válido.
  - `runCommand(name, { authStore, readPassword: (prompt) => Promise<string>, print: (msg) => void }) => Promise<void>`.

- [ ] **Step 1: Write the failing tests**
  - `test/server-index.test.js`:
    - `start({ db: fakeMongo(), env: { PORT: "0" }, csp: {} })` sin usuaria rechaza con un error cuyo mensaje es exactamente "Crea la usuaria con: node server/cli.js crear-usuaria".
    - Con usuaria, devuelve un servidor cuya `address().address` es `127.0.0.1`.
    - Se cierra al terminar.
  - `test/cli.test.js`, con `readPassword` que entrega respuestas en orden y `print` que acumula:
    - `crear-usuaria` con `["contraseña-larga-1", "contraseña-larga-1"]` crea la usuaria e imprime "Usuaria creada.".
    - Con contraseñas distintas lanza "Las contraseñas no coinciden.".
    - Con `"corta"` lanza "La contraseña debe tener al menos 12 caracteres.".
    - Si ya existe una usuaria lanza "Ya existe una usuaria. Usa cambiar-contraseña.".
    - `cambiar-contraseña` invalida una sesión existente.
    - `cerrar-sesiones` imprime "Se cerraron 2 sesiones.".
    - `desbloquear` deja `lockedUntil: null` y `failedCount: 0`, e imprime "Cuenta desbloqueada.".
    - Un comando desconocido imprime el uso, con la lista de los 4 comandos.

- [ ] **Step 2: Run** `node --test test/server-index.test.js test/cli.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `server/index.js`:
    - Exporta `start`.
    - `start` corre `ensureIndexes`, revisa que exista la usuaria y crea la app con `PUBLIC_ORIGIN`.
    - El bloque `require.main === module` se conecta a Mongo como hoy, lee `dist/csp.json` y llama `start`.
    - Ante un error imprime el mensaje (con `redactUri` si es de conexión) y sale con 1.
  - `server/cli.js`:
    - Exporta `runCommand`.
    - El bloque principal toma el comando de `process.argv[2]`, se conecta con las mismas variables y lee la contraseña sin mostrarla: `readline` con salida silenciada y `stdin` en modo raw.
    - Muestra los errores en español y sale con 1.
  - `.env.example`: agrega `PUBLIC_ORIGIN=` con un comentario: "vacío en tu computadora; https://tu-dominio en el servidor".

- [ ] **Step 4: Run** `npm test`. Expected: PASS en todas las pruebas.

- [ ] **Step 5: Commit**
```bash
git add server/index.js server/cli.js .env.example test/server-index.test.js test/cli.test.js
git commit -m "feat: arranque con usuaria obligatoria y comandos de cuenta"
```

---

### Task 7: La página reacciona a la sesión

**Files:**
- Modify: `src/api-db.js`, `src/app.js:81` (barra superior) y `src/app.js:485-490` (`boot`)
- Test: `test/api-db.test.js`, `e2e/login.py`, `e2e/local.py`

**Interfaces:**
- Produces: `createApiDb(baseUrl, fetchFn, { onUnauthorized } = {})`. Por defecto, `onUnauthorized` es `() => root.location.assign("/login")`.

- [ ] **Step 1: Write the failing test** en `test/api-db.test.js`: un `fetchFn` que responde `{ ok: false, status: 401, json: async () => ({ error: "Tu sesión terminó. Vuelve a entrar." }) }`.
  - Al hacer `doc("a").set({})`, se llama `onUnauthorized` una vez y la promesa se rechaza con ese mensaje.
  - En `onSnapshot`, se llama `onUnauthorized` y el `error` del suscriptor recibe el mensaje.

- [ ] **Step 2: Run** `node --test test/api-db.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `src/api-db.js`: ante un `401`, llama `onUnauthorized` antes de lanzar el error.
  - `src/app.js` en `boot`:
    - Activa el modo servidor si `location.protocol` es `"http:"` o `"https:"`.
    - Marca `S.server = true`.
    - Si la revisión inicial de `/api/settings` da `401`, hace `location.assign("/login")` y sale.
    - El mensaje de error de conexión pasa a "No se pudo conectar con el servidor. Intenta de nuevo."
  - Barra superior: con `S.server`, agrega el botón "Salir". Hace `POST /api/auth/logout` y luego `location.assign("/login")`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Write** `e2e/login.py`, con el mismo estilo y rutas que `e2e/local.py`, contra `e2e/serve-memory.mjs`:
  - `/` lleva a `/login`.
  - Con `"incorrecta-123"`, `#msg` dice "Contraseña incorrecta".
  - Con `portal-de-prueba-1` aparece `.top`.
  - Al hacer clic en "Salir", la URL termina en `/login`.
  - Al final, ningún mensaje de consola contiene `Content Security Policy` y `errs` queda vacío.
  - Además, `e2e/local.py` entra con `portal-de-prueba-1` antes de su recorrido.

- [ ] **Step 6: Run** `npm run build && python e2e/login.py && python e2e/local.py`. Expected: ambos terminan sin `AssertionError` y no muestran errores de consola.

- [ ] **Step 7: Commit**
```bash
git add src/api-db.js src/app.js test/api-db.test.js e2e/login.py e2e/local.py
git commit -m "feat: la página redirige a login y permite salir"
```

---

### Task 8: Archivos y guía de despliegue

**Files:**
- Create:
  - `deploy/Caddyfile`
  - `deploy/nails-up.service`
  - `deploy/actualizar.sh`
  - `deploy/respaldo.sh`
  - `deploy/nails-up-respaldo.service`
  - `deploy/nails-up-respaldo.timer`
  - `deploy/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `node server/cli.js crear-usuaria` (Task 6) y las variables `MONGODB_URI`, `MONGODB_DB`, `PORT` y `PUBLIC_ORIGIN`.

- [ ] **Step 1: Write** los archivos con los valores de la spec, sección 4:
  - `Caddyfile`: `portal.tudominio.com`, `reverse_proxy 127.0.0.1:3000`, `encode gzip`, log en `/var/log/caddy/portal.log`.
  - `nails-up.service`:
    - Usuario `nailsup`, `WorkingDirectory=/opt/nails-up`, `EnvironmentFile=/opt/nails-up/.env`.
    - `ExecStart=/usr/bin/node server/index.js`, `Restart=on-failure`.
    - `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`.
  - `actualizar.sh`: `set -euo pipefail`; `git pull`, `npm ci --omit=dev`, `npm run build`, `sudo systemctl restart nails-up`.
  - `respaldo.sh`: `set -euo pipefail`; carga `.env`; `mongodump --uri "$MONGODB_URI" --db "$MONGODB_DB" --gzip --archive=/var/backups/nailsup/nailsup-$(date +%F).gz`; borra todo menos los 14 más nuevos; no imprime la URI.
  - El timer corre diario a las `03:00` con `Persistent=true`.
- [ ] **Step 2: Write** `deploy/README.md`, una guía paso a paso en español:
  - DNS.
  - Usuario y SSH con llave; `PermitRootLogin no` y `PasswordAuthentication no`.
  - `ufw allow 22,80,443/tcp`.
  - `fail2ban` y `unattended-upgrades`.
  - Node 22 de NodeSource, Caddy y `mongodb-database-tools`.
  - Atlas:
    - un usuario con `readWrite` solo en `nailsup`;
    - la lista de IP con solo la del VPS;
    - la URI `mongodb+srv`.
  - `.env` con `chmod 600`.
  - `crear-usuaria`.
  - Activar los servicios y el timer.
  - Restaurar con `mongorestore --gzip --archive=…`.
  - Lista de verificación manual:
    - `curl -I https://…` muestra los encabezados;
    - `http://` redirige;
    - `curl http://IP:3000` falla desde fuera;
    - Atlas rechaza otra IP;
    - una restauración de prueba funciona.
  - En `README.md`, una sección corta "Publicarlo en internet" que apunta a `deploy/README.md` y avisa que ahora también en local se pide contraseña: hay que correr `node --env-file-if-exists=.env server/cli.js crear-usuaria` antes del primer `npm start`.
- [ ] **Step 3: Run** `bash -n deploy/actualizar.sh && bash -n deploy/respaldo.sh && npm test`. Expected: sin salida de `bash -n` y todas las pruebas en PASS.
- [ ] **Step 4: Commit**
```bash
git add deploy README.md
git commit -m "docs: despliegue en vps con caddy, systemd y respaldos"
```
