import { Router } from 'express';
import { z } from 'zod';
import { type AuthedRequest, autenticar, hashPassword, signToken, verifyPassword } from '../auth';
import type { Repositorio } from '../data/repositorio';
import type { Usuario } from '../domain/usuario';
import { paraPublico, trocarSenhaSchema } from '../domain/usuario';
import { validar } from './util';

const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  senha: z.string().min(1).max(255),
});

// Limite de tentativas de login (anti-força-bruta): após MAX_FALHAS erros
// seguidos para um e-mail, bloqueia por BLOQUEIO_MS. Em memória de propósito —
// zera ao reiniciar o processo, o que é aceitável para uma intranet de LAN.
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { falhas: number; bloqueadoAte: number }>();

function bloqueio(email: string): number {
  const t = tentativas.get(email);
  if (!t) return 0;
  if (t.bloqueadoAte > Date.now()) return t.bloqueadoAte - Date.now();
  if (t.bloqueadoAte > 0) tentativas.delete(email); // bloqueio expirou: zera
  return 0;
}

function registrarFalha(email: string): void {
  const t = tentativas.get(email) ?? { falhas: 0, bloqueadoAte: 0 };
  t.falhas += 1;
  if (t.falhas >= MAX_FALHAS) t.bloqueadoAte = Date.now() + BLOQUEIO_MS;
  tentativas.set(email, t);
}

function tokenPara(u: Usuario): string {
  return signToken({
    sub: u.id,
    email: u.email,
    role: u.role,
    name: u.name,
    ...(u.mustChangePassword ? { mcp: true } : {}),
  });
}

export function montarAuth(repo: Repositorio): Router {
  const r = Router();

  r.post('/login', validar(loginSchema), async (req, res) => {
    const { email, senha } = req.body as z.infer<typeof loginSchema>;
    const chave = email.trim().toLowerCase();

    const restante = bloqueio(chave);
    if (restante > 0) {
      res.status(429).json({
        erro: `muitas tentativas de login — aguarde ${Math.ceil(restante / 60000)} minuto(s)`,
      });
      return;
    }

    const u = await repo.usuarios.porEmail(email);
    if (!u || !verifyPassword(senha, u.passwordHash)) {
      registrarFalha(chave);
      res.status(401).json({ erro: 'credenciais inválidas' });
      return;
    }
    if (!u.ativo) {
      res.status(401).json({ erro: 'conta desativada — procure um administrador' });
      return;
    }
    tentativas.delete(chave);
    res.json({ token: tokenPara(u), user: paraPublico(u) });
  });

  r.get('/me', autenticar, async (req: AuthedRequest, res) => {
    const u = await repo.usuarios.obter(req.user!.sub);
    if (!u) {
      res.status(404).json({ erro: 'usuário não encontrado' });
      return;
    }
    res.json(paraPublico(u));
  });

  // A própria pessoa troca a senha (exige a atual). Também é o caminho do
  // "trocar no 1º acesso": limpa a pendência e devolve um token novo sem ela.
  r.post('/senha', autenticar, validar(trocarSenhaSchema), async (req: AuthedRequest, res) => {
    const { senhaAtual, novaSenha } = req.body as z.infer<typeof trocarSenhaSchema>;
    const u = await repo.usuarios.obter(req.user!.sub);
    if (!u) {
      res.status(404).json({ erro: 'usuário não encontrado' });
      return;
    }
    if (!verifyPassword(senhaAtual, u.passwordHash)) {
      res.status(401).json({ erro: 'senha atual incorreta' });
      return;
    }
    const novo = await repo.usuarios.atualizar(u.id, {
      passwordHash: hashPassword(novaSenha),
      mustChangePassword: false,
    });
    res.json({ token: tokenPara(novo), user: paraPublico(novo) });
  });

  return r;
}
