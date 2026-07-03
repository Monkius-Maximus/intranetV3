import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { AuthedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { pool } from '../db';

export const usersRouter = Router();

// Current user — any authenticated role.
usersRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await pool.query(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = $1',
      [req.user!.sub],
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'usuário não encontrado' });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at,
    });
  }),
);

// Full user listing — administrators only.
usersRouter.get(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      'SELECT id, username, full_name, role, created_at FROM users ORDER BY id',
    );
    res.json(
      result.rows.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at,
      })),
    );
  }),
);
