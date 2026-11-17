#!/usr/bin/env bash
# Respaldo diario de la base. Corre como usuario "nailsup" (ver nails-up-respaldo.service).
set -euo pipefail
umask 077

DIR=/var/backups/nailsup
# .env es 600 y del mismo usuario que corre este script, por eso es seguro cargarlo.
set -a
. /opt/nails-up/.env
set +a

mkdir -p "$DIR"

# La URI (con la contraseña) va en un archivo temporal 600, no en la línea de
# comandos, para que no aparezca en "ps". Se borra al terminar.
CONF=$(mktemp)
OUT="$DIR/nailsup-$(date +%F).gz"
TMP="$OUT.tmp"
trap 'rm -f "$CONF" "$TMP"' EXIT
printf 'uri: "%s"\n' "$MONGODB_URI" > "$CONF"

mongodump --config "$CONF" --db "$MONGODB_DB" --gzip \
  --archive="$TMP" --quiet
mv -f "$TMP" "$OUT"

# Conserva solo los 14 más nuevos.
ls -1t "$DIR"/nailsup-*.gz 2>/dev/null | tail -n +15 | xargs -r rm -f --
echo "Respaldo listo en $DIR"
