# Intranet SEPLAG

Aplicação web interna da SEPLAG: **diretório de funcionários/ramais**, comunicados
e links úteis, com login e um administrador que gerencia as pessoas.

Arquitetura enxuta, no mesmo formato do projeto de Sistemas Distribuídos da equipe:
**um único servidor Express** que serve a interface web **e** a API REST, com
**persistência local em arquivo** (JSON atômico) — sem banco de dados externo,
sem Docker, sem build. Roda em qualquer máquina da rede; os demais PCs acessam
pela porta aberta no firewall.

- **Servidor:** Node.js + Express 5 + TypeScript (rodando via `tsx`, sem build).
- **Validação:** Zod. **Auth:** JWT + bcrypt (papéis `admin` e `viewer`).
- **Dados:** `data/intranet.json` (escrita atômica). **UI:** `public/` (HTML/JS/CSS).

## Rodar (desenvolvimento ou produção)

```bash
npm install
npm start
```

Na primeira execução, um usuário **admin** é criado e a senha é **impressa uma
vez** no console (ou defina `ADMIN_EMAIL`/`ADMIN_PASSWORD`). O servidor sobe em
`http://0.0.0.0:3000`. Para os outros PCs da rede acessarem, **abra a porta 3000
no firewall** da máquina — foi assim que a equipe já validou na rede corporativa.

Variáveis de ambiente (todas opcionais):

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | porta HTTP |
| `HOST` | `0.0.0.0` | interface de bind (exposto na LAN) |
| `ADMIN_EMAIL` | `admin@intranet.local` | e-mail do admin inicial |
| `ADMIN_PASSWORD` | *(gerada e impressa)* | senha do admin inicial |
| `JWT_SECRET` | *(gerado em `data/jwt-secret.key`)* | segredo dos tokens |
| `INTRANET_DATA` | `./data` | diretório de dados |

## Carregar os funcionários reais (LGPD)

O SQL com dados reais **não** vai para o git. Carregue-o localmente:

```bash
npm run importar-funcionarios -- /caminho/employees_real_data_complete.sql
```

Isso lê os `INSERT INTO employees (...)` e grava em `data/intranet.json`
(idempotente — rodar de novo troca o conjunto). Departamentos e links úteis já
vêm no seed (`src/seed.ts`); não são dados pessoais.

## Testes

```bash
npm test        # vitest + supertest (API)
npm run typecheck
```

## Deploy

Veja **[DEPLOY.md](DEPLOY.md)** — o caminho simples (instalar Node, subir o app,
abrir a porta) e a variante air-gapped, caso a máquina realmente não tenha
internet no setup.

## Estrutura

```
src/        config, persistência (JSON atômico), store (domínio), auth, schemas, seed, app, index
public/     interface web (login + diretório + comunicados + links)
scripts/    importar-funcionarios.ts (carga dos dados reais)
data/       banco JSON + segredo JWT  (NÃO versionado — LGPD)
```
