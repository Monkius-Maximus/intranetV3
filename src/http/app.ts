import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Repositorio } from '../data/repositorio';
import { EmUso, FalhaDeGravacao, JaExiste, NaoEncontrado } from '../domain/erros';
import { montarAuditoria } from './auditoria';
import { montarAuth } from './auth';
import { montarAvisos } from './avisos';
import { montarContas } from './contas';
import { montarEventos } from './eventos';
import { montarTiles } from './tiles';
import { montarHealth } from './health';
import { montarNavegacao } from './navegacao';
import { montarPessoas } from './pessoas';
import { montarSetores } from './setores';

// Monta o app Express a partir de um repositório. Receber o repo por parâmetro
// (em vez de um singleton) mantém as rotas desacopladas da persistência e
// facilita os testes (injeta um repositório novo por teste).
export function criarApp(repo: Repositorio): express.Express {
  const app = express();
  app.use(express.json());

  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
  app.use(express.static(publicDir));

  app.use('/api/health', montarHealth(repo));
  app.use('/api/auth', montarAuth(repo));
  app.use('/api/contas', montarContas(repo));
  app.use('/api/pessoas', montarPessoas(repo));
  app.use('/api/setores', montarSetores(repo));
  app.use('/api/avisos', montarAvisos(repo));
  app.use('/api/navegacao', montarNavegacao(repo));
  app.use('/api/tiles', montarTiles(repo));
  app.use('/api/eventos', montarEventos(repo));
  app.use('/api/auditoria', montarAuditoria(repo));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'recurso não encontrado' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NaoEncontrado) {
      res.status(404).json({ erro: err.message });
      return;
    }
    if (err instanceof JaExiste || err instanceof EmUso) {
      res.status(409).json({ erro: err.message });
      return;
    }
    if (err instanceof FalhaDeGravacao) {
      // Problema do AMBIENTE (disco/permissão/antivírus) — devolve a causa
      // para o admin agir, em vez de um "erro interno" mudo.
      console.error('falha de gravação:', err.message);
      res.status(503).json({ erro: err.message });
      return;
    }
    const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ erro: 'requisição inválida' });
      return;
    }
    console.error('erro inesperado:', err);
    res.status(500).json({ erro: 'erro interno' });
  });

  return app;
}
