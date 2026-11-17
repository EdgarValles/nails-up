# Nails Up: acceso seguro desde internet

Fecha: 2026-11-17

## Objetivo

Publicar el portal de Nails Up en internet, en un servidor en la nube, para que una sola persona lo use desde cualquier dispositivo, sin exponer los datos de clientas (nombres, teléfonos, citas, cobros) a nadie más.

**Criterios de éxito**
- Sin una sesión válida, nadie puede leer ni cambiar datos ni ver el portal.
- Todo el tráfico va por HTTPS; MongoDB y el proceso de Node no son alcanzables desde internet.
- Una contraseña adivinada a fuerza bruta es impráctica (bloqueo progresivo + límite por IP).
- Hay respaldos diarios restaurables.
- El mismo código sigue funcionando en local y la versión de claude.ai no cambia.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Dónde corre | VPS en la nube (Ubuntu 24.04 LTS) |
| Candado | Inicio de sesión propio en el portal |
| Factores | Solo contraseña (mínimo 12 caracteres), sin 2FA |
| Base de datos | MongoDB Atlas |
| Sesiones | Token aleatorio, guardado como hash en MongoDB, cookie `HttpOnly` |
| Duración | 7 días sin uso o 30 días en total, lo que ocurra primero |
| Cuentas | Una sola, creada por comando; sin registro ni "olvidé mi contraseña" |
| HTTPS | Caddy como proxy inverso con certificado automático |

## Estado actual (antes del cambio)

Correcto hoy: el servidor escucha solo en `127.0.0.1`; revisa `Host` y `Origin`; lista fija de colecciones y validación de ids; límite de cuerpo de 256 KB; errores sin detalles internos; la interfaz se arma con `createElement` (sin `innerHTML`); los enlaces de WhatsApp solo llevan dígitos y texto codificado.

Problemas al exponerlo: sin autenticación; sin HTTPS; la revisión de `Host` rechaza un dominio público; sin encabezados de seguridad (CSP, anti-iframe); sin respaldos automáticos; `Origin` ausente se acepta en peticiones que cambian datos; `src/app.js` solo usa el servidor si el protocolo es `http:`.

## 1. Arquitectura

```
Internet ──HTTPS──> Caddy (VPS, puertos 80/443)
                      ▼
                    Node/Express en 127.0.0.1:3000
                      ├─ /login        página de entrada (sin sesión)
                      ├─ /api/auth/*   entrar / salir
                      ├─ /             portal (requiere sesión)
                      └─ /api/:col     datos (requiere sesión)
                      ▼
                    MongoDB Atlas (acceso solo desde la IP del VPS)
                      ├─ clients, services, appointments, promos, settings
                      ├─ users      { _id, passwordHash, failedCount, lockCount, lockedUntil, passwordChangedAt }
                      └─ sessions   { _id: sha256(token), userId, createdAt, lastSeenAt }
```

### Piezas nuevas
- `server/password.js`: `hashPassword(pw)` y `verifyPassword(pw, hash)` con `scrypt` de `node:crypto`, sal aleatoria de 16 bytes y comparación con `timingSafeEqual`. `validatePassword(pw)` exige mínimo 12 caracteres. Formato del hash: `scrypt$N$r$p$salBase64$hashBase64`.
- `server/auth-store.js`: sobre MongoDB. Usuaria (`getUser`, `createUser`, `setPassword`, `recordFailure`, `resetFailures`, `unlock`) y sesiones (`createSession`, `findSession`, `touchSession`, `deleteSession`, `deleteAllSessions`). Crea los índices al arrancar.
- `server/auth.js`: rutas `POST /api/auth/login` y `POST /api/auth/logout`, middleware `requireSession` y el limitador por IP en memoria.
- `server/cli.js`: comandos `crear-usuaria`, `cambiar-contraseña`, `cerrar-sesiones`, `desbloquear`. La contraseña se pide dos veces sin mostrarla.
- `src/login.html`: página de entrada mínima con el estilo del portal; también la ensambla `build.mjs`.

