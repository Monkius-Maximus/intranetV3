#!/usr/bin/env bash
#
# Intranet SEPLAG — instalador OFFLINE (roda no SERVIDOR, como root).
#
# Idempotente: rodar de novo com um bundle novo atualiza o código e PRESERVA o
# banco de dados. Falha cedo e alto: se um passo falhar, para nele e diz onde.
#
# Uso (a partir do bundle extraído):
#     sudo bash scripts/install-server.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
BUNDLE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPS_DIR="$BUNDLE_ROOT/deps"
APP_SRC="$BUNDLE_ROOT/app"
CONFIG_DIR="$BUNDLE_ROOT/config"

APP_DB="intranet"
APP_DB_USER="intranet_app"
SYS_USER="intranet"
INSTALL_DIR="/opt/intranet"
NODE_DIR="/opt/node"

IS_REINSTALL=0
ADMIN_PASSWORD=""
CURRENT_STEP="init"

# ---------------------------------------------------------------------------
# Saída
# ---------------------------------------------------------------------------
log()  { printf '\033[1;34m[*]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[\xe2\x9c\x93]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[\xe2\x9c\x97] %s\033[0m\n' "$*" >&2; exit 1; }

on_error() {
  printf '\033[1;31m[\xe2\x9c\x97] Falha no passo "%s" (linha %s). Instalacao interrompida.\033[0m\n' \
    "$CURRENT_STEP" "$1" >&2
  exit 1
}
trap 'on_error "$LINENO"' ERR

# ---------------------------------------------------------------------------
# Passos
# ---------------------------------------------------------------------------
preflight() {
  CURRENT_STEP="preflight"
  [[ $EUID -eq 0 ]] || die "Execute como root: sudo bash scripts/install-server.sh"

  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] \
    || die "Requer Ubuntu 24.04 LTS (encontrado: ${PRETTY_NAME:-desconhecido})."
  [[ "$(dpkg --print-architecture)" == "amd64" ]] \
    || die "Requer arquitetura amd64."

  local d
  for d in deps app config; do
    [[ -d "$BUNDLE_ROOT/$d" ]] \
      || die "Diretorio do bundle ausente: $d/ (rode a partir do bundle extraido)."
  done
  [[ -d "$DEPS_DIR/debs" ]] || die "deps/debs/ ausente no bundle."
  compgen -G "$DEPS_DIR/debs/*.deb" >/dev/null || die "Nenhum .deb em deps/debs/ (bundle incompleto)."
  compgen -G "$DEPS_DIR/node-v*-linux-x64.tar.xz" >/dev/null || die "Tarball do Node ausente em deps/ (bundle incompleto)."
  ok "Pre-condicoes atendidas (Ubuntu 24.04 amd64, root, bundle completo)."
}

detect_reinstall() {
  CURRENT_STEP="detect_reinstall"
  if sudo -u postgres psql -tAc \
       "SELECT 1 FROM pg_database WHERE datname='$APP_DB'" 2>/dev/null | grep -q 1; then
    IS_REINSTALL=1
    warn "Instalacao previa detectada (banco '$APP_DB' existe). Os dados serao preservados."
  else
    IS_REINSTALL=0
    log "Nova instalacao."
  fi
}

