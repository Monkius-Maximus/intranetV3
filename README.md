# Intranet SEPLAG

Aplicação web interna da SEPLAG: **diretório de funcionários/ramais**, comunicados
e links úteis. O usuário comum **não faz login** — consulta o diretório direto;
o **login existe só para o administrador** gerenciar as pessoas e comunicados.

Arquitetura enxuta, no mesmo formato do projeto de Sistemas Distribuídos da equipe:
**um único servidor Express** que serve a interface web **e** a API REST, com
**persistência local em arquivo** (JSON atômico) — sem banco de dados externo,
sem Docker, sem build. Roda em qualquer máquina da rede; os demais PCs acessam
pela porta aberta no firewall.

- **Servidor:** Node.js + Express 5 + TypeScript (rodando via `tsx`, sem build).
- **Validação:** Zod. **Auth:** leitura pública; escrita só para o admin
  (JWT + bcrypt). Ver *Segurança* em [DEPLOY.md](DEPLOY.md#4-segurança).
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

Os arquivos com dados reais (XLSX/SQL) **não** vão para o git — ficam só na sua
máquina e são carregados por um importador. Duas fontes possíveis:

**A) XLSX de aniversariantes (recomendado — é o arquivo que você tem):**
exportado da rota `aniversariantes2` do Seplagnet atual, no formato
"Aniversariantes do mês de \<Mês\>" + linhas `dia | nome | setor`:

```bash
npm run importar-aniversariantes -- /caminho/ANIVERSARIANTES_SEPLAG_2026.xlsx
```

E-mail e ramal não existem nessa fonte: ficam vazios e podem ser preenchidos
depois pela tela do admin (ou por uma integração futura, ex.: Synergy+).
Grafias divergentes de setor são normalizadas (CEDIDO→CEDIDA, GABINTE→GABINETE,
SUGESPE→SECOGE, `\` → `/`).

**B) SQL completo (se você tiver o arquivo):**

```bash
npm run importar-funcionarios -- /caminho/employees_real_data_complete.sql
```

Ambos são idempotentes — rodar de novo substitui o quadro inteiro. Departamentos
e links úteis já vêm no seed (`src/seed.ts`); não são dados pessoais.

## Testes

```bash
npm test        # vitest + supertest (API)
npm run typecheck
```

## Solução de problemas

Deu erro? Rode o diagnóstico e siga o que ele disser (funciona com Node puro,
mesmo com `node_modules` quebrado):

```bash
npm run doctor                          # checa Node, plataforma, node_modules, data/
npm run doctor -- caminho/arquivo.sql   # checa também o arquivo de dados
```

Erros comuns:

| Sintoma | Causa | Correção |
|---|---|---|
| `You installed esbuild for another platform` | `node_modules` copiado entre sistemas (ex.: WSL ↔ Windows) | apague `node_modules` e rode `npm install` na máquina onde vai executar |
| `Nenhum registro reconhecido em …` | arquivo errado (ex.: `add_all_employees.sql`, que só tem comentários) ou formato diferente | use o `employees_real_data_complete.sql`; o doctor mostra quantas linhas reconheceu |
| Erro logo ao iniciar, mencionando a versão | Node < 18 | instale o Node LTS (o `npm install` e o app agora avisam claramente) |
| Acentos virando `�` no import | arquivo salvo em UTF-16/BOM pelo Windows | o importador já detecta e converte sozinho (BOM UTF-8/UTF-16) |

Se persistir, envie a saída **completa** do `npm run doctor` + o erro original.

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
