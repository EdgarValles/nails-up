# Nails Up: portal de administración

Portal privado para llevar citas, clientas, cobros, descuentos y promociones de Nails Up.

## Comandos
- `npm test`: pruebas de la lógica (Node 22, sin dependencias).
- `npm run build`: genera `dist/index.html`, la página única que se publica.
- `e2e/*.py`: recorridos en navegador con Playwright (abren `dist/index.html#demo`, que usa una base de datos en memoria).

## Estructura
- `src/logic.js`: descuentos, lealtad, fechas, teléfonos, captación.
- `src/data.js`: capa de datos sobre la capacidad `db` de los artifacts de Claude.
- `src/app.js` y `src/styles.css`: pantallas y estilos.
- `docs/superpowers/`: diseño y plan de construcción.

Los datos se guardan con la capacidad `db` del artifact, con reglas de acceso solo para la dueña (`admin`).
