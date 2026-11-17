# Nails Up: modo local con MongoDB (diseño corto)

Fecha: 2026-11-17. Aprobado por la dueña en el chat.

## Intención
Poder usar el portal en su computadora guardando los datos en su MongoDB local, sin depender de claude.ai.

## Metas
- `npm start` levanta un servidor local y el portal queda en `http://localhost:3000`.
- Mismas pantallas y lógica que hoy; solo cambia dónde se guardan los datos.
- El mismo `dist/index.html` sigue funcionando en el artifact publicado (capacidad `db`).

## No metas
- Acceso desde otros dispositivos o internet, login y usuarios (el servidor escucha solo en 127.0.0.1).
- Migrar datos del portal de claude.ai (se ofrece importación solo si la dueña ya capturó datos reales).
- Aplicación de escritorio.

## Anti-metas
- Que otra página web abierta en su navegador pueda leer o escribir sus datos locales.
- Subir contraseñas o direcciones de MongoDB a GitHub.

## Decisiones (de Claude, aprobadas en conjunto)
- Node + Express + driver oficial `mongodb`; `MONGODB_URI` (por defecto `mongodb://localhost:27017`) y `MONGODB_DB` (por defecto `nailsup`) en `.env`.
- API REST mínima sobre las mismas cinco colecciones: clients, services, appointments, promos, settings.
- La página elige el almacenamiento al arrancar: capacidad `db` de claude.ai si existe; si no, la API del servidor si se sirve por http; si no, el aviso de base de datos no disponible.
- El servidor solo acepta peticiones con `Host` localhost/127.0.0.1 y con contenido JSON, para frenar escrituras desde otras páginas y rebinding de DNS.
- Pruebas del servidor con un almacén en memoria; la prueba contra MongoDB real la hace la dueña.

## Aproximaciones consideradas
1. Servidor local Node/Express + MongoDB (elegida).
2. Servidor con login expuesto a internet: para cuando quiera usarlo en el celular; no ahora.
3. App de escritorio (Electron): demasiado para el caso.
