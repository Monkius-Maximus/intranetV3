import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { config } from '../config';
import { signToken, verifyPassword } from '../auth';
import { pool } from '../db';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'usuário e senha são obrigatórios' });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1',
      [username],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'credenciais inválidas' });
      return;
    }

    const token = signToken(
      { sub: user.id, username: user.username, role: user.role },
      config.jwtSecret,
      config.jwtExpiresInSeconds,
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    });
  }),
);