### Cambios a lo existente
- `server/app.js`: `createApp(store, { authStore, publicOrigin, csp, now })`. La revisión de `Host`/`Origin` acepta el origen de `PUBLIC_ORIGIN` además de localhost; encabezados de seguridad; `requireSession` protege `/` y `/api/:col`.
- `server/index.js`: lee `PUBLIC_ORIGIN`; crea índices; no arranca si no existe la usuaria (mensaje: `Crea la usuaria con: node server/cli.js crear-usuaria`).
- `src/app.js`: usa la API del servidor con `http:` o `https:`; ante `401` redirige a `/login`; botón "Salir" en la barra superior; `h()` aplica `style` con `el.style.cssText` en vez de `setAttribute`.
- `src/api-db.js`: expone el estado `401` para que la página redirija.
- `build.mjs`: genera también `dist/login.html` y `dist/csp.json` con los hashes SHA-256 de cada bloque `<script>` y `<style>` de cada página.

Sin `PUBLIC_ORIGIN` el portal funciona en local como hoy, pero también pide contraseña. La versión de claude.ai no cambia.

## 2. Entrar, salir, bloqueo y expiración

### Entrar: `POST /api/auth/login`, cuerpo `{ "password": "…" }`
1. Si el límite por IP se rebasó (20 intentos por 15 minutos) → `429` "Demasiados intentos. Intenta más tarde."
2. Si `lockedUntil > now` → `429` "Demasiados intentos. Intenta en X minutos." No se revisa la contraseña.
3. Se verifica la contraseña.
4. Incorrecta: `failedCount += 1`. Al llegar a 5: `lockedUntil = now + min(15 min × 2^lockCount, 24 h)`, `lockCount += 1`, `failedCount = 0`. Responde `401` "Contraseña incorrecta".
5. Correcta: `failedCount = 0`, `lockCount = 0`. Token de 32 bytes aleatorios; se guarda `sha256(token)` con `createdAt` y `lastSeenAt`. Cookie `nu_session=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`, más `Secure` cuando `PUBLIC_ORIGIN` es `https:`. Responde `204`.

### Cada petición protegida: `requireSession`
- Lee la cookie, calcula su hash y busca la sesión.
- Es inválida si no existe, si `now − lastSeenAt > 7 días`, si `now − createdAt > 30 días` o si `createdAt < passwordChangedAt`. Una sesión inválida encontrada se borra.
- Inválida: en `/api/*` → `401` `{ "error": "Tu sesión terminó. Vuelve a entrar." }`; en `/` → `302` a `/login`.
- Válida: actualiza `lastSeenAt` como máximo una vez por minuto.
- Índices TTL: `sessions.lastSeenAt` con `expireAfterSeconds` de 7 días y `sessions.createdAt` con 30 días.
- `/login` con sesión válida redirige a `/`.

### Salir: `POST /api/auth/logout`
Borra la sesión y la cookie (`Max-Age=0`). Responde `204`.

### Comandos
- `crear-usuaria`: falla si ya existe una.
- `cambiar-contraseña`: actualiza el hash y `passwordChangedAt`; invalida todas las sesiones.
- `cerrar-sesiones`: borra todas las sesiones.
- `desbloquear`: `failedCount = 0`, `lockCount = 0`, `lockedUntil = null`.

Nunca existe una contraseña por defecto.

## 3. Protecciones del servidor

### Encabezados
- `Content-Security-Policy` (ver abajo).
- `Strict-Transport-Security: max-age=31536000` cuando `PUBLIC_ORIGIN` es `https:`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `Cache-Control: no-store` en `/`, `/login` y `/api/*`.

### CSP
`build.mjs` escribe en `dist/csp.json` los hashes de los bloques en línea de cada página. El servidor envía, por página:

```
default-src 'none'; script-src 'sha256-…' …; style-src 'sha256-…';
connect-src 'self'; img-src 'self' data:; form-action 'self';
base-uri 'none'; frame-ancestors 'none'
```

No se usa `'unsafe-inline'`. Los estilos de elementos se aplican con `el.style.cssText`, que la CSP permite.

### CSRF
- Cookie `SameSite=Strict`.
- `POST`, `PUT` y `DELETE` (incluido el login) exigen un `Origin` igual al origen permitido; si falta o es otro → `403`.
- Se mantiene el requisito de `Content-Type: application/json`.

