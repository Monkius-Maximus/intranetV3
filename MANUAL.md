# Manual da Intranet SEPLAG

Guia completo do repositório e da ferramenta — da instalação ao uso diário.
Complementa o [README.md](README.md) (visão técnica) e o [DEPLOY.md](DEPLOY.md)
(implantação detalhada).

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [O repositório](#2-o-repositório)
3. [Rodar em modo de desenvolvimento](#3-rodar-em-modo-de-desenvolvimento)
4. [Instalar no servidor (VM Ubuntu)](#4-instalar-no-servidor-vm-ubuntu)
5. [Carregar as pessoas reais](#5-carregar-as-pessoas-reais)
6. [Guia do usuário comum](#6-guia-do-usuário-comum)
7. [Guia do administrador](#7-guia-do-administrador)
8. [Guia do gestor de setor](#8-guia-do-gestor-de-setor)
9. [Operação e manutenção](#9-operação-e-manutenção)
10. [Solução de problemas](#10-solução-de-problemas)
11. [Referência rápida da API](#11-referência-rápida-da-api)
12. [Limites conhecidos](#12-limites-conhecidos)

---

## 1. Visão geral

A intranet é **um único servidor Node/Express** que serve a interface web e a
API, com persistência em **um arquivo JSON** (`data/intranet.json`). Sem banco
externo, sem build, sem Docker: instalar o Node e subir o processo basta.

### Papéis

| Papel | Quem é | O que faz |
|---|---|---|
| **Público** | Qualquer pessoa na rede | Consulta tudo sem login: comunicados, ramais, aniversariantes, agenda, links |
| **Leitura** | Conta que só consulta | Igual ao público (reservado para usos futuros) |
| **Gestor** | Chefe de setor | Gerencia as **pessoas dos seus setores** e os **próprios comunicados** |
| **Admin** | Administrador | Tudo: pessoas, comunicados, tiles, setores, eventos, links, contas, auditoria |

### Dois conceitos que não se misturam

- **Pessoas** = o *diretório* de servidores (nome, setor, ramal, aniversário).
  Não fazem login; são dados exibidos.
- **Contas de acesso** = quem *entra e gerencia* o sistema (e-mail + senha + papel).

### Tudo é em tempo real

Qualquer edição feita pela tela (comunicado, pessoa, tile, setor, evento,
conta) **vale imediatamente** — não é preciso reiniciar o serviço. As duas
únicas exceções estão em [§9](#9-operação-e-manutenção).

---

## 2. O repositório

```
https://github.com/Monkius-Maximus/intranetV3
branch: claude/redesign-ui-intranet
```

### Estrutura

```
src/          backend TypeScript (domínio, dados, rotas HTTP)
public/       frontend (HTML/CSS/JS puro — servido pelo Express)
scripts/      importadores (XLSX/CSV/SQL), backup, doctor
deploy/       instalar.sh (VM Ubuntu) e intranet.service (systemd)
data/         banco JSON, segredo JWT, uploads — NUNCA vai para o git (LGPD)
```

### Comandos

| Comando | O que faz |
|---|---|
| `npm install` | instala as dependências |
| `npm start` | sobe o servidor (porta 3000) |
| `npm run dev` | sobe com recarga automática ao editar o código |
| `npm test` | testes da API (vitest) |
| `npm run typecheck` | checagem de tipos |
| `npm run doctor` | diagnóstico do ambiente (Node, plataforma, `data/` gravável) |
| `npm run importar-aniversariantes -- arq.xlsx` | carga do XLSX do Seplagnet |
| `npm run importar-csv -- arq.csv` | carga por CSV (plano B universal) |
| `npm run backup` | copia o banco para `backups/` |

### Regra de ouro (LGPD)

**`data/` nunca vai para o git.** Isso significa que um clone novo sempre nasce
**vazio** — as pessoas reais entram pela importação na máquina de destino, ou
copiando o `data/` junto. Planilhas com dados reais (`*.xlsx`) também são
ignoradas pelo git.

---

## 3. Rodar em modo de desenvolvimento

Para testar no seu notebook (Windows, WSL ou Linux):

```bash
git clone https://github.com/Monkius-Maximus/intranetV3.git intranet
cd intranet
git checkout claude/redesign-ui-intranet
npm install
ADMIN_EMAIL=admin@seplag.local ADMIN_PASSWORD='umaSenhaForte' npm start
```

Abra `http://localhost:3000`. O boot imprime também a URL de rede
(`http://<seu-IP>:3000`) para testar de outro dispositivo.

> **Windows:** rode no PowerShell/CMD (não no WSL) se quiser que outros
> dispositivos da rede acessem — e defina as variáveis com
> `set ADMIN_PASSWORD=...` antes do `npm start`, ou apenas rode `npm start`
> e anote a senha gerada impressa uma única vez no console.

### Variáveis de ambiente (todas opcionais)

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | porta HTTP |
| `HOST` | `0.0.0.0` | interface de rede (todas) |
| `ADMIN_EMAIL` | `admin@intranet.local` | e-mail do 1º admin |
| `ADMIN_PASSWORD` | *(gerada e impressa)* | senha do 1º admin |
| `JWT_SECRET` | *(gerado em `data/jwt-secret.key`)* | segredo dos tokens |
| `INTRANET_DATA` | `./data` | diretório de dados |

O primeiro admin só é criado **quando não existe nenhuma conta** — depois
disso, contas são geridas pela tela e essas variáveis não têm mais efeito.

---

## 4. Instalar no servidor (VM Ubuntu)

### Caminho recomendado: o instalador

Na VM (com internet), como usuário com sudo:

```bash
git clone https://github.com/Monkius-Maximus/intranetV3.git intranet
cd intranet
git checkout claude/redesign-ui-intranet
sudo bash deploy/instalar.sh              # porta 80
# ou: sudo PORTA=3000 bash deploy/instalar.sh
```

O instalador faz tudo: Node 22 (se faltar), usuário de serviço `intranet`,
app em `/opt/intranet`, pergunta e-mail/senha do 1º admin, serviço systemd
(reinicia sozinho e volta após reboot) e backup diário automático (guarda 30).

Ao final ele imprime a URL para os demais PCs. Confira com:

```bash
curl http://localhost/api/health
# → {"status":"ok","pessoas":N,"contas":N,"gravavel":true}
```

### Atualizar o sistema depois

```bash
cd ~/intranet && git pull
sudo bash deploy/instalar.sh     # preserva o data/ (pessoas, comunicados, uploads)
```

### Comandos úteis do serviço

```bash
sudo systemctl status intranet     # está no ar?
sudo systemctl restart intranet    # reiniciar
journalctl -u intranet -f          # acompanhar os logs
```

### Sem internet na VM? Firewall? Outros PCs não acessam?

Ver **DEPLOY.md**: §2 (pacote offline a partir do WSL), §3 (checklist de rede
em 7 passos — o guia definitivo para "ninguém consegue acessar").

---

## 5. Carregar as pessoas reais

> ⚠️ **Sempre com o serviço parado** — o servidor mantém o estado em memória e
> sobrescreveria a importação na próxima gravação.

### Na VM (app instalado pelo instalador)

```bash
sudo systemctl stop intranet
sudo -u intranet env INTRANET_DATA=/opt/intranet/data \
  npm --prefix /opt/intranet run importar-aniversariantes -- /tmp/ANIVERSARIANTES.xlsx
sudo systemctl start intranet
curl http://localhost/api/health     # confira a contagem de pessoas
```

### Fonte A — XLSX do Seplagnet (rota aniversariantes2)

Formato: blocos "Aniversariantes do mês de \<Mês\>" com linhas `dia | nome |
setor`. Grafias de setor divergentes são normalizadas automaticamente
(CEDIDO→CEDIDA, GABINTE→GABINETE, SUGESPE→SECOGE, `\`→`/`). E-mail e ramal não
existem nessa fonte — completa-se depois pela tela.

### Fonte B — CSV (plano B, funciona com qualquer planilha)

Se o XLSX não for reconhecido (o importador mostra o que encontrou e o motivo),
abra a planilha no Excel e salve como CSV com o cabeçalho:

```
nome;setor;dia;mes            (opcionais, em qualquer ordem: email;ramal;cargo)
```

```bash
npm run importar-csv -- pessoas.csv
```

### Reimportar é seguro

A importação **mescla**: atualiza o núcleo (nome, setor, aniversário), cria os
novos e **preserva** o que o admin preencheu pela tela (e-mail, ramal, cargo).
Pessoas que não estão no arquivo são mantidas.

---

## 6. Guia do usuário comum

Nenhum login é necessário. Basta abrir a URL da intranet.

### Início

- **Acesso rápido** — tiles coloridos que abrem os sistemas (Ponto, SEI!, …).
- **Comunicados** — os mais recentes; clique em "Ver todos" para a lista completa.
- **Agenda** — próximos eventos, aniversariantes do mês e links úteis.

### Comunicados

Lista completa, do mais recente ao mais antigo; fixados vêm primeiro. A cor da
borda indica a categoria (Geral, TI, RH, Urgente). Comunicados podem trazer
**anexos** — clique no chip do arquivo para baixar.

### Ramais

O diretório de servidores: busque por **nome, ramal, e-mail ou setor** (a busca
ignora acentos) ou filtre pelo setor. A busca do topo da tela também leva aqui.

### Aniversariantes

O mês completo (dia, nome, setor), com destaque de **HOJE 🎂** e navegação
entre meses — igual ao Seplagnet antigo, só que sempre atualizado.

---

## 7. Guia do administrador

### Entrar e sair

Clique em **"Entrar (admin)"** (topo) ou **"Entrar como admin"** (rodapé da
barra lateral). Após o login, o menu ganha o grupo **Administração**. O ícone
de porta no rodapé sai da conta.

- **Trocar a própria senha:** ícone de **chave** 🔑 no rodapé da barra lateral.
- **Errou a senha 5 vezes?** O login bloqueia por 15 minutos (proteção contra
  força bruta).

### Pessoas (diretório)

- **Nova pessoa** abre o painel lateral: nome, cargo, setor, ramal, e-mail,
  aniversário e situação (Ativo / Ex-servidor — ex-servidores saem do
  diretório ativo, mas ficam no histórico).
- **Editar/Excluir** pelos ícones de cada linha (excluir pede confirmação).
- **Botão "Setores"**: crie setores novos (sigla + nome), renomeie — **renomear
  a sigla atualiza automaticamente todas as pessoas do setor** — e exclua
  (bloqueado enquanto houver pessoas nele; mova-as antes).

### Comunicados (Gerenciar comunicados)

- **Novo comunicado**: título, conteúdo, **categoria** (define a cor do card),
  **Fixar no topo** e **anexos** ("Adicionar arquivo": PDF, Office, imagens ou
  ZIP, até 10 MB cada).
- **Editar** preserva o comunicado (mesma data); dá para remover anexos
  existentes e juntar novos. **Excluir** apaga também os arquivos anexados.

### Início (modo admin)

- **Tiles**: passe o mouse → **lápis** edita (rótulo, URL, ícone, cor, com
  prévia ao vivo), **setas** reordenam; o tile **"+ Adicionar"** cria. URLs:
  `https://…` abre o sistema em nova aba; `#ramais` ou `#aniversariantes`
  navega dentro da intranet.
- **Próximos eventos**: **+** cria (título, data, hora, local); editar/excluir
  aparecem ao passar o mouse na linha.
- **Links úteis**: adicione/remova itens e grupos pelo próprio card.

### Contas de acesso

- **Nova conta**: nome, e-mail, papel (**Admin / Gestor / Leitura**) e senha
  inicial. Para **Gestor**, marque os **setores** que ele administra.
- **"Trocar senha no 1º acesso"** (ligado por padrão): a pessoa é obrigada a
  definir a própria senha ao entrar — até lá, não consegue editar nada.
- **Editar**: papel, setores, **Conta ativa** (desativada não loga) e
  **Redefinir senha** (a pessoa troca no próximo login).
- Proteções automáticas: e-mail duplicado é recusado; **sempre resta ao menos
  uma conta admin ativa** (o sistema impede rebaixar/desativar/excluir a
  última); ninguém exclui a própria conta.

### Auditoria

**Administração → Auditoria**: quem entrou e quem criou/editou/excluiu o quê
(pessoas, comunicados, anexos, setores, tiles, eventos, contas, senhas), com
data e hora. O sistema guarda as últimas 2.000 ações.

---

## 8. Guia do gestor de setor

O gestor entra pelo mesmo login e vê o grupo **Gestão** no menu:

| Pode | Não pode |
|---|---|
| Cadastrar/editar/excluir **pessoas dos seus setores** | Mexer em pessoas de outros setores (nem movê-las para fora dos seus) |
| **Publicar comunicados** (com categoria e anexos) | Editar/excluir comunicados **de outros autores** |
| Editar/excluir **os próprios comunicados** | Tiles, setores, eventos, links, contas, auditoria |
| Trocar a própria senha | — |

Na tela Pessoas, as linhas fora do escopo aparecem sem botões de ação; no
formulário, só os setores dele estão disponíveis. As regras também são
aplicadas no servidor — não são só visuais.

---

## 9. Operação e manutenção

### Quando (não) reiniciar

**Nunca é preciso reiniciar para conteúdo**: comunicados, pessoas, tiles,
setores, eventos, contas — tudo pela tela, efeito imediato. Reinicie apenas:

1. **Importação em lote** (`importar-*`): pare o serviço antes, suba depois.
2. **Atualização de código** (`git pull` + `instalar.sh` — reinicia sozinho).

### Backup e restauração

Todo o estado são **dois itens** dentro de `data/`: o arquivo
`intranet.json` e a pasta `uploads/` (anexos). Na VM, o instalador já agenda
backup diário do banco em `/opt/intranet/backups/` (guarda 30).

Restaurar = parar o serviço, devolver o arquivo para
`/opt/intranet/data/intranet.json`, subir. (O `data/jwt-secret.key` no backup
mantém os logins ativos válidos.)

### Monitoramento

- **`/api/health`** — o termômetro do sistema:
  `{"status":"ok","pessoas":N,"contas":N,"gravavel":true}`.
  `pessoas` diz qual banco o servidor está lendo; `gravavel:false` significa
  problema de disco/permissão (o boot também falha cedo nesses casos).
- **Logs**: `journalctl -u intranet -f` na VM.

### Requisitos de máquina

Qualquer PC funcional dos últimos ~10 anos: 1–2 núcleos, 1 GB de RAM no Linux
(4 GB se Windows), ~2 GB de disco, rede cabeada. O que importa é operacional:
máquina sempre ligada, IP fixo, porta liberada, disco local (nunca OneDrive) e
backup.

---

## 10. Solução de problemas

Primeiro passo, sempre: `npm run doctor` e `/api/health`.

| Sintoma | Causa provável | Solução |
|---|---|---|
| Sistema no ar, **sem nenhuma pessoa** | clone novo (`data/` não vai pro git) | importe **nesta máquina** ou copie `data/intranet.json`; confira `/api/health` |
| **Cadastro não salva** (erro 503) | `data/` sem escrita: permissão, antivírus, OneDrive | `npm run doctor`; veja `gravavel` no health; a mensagem de erro diz a causa |
| **Outros PCs não acessam** | rede/firewall/WSL | DEPLOY.md §3 — checklist de 7 passos |
| Import XLSX "nenhum registro reconhecido" | formato diferente do esperado | o importador mostra o que viu; use o **plano B em CSV** |
| `esbuild for another platform` | `node_modules` copiado entre SOs | apague `node_modules` e `npm install` na máquina de destino |
| **Login bloqueado** ("muitas tentativas") | 5 senhas erradas seguidas | aguarde 15 min (ou reinicie o serviço, que zera o contador) |
| Admin **esqueceu a senha** e há outro admin | — | o outro admin redefine em Contas de acesso |
| **Único** admin esqueceu a senha | — | pare o serviço; edite `data/intranet.json` deixando `"usuarios": []`; suba com `ADMIN_EMAIL`/`ADMIN_PASSWORD` definidos (na VM: `/etc/intranet.env`) — o admin é recriado; recrie as demais contas pela tela |
| Acentos virando `�` na importação | arquivo UTF-16/BOM do Windows | nada a fazer — o importador detecta e converte sozinho |

Persistiu? Envie a saída completa do `npm run doctor` + o erro original.

---

## 11. Referência rápida da API

Leitura é pública; escrita exige token (`Authorization: Bearer …` obtido em
`/api/auth/login`). Papel mínimo indicado por coluna.

| Recurso | Público (GET) | Gestor | Admin |
|---|---|---|---|
| `/api/health` | estado + contagens | — | — |
| `/api/pessoas` | listar/buscar (`?busca=&setor=`) | CRUD nos seus setores | CRUD total |
| `/api/avisos` | listar | criar; editar/excluir os próprios | tudo |
| `/api/avisos/:id/anexos` | download público | nos próprios avisos | tudo |
| `/api/setores` | listar | — | CRUD (rename cascateia) |
| `/api/tiles` | listar + `/opcoes` | — | CRUD + reordenar |
| `/api/eventos` | listar | — | CRUD |
| `/api/navegacao` | listar | — | CRUD grupos/itens |
| `/api/contas` | — | — | CRUD + redefinir senha |
| `/api/auditoria` | — | — | listar (`?limite=`) |
| `/api/auth` | `login` | `me`, `senha` (trocar a própria) | idem |

Tokens expiram em 8 horas. Validação retorna **422** com os campos; permissão
negada, **403**; conflito (e-mail/sigla duplicada, setor em uso, último admin),
**409**.

---

## 12. Limites conhecidos

- **Sem push em tempo real**: quem está com a página aberta vê novidades ao
  navegar/recarregar (normal para portal interno).
- **Sem notificação por e-mail** (depende de SMTP corporativo — futuro).
- **Conteúdo dos comunicados é texto puro** (os botões de formatação do editor
  são decorativos por enquanto).
- **Leitura é pública por design**: qualquer pessoa que alcance a porta na LAN
  vê o diretório. Exponha o serviço apenas na rede corporativa.
