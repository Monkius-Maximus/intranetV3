import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config';
import type { Papel } from './domain/usuario';

export interface TokenPayload {
  sub: number;
  email: string;
  role: Papel;
  name: string;
  setores?: string[]; // siglas administradas (papel gestor)
  mcp?: boolean; // troca de senha pendente: só pode trocar a senha até resolver
}

export function hashPassword(senha: string): string {
  return bcrypt.hashSync(senha, config.bcryptCost);
}

export function verifyPassword(senha: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(senha, hash);
  } catch {
    return false;
  }
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresInSeconds });
}

export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

export function autenticar(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'não autenticado' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice('Bearer '.length), config.jwtSecret) as unknown as TokenPayload;
    next();
  } catch {
    res.status(401).json({ erro: 'token inválido' });
  }
}

function senhaPendente(req: AuthedRequest, res: Response): boolean {
  if (req.user?.mcp) {
    res.status(403).json({ erro: 'troca de senha pendente — defina uma nova senha antes de continuar' });
    return true;
  }
  return false;
}

export function exigirAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ erro: 'acesso restrito a administradores' });
    return;
  }
  if (senhaPendente(req, res)) return;
  next();
}

// Admin ou gestor (os papéis que escrevem). A checagem de ESCOPO do gestor
// (quais setores / quais comunicados) é feita em cada rota.
export function exigirGestao(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin' && req.user?.role !== 'gestor') {
    res.status(403).json({ erro: 'acesso restrito à gestão' });
    return;
  }
  if (senhaPendente(req, res)) return;
  next();
}

// Escopo do gestor sobre um setor (admins passam sempre).
export function gerenciaSetor(user: TokenPayload | undefined, code: string | null): boolean {
  if (user?.role === 'admin') return true;
  if (user?.role !== 'gestor') return false;
  return code !== null && (user.setores ?? []).includes(code);
}
