#!/usr/bin/env bash
#
# Intranet SEPLAG — atualização a partir de um bundle novo.
#
# Faz backup do banco e re-executa o instalador (idempotente: atualiza o código
# e preserva os dados). Rode a partir do bundle NOVO já extraído.
#
# Uso:   sudo bash scripts/update-server.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ $EUID -eq 0 ]] || {
  echo "Execute como root: sudo bash scripts/update-server.sh" >&2
  exit 1
}

echo "[*] Backup do banco antes de atualizar..."
bash "$SCRIPT_DIR/backup-db.sh"

echo "[*] Re-executando instalador (preserva dados)..."
bash "$SCRIPT_DIR/install-server.sh"
