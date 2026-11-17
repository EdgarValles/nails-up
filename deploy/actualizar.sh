#!/usr/bin/env bash
# Actualiza el portal: ejecútalo con tu usuario administrador (el que tiene sudo).
# git y npm corren como "nailsup", que es el dueño de /opt/nails-up.
set -euo pipefail

cd /opt/nails-up
como_nailsup() {
  if [ "$(id -un)" = "nailsup" ]; then "$@"; else sudo -u nailsup "$@"; fi
}

como_nailsup git pull
como_nailsup npm ci --omit=dev
como_nailsup npm run build
sudo systemctl restart nails-up
echo "Listo: el portal se actualizó y se reinició."
