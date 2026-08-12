#!/usr/bin/env bash
# =============================================================================
# Instalador numa VM Ubuntu (Server 20.04+) — serve a qualquer projeto feito
# sobre este chassi; a identidade do portal vem de src/perfil.ts.
#
# Uso (a partir da raiz do repositório clonado na VM):
#   sudo bash deploy/instalar.sh                     # instala na porta 80
#   sudo PORTA=3000 bash deploy/instalar.sh          # ou em outra porta
#   sudo PROJETO=casa bash deploy/instalar.sh        # outro nome de instalação
#
# PROJETO (padrão "intranet") define, de uma vez: usuário de serviço, pasta em
# /opt, arquivo .env, unidade systemd e tarefa de backup. Mantendo o padrão, a
# instalação é idêntica à de sempre — é o que permite atualizar sem migrar nada.
# Dois projetos com nomes diferentes convivem na mesma máquina (portas distintas).
#
# O que faz (idempotente — rode de novo para ATUALIZAR o app):
#   1. Garante Node 22 LTS (NodeSource) se não houver Node >= 18.
#   2. Cria o usuário de serviço e instala o app em /opt/<PROJETO>.
#   3. npm ci --omit=dev (dependências de produção, reprodutíveis).
#   4. Grava /etc/<PROJETO>.env (porta; credenciais do 1º admin na 1ª execução).
#   5. Instala e ativa o serviço systemd (reinicia sozinho; porta 80 sem root
#      via CAP_NET_BIND_SERVICE).
#   6. Agenda backup diário do banco (cron), guardando os últimos 30.
#
# Depois de instalar, carregue os dados reais (com o serviço parado):
#   sudo systemctl stop intranet
#   sudo -u intranet env INTRANET_DATA=/opt/intranet/data \
#     npm --prefix /opt/intranet run importar-csv -- /tmp/pessoas.csv
#   sudo systemctl start intranet
# =============================================================================
set -euo pipefail

PORTA="${PORTA:-80}"
# Nome da instalação. Só letras/números/hífen: vira usuário de sistema e nome
# de unidade systemd.
PROJETO="${PROJETO:-intranet}"
[[ "$PROJETO" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || {
  echo "ERRO: PROJETO inválido ('$PROJETO'): use minúsculas, números e hífen." >&2; exit 1;
}

DESTINO="/opt/$PROJETO"
USUARIO="$PROJETO"
ENV_FILE="/etc/$PROJETO.env"
SERVICO="$PROJETO"
NPMRC_FILE="/etc/$PROJETO-npmrc"
CRON_FILE="/etc/cron.daily/$PROJETO-backup"
# Nome do arquivo de banco dentro de data/ (padrão do src/config.ts).
BANCO="${BANCO:-intranet.json}"
ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo -e "\033[1;34m==>\033[0m $*"; }
erro() { echo -e "\033[1;31mERRO:\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || erro "rode com sudo: sudo bash deploy/instalar.sh"
[ -f "$ORIGEM/package.json" ] || erro "rode a partir do repositório clonado (deploy/instalar.sh)"

TEM_SYSTEMD=1
pidof systemd >/dev/null 2>&1 || { TEM_SYSTEMD=0; log "AVISO: sem systemd (container?) — vou pular a ativação do serviço"; }

# 1. Node -------------------------------------------------------------------
node_ok() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; }
if node_ok; then
  log "Node $(node --version) já presente"
else
  log "Instalando Node 22 LTS (NodeSource)…"
  command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
  node_ok || erro "instalação do Node falhou — instale o Node 18+ manualmente e rode de novo"
  log "Node $(node --version) instalado"
fi
# rsync dá updates limpos (--delete); se não houver, tenta instalar; se não
# der, cai para tar (funciona sempre; arquivos removidos do repo podem sobrar).
if ! command -v rsync >/dev/null 2>&1; then
  (apt-get update -qq || true) >/dev/null 2>&1
  (apt-get install -y -qq rsync || true) >/dev/null 2>&1
fi

# 2. Usuário de serviço + cópia do app ---------------------------------------
id "$USUARIO" >/dev/null 2>&1 || { log "Criando usuário de serviço '$USUARIO'"; useradd --system --home "$DESTINO" --shell /usr/sbin/nologin "$USUARIO"; }

log "Copiando o app para $DESTINO (preservando data/ existente)…"
mkdir -p "$DESTINO"
if command -v rsync >/dev/null 2>&1; then
  # A barra inicial ancora o padrão na raiz da cópia — sem ela o rsync
  # excluiria também src/data/ (o código do repositório!).
  rsync -a --delete \
    --exclude '/data/' --exclude '/node_modules/' --exclude '/.git/' --exclude '/backups/' \
    "$ORIGEM/" "$DESTINO/"
else
  log "(sem rsync — copiando via tar)"
  # --anchored: sem ele o GNU tar casaria './data' com QUALQUER nível
  # (excluiria também src/data/ — o código do repositório!).
  (cd "$ORIGEM" && tar cf - --anchored --exclude='./data' --exclude='./node_modules' --exclude='./.git' --exclude='./backups' .) \
    | (cd "$DESTINO" && tar xf -)
fi
mkdir -p "$DESTINO/data" "$DESTINO/backups"

# 3. Dependências de produção -------------------------------------------------
log "Instalando dependências (npm ci --omit=dev)…"
chown -R "$USUARIO:$USUARIO" "$DESTINO"

# Redes corporativas costumam ter proxy/inspeção TLS: repassa ao usuário de
# serviço a configuração de rede de quem está instalando (env + ~/.npmrc).
ENV_NPM=()
for v in NODE_EXTRA_CA_CERTS HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy; do
  [ -n "${!v:-}" ] && ENV_NPM+=("$v=${!v}")
done
NPMRC_ARG=()
if [ -f /root/.npmrc ]; then
  cp /root/.npmrc "$NPMRC_FILE" && chmod 644 "$NPMRC_FILE"
  NPMRC_ARG=(--userconfig "$NPMRC_FILE")
fi
sudo -u "$USUARIO" env "${ENV_NPM[@]}" bash -c "cd '$DESTINO' && npm ci --omit=dev --no-audit --no-fund ${NPMRC_ARG[*]}" \
  || erro "npm ci falhou. A VM alcança o registry npm? Atrás de proxy corporativo, exporte
       HTTPS_PROXY=… (e NODE_EXTRA_CA_CERTS=/caminho/ca.crt se houver inspeção TLS)
       antes de rodar este script."

# 4. Variáveis de ambiente -----------------------------------------------------
# Credenciais do 1º admin: por prompt (interativo) ou por env (automação):
#   sudo ADMIN_EMAIL=... ADMIN_PASSWORD=... bash deploy/instalar.sh
if [ ! -f "$ENV_FILE" ]; then
  log "Primeira instalação: definindo o administrador inicial"
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    [ -t 0 ] || erro "sem terminal para perguntar a senha — rode com:
       sudo ADMIN_EMAIL=admin@seplag.local ADMIN_PASSWORD='umaSenhaForte' bash deploy/instalar.sh"
    read -rp "  E-mail do admin [admin@seplag.local]: " ADMIN_EMAIL || erro "entrada encerrada"
    while :; do
      read -rsp "  Senha do admin (mín. 8 caracteres): " ADMIN_PASSWORD || erro "entrada encerrada"
      echo
      [ "${#ADMIN_PASSWORD}" -ge 8 ] && break
      echo "  senha curta demais."
    done
  fi
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@seplag.local}"
  [ "${#ADMIN_PASSWORD}" -ge 8 ] || erro "ADMIN_PASSWORD precisa de pelo menos 8 caracteres"
  cat > "$ENV_FILE" <<EOF
