# ⚠️ Branch de laboratório — NÃO é a intranet de produção

Este branch (`claude/chassi-generico`) existe para transformar o projeto num
**chassi reutilizável** — uma base para outras intranets (residencial, de
equipe, de outro órgão). Ele **não** deve ir para a intranet que está no ar.

## Quem é quem

| Branch | Papel | Vai para o servidor? |
|---|---|---|
| `claude/redesign-ui-intranet` | **Produção** — a intranet da SEPLAG | **Sim** |
| `claude/multi-setor-export` | PR #2, entra em produção | **Sim**, ao ser mergeado |
| `claude/chassi-generico` | **Laboratório** (este) | **Não** |

Este branch **parte** do PR #2 (para herdar a correção do instalador), então o
histórico dele contém aquele trabalho. Isso é intencional — mas significa que
**abrir um PR daqui para produção levaria as duas coisas juntas**. Não faça
isso: se algum dia uma parte daqui for aproveitada em produção, ela deve sair
num commit próprio, num branch próprio, com decisão explícita.

## O que já foi feito aqui

1. **`src/perfil.ts`** — arquivo único com a identidade (nome, organização,
   marca, logo) e o conteúdo inicial (setores, navegação, tiles). O `seed.ts`
   ficou genérico; a interface lê a identidade de `GET /api/perfil` e monta a
   barra lateral, o título da aba, o login e o favicon a partir dela.
2. **`deploy/instalar.sh` parametrizado** por `PROJETO` (padrão `intranet`).
   Com o padrão, os caminhos são idênticos aos de hoje.
3. **Recursos dirigidos por dados — o "CRUD de página".** O admin cria uma
   página nova (Estoque, Gastos, Tarefas) pela tela **Páginas**, escolhendo os
   campos; ela aparece no menu e na API sem ninguém programar nem reinstalar.
   - Definição em `src/domain/recurso.ts`; conteúdo em `/api/r/<chave>`.
   - Cinco tipos de campo: texto, número, data, sim/não e seleção.
   - **A validação é gerada da definição** — obrigatório, opção inválida e
     campo desconhecido são recusados com 422, como nas telas escritas à mão.
   - Leitura pública, escrita para admin/gestor, tudo na trilha de auditoria.
   - Excluir a página remove os registros dela (a tela avisa antes).

## Perfis prontos

| `PERFIL` | O que é | Nasce com |
|---|---|---|
| `seplag` (padrão) | A intranet da SEPLAG | 9 secretarias, tiles e links do órgão |
| `casa` | Intranet residencial | Áreas da casa + páginas **Estoque**, **Gastos** e **Tarefas** |

Criar um projeto novo = escrever um arquivo em `src/perfis/` e listá-lo em
`src/perfil.ts`. Nada mais no código conhece o assunto.

## Como testar sem encostar na produção

Rode sempre com **pasta de dados**, **porta** e **projeto** próprios:

```bash
# a intranet residencial, isolada (nunca usa o data/ de produção)
PERFIL=casa INTRANET_DATA=/tmp/lab-casa PORT=3300 \
  ADMIN_EMAIL=admin@casa.local ADMIN_PASSWORD='umaSenhaForte' npm start
```

Se um dia for instalar numa VM **para testar**, use outro nome de projeto e
outra porta — assim convive com a instalação real sem tocá-la:

```bash
sudo PROJETO=casa PORTA=8080 bash deploy/instalar.sh
```

> Isso cria `/opt/casa`, usuário `casa`, serviço `casa` e `/etc/casa.env` —
> nada em comum com `/opt/intranet`. **Nunca** rode o instalador deste branch
> com o `PROJETO` padrão numa máquina que já hospeda a intranet real: os
> caminhos coincidiriam e o código do laboratório substituiria o de produção.

4. **Perfil "Casa"** — feito: `PERFIL=casa` sobe a intranet residencial com
   Estoque, Gastos e Tarefas já criados.

## Próximos passos planejados

5. **Filtros por coluna nas páginas** — a tela genérica só tem busca livre.
   Para "o que está abaixo do mínimo?" ou "gastos deste mês" falta filtrar e
   somar por campo.
6. **Generalizar o escopo do gestor** — hoje é literalmente "setores"; virar
   "escopo por campo" para servir a outros assuntos.
