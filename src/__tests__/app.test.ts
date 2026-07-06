import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  // Ambiente isolado: dados num tempdir, admin conhecido, segredo fixo.
  process.env.INTRANET_DATA = mkdtempSync(join(tmpdir(), 'intranet-test-'));
  process.env.ADMIN_EMAIL = 'admin@test.local';
  process.env.ADMIN_PASSWORD = 'admin12345';
  process.env.JWT_SECRET = 'segredo-de-teste';

  const store = await import('../store');
  const { seed } = await import('../seed');
  ({ app } = await import('../app'));
  await store.iniciar();
  await seed();
});

async function loginAdmin(): Promise<string> {
  const r = await request(app).post('/api/login').send({ email: 'admin@test.local', senha: 'admin12345' });
  expect(r.status).toBe(200);
  return r.body.token;
}

describe('Intranet SEPLAG API', () => {
  it('health responde 200', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  it('leitura do diretório é pública (200 sem token)', async () => {
    const r = await request(app).get('/api/employees');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it('escrita exige admin (401 sem token)', async () => {
    const r = await request(app).post('/api/employees').send({ name: 'Sem Permissão' });
    expect(r.status).toBe(401);
  });

  it('corpo JSON malformado retorna 400 (não 500)', async () => {
    const r = await request(app).post('/api/employees').set('Content-Type', 'application/json').send('{malformado');
    expect(r.status).toBe(400);
  });

  it('login com senha errada é 401', async () => {
    const r = await request(app).post('/api/login').send({ email: 'admin@test.local', senha: 'errada' });
    expect(r.status).toBe(401);
  });

  it('seed criou os departamentos', async () => {
    const token = await loginAdmin();
    const r = await request(app).get('/api/departments').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(9);
  });

  it('admin edita funcionário (PUT parcial) e preserva o resto', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beltrana Editável', phoneExtension: '1111', departmentCode: 'IGPE', departmentFull: 'IGPE/GESTAO' });
    expect(criado.status).toBe(201);

    const editado = await request(app)
      .put(`/api/employees/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneExtension: '2222' });
    expect(editado.status).toBe(200);
    expect(editado.body.phoneExtension).toBe('2222');
    // patch parcial não pode apagar os demais campos
    expect(editado.body.name).toBe('Beltrana Editável');
    expect(editado.body.departmentFull).toBe('IGPE/GESTAO');
  });

  it('PUT sem token é 401', async () => {
    const r = await request(app).put('/api/employees/1').send({ name: 'X' });
    expect(r.status).toBe(401);
  });

  it('admin cria e remove link; leitura é pública', async () => {
    const token = await loginAdmin();
    const criado = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Wiki Interna', url: 'https://wiki.seplag.local', description: 'Base de conhecimento' });
    expect(criado.status).toBe(201);

    const publico = await request(app).get('/api/links'); // sem token
    expect(publico.status).toBe(200);
    expect(publico.body.some((l: { title: string }) => l.title === 'Wiki Interna')).toBe(true);

    const removido = await request(app)
      .delete(`/api/links/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removido.status).toBe(200);
  });

  // ---- Segurança: nada sensível alcançável pelo navegador ----

  it('o banco de dados NÃO é servido por HTTP (404 em /data/…)', async () => {
    for (const caminho of ['/data/intranet.json', '/data/jwt-secret.key', '/../data/intranet.json']) {
      const r = await request(app).get(caminho);
      expect(r.status, caminho).toBe(404);
    }
  });

  it('nenhuma resposta da API expõe hash de senha ou segredo', async () => {
    const login = await request(app)
      .post('/api/login')
      .send({ email: 'admin@test.local', senha: 'admin12345' });
    expect(login.status).toBe(200);
    expect(JSON.stringify(login.body)).not.toContain('passwordHash');
    expect(JSON.stringify(login.body)).not.toContain('$2a$'); // prefixo bcrypt

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('admin cria funcionário e a busca o encontra', async () => {
    const token = await loginAdmin();
    const criar = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fulano de Tal', email: 'fulano@seplag.pe.gov.br', departmentCode: 'SEPO' });
    expect(criar.status).toBe(201);

    // busca acento-insensível
    const lista = await request(app).get('/api/employees?busca=FULANO').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].name).toBe('Fulano de Tal');
  });
});
