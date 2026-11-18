# Publicar Nails Up en un VPS

¿Prefieres no administrar un servidor? La guía [`render.md`](render.md) publica el portal en Render, todo desde Windows.

Guía paso a paso para Ubuntu 24.04: el portal corre en el servidor detrás de Caddy (que pone el candado https) y guarda los datos en MongoDB Atlas.
Cambia `portal.tudominio.com`, `TU_IP`, `admin` y `TU_USUARIO_ATLAS` por tus valores reales.

## 1. DNS
En el panel de tu dominio crea un registro **A** `portal` que apunte a la IP del VPS. Espera unos minutos a que se propague. Caddy no puede conseguir el certificado hasta que esto funcione.

## 2. Usuario administrador y SSH con llave
Entra como `root` la primera vez (`ssh root@TU_IP`) y crea tu usuario:
```
adduser admin
usermod -aG sudo admin
```
Desde **tu computadora** copia tu llave (si no tienes una, crea una con `ssh-keygen -t ed25519`):
```
ssh-copy-id admin@TU_IP
```
Comprueba que entras con `ssh admin@TU_IP` **antes** de seguir. Ya como `admin`, crea `/etc/ssh/sshd_config.d/00-nailsup.conf` (`sudo nano …`) con:
```
PermitRootLogin no
PasswordAuthentication no
```
(El nombre empieza con `00` para que mande sobre otros archivos de esa carpeta.) Aplica y, sin cerrar tu sesión actual, abre otra terminal y comprueba que `ssh admin@TU_IP` sigue entrando:
```
sudo sshd -t && sudo systemctl restart ssh
```

## 3. Firewall, fail2ban y actualizaciones automáticas
```
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades curl git gnupg
sudo ufw allow 22,80,443/tcp
sudo ufw --force enable
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```
`ufw` deja abiertos solo 22, 80 y 443. El puerto 3000 del portal no se abre: solo Caddy lo usa por dentro.

## 4. Node 22, Caddy y las herramientas de MongoDB
**Node 22 (NodeSource):**
```
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v
```
**Caddy (repositorio oficial):**
```
sudo apt -y install debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt -y install caddy
```
**mongodb-database-tools** (para `mongodump` y `mongorestore`, versión 100.3 o más nueva). Ubuntu no lo trae en sus repositorios. Descarga el `.deb` de Ubuntu 24.04 desde <https://www.mongodb.com/try/download/database-tools> (elige tu plataforma, copia el enlace y usa `wget`) y instálalo:
```
sudo apt -y install ./mongodb-database-tools-ubuntu2404-x86_64-100.X.Y.deb
mongodump --version
```
El nombre del archivo cambia con la versión y la arquitectura del VPS.

## 5. MongoDB Atlas
1. Crea un cluster gratis (M0) en <https://cloud.mongodb.com>.
2. **Database Access**: crea un usuario con contraseña larga y el rol **readWrite solo en la base `nailsup`** (Specific Privileges, no "Atlas admin"). Usa solo letras y números en la contraseña; así no hay que codificar nada en la URI y el respaldo funciona sin problemas.
3. **Network Access**: borra `0.0.0.0/0` si existe y agrega **solo la IP del VPS**.
4. **Connect > Drivers**: copia la URI `mongodb+srv://…` y pon tu usuario y contraseña. Ejemplo:
   `mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/`

## 6. Instalar el portal
```
sudo adduser --system --group --home /opt/nails-up nailsup
sudo mkdir -p /var/backups/nailsup /var/log/caddy
sudo chown nailsup:nailsup /var/backups/nailsup
sudo chmod 700 /var/backups/nailsup
sudo -u nailsup git clone URL_DE_TU_REPOSITORIO /opt/nails-up
sudo -u nailsup bash -c 'cd /opt/nails-up && npm ci --omit=dev && npm run build'
```
(Si el repositorio es privado, `git clone` necesita una llave de despliegue o un token; configúralo para el usuario `nailsup`.)

