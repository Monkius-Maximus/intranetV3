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
