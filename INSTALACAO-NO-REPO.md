# Onde cada arquivo entra no repositório

Mapa do repositório e o destino de cada artefato em runtime no servidor.

## Estrutura do repositório

```
intranetV3/
├── README.md
├── DEPLOY-OFFLINE.md            # guia do fluxo dev → pendrive → servidor
├── INSTALACAO-NO-REPO.md        # este arquivo
├── GITIGNORE-ADDITIONS.txt      # porquê de cada linha do .gitignore
├── .gitignore
│
├── backend/                     # API Node + Express + TypeScript
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── .env.example             # template p/ DEV (sem segredos)
│   ├── src/
│   │   ├── server.ts            # bind 127.0.0.1:3000
│   │   ├── config.ts            # lê env (falha se faltar)
│   │   ├── db.ts                # pool pg
│   │   ├── auth.ts              # bcrypt + JWT (utilitários puros)
│   │   ├── asyncHandler.ts
│   │   ├── middleware/auth.ts   # authenticate + requireAdmin
│   │   └── routes/              # health, auth, users, announcements
│   └── test/auth.test.js        # roda contra dist/ (node --test)
│
├── frontend/                    # SPA Vite (vanilla TS)
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/                     # main.ts, api.ts, style.css
│
├── database/
│   ├── schema.sql               # tabelas (idempotente)
│   └── seed.sql                 # dados de EXEMPLO (reais não vão no git)
│
├── config/                      # fonte única dos configs (copiados no bundle)
│   ├── nginx-intranet.conf
│   └── intranet-backend.service
│
└── scripts/
    ├── build-offline-bundle.sh  # DEV: gera o bundle
    ├── install-server.sh        # SERVIDOR: instala offline
    ├── status.sh                # SERVIDOR: saúde
    ├── backup-db.sh             # SERVIDOR: backup do banco
    ├── update-server.sh         # SERVIDOR: backup + reinstala
    └── LEIA-ME.txt              # vai para a raiz do bundle
```

## Repositório → runtime no servidor

| No repositório | No servidor (após instalar) |
|---|---|
| `backend/` (compilado + prod deps) | `/opt/intranet/backend/` |
| `frontend/` (build Vite) | `/opt/intranet/frontend/` |
| `config/nginx-intranet.conf` | `/etc/nginx/sites-available/intranet` (+ symlink em `sites-enabled`) |
| `config/intranet-backend.service` | `/etc/systemd/system/intranet-backend.service` |
| Node 22.23.1 (tarball do bundle) | `/opt/node/` |
| (gerado na instalação) | `/opt/intranet/backend/.env` (modo 600, dono `intranet`) |
| `database/schema.sql` + `seed.sql` | importados no banco `intranet` (1ª instalação) |
| `scripts/backup-db.sh` (saída) | `/opt/intranet/backups/` |

## Fluxo do bundle

`build-offline-bundle.sh` monta, a partir do repositório, a árvore descrita em
`DEPLOY-OFFLINE.md` (deps/ app/ config/ scripts/ + LEIA-ME.txt) e a compacta em
`offline-builds/intranet-bundle-*.tar.gz`. Nada em `offline-builds/`,
`node_modules/`, `dist/` ou `.env` é versionado (ver `.gitignore`).
