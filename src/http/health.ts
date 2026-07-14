import { Router } from 'express';
import { sondaDeEscrita } from '../config';
import type { Repositorio } from '../data/repositorio';

// Saúde com diagnóstico: contagens (qual banco este servidor está lendo?) e
// gravabilidade do data/ (o CRUD vai conseguir salvar?). Abra /api/health no
// navegador do servidor para conferir os dois de uma vez.
export function montarHealth(repo: Repositorio): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    const erroEscrita = sondaDeEscrita();
    res.json({
      status: 'ok',
      pessoas: await repo.pessoas.contar(),
      contas: await repo.usuarios.contar(),
      gravavel: erroEscrita === null,
      ...(erroEscrita ? { erroEscrita } : {}),
    });
  });
  return r;
}
