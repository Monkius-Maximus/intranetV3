import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import type { Repositorio } from '../data/repositorio';

let app: Express;
let repo: Repositorio;
let mesclarPessoas: typeof import('../ingest').mesclarPessoas;

beforeAll(async () => {
  process.env.ADMIN_EMAIL = 'admin@test.local';
  process.env.ADMIN_PASSWORD = 'admin12345';
  process.env.JWT_SECRET = 'segredo-de-teste';
  const dir = mkdtempSync(join(tmpdir(), 'intranet-test-'));

  const { RepositorioJson } = await import('../data/repositorioJson');
  const { seed } = await import('../seed');
  const { criarApp } = await import('../http/app');
  ({ mesclarPessoas } = await import('../ingest'));

  repo = new RepositorioJson(join(dir, 'db.json'));
  await repo.iniciar();
  await seed(repo);
  app = criarApp(repo);
});

async function loginAdmin(): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', senha: 'admin12345' });
  expect(r.status).toBe(200);
  return r.body.token;
}

describe('Saúde e acesso', () => {
  it('health responde 200', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  it('leitura do diretório é pública (200 sem token)', async () => {
    const r = await request(app).get('/api/pessoas');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it('escrita exige admin (401 sem token)', async () => {
    const r = await request(app).post('/api/pessoas').send({ name: 'Sem Permissão' });
    expect(r.status).toBe(401);
  });

  it('login com senha errada é 401', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', senha: 'errada' });
    expect(r.status).toBe(401);
  });

  it('corpo JSON malformado retorna 400 (não 500)', async () => {
    const r = await request(app).post('/api/pessoas').set('Content-Type', 'application/json').send('{ruim');
    expect(r.status).toBe(400);
  });
});

describe('Pessoas', () => {
  it('seed criou os setores', async () => {
    const r = await request(app).get('/api/setores');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(9);
  });

  it('admin cria pessoa e a busca a encontra (acento-insensível)', async () => {
    const token = await loginAdmin();
    const criar = await request(app)
      .post('/api/pessoas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fulano de Tál', departmentCode: 'SEPO' });
    expect(criar.status).toBe(201);
    expect(criar.body.status).toBe('ativo'); // default do modelo expandido
    expect(criar.body.competencias).toEqual([]);

    const lista = await request(app).get('/api/pessoas?busca=FULANO DE TAL').set('Authorization', `Bearer ${token}`);
    expect(lista.body).toHaveLength(1);
  });

  it('PUT parcial preserva os demais campos', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/pessoas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beltrana Editável', phoneExtension: '1111', departmentCode: 'IGPE', departmentFull: 'IGPE/GESTAO' });
    const editado = await request(app)
      .put(`/api/pessoas/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneExtension: '2222' });
    expect(editado.status).toBe(200);
    expect(editado.body.phoneExtension).toBe('2222');
    expect(editado.body.name).toBe('Beltrana Editável');
    expect(editado.body.departmentFull).toBe('IGPE/GESTAO');
  });
});

describe('Ingestão multi-origem (merge preserva enriquecimento)', () => {
  it('reimportar atualiza o núcleo mas NÃO apaga e-mail/cargo preenchidos', async () => {
    const token = await loginAdmin();
    // 1ª importação (só núcleo)
    await mesclarPessoas(
      repo,
      [{ name: 'Zé Procedência', departmentCode: 'SEPO', departmentFull: 'SEPO', birthDay: 5, birthMonth: 5 }],
      'xlsx',
    );
    const achado = (await repo.pessoas.listar({ busca: 'Zé Procedência' }))[0];

    // admin enriquece
    await request(app)
      .put(`/api/pessoas/${achado.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ze@seplag.pe.gov.br', cargo: 'Analista' });

    // reimportação: muda o setor (núcleo)
    await mesclarPessoas(
      repo,
      [{ name: 'Zé Procedência', departmentCode: 'IGPE', departmentFull: 'IGPE', birthDay: 5, birthMonth: 5 }],
      'xlsx',
    );

    const depois = await repo.pessoas.obter(achado.id);
    expect(depois?.departmentCode).toBe('IGPE'); // núcleo atualizado
    expect(depois?.email).toBe('ze@seplag.pe.gov.br'); // enriquecimento preservado
    expect(depois?.cargo).toBe('Analista');
  });
});

describe('Avisos', () => {
  it('admin cria, edita parcialmente (PUT) e o restante é preservado', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/avisos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Título original', body: 'Corpo original', pinned: true, categoria: 'ti' });
    expect(criado.status).toBe(201);
    expect(criado.body.categoria).toBe('ti');
    expect(criado.body.autor).toBe('Administrador'); // nome de quem publicou (do token)

    const editado = await request(app)
      .put(`/api/avisos/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Corpo revisado' });
    expect(editado.status).toBe(200);
    expect(editado.body.body).toBe('Corpo revisado');
    expect(editado.body.title).toBe('Título original'); // preservado
    expect(editado.body.pinned).toBe(true); // preservado
    expect(editado.body.categoria).toBe('ti'); // preservado
    expect(editado.body.id).toBe(criado.body.id); // mesmo registro
    expect(editado.body.createdAt).toBe(criado.body.createdAt);
  });

  it('categoria inválida é rejeitada; ausente assume "geral"', async () => {
    const token = await loginAdmin();
    const invalida = await request(app)
      .post('/api/avisos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X', body: 'Y', categoria: 'inexistente' });
    expect(invalida.status).toBe(422); // validação Zod (ver http/util.ts)

    const semCategoria = await request(app)
      .post('/api/avisos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sem categoria', body: 'corpo' });
    expect(semCategoria.status).toBe(201);
    expect(semCategoria.body.categoria).toBe('geral');
  });

  it('PUT sem token é 401; id inexistente é 404', async () => {
    const semToken = await request(app).put('/api/avisos/1').send({ title: 'X' });
    expect(semToken.status).toBe(401);
    const token = await loginAdmin();
    const naoExiste = await request(app)
      .put('/api/avisos/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X' });
    expect(naoExiste.status).toBe(404);
  });
});

describe('Navegação dirigida por banco', () => {
  it('árvore pública traz os grupos do seed', async () => {
    const r = await request(app).get('/api/navegacao');
    expect(r.status).toBe(200);
    expect(r.body.map((g: { nome: string }) => g.nome)).toContain('Sistemas');
  });

  it('admin cria grupo e item; aparecem na árvore', async () => {
    const token = await loginAdmin();
    const g = await request(app)
      .post('/api/navegacao/grupos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Grupo Teste', destaque: true });
    expect(g.status).toBe(201);
    const item = await request(app)
      .post('/api/navegacao/itens')
      .set('Authorization', `Bearer ${token}`)
      .send({ grupoId: g.body.id, label: 'Item X', url: 'https://exemplo.gov.br' });
    expect(item.status).toBe(201);

    const arvore = await request(app).get('/api/navegacao');
    const grupo = arvore.body.find((x: { id: number }) => x.id === g.body.id);
    expect(grupo.itens).toHaveLength(1);
  });

  it('criar grupo sem token é 401', async () => {
    const r = await request(app).post('/api/navegacao/grupos').send({ nome: 'X' });
    expect(r.status).toBe(401);
  });
});

describe('Tiles dirigidos por banco', () => {
  it('seed criou os 6 tiles; leitura é pública', async () => {
    const r = await request(app).get('/api/tiles');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(6);
    expect(r.body[0].ordem).toBe(1);
  });

  it('admin cria, edita, reordena e exclui; URL inválida é 422', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/tiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Biblioteca', icon: 'local_library', cor: '#103a6b', url: 'https://biblioteca.pe.gov.br' });
    expect(criado.status).toBe(201);

    const interno = await request(app)
      .put(`/api/tiles/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ url: '#aniversariantes' });
    expect(interno.status).toBe(200);
    expect(interno.body.url).toBe('#aniversariantes');

    const invalida = await request(app)
      .post('/api/tiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'X', icon: 'badge', cor: '#1e73be', url: 'javascript:alert(1)' });
    expect(invalida.status).toBe(422);

    const lista = (await request(app).get('/api/tiles')).body;
    const ids = lista.map((t: { id: number }) => t.id).reverse();
    await request(app).put('/api/tiles/ordem').set('Authorization', `Bearer ${token}`).send({ ids });
    const depois = (await request(app).get('/api/tiles')).body;
    expect(depois[0].id).toBe(ids[0]);

    const del = await request(app).delete(`/api/tiles/${criado.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});

describe('Setores editáveis', () => {
  it('renomear a sigla cascateia para as pessoas do setor', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/setores')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'nucleo-x', name: 'Núcleo Experimental' });
    expect(criado.status).toBe(201);
    expect(criado.body.code).toBe('NUCLEO-X'); // sigla normalizada p/ caixa alta

    const pessoa = await request(app)
      .post('/api/pessoas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pessoa do Núcleo', departmentCode: 'NUCLEO-X', departmentFull: 'NUCLEO-X/EQUIPE' });

    const renome = await request(app)
      .put(`/api/setores/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'NEX' });
    expect(renome.status).toBe(200);

    const depois = await request(app).get(`/api/pessoas/${pessoa.body.id}`);
    expect(depois.body.departmentCode).toBe('NEX'); // cascata
    expect(depois.body.departmentFull).toBe('NEX/EQUIPE');
  });

  it('não exclui setor em uso (409); exclui quando vazio', async () => {
    const token = await loginAdmin();
    const setores = (await request(app).get('/api/setores')).body;
    const nex = setores.find((s: { code: string }) => s.code === 'NEX');
    const emUso = await request(app).delete(`/api/setores/${nex.id}`).set('Authorization', `Bearer ${token}`);
    expect(emUso.status).toBe(409);

    const vazio = await request(app)
      .post('/api/setores')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TEMP', name: 'Temporário' });
    const del = await request(app).delete(`/api/setores/${vazio.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  it('sigla duplicada é 409; escrita sem token é 401', async () => {
    const token = await loginAdmin();
    const dup = await request(app)
      .post('/api/setores')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'SEPO', name: 'Duplicado' });
    expect(dup.status).toBe(409);
    expect((await request(app).post('/api/setores').send({ code: 'X2', name: 'X' })).status).toBe(401);
  });
});

describe('Eventos (agenda)', () => {
  it('admin cria e edita; leitura pública ordenada por data', async () => {
    const token = await loginAdmin();
    const b = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Reunião geral', data: '2026-08-20', hora: '10h', local: 'Auditório' });
    expect(b.status).toBe(201);
    const a = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'Prazo relatório', data: '2026-08-05' });
    expect(a.body.hora).toBeNull();

    const lista = await request(app).get('/api/eventos');
    expect(lista.status).toBe(200);
    const idx = (t: string) => lista.body.findIndex((e: { titulo: string }) => e.titulo === t);
    expect(idx('Prazo relatório')).toBeLessThan(idx('Reunião geral')); // ordenado por data

    const edit = await request(app)
      .put(`/api/eventos/${b.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ local: 'Sala 3' });
    expect(edit.body.local).toBe('Sala 3');
    expect(edit.body.titulo).toBe('Reunião geral');

    const dataRuim = await request(app)
      .post('/api/eventos')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'X', data: '20/08/2026' });
    expect(dataRuim.status).toBe(422);
  });
});

