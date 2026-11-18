# Respaldo de Nails Up desde Windows: descarga una copia de la base de Atlas a tu PC
# y conserva las 14 mas nuevas. Guia: deploy/render.md, seccion "Respaldos".
# Uso: powershell -ExecutionPolicy Bypass -File deploy\respaldo.ps1
param(
  [string]$Carpeta = (Join-Path $env:USERPROFILE "Documents\Respaldos Nails Up"),
  [string]$Base = "nailsup"
)
$ErrorActionPreference = "Stop"

# La URI (con la contrasena) se lee de un archivo, no de la linea de comandos,
# para que no quede en el historial ni en la lista de procesos.
$conf = Join-Path $Carpeta "atlas.yaml"
if (-not (Test-Path $conf)) {
  throw "Falta $conf. Crealo con una sola linea: uri: ""mongodb+srv://USUARIO:CONTRASENA@cluster0.xxxxx.mongodb.net/"""
}
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) {
  throw "No se encontro mongodump. Instala MongoDB Database Tools y agrega su carpeta bin al PATH."
}

$out = Join-Path $Carpeta ("nailsup-" + (Get-Date -Format "yyyy-MM-dd") + ".gz")
$tmp = "$out.tmp"
try {
  & mongodump --config "$conf" --db $Base --gzip "--archive=$tmp" --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "mongodump fallo (codigo $LASTEXITCODE). Revisa que la IP de esta PC este en Network Access de Atlas."
  }
  Move-Item -Force $tmp $out
} finally {
  if (Test-Path $tmp) { Remove-Item -Force $tmp }
}

Get-ChildItem $Carpeta -Filter "nailsup-*.gz" | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Host "Respaldo listo: $out"
