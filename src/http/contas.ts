import { Router } from 'express';
import type { z } from 'zod';
import { type AuthedRequest, autenticar, exigirAdmin, hashPassword } from '../auth';
import type { Repositorio } from '../data/repositorio';
import {
  atualizarContaSchema,
  criarContaSchema,
  paraPublico,
  redefinirSenhaSchema,
} from '../domain/usuario';
import { idParam, validar } from './util';

// Contas de LOGIN (quem entra e gerencia) — não confundir com o diretório de
// pessoas (/api/pessoas). Só administradores mexem aqui.
//
// Invariante protegida em todas as rotas: precisa sempre restar pelo menos
// UM administrador ativo — senão o sistema fica sem gestão para sempre.
export function montarContas(repo: Repositorio): Router {
  const r = Router();
  r.use(autenticar, exigirAdmin);

  // A mudança/remoção deixaria o sistema sem nenhum admin ativo?
  async function deixariaSemAdmin(idAlvo: number, depois: { role?: string; ativo?: boolean }): Promise<boolean> {
    const contas = await repo.usuarios.listar();
    const alvo = contas.find((c) => c.id === idAlvo);
    if (!alvo || alvo.role !== 'admin' || !alvo.ativo) return false; // alvo não é admin ativo: irrelevante
    const continuaAdminAtivo = depois.role !== undefined || depois.ativo !== undefined
      ? (depois.role ?? alvo.role) === 'admin' && (depois.ativo ?? alvo.ativo)
      : false; // remoção
    if (continuaAdminAtivo) return false;
    return contas.filter((c) => c.role === 'admin' && c.ativo && c.id !== idAlvo).length === 0;
  }

  r.get('/', async (_req, res) => {
    res.json((await repo.usuarios.listar()).map(paraPublico));
  });

  r.post('/', validar(criarContaSchema), async (req, res) => {
    const dados = req.body as z.infer<typeof criarContaSchema>;
    const conta = await repo.usuarios.criar({
      name: dados.name,
      email: dados.email,
      role: dados.role,
      passwordHash: hashPassword(dados.senha),
      mustChangePassword: dados.mustChangePassword,
    });
    res.status(201).json(paraPublico(conta));
  });

  r.put('/:id', validar(atualizarContaSchema), async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const patch = req.body as z.infer<typeof atualizarContaSchema>;
    if (await deixariaSemAdmin(id, patch)) {
      res.status(409).json({ erro: 'esta é a única conta de administrador ativa — crie/ative outra antes' });
      return;
    }
    res.json(paraPublico(await repo.usuarios.atualizar(id, patch)));
  });

  r.put('/:id/senha', validar(redefinirSenhaSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const { senha, mustChangePassword } = req.body as z.infer<typeof redefinirSenhaSchema>;
    const conta = await repo.usuarios.atualizar(id, {
      passwordHash: hashPassword(senha),
      mustChangePassword,
    });
    res.json(paraPublico(conta));
  });

  r.delete('/:id', async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    if (id === req.user!.sub) {
      res.status(409).json({ erro: 'não é possível excluir a própria conta' });
      return;
    }
    if (await deixariaSemAdmin(id, {})) {
      res.status(409).json({ erro: 'esta é a única conta de administrador ativa — crie/ative outra antes' });
      return;
    }
    res.json(paraPublico(await repo.usuarios.remover(id)));
  });

  return r;
}