describe('Contas de acesso', () => {
  it('admin cria conta; com troca pendente não escreve; após trocar a senha, escreve', async () => {
    const token = await loginAdmin();
    const criada = await request(app)
      .post('/api/contas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Chefe do Setor', email: 'chefe@test.local', senha: 'senha-inicial-1' });
    expect(criada.status).toBe(201);
    expect(JSON.stringify(criada.body)).not.toContain('passwordHash');
    expect(criada.body.mustChangePassword).toBe(true); // padrão seguro

    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'chefe@test.local', senha: 'senha-inicial-1' });
    expect(login1.status).toBe(200);
    expect(login1.body.user.mustChangePassword).toBe(true);

    // escrita bloqueada enquanto a troca estiver pendente
    const bloqueada = await request(app)
      .post('/api/avisos')
      .set('Authorization', `Bearer ${login1.body.token}`)
      .send({ title: 'X', body: 'Y' });
    expect(bloqueada.status).toBe(403);

    // troca a senha → token novo → escrita liberada, com autoria correta
    const troca = await request(app)
      .post('/api/auth/senha')
      .set('Authorization', `Bearer ${login1.body.token}`)
      .send({ senhaAtual: 'senha-inicial-1', novaSenha: 'senha-definitiva-2' });
    expect(troca.status).toBe(200);
    const liberada = await request(app)
      .post('/api/avisos')
      .set('Authorization', `Bearer ${troca.body.token}`)
      .send({ title: 'Do chefe', body: 'Publicado após trocar a senha' });
    expect(liberada.status).toBe(201);
    expect(liberada.body.autor).toBe('Chefe do Setor');
  });

  it('e-mail duplicado é 409', async () => {
    const token = await loginAdmin();
    const r = await request(app)
      .post('/api/contas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Outro', email: 'CHEFE@test.local', senha: 'qualquer-senha-8' });
    expect(r.status).toBe(409);
  });

  it('protege o último admin ativo e a própria conta', async () => {
    const token = await loginAdmin();
    const contas = (await request(app).get('/api/contas').set('Authorization', `Bearer ${token}`)).body;
    const eu = contas.find((c: { email: string }) => c.email === 'admin@test.local');
    const chefe = contas.find((c: { email: string }) => c.email === 'chefe@test.local');

    // rebaixa o chefe para leitor (permitido: ainda sobra o admin principal)
    const rebaixa = await request(app)
      .put(`/api/contas/${chefe.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'viewer' });
    expect(rebaixa.status).toBe(200);

    // agora o admin principal é o ÚLTIMO admin ativo: não pode ser rebaixado,
    // desativado nem excluído
    expect(
      (await request(app).put(`/api/contas/${eu.id}`).set('Authorization', `Bearer ${token}`).send({ role: 'viewer' }))
        .status,
    ).toBe(409);
    expect(
      (await request(app).put(`/api/contas/${eu.id}`).set('Authorization', `Bearer ${token}`).send({ ativo: false }))
        .status,
    ).toBe(409);
    expect(
      (await request(app).delete(`/api/contas/${eu.id}`).set('Authorization', `Bearer ${token}`)).status,
    ).toBe(409); // também é a própria conta
  });

  it('5 senhas erradas bloqueiam o login por 15 min (mesmo com a senha certa)', async () => {
    const token = await loginAdmin();
    await request(app)
      .post('/api/contas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Bloqueável', email: 'bloqueio@test.local', senha: 'senha-valida-8', mustChangePassword: false });

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: 'bloqueio@test.local', senha: 'errada' });
      expect(r.status).toBe(401);
    }
    const bloqueado = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bloqueio@test.local', senha: 'senha-valida-8' });
    expect(bloqueado.status).toBe(429);
  });

  it('conta desativada não loga', async () => {
    const token = await loginAdmin();
    const criada = await request(app)
      .post('/api/contas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Desativada', email: 'desativada@test.local', senha: 'senha-valida-8', mustChangePassword: false });
    await request(app)
      .put(`/api/contas/${criada.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ativo: false });
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'desativada@test.local', senha: 'senha-valida-8' });
    expect(r.status).toBe(401);
  });
});

describe('Segurança', () => {
  it('o banco NÃO é servido por HTTP', async () => {
    for (const p of ['/data/intranet.json', '/../data/intranet.json', '/data/jwt-secret.key']) {
      expect((await request(app).get(p)).status).toBe(404);
    }
  });

  it('nenhuma resposta expõe hash de senha', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', senha: 'admin12345' });
    expect(JSON.stringify(login.body)).not.toContain('passwordHash');
    expect(JSON.stringify(login.body)).not.toContain('$2a$');
  });
});
