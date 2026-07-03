import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export type Role = 'admin' | 'user';

export interface TokenPayload {
  sub: number;
  username: string;
  role: Role;
}

// Password hashing — bcrypt via the pure-JS bcryptjs (no native build step,
// which matters for an offline install where compilers are not available).
export function hashPassword(password: string, cost: number): string {
  return bcrypt.hashSync(password, cost);
}

export function verifyPassword(password: string, hash: string): boolean {
  // compareSync throws on a malformed hash (e.g. the seed placeholder before
  // the admin password is set at install time); treat that as "no match".
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export function signToken(payload: TokenPayload, secret: string, expiresInSeconds: number): string {
  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as unknown as TokenPayload;
}
