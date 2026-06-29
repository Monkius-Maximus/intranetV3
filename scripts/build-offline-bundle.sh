#!/usr/bin/env bash
#
# Intranet SEPLAG — gerador do bundle OFFLINE (roda na maquina DEV com internet).
#
# Produz um unico .tar.gz autocontido que o servidor air-gapped instala sem
# tocar a rede. Rode numa WSL2 Ubuntu 24.04 LIMPA (mesma versao do servidor).
#
# Uso:   bash scripts/build-offline-bundle.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Constantes (versao do Node FIXADA em todo o pipeline)
# ---------------------------------------------------------------------------
NODE_VERSION="22.23.1"
NODE_DIST="node-v${NODE_VERSION}-linux-x64"
NODE_TARBALL="${NODE_DIST}.tar.xz"
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"

DEB_PACKAGES=(
  postgresql-16 postgresql-client-16 postgresql-contrib-16
  nginx nginx-common nginx-core
  ufw
)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/offline-builds"
CACHE_DIR="$OUT_DIR/.cache"

TS="$(date +%Y%m%d-%H%M%S)"
BUNDLE_NAME="intranet-bundle-$TS"
STAGING="$OUT_DIR/$BUNDLE_NAME"

CURRENT_STEP="init"

# ---------------------------------------------------------------------------
# Saida
# ---------------------------------------------------------------------------
log()  { printf '\033[1;34m[*]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[\xe2\x9c\x93]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[\xe2\x9c\x97] %s\033[0m\n' "$*" >&2; exit 1; }

on_error() {
  printf '\033[1;31m[\xe2\x9c\x97] Falha no passo "%s" (linha %s).\033[0m\n' \
    "$CURRENT_STEP" "$1" >&2
  exit 1
}
trap 'on_error "$LINENO"' ERR

# ---------------------------------------------------------------------------
# Passos
# ---------------------------------------------------------------------------
check_environment() {
  CURRENT_STEP="check_environment"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || die \
    "A maquina DEV deve ser Ubuntu 24.04 (mesma do servidor); senao os .deb nao casam com o alvo. Encontrado: ${PRETTY_NAME:-?}"
  [[ "$(dpkg --print-architecture)" == "amd64" ]] || die "Arquitetura deve ser amd64."

  local tool
  for tool in curl tar xz sha256sum npm node apt-get dpkg openssl; do
    command -v "$tool" >/dev/null || die "Ferramenta ausente: $tool"
  done
  ok "Ambiente DEV valido (Ubuntu 24.04 amd64)."
}

node_checksum_ok() {
  local tarball="$1" sums="$2" expected
  expected="$(grep " ${NODE_TARBALL}\$" "$sums" 2>/dev/null | awk '{print $1}')"
  [[ -n "$expected" ]] || return 1
  echo "${expected}  ${tarball}" | sha256sum -c - >/dev/null 2>&1
}

download_nodejs() {
  CURRENT_STEP="download_nodejs"
  mkdir -p "$CACHE_DIR"
  local tarball="$CACHE_DIR/$NODE_TARBALL"
  local sums="$CACHE_DIR/SHASUMS256-${NODE_VERSION}.txt"

  curl -fSL --retry 3 -o "$sums" "$NODE_BASE_URL/SHASUMS256.txt"

  if [[ -f "$tarball" ]] && node_checksum_ok "$tarball" "$sums"; then
    log "Node $NODE_VERSION em cache e integro."
  else
    log "Baixando Node $NODE_VERSION ..."
    curl -fSL --retry 3 -o "$tarball" "$NODE_BASE_URL/$NODE_TARBALL"
  fi

  node_checksum_ok "$tarball" "$sums" || die "Checksum do Node nao confere."
  cp "$tarball" "$STAGING/deps/$NODE_TARBALL"
  ok "Node $NODE_VERSION pronto (checksum verificado)."
}