### Proxy
- `app.set("trust proxy", "loopback")`, para que `req.ip` sea la IP real y no se pueda falsificar.
- Node escucha solo en `127.0.0.1`.

### MongoDB Atlas
- Usuario exclusivo con `readWrite` solo sobre `nailsup`.
- Lista de acceso de red: solo la IP del VPS. Conexión `mongodb+srv` con TLS.
- `.env` con permisos `600`, fuera de git; las direcciones se muestran con `redactUri`.

### Registros
Entradas exitosas, fallidas y bloqueos con fecha, IP y resultado. Nunca contraseña ni token.

## 4. Despliegue en el VPS

Todo en `deploy/`, con una guía `deploy/README.md` en español.

- **Sistema:** `ufw` con solo 22, 80 y 443 abiertos; SSH solo con llave y sin `root`; `fail2ban`; `unattended-upgrades`; Node 22 LTS de NodeSource.
- **Caddy** (`deploy/Caddyfile`): `reverse_proxy 127.0.0.1:3000`, `encode gzip`, registro en `/var/log/caddy/portal.log`. Certificado y redirección `http→https` automáticos. Requiere un dominio o subdominio apuntando al VPS.
- **Servicio** (`deploy/nails-up.service`): usuario `nailsup` sin privilegios; `Restart=on-failure`; `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`; `EnvironmentFile` con `MONGODB_URI`, `MONGODB_DB`, `PORT`, `PUBLIC_ORIGIN`.
- **Actualizar** (`deploy/actualizar.sh`): `git pull`, `npm ci --omit=dev`, `npm run build`, `systemctl restart nails-up`.
- **Respaldos:** Atlas M0 no tiene respaldos automáticos. `deploy/respaldo.sh` + `deploy/nails-up-respaldo.service` + `deploy/nails-up-respaldo.timer`: `mongodump --uri … --gzip --archive` diario a las 3:00 en `/var/backups/nailsup`, conservando las últimas 14. La guía explica bajar una copia con `scp` y restaurarla con `mongorestore`.

## 5. Pruebas

`node --test` con almacenes en memoria y reloj inyectable (`now`). TDD en cada pieza.

- `test/password.test.js`: verifica correcta/incorrecta; sal distinta en cada hash; rechaza menos de 12 caracteres; hash mal formado no lanza error y no coincide.
- `test/auth-store.test.js`: crear y encontrar sesión; expira a 7 días sin uso y a 30 en total; inválida tras cambio de contraseña; bloqueo 15, 30, 60… minutos hasta 24 h; `deleteAllSessions`.
- `test/auth.test.js` (HTTP real): login pone cookie con atributos correctos y abre `/api/clients`; sin cookie o con cookie inventada → `401` en API y `302` a `/login` en `/`; quinto fallo bloquea y la contraseña correcta recibe `429` durante el bloqueo; límite por IP en el intento 21; logout invalida; `POST` sin `Origin` o con `Origin` ajeno → `403`.
- `test/server-index.test.js`: `server/index.js` exporta `start({ db, env })`; sin usuaria rechaza con el mensaje de `crear-usuaria` y no abre el puerto.
- `test/server-app.test.js`: entra antes de cada prueba; revisa encabezados, CSP con hashes y `Cache-Control: no-store`.
- `test/build.test.js`: `dist/csp.json` y `dist/login.html` existen; los hashes corresponden a los bloques reales.
- `test/api-db.test.js`: un `401` se informa para redirigir a `/login`.
- `e2e/login.py`: sin sesión lleva a `/login`; contraseña mala muestra error; buena abre la agenda; "Salir" regresa a `/login`; ninguna violación de CSP en consola. Los recorridos existentes entran primero.
- Lista manual en `deploy/README.md`: `curl -I` muestra encabezados; `http://` redirige; el puerto 3000 no responde desde fuera; Atlas rechaza otra IP; un respaldo se restaura.

## Fuera de alcance
- 2FA, recuperación por correo, varias cuentas o roles.
- Copia automática de respaldos fuera del VPS (S3, Backblaze).
- Cambios a la versión publicada en claude.ai.
