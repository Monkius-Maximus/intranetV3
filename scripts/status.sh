#!/usr/bin/env bash
#
# Intranet SEPLAG — verificação de saúde (somente leitura, sem efeitos).
#
set -uo pipefail

green() { printf '\033[1;32m[\xe2\x9c\x93]\033[0m %s\n' "$*"; }
red()   { printf '\033[1;31m[\xe2\x9c\x97]\033[0m %s\n' "$*"; }

check_service() {
  local svc="$1"
  if systemctl is-active --quiet "$svc"; then
    green "$svc ativo"
  else
    red "$svc inativo"
  fi
}

echo "== Servicos =="
check_service postgresql
check_service intranet-backend
check_service nginx

echo
echo "== Health check (backend) =="
if body="$(curl -fsS --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null)"; then
  green "GET /api/health -> $body"
else
  red "GET /api/health sem resposta"
fi
