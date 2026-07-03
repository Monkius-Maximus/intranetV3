# Intranet SEPLAG

Aplicação web interna (administradores e usuários comuns) projetada para rodar
num servidor da rede corporativa **sem acesso à internet** (air-gapped), em
**deploy nativo, sem Docker**.

- **Backend:** Node.js 22.23.1 + Express + TypeScript (JWT, bcrypt, PostgreSQL).
- **Frontend:** SPA estática (Vite).
- **Banco:** PostgreSQL 16.
- **Servidor:** Ubuntu 24.04 LTS — nginx (porta 80) + systemd; backend só em
  `127.0.0.1:3000`.

## Como instalar (resumo)

Todo download/compilação acontece numa **máquina DEV com internet**, que gera um
pacote único. O **servidor** apenas executa um instalador offline.

```bash
# Na DEV (WSL2 Ubuntu 24.04, com internet):
bash scripts/build-offline-bundle.sh        # gera offline-builds/intranet-bundle-*.tar.gz

# No SERVIDOR (Ubuntu 24.04, sem internet), via pendrive:
tar xzf intranet-bundle-*.tar.gz && cd intranet-bundle-*
sudo bash scripts/install-server.sh
```

O guia completo está em **[DEPLOY-OFFLINE.md](DEPLOY-OFFLINE.md)**. O mapa de
arquivos está em **[INSTALACAO-NO-REPO.md](INSTALACAO-NO-REPO.md)**.

## Desenvolvimento local

```bash
# Backend
cd backend && npm install && cp .env.example .env   # ajuste DB_* e JWT_SECRET
npm run build && npm start

# Frontend (proxy /api -> 127.0.0.1:3000 já configurado)
cd frontend && npm install && npm run dev
```

Banco local: crie o banco `intranet`/role `intranet_app` e importe
`database/schema.sql` e `database/seed.sql`.