PORT=$PORTA
HOST=0.0.0.0
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
  chmod 600 "$ENV_FILE"
else
  log "Mantendo $ENV_FILE existente (ajuste a porta lá se precisar)"
  sed -i "s/^PORT=.*/PORT=$PORTA/" "$ENV_FILE"
fi

# 5. Serviço systemd -----------------------------------------------------------
log "Gravando /etc/systemd/system/$SERVICO.service (porta $PORTA)"
cat > "/etc/systemd/system/$SERVICO.service" <<EOF
[Unit]
Description=$PROJETO (Node/Express, porta $PORTA)
After=network.target

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$DESTINO
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $DESTINO/node_modules/.bin/tsx src/index.ts
Restart=on-failure
RestartSec=3
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

if [ "$TEM_SYSTEMD" -eq 1 ]; then
  systemctl daemon-reload
  systemctl enable "$SERVICO"
  # restart (não "enable --now"): numa ATUALIZAÇÃO o serviço já está rodando e
  # "start" seria no-op, deixando o código antigo em memória. restart derruba e
  # sobe carregando o novo $DESTINO; se estiver parado, apenas inicia.
  systemctl restart "$SERVICO"
  sleep 2
  systemctl --no-pager --lines=6 status "$SERVICO" || true
else
  log "(sem systemd: unit gravada; ative com 'systemctl enable --now $SERVICO' numa VM real)"
fi

# 6. Backup diário --------------------------------------------------------------
log "Agendando backup diário (guarda os últimos 30)"
cat > "$CRON_FILE" <<EOF
#!/bin/sh
# Backup diário do banco (data/ -> backups/), mantendo os 30 mais recentes.
cp "$DESTINO/data/$BANCO" "$DESTINO/backups/backup-\$(date +%Y%m%d).json" 2>/dev/null || exit 0
chown $USUARIO:$USUARIO "$DESTINO/backups/backup-\$(date +%Y%m%d).json"
ls -1t "$DESTINO/backups"/backup-*.json 2>/dev/null | tail -n +31 | xargs -r rm --
EOF
chmod +x "$CRON_FILE"

# ------------------------------------------------------------------------------
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
log "Pronto! Próximos passos:"
echo "  1. Teste:   curl http://localhost:$PORTA/api/health"
echo "  2. Acesse:  http://${IP:-<IP-da-VM>}${PORTA:+:$PORTA}  (porta 80 dispensa o :80)"
echo "  3. Carregue as pessoas reais (serviço parado — ver cabeçalho deste script)"
echo "  4. Logs:    journalctl -u $SERVICO -f"
echo "  5. Atualizar no futuro: git pull && sudo bash deploy/instalar.sh"
