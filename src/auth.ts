import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config';
import type { Role } from './store';

export interface TokenPayload {
  sub: number;
  email: string;
  role: Role;
  name: string;
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

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
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

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ erro: 'acesso restrito a administradores' });
    return;
  }
  next();
}
