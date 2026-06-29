#!/usr/bin/env bash
#
# Intranet SEPLAG — backup operacional do banco (pg_dump comprimido).
#
# Uso:   sudo bash scripts/backup-db.sh [DIRETORIO_DESTINO]
# Padrão do destino: /opt/intranet/backups
#
set -euo pipefail

APP_DB="intranet"
BACKUP_DIR="${1:-/opt/intranet/backups}"

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/backup-$ts.sql.gz"

sudo -u postgres pg_dump --no-owner "$APP_DB" | gzip > "$out"

printf '\033[1;32m[\xe2\x9c\x93]\033[0m Backup criado: %s (%s)\n' \
  "$out" "$(du -h "$out" | cut -f1)"
