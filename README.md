# Nails Up: portal de administración

Portal privado para llevar citas, clientas, cobros, descuentos y promociones de Nails Up.
Funciona de dos maneras con el mismo código:

1. **Local, con tu MongoDB** (esta guía).
2. **Publicado en claude.ai**, que guarda los datos en la base del propio artifact.

## Usarlo en tu computadora (Windows)

Necesitas Node.js 22 o más nuevo y MongoDB encendido en tu computadora.

1. Abre una terminal en la carpeta del proyecto e instala una vez:
   ```
   npm install
   ```
2. Copia `.env.example` como `.env`. Si tu MongoDB es el instalado por defecto, no hace falta cambiar nada. `.env` nunca se sube a GitHub.
3. Enciende MongoDB (el servicio "MongoDB Server" en Windows debe estar en ejecución).
4. Arranca el portal:
   ```
   npm start
   ```
   Debe decir `Portal listo en http://localhost:3000`.
5. Abre `http://localhost:3000` en el navegador.

Si MongoDB está apagado, `npm start` termina con el mensaje "No se pudo conectar a MongoDB… Revisa que esté encendido."

El servidor escucha solo en tu computadora (`127.0.0.1`) y rechaza peticiones de otras páginas. No tiene usuario ni contraseña porque nadie más puede llegar a él. Si lo quieres usar desde el celular, hay que agregar un inicio de sesión antes.

### Variables (`.env`)
- `MONGODB_URI`: por defecto `mongodb://localhost:27017`
- `MONGODB_DB`: por defecto `nailsup`
- `PORT`: por defecto `3000`

## Respaldo
Tus datos están en la base `nailsup` de MongoDB. Para guardar una copia: `mongodump --db nailsup --out respaldo`.

## Desarrollo
- `npm test`: pruebas de lógica, API y adaptador.
- `npm run build`: genera `dist/index.html`.
- `#demo` al final de la dirección (abriendo `dist/index.html` directo) usa una base temporal en memoria, solo para ver el diseño.
- `e2e/*.py`: recorridos en navegador con Playwright.
- `docs/superpowers/`: diseños y planes.
