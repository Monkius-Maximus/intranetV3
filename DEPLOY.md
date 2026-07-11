# Deploy — Intranet SEPLAG

O app é **um processo Node só**, com dados num arquivo local. Não há banco
externo, nginx, systemd obrigatório nem build. O deploy é: instalar o Node,
subir o app, **abrir a porta no firewall** — foi o que a equipe já validou na
rede corporativa (Wi-Fi e cabo).

## 1. Caminho simples (a máquina consegue instalar o Node)

Na máquina que vai hospedar (Linux ou Windows):

```bash
# 1. Instale o Node.js LTS (uma vez):
#    - Ubuntu:  sudo apt install nodejs npm       (ou nodesource / nvm)
#    - Windows: instalador oficial de nodejs.org
node --version

# 2. Copie esta pasta para a máquina e instale só o de produção:
npm install --omit=dev

# 3. Suba o app (defina a senha do admin na 1ª vez):
ADMIN_EMAIL=admin@seplag.local ADMIN_PASSWORD='umaSenhaForte' npm start
```

Anote a URL impressa (`http://<host>:3000`). Passe o IP/hostname ao TI para
cadastrar no DNS, se quiser um nome amigável.

### Abrir a porta no firewall (o passo que faz os outros PCs enxergarem)

- **Windows:** Firewall do Windows → Regras de Entrada → Nova regra → Porta →
  TCP 3000 → Permitir. (Foi exatamente isto que a equipe fez no teste.)
- **Ubuntu (se o UFW estiver ativo):** `sudo ufw allow 3000/tcp`

### Manter no ar

- **Linux (opcional, recomendado):** um serviço systemd com `Restart=on-failure`
  — há um pronto em [`deploy/intranet.service`](deploy/intranet.service), com as
  instruções de instalação no cabeçalho.
- **Windows:** o Agendador de Tarefas (ao iniciar) ou uma ferramenta como
  `nssm` para rodar `npm start` como serviço.
- **Rápido/temporário:** `npm start` numa sessão que fique aberta.

### Porta 80 em vez de 3000 (opcional)

Rode com `PORT=80` (precisa de privilégio no Linux: `sudo setcap
'cap_net_bind_service=+ep' $(which node)` ou rodar como serviço). Não é
necessário nginx.

## 2. Variante air-gapped (a máquina NÃO tem internet no setup)

Não há banco nem pacotes de sistema: o "pacote offline" é a **pasta do app com
`node_modules/`** + o instalador do Node. Uma ressalva importante: quase todas
as dependências são JavaScript puro (`express`, `zod`, `bcryptjs`,
`jsonwebtoken`), **mas o `tsx` traz o esbuild, que tem um binário nativo por
SO/arquitetura**. Ou seja: o `node_modules/` montado no WSL/Ubuntu funciona num
servidor **Linux x64**, e **não** funciona num servidor **Windows** (é o erro
`You installed esbuild for another platform` do README).

### 2.1 Preparando o pacote no WSL (Ubuntu)

Na máquina com internet (seu WSL):

```bash
git clone <repo> intranet && cd intranet
git checkout <branch>                # ex.: claude/redesign-ui-intranet
npm ci --omit=dev                    # dependências de produção, reprodutíveis

# Carregue as PESSOAS REAIS agora, para o banco viajar junto com o pacote.
# Defina a senha do admin AQUI: o importador cria o usuário admin na 1ª
# execução, e é ESTA senha que valerá no servidor.
ADMIN_EMAIL=admin@seplag.local ADMIN_PASSWORD='umaSenhaForte' \
  npm run importar-aniversariantes -- /mnt/c/Users/voce/ANIVERSARIANTES_SEPLAG_2026.xlsx

# (Opcional) confira localmente antes de empacotar:
#   npm start   →  http://localhost:3000
# Importante: NUNCA rode o importador com o app no ar (o servidor mantém o
# estado em memória e sobrescreveria a importação na próxima gravação).

# Empacote (tar preserva permissões e evita corrupção ao cruzar /mnt/c):
cd .. && tar -czf intranet.tar.gz intranet
```

O `data/intranet.json` (pessoas reais) e o `data/jwt-secret.key` vão dentro do
tarball — é intencional: o servidor já nasce com o quadro completo e o admin
criado. **Trate o tarball como dado pessoal (LGPD): pendrive, não e-mail/nuvem.**

Baixe também o Node para o SO do servidor em <https://nodejs.org/en/download>:
`node-v22.x-linux-x64.tar.xz` (Linux) ou o instalador `.msi` (Windows).

### 2.2 Se o servidor é Linux (x64)

Leve `intranet.tar.gz` + o tarball do Node num pendrive:

```bash
sudo tar -xJf node-v22.*-linux-x64.tar.xz -C /opt && sudo mv /opt/node-v22.* /opt/node
export PATH=/opt/node/bin:$PATH      # persista no ~/.bashrc ou no service
tar -xzf intranet.tar.gz && cd intranet
npm start                            # sobe em http://0.0.0.0:3000
```

### 2.3 Se o servidor é Windows

O `node_modules/` do WSL **não serve**. Duas saídas:

- **A (mais simples):** faça o passo 2.1 numa máquina **Windows** com internet
  (instale o Node, `npm ci --omit=dev`, importe o XLSX, zipe a pasta).
- **B (a partir do próprio WSL, npm ≥ 10):** monte uma cópia com os binários
  do Windows — o npm baixa o esbuild da outra plataforma com:
  ```bash
  cp -r intranet intranet-win && cd intranet-win && rm -rf node_modules
  npm ci --omit=dev --force --os=win32 --cpu=x64
  cd .. && tar -czf intranet-win.tar.gz intranet-win
  ```
  (Essa cópia não roda no WSL — é só para levar ao servidor Windows.)

No servidor: instale o `.msi` do Node, extraia a pasta e rode `npm start`
(Agendador de Tarefas ou `nssm` para manter como serviço — ver seção 1).

## 3. Backup e restauração

Todo o estado está em **um arquivo**:

```bash
npm run backup      # copia data/intranet.json para backups/backup-<timestamp>.json
```

Restaurar = colocar o arquivo de volta em `data/` e reiniciar. (O segredo dos
tokens fica em `data/jwt-secret.key` — inclua no backup se quiser que os logins
atuais sobrevivam à restauração.)

## 4. Segurança

- **Leitura pública, escrita só admin.** O usuário comum consulta o diretório
  sem login; só o administrador entra (senha **bcrypt**, token **JWT** com
  segredo aleatório) para gerenciar pessoas/comunicados.
- **Atenção LGPD:** como a leitura é aberta, qualquer um que alcance a porta na
  LAN vê os dados de contato dos servidores. Isso é intencional (diretório
  interno), mas exponha **só a porta do app** no firewall e mantenha o servidor
  na rede corporativa. Se precisar de um portão, o caminho mais simples é exigir
  um token também nos `GET` (basta recolocar o middleware `authenticate` nas
  rotas de leitura em `src/app.ts`) e distribuir um login de leitura.
- `data/` (banco, segredo, dados reais) **nunca** vai para o git.