Crea el archivo de variables, que guarda la contraseña de Atlas. Primero se crea vacío con permisos 600, para que la contraseña nunca sea legible por otros:
```
sudo -u nailsup install -m 600 /dev/null /opt/nails-up/.env
sudo -u nailsup nano /opt/nails-up/.env
```
```
MONGODB_URI="mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB=nailsup
PORT=3000
PUBLIC_ORIGIN=https://portal.tudominio.com
```
La URI **va entre comillas dobles**, completa y con todo lo que Atlas pone después del `?` (por ejemplo `?retryWrites=true&w=majority`): sin comillas, el `&` rompe el respaldo.
Crea la usuaria del portal (pide una contraseña de 12 caracteres o más):
```
sudo -u nailsup bash -c 'cd /opt/nails-up && node --env-file-if-exists=.env server/cli.js crear-usuaria'
```
El mismo programa tiene `cambiar-contraseña`, `cerrar-sesiones` (saca a todos los dispositivos) y `desbloquear` (cuando se bloquea por intentos fallidos).

## 7. Activar servicios y respaldo
```
sudo chmod +x /opt/nails-up/deploy/*.sh
sudo cp /opt/nails-up/deploy/nails-up.service /opt/nails-up/deploy/nails-up-respaldo.service /opt/nails-up/deploy/nails-up-respaldo.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nails-up
sudo systemctl enable --now nails-up-respaldo.timer
sudo cp /opt/nails-up/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile        # cambia portal.tudominio.com por tu dominio
sudo chown caddy:caddy /var/log/caddy
sudo systemctl reload caddy
```
Revisa que todo esté bien: `systemctl status nails-up` y `journalctl -u nails-up -n 30`. Abre `https://portal.tudominio.com`.

Cuando haya cambios nuevos, ejecuta con tu usuario `admin` (necesita `sudo`, que ya tiene):
```
/opt/nails-up/deploy/actualizar.sh
```

## 8. Respaldos y restauración
Atlas M0 no hace respaldos automáticos. El timer guarda una copia cada día a las 03:00 (hora del reloj del servidor, normalmente UTC; revisa o cambia con `timedatectl`) en `/var/backups/nailsup` y conserva las últimas 14. Pruébalo ahora:
```
sudo systemctl start nails-up-respaldo.service
sudo ls -l /var/backups/nailsup
```
Baja una copia a tu computadora (la carpeta solo la lee `nailsup`, por eso se copia primero a tu carpeta):
```
ssh -t admin@TU_IP 'sudo cp /var/backups/nailsup/nailsup-AAAA-MM-DD.gz ~/ && sudo chown admin ~/nailsup-AAAA-MM-DD.gz'
scp admin@TU_IP:nailsup-AAAA-MM-DD.gz .
```
Borra la copia del VPS cuando termines (`rm ~/nailsup-AAAA-MM-DD.gz`).

Para **restaurar** (con `--drop` reemplaza los datos actuales de esas colecciones), desde donde esté el archivo:
```
mongorestore --uri "mongodb+srv://TU_USUARIO_ATLAS:LA_CONTRASEÑA@cluster0.xxxxx.mongodb.net/" --gzip --archive=nailsup-AAAA-MM-DD.gz --drop
```
(Si lo corres desde tu computadora, agrega antes tu IP en Network Access de Atlas, y quítala al terminar.) Para probar sin tocar los datos reales, restaura a otra base con `--nsFrom 'nailsup.*' --nsTo 'nailsup_prueba.*'`; esto necesita un usuario de Atlas con permiso en esa base. Bórrala después.

## 9. Lista de verificación
Marca cada punto después de instalar:
- [ ] `curl -I https://portal.tudominio.com` responde y muestra los encabezados de seguridad (por ejemplo `strict-transport-security`, `content-security-policy`, `x-content-type-options`).
- [ ] `curl -I http://portal.tudominio.com` redirige (301 o 308) a `https://`.
- [ ] Desde **tu computadora** (no el VPS), `curl --max-time 5 http://TU_IP:3000` falla.
- [ ] Atlas rechaza otra IP: desde otra red, la URI no conecta.
- [ ] Entrar con la contraseña funciona, y sin ella te manda a `/login`.
- [ ] Los respaldos corren: `systemctl list-timers nails-up-respaldo.timer` muestra la próxima ejecución; después de la primera noche, `journalctl -u nails-up-respaldo -n 20` no muestra errores y `sudo ls -l /var/backups/nailsup` tiene un archivo del día.
- [ ] Una restauración de prueba funciona (sección 8).
- [ ] `sudo ufw status` muestra solo 22, 80 y 443; `sudo fail2ban-client status sshd` responde.