prompt_admin_password() {
  CURRENT_STEP="prompt_admin_password"
  if [[ "$IS_REINSTALL" == "1" ]]; then
    log "Reinstalacao: senha do admin preservada (nao sera solicitada)."
    return
  fi
  local p1 p2
  while true; do
    read -rsp "Defina a senha do usuario 'admin' da aplicacao (min. 8): " p1; echo
    [[ ${#p1} -ge 8 ]] || { warn "Minimo de 8 caracteres."; continue; }
    read -rsp "Confirme a senha: " p2; echo
    [[ "$p1" == "$p2" ]] || { warn "As senhas nao conferem."; continue; }
    break
  done
  ADMIN_PASSWORD="$p1"
  ok "Senha do admin definida."
}

install_packages() {
  CURRENT_STEP="install_packages"
  log "Instalando pacotes .deb do bundle (offline)..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-download "$DEPS_DIR"/debs/*.deb
  ok "Pacotes instalados (PostgreSQL 16, nginx, UFW)."
}

install_node() {
  CURRENT_STEP="install_node"
  local tarball
  tarball="$(find "$DEPS_DIR" -maxdepth 1 -name 'node-v*-linux-x64.tar.xz' | head -n1)"
  [[ -n "$tarball" ]] || die "Tarball do Node nao encontrado em deps/."
  log "Instalando Node em $NODE_DIR ..."
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  tar -xJf "$tarball" -C "$NODE_DIR" --strip-components=1
  printf 'export PATH=%s/bin:$PATH\n' "$NODE_DIR" > /etc/profile.d/node.sh
  chmod 644 /etc/profile.d/node.sh
  ok "Node instalado: $("$NODE_DIR/bin/node" --version)"
}

create_system_user() {
  CURRENT_STEP="create_system_user"
  if id "$SYS_USER" &>/dev/null; then
    log "Usuario de sistema '$SYS_USER' ja existe."
  else
    useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "$SYS_USER"
    ok "Usuario de sistema '$SYS_USER' criado."
  fi
}

setup_postgres() {
  CURRENT_STEP="setup_postgres"
  systemctl enable --now postgresql

  if ! sudo -u postgres psql -tAc \
        "SELECT 1 FROM pg_roles WHERE rolname='$APP_DB_USER'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $APP_DB_USER LOGIN;"
    ok "Role '$APP_DB_USER' criada."
  fi

  if ! sudo -u postgres psql -tAc \
        "SELECT 1 FROM pg_database WHERE datname='$APP_DB'" | grep -q 1; then
    sudo -u postgres createdb -O "$APP_DB_USER" "$APP_DB"
    ok "Banco '$APP_DB' criado."
  fi

  if [[ "$IS_REINSTALL" == "0" ]]; then
    log "Importando schema e dados..."
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$APP_DB" <<SQL
SET ROLE $APP_DB_USER;
\i $APP_SRC/database/schema.sql
\i $APP_SRC/database/seed.sql
SQL
    ok "Schema e dados importados."
  else
    log "Reinstalacao: banco preservado (schema/dados nao reimportados)."
  fi
}

deploy_app() {
  CURRENT_STEP="deploy_app"
  log "Publicando aplicacao em $INSTALL_DIR ..."
  mkdir -p "$INSTALL_DIR/backend" "$INSTALL_DIR/frontend"

  # Backend: substitui o código mantendo o .env existente.
  find "$INSTALL_DIR/backend" -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
  cp -a "$APP_SRC/backend/." "$INSTALL_DIR/backend/"

  # Frontend: substituição completa (sem estado).
  rm -rf "$INSTALL_DIR/frontend"
  mkdir -p "$INSTALL_DIR/frontend"
  cp -a "$APP_SRC/frontend/." "$INSTALL_DIR/frontend/"

  chown -R "$SYS_USER:$SYS_USER" "$INSTALL_DIR"
  ok "Aplicacao publicada."
}

set_admin_password() {
  CURRENT_STEP="set_admin_password"
  [[ "$IS_REINSTALL" == "0" ]] || return 0
  log "Definindo senha do admin (bcrypt)..."
  # Usa o proprio util do app (dist/auth.js) — mesma logica que o login verifica.
  local hash
  hash="$("$NODE_DIR/bin/node" \
    -e 'const {hashPassword}=require("/opt/intranet/backend/dist/auth.js");process.stdout.write(hashPassword(process.argv[1],12));' \
    "$ADMIN_PASSWORD")"
  # Lido via stdin (não -c): só assim o psql interpola :'hash', que cita o valor
  # com segurança (o hash bcrypt contém '$').
  sudo -u postgres psql -v ON_ERROR_STOP=1 -v hash="$hash" -d "$APP_DB" <<'SQL'
UPDATE users SET password_hash = :'hash' WHERE username = 'admin';
SQL
  ok "Senha do admin gravada."
}

generate_env() {
  CURRENT_STEP="generate_env"
  local env_file="$INSTALL_DIR/backend/.env"

  if [[ -f "$env_file" ]]; then
    log ".env existente preservado."
    chmod 600 "$env_file"
    chown "$SYS_USER:$SYS_USER" "$env_file"
    return
  fi

  log "Gerando .env com segredos aleatorios..."
  local db_pass jwt_secret
  db_pass="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 48)"

  # Recuperação: se o banco já existe mas o .env sumiu, reseta a senha da role
  # para casar com o novo .env. Nunca dropa o banco.
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -c "ALTER ROLE $APP_DB_USER WITH PASSWORD '$db_pass';"

  cat > "$env_file" <<EOF
HOST=127.0.0.1
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$APP_DB
DB_USER=$APP_DB_USER
DB_PASSWORD=$db_pass
JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=28800
EOF
  chmod 600 "$env_file"
  chown "$SYS_USER:$SYS_USER" "$env_file"
  ok ".env gerado (modo 600, dono $SYS_USER)."
}

setup_nginx() {
  CURRENT_STEP="setup_nginx"
  install -m 644 "$CONFIG_DIR/nginx-intranet.conf" /etc/nginx/sites-available/intranet
  ln -sf /etc/nginx/sites-available/intranet /etc/nginx/sites-enabled/intranet
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
  ok "nginx configurado e ativo."
}

setup_systemd() {
  CURRENT_STEP="setup_systemd"
  install -m 644 "$CONFIG_DIR/intranet-backend.service" \
    /etc/systemd/system/intranet-backend.service
  systemctl daemon-reload
  systemctl enable intranet-backend
  systemctl restart intranet-backend
  ok "Servico intranet-backend ativo."
}

setup_firewall() {
  CURRENT_STEP="setup_firewall"
  ufw allow 80/tcp
  ufw --force enable
  ok "Firewall (UFW) ativo: somente a porta 80 liberada."
}

pin_packages() {
  CURRENT_STEP="pin_packages"
  apt-mark hold postgresql-16 postgresql-client-16 nginx nginx-common nginx-core >/dev/null
  if systemctl list-unit-files 2>/dev/null | grep -q '^unattended-upgrades'; then
    systemctl disable --now unattended-upgrades 2>/dev/null || true
  fi
  ok "Pacotes criticos travados (apt-mark hold); unattended-upgrades desabilitado."
}

print_summary() {
  CURRENT_STEP="print_summary"
  local ip host
  ip="$(hostname -I | awk '{print $1}')"
  host="$(hostname)"
  echo
  ok "Instalacao concluida."
  cat <<EOF

--------------------------------------------------
 Intranet SEPLAG -- instalada
--------------------------------------------------
 Acesso:    http://$ip
 Hostname:  $host
 IP:        $ip

 Para o TI cadastrar no DNS (Windows Server):
   FQDN sugerido:  intranet.seplag.local  ->  $ip

 Operacao:
   systemctl status intranet-backend
   systemctl restart intranet-backend
   journalctl -u intranet-backend -f
   curl http://127.0.0.1:3000/api/health
   bash scripts/status.sh
--------------------------------------------------
EOF
}

main() {
  preflight
  detect_reinstall
  prompt_admin_password
  install_packages
  install_node
  create_system_user
  setup_postgres
  deploy_app
  set_admin_password
  generate_env
  setup_nginx
  setup_systemd
  setup_firewall
  pin_packages
  print_summary
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
