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

- **Linux (opcional, recomendado):** um serviço systemd que roda
  `npm start` no diretório do app, com `Restart=on-failure`. (Um processo só;
  nada além disto.)
- **Windows:** o Agendador de Tarefas (ao iniciar) ou uma ferramenta como
  `nssm` para rodar `npm start` como serviço.
- **Rápido/temporário:** `npm start` numa sessão que fique aberta.

### Porta 80 em vez de 3000 (opcional)

Rode com `PORT=80` (precisa de privilégio no Linux: `sudo setcap
'cap_net_bind_service=+ep' $(which node)` ou rodar como serviço). Não é
necessário nginx.

## 2. Variante air-gapped (a máquina NÃO tem internet no setup)

Como não há banco nem pacotes de sistema, o "pacote offline" é trivial — bem mais
simples que a abordagem anterior:

1. Numa máquina com internet, do mesmo SO/arquitetura:
   ```bash
   npm install --omit=dev        # baixa as dependências (JS puro, sem compilar)
   ```
   Baixe também o tarball oficial do Node (`node-vXX-linux-x64.tar.xz`).
2. Leve num pendrive: **a pasta do app inteira (com `node_modules/`)** + o
   tarball do Node.
3. Na máquina-alvo: extraia o Node para `/opt/node` (ou instale o `.msi` no
   Windows) e rode `npm start` (ou `node_modules/.bin/tsx src/index.ts`).

Nenhum `.deb`, nenhum PostgreSQL, nenhuma compilação. As dependências
(`express`, `zod`, `bcryptjs`, `jsonwebtoken`, `tsx`) são JavaScript puro.

## 3. Backup e restauração

Todo o estado está em **um arquivo**:

```bash
cp data/intranet.json  backup-intranet-$(date +%Y%m%d-%H%M%S).json
```

Restaurar = colocar o arquivo de volta em `data/` e reiniciar. (O segredo dos
tokens fica em `data/jwt-secret.key` — inclua no backup se quiser que os logins
atuais sobrevivam à restauração.)

## 4. Segurança

- Acesso protegido por **login** (o diretório tem dados pessoais — LGPD).
- Senhas com **bcrypt**; tokens **JWT** assinados com segredo aleatório.
- `data/` (banco, segredo, dados reais) **nunca** vai para o git.
- Exponha só a porta do app no firewall; nada mais precisa estar aberto.
