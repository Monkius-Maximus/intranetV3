import { Router } from 'express';
import { z } from 'zod';
import { type AuthedRequest, autenticar, signToken, verifyPassword } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { paraPublico } from '../domain/usuario';
import { validar } from './util';

const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  senha: z.string().min(1).max(255),
});

export function montarAuth(repo: Repositorio): Router {
  const r = Router();

  r.post('/login', validar(loginSchema), async (req, res) => {
    const { email, senha } = req.body as z.infer<typeof loginSchema>;
    const u = await repo.usuarios.porEmail(email);
    if (!u || !verifyPassword(senha, u.passwordHash)) {
      res.status(401).json({ erro: 'credenciais inválidas' });
      return;
    }
    const token = signToken({ sub: u.id, email: u.email, role: u.role, name: u.name });
    res.json({ token, user: paraPublico(u) });
  });

  r.get('/me', autenticar, async (req: AuthedRequest, res) => {
    const u = await repo.usuarios.obter(req.user!.sub);
    if (!u) {
      res.status(404).json({ erro: 'usuário não encontrado' });
      return;
    }
    res.json(paraPublico(u));
  });

  return r;
}
