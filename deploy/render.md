# Publicar Nails Up en Render con MongoDB Atlas (desde Windows)

Todo se hace desde tu PC con Windows: los paneles web de GitHub, Render y Atlas, y PowerShell en la carpeta del proyecto.
Render corre el portal y le pone el candado https; Atlas guarda los datos.

Cambia `TU_USUARIO_ATLAS`, `LA_CONTRASEÑA`, `cluster0.xxxxx` y `nails-up.onrender.com` por tus valores reales.

## 1. MongoDB Atlas
1. Crea un cluster gratis (M0) en <https://cloud.mongodb.com>.
2. **Database Access**: crea un usuario con contraseña larga y el rol **readWrite solo en la base `nailsup`** (Specific Privileges, no "Atlas admin"). Usa solo letras y números en la contraseña; así no hay que codificar nada en la URI.
3. **Network Access**: borra `0.0.0.0/0` si existe. Por ahora agrega **tu IP** con "Add current IP address" para poder crear la usuaria desde tu PC (paso 2). En el paso 4 agregas las de Render.
4. **Connect > Drivers**: copia la URI `mongodb+srv://…` y pon tu usuario y contraseña. Ejemplo:
   `mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 2. Crear la usuaria del portal (desde tu PC)
Render no tiene terminal en el plan gratis, así que la usuaria se crea desde tu PC directo en Atlas.
En PowerShell, en la carpeta del proyecto, crea el archivo `.env.atlas` (ya está en `.gitignore`, nunca se sube):
```
notepad .env.atlas
```
Con este contenido (la URI **entre comillas dobles**):
```
MONGODB_URI="mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB=nailsup
```
Crea la usuaria (pide una contraseña de 12 caracteres o más):
```
node --env-file=.env.atlas server/cli.js crear-usuaria
```
Con el mismo archivo funcionan `cambiar-contraseña`, `cerrar-sesiones` (saca a todos los dispositivos) y `desbloquear` (cuando se bloquea por intentos fallidos), por ejemplo:
```
node --env-file=.env.atlas server/cli.js desbloquear
```
Cada vez que los uses, tu IP debe estar en Network Access de Atlas.

## 3. Subir el proyecto a GitHub
Render toma el código de GitHub.
1. En <https://github.com/new> crea un repositorio **privado** llamado `nails-up`, sin README ni .gitignore.
2. En PowerShell, en la carpeta del proyecto (cambia `TU_USUARIO_GITHUB`):
   ```
   git remote add origin https://github.com/TU_USUARIO_GITHUB/nails-up.git
   git push -u origin master
   ```
   La primera vez Windows abre una ventana para iniciar sesión en GitHub.

## 4. Crear el servicio en Render
1. Crea tu cuenta en <https://render.com> y conecta tu cuenta de GitHub.
2. **New > Blueprint**, elige el repositorio `nails-up`. Render lee `render.yaml` y te pide dos valores:
   - `MONGODB_URI`: la misma URI del paso 1, **sin comillas**.
   - `PUBLIC_ORIGIN`: `https://nails-up.onrender.com` (sin `/` al final).
3. Crea el servicio. La dirección real aparece arriba en la página del servicio. Si Render le agregó letras (por ejemplo `nails-up-ab12.onrender.com`), corrige `PUBLIC_ORIGIN` en **Environment**; Render vuelve a desplegar solo.
4. En la página del servicio, **Connect > Outbound**: copia las IP de salida de Render y agrégalas una por una en **Network Access** de Atlas. Después, en Render, **Manual Deploy > Deploy latest commit**.
5. En **Logs** debe aparecer `Portal listo en https://…`. Abre la dirección y entra con tu contraseña.

Si en los Logs aparece "No se pudo conectar a MongoDB", revisa la URI y que las IP de Render estén en Atlas. Esas IP son compartidas por la región y pueden cambiar: si un día deja de conectar, vuelve a copiarlas.

**Plan:** el gratis se duerme a los 15 minutos sin uso y tarda cerca de un minuto en despertar. Para uso diario cambia a **Starter** en Settings > Instance Type (o `plan: starter` en `render.yaml`).

**Dominio propio (opcional):** en Settings > Custom Domains agrega por ejemplo `portal.tudominio.com` y crea en tu dominio el registro CNAME que Render te indique. Luego cambia `PUBLIC_ORIGIN` a `https://portal.tudominio.com`.

## 5. Actualizar
Cada `git push` a `master` despliega solo (`autoDeploy`). Las pruebas no corren en Render: corre `npm test` antes de subir.

## 6. Respaldos
Atlas M0 no hace respaldos y Render no guarda archivos, así que las copias se bajan a tu PC con `deploy/respaldo.ps1`.
1. Instala **MongoDB Database Tools** para Windows (el `.msi`) desde <https://www.mongodb.com/try/download/database-tools> y agrega su carpeta `bin` al PATH (por ejemplo `C:\Program Files\MongoDB\Tools\100\bin`). Abre una PowerShell nueva y comprueba con `mongodump --version`.
2. Crea la carpeta `Documentos\Respaldos Nails Up` y dentro el archivo `atlas.yaml` con una sola línea (la URI entre comillas):
   ```
   uri: "mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
   ```
3. Con tu IP en Network Access de Atlas, corre:
   ```
   powershell -ExecutionPolicy Bypass -File deploy\respaldo.ps1
   ```
   Guarda `nailsup-AAAA-MM-DD.gz` en esa carpeta y conserva los 14 más nuevos.

**Automático (opcional):** en el **Programador de tareas** de Windows crea una tarea diaria con la acción `powershell.exe` y los argumentos `-ExecutionPolicy Bypass -File "C:\Proyectos\nails-up\deploy\respaldo.ps1"`. Para que funcione sin que tú hagas nada, tu IP de casa debe quedarse en Atlas; si tu proveedor te la cambia, el respaldo falla hasta que la actualices.

**Restaurar** (con `--drop` reemplaza los datos actuales de esas colecciones), desde la carpeta del respaldo:
```
mongorestore --uri "mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/" --gzip --archive=nailsup-AAAA-MM-DD.gz --drop
```
Para probar sin tocar los datos reales, restaura a otra base con `--nsFrom "nailsup.*" --nsTo "nailsup_prueba.*"`; esto necesita un usuario de Atlas con permiso en esa base. Bórrala después.

## 7. Lista de verificación
En PowerShell usa `curl.exe` (con `.exe`), porque `curl` solo es otro comando.
- [ ] `curl.exe -I https://nails-up.onrender.com/login` muestra los encabezados de seguridad (`strict-transport-security`, `content-security-policy`, `x-content-type-options`).
- [ ] `curl.exe -I http://nails-up.onrender.com/login` redirige a `https://`.
- [ ] Entrar con la contraseña funciona, y sin ella te manda a `/login`.
- [ ] **La IP que registra el portal es la tuya.** Escribe una contraseña equivocada una vez y busca en **Logs** de Render la línea con `"ip"`. Compárala con tu IP (`curl.exe https://ifconfig.me`). Si coinciden, todo bien. Si sale otra (de Render o Cloudflare), cambia `TRUST_PROXY` a `2` en Environment y repite la prueba. Nunca pongas `true`: aceptaría IPs inventadas.
- [ ] En Atlas, Network Access tiene solo las IP de Render (y la tuya si usas respaldos automáticos); no `0.0.0.0/0`.
- [ ] Un respaldo y una restauración de prueba funcionan (sección 6).