download_debs() {
  CURRENT_STEP="download_debs"
  local pool="$STAGING/deps/debs"
  mkdir -p "$pool/partial"

  if dpkg -l 2>/dev/null | grep -qE '^ii[[:space:]]+(postgresql-16|nginx-core)[[:space:]]'; then
    warn "postgresql/nginx JA instalados nesta maquina."
    warn "O apt pode NAO baixar dependencias ja satisfeitas -> bundle INCOMPLETO."
    warn "Gere os .deb numa WSL Ubuntu 24.04 LIMPA e dedicada (ver DEPLOY-OFFLINE.md)."
  fi

  log "apt-get update ..."
  sudo apt-get update
  log "Baixando .deb + dependencias transitivas ..."
  sudo apt-get install -y --download-only \
    -o Dir::Cache::archives="$pool" \
    "${DEB_PACKAGES[@]}"

  rm -rf "$pool/partial" "$pool/lock"
  sudo chown -R "$(id -u):$(id -g)" "$pool"

  local count
  count="$(find "$pool" -name '*.deb' | wc -l)"
  [[ "$count" -gt 0 ]] || die "Nenhum .deb baixado."
  ok "$count pacotes .deb reunidos."
}

build_backend() {
  CURRENT_STEP="build_backend"
  local dst="$STAGING/app/backend"
  mkdir -p "$dst"
  pushd "$REPO_ROOT/backend" >/dev/null
  log "backend: npm ci (com devDeps)"
  npm ci
  log "backend: build (TypeScript -> dist/)"
  npm run build
  log "backend: testes (valida o codigo contra o Node em uso)"
  npm test
  log "backend: reduzindo a dependencias de producao"
  rm -rf node_modules
  npm ci --omit=dev
  cp -a dist package.json package-lock.json node_modules "$dst/"
  popd >/dev/null
  ok "Backend compilado e empacotado (apenas producao)."
}

build_frontend() {
  CURRENT_STEP="build_frontend"
  local dst="$STAGING/app/frontend"
  mkdir -p "$dst"
  pushd "$REPO_ROOT/frontend" >/dev/null
  log "frontend: npm ci"
  npm ci
  log "frontend: build (Vite -> dist/)"
  npm run build
  cp -a dist/. "$dst/"
  popd >/dev/null
  ok "Frontend buildado e empacotado."
}

copy_database_files() {
  CURRENT_STEP="copy_database_files"
  local dst="$STAGING/app/database"
  mkdir -p "$dst"
  cp "$REPO_ROOT/database/schema.sql" "$dst/"
  cp "$REPO_ROOT/database/seed.sql" "$dst/"
  ok "Arquivos de banco copiados (schema.sql, seed.sql)."
}

copy_configs() {
  # Os configs sao canonicos em repo/config (fonte unica); aqui apenas copiamos.
  CURRENT_STEP="copy_configs"
  local dst="$STAGING/config"
  mkdir -p "$dst"
  cp "$REPO_ROOT/config/nginx-intranet.conf" "$dst/"
  cp "$REPO_ROOT/config/intranet-backend.service" "$dst/"
  ok "Configs copiadas (nginx, systemd)."
}

copy_scripts() {
  CURRENT_STEP="copy_scripts"
  local dst="$STAGING/scripts"
  mkdir -p "$dst"
  cp "$REPO_ROOT"/scripts/install-server.sh \
     "$REPO_ROOT"/scripts/status.sh \
     "$REPO_ROOT"/scripts/backup-db.sh \
     "$REPO_ROOT"/scripts/update-server.sh \
     "$dst/"
  cp "$REPO_ROOT/scripts/LEIA-ME.txt" "$STAGING/LEIA-ME.txt"
  chmod +x "$dst"/*.sh
  ok "Scripts copiados."
}

package_bundle() {
  CURRENT_STEP="package_bundle"
  local archive="$OUT_DIR/$BUNDLE_NAME.tar.gz"
  log "Empacotando ..."
  tar czf "$archive" -C "$OUT_DIR" "$BUNDLE_NAME"
  rm -rf "$STAGING"
  ok "Bundle gerado: $archive ($(du -h "$archive" | cut -f1))"
  cat <<EOF

Proximos passos:
  1. Copie o arquivo para um pendrive:
       $archive
  2. No servidor (Ubuntu 24.04, sem internet):
       tar xzf $(basename "$archive")
       cd $BUNDLE_NAME
       sudo bash scripts/install-server.sh
EOF
}

main() {
  check_environment
  rm -rf "$STAGING"
  mkdir -p "$STAGING/deps"
  download_nodejs
  download_debs
  build_backend
  build_frontend
  copy_database_files
  copy_configs
  copy_scripts
  package_bundle
}

main "$@"
