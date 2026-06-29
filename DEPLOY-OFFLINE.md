# Deploy Offline — Intranet SEPLAG (servidor air-gapped)

Guia do fluxo **DEV → pendrive → SERVIDOR**. O servidor **nunca** acessa a
internet: todo download e toda compilação acontecem na máquina DEV, que gera um
pacote único (`.tar.gz`). O servidor só roda um instalador offline.

> Deploy **nativo, sem Docker** — systemd + nginx + PostgreSQL + Node em
> `/opt/node`.

---

## 1. Modelo de duas máquinas

```
┌─────────────────────────────┐     pendrive      ┌─────────────────────────────┐
│  MÁQUINA DEV                │   bundle.tar.gz   │  SERVIDOR                   │
│  WSL2 Ubuntu 24.04 + net    │  ───────────────► │  Ubuntu 24.04, SEM internet │
│                             │   (USB físico)    │                             │
│  build-offline-bundle.sh    │                   │  install-server.sh          │
│  → baixa, compila, empacota │                   │  → instala 100% offline     │
└─────────────────────────────┘                   └─────────────────────────────┘
```

| | DEV | SERVIDOR |
|---|---|---|
| SO | Ubuntu **24.04** (WSL2) | Ubuntu **24.04 LTS** |
| Arquitetura | amd64 | amd64 |
| Internet | sim (só para gerar o bundle) | **não** |
| Roda | `build-offline-bundle.sh` | `install-server.sh` |

A versão do Ubuntu na DEV **precisa ser a mesma do servidor (24.04)**, senão os
`.deb` baixados não casam com as dependências do alvo.

---

## 2. Arquitetura em runtime (no servidor)

```
LAN :80 ──► nginx ──► estático (frontend)
                 └──► /api/ ──► backend Node (127.0.0.1:3000) ──► PostgreSQL 16 (local)
```

- **Só o nginx** escuta na rede. O backend faz bind **exclusivo** em
  `127.0.0.1:3000`; o PostgreSQL escuta apenas localmente.
- O nginx serve o frontend estático e faz proxy de `/api/`.
- SPA: rotas que não são arquivo caem em `index.html`.

---

## 3. Stack e versões

| Componente | Versão | Instalação no servidor |
|---|---|---|
| SO | Ubuntu 24.04 LTS | já instalado |
| PostgreSQL | 16 | `.deb` do bundle |
| nginx | do 24.04 | `.deb` do bundle |
| UFW | do 24.04 | `.deb` do bundle |
| Node.js | **22.23.1 LTS** (fixado) | tarball em `/opt/node` (fora do apt) |
| Backend | Node + Express + TS | systemd `intranet-backend` |
| Frontend | build estático (Vite) | servido pelo nginx |

> **Node fixado em 22.23.1** em todo o pipeline (build + install + service).
> Não misture versões.

---

## 4. Na máquina DEV — gerar o bundle

> **Importante (ponto onde deploys offline mais quebram):** gere os `.deb` numa
> **WSL Ubuntu 24.04 LIMPA e dedicada**. Num ambiente que **já tem**
> postgres/nginx instalados, o `apt` considera as dependências "já satisfeitas"
> e **não as baixa** — silenciosamente — e o bundle fica incompleto. Só num
> ambiente limpo o `apt` calcula o fechamento transitivo completo que um
> servidor zerado precisa. O script avisa se detectar postgres/nginx instalados.

```bash
git clone <repo> intranetV3 && cd intranetV3
bash scripts/build-offline-bundle.sh
```

O que ele faz (em ordem):

1. `check_environment` — exige Ubuntu 24.04 amd64.
2. `download_nodejs` — baixa o tarball oficial do Node 22.23.1 e **verifica o
   checksum** (cacheado em `offline-builds/.cache`).
3. `download_debs` — baixa PostgreSQL 16, nginx, UFW **com dependências
   transitivas** (`apt-get --download-only`).
4. `build_backend` — `npm ci` → `npm run build` → `npm test` → reduz a
   dependências de produção (`npm ci --omit=dev`).
5. `build_frontend` — `npm ci` → `npm run build` (Vite).
6. `copy_database_files` — `schema.sql` + `seed.sql`.
7. `copy_configs` — `nginx-intranet.conf` + `intranet-backend.service`.
8. `copy_scripts` — instalador e utilitários + `LEIA-ME.txt`.
9. `package_bundle` — gera `offline-builds/intranet-bundle-AAAAMMDD-HHMMSS.tar.gz`.

### Dados reais (LGPD)

O `seed.sql` versionado contém apenas **dados de exemplo**. Para produção,
coloque o SQL de **dados reais** em `database/` com um nome coberto pelo
`.gitignore` (ex.: `dados-reais.sql`) e ajuste `copy_database_files` para
incluí-lo. Dados reais **nunca** vão para o git.

---

## 5. Transporte

Copie **um único arquivo** (`intranet-bundle-*.tar.gz`, ~150–300 MB) para o
pendrive e leve ao servidor.

---

## 6. No servidor — instalar (offline)

```bash
tar xzf intranet-bundle-*.tar.gz
cd intranet-bundle-*
sudo bash scripts/install-server.sh
```

Na **primeira** instalação o script pede a **senha do admin**. Ao final imprime
a **URL de acesso, hostname e IP** para o TI cadastrar no DNS do Windows Server
(FQDN sugerido: `intranet.seplag.local`).

O instalador é **idempotente**: rodar de novo com um bundle novo **atualiza o
código e preserva o banco**. Passos: preflight → detecção de reinstalação →
senha do admin (só na 1ª) → `.deb` offline → Node em `/opt/node` → usuário de
sistema → PostgreSQL (role/banco/schema) → publicação da app → senha do admin
(bcrypt) → `.env` com segredos aleatórios → nginx → systemd → UFW (só porta 80)
→ `apt-mark hold` + `unattended-upgrades` off → resumo.

---

## 7. Operação

```bash
bash scripts/status.sh                 # saúde: postgres, backend, nginx, /api/health
sudo bash scripts/backup-db.sh         # backup do banco (timestamp, .sql.gz)
sudo bash scripts/update-server.sh     # backup + reinstala a partir de um bundle novo
systemctl status intranet-backend
journalctl -u intranet-backend -f
ss -ltnp | grep -E ':80|:3000|:5432'   # confirmar binds (3000 só em 127.0.0.1)
```

---

## 8. Recuperação: banco existe mas `.env` sumiu

`install-server.sh` detecta o caso, **gera um novo `.env`** e **reseta a senha
da role** do PostgreSQL para casar com ele. O banco **não é dropado**. Basta
rodar o instalador de novo.

---

## 9. Segurança

- `.env` com modo `600`, dono `intranet`; `DB_PASSWORD` e `JWT_SECRET`
  aleatórios (gerados com `openssl rand`).
- Senhas de usuário com **bcrypt** (custo 12).
- UFW: **só a porta 80**. 3000 e 5432 nunca expostos à LAN.
- systemd com hardening (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`,
  `ProtectHome`).
- nginx bloqueia `.env`/`.git` e envia headers básicos de segurança.
- Pacotes críticos em `apt-mark hold`; `unattended-upgrades` desligado (servidor
  air-gapped não deve se auto-modificar).
