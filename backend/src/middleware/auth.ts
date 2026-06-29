import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { TokenPayload, verifyToken } from '../auth';

export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'não autenticado' });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyToken(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'token inválido' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'acesso restrito a administradores' });
    return;
  }
  next();
}
