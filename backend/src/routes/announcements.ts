import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { AuthedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { pool } from '../db';

export const announcementsRouter = Router();

// Anyone logged in can read the intranet announcements.
announcementsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.created_at, u.full_name AS author
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC`,
    );
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        author: row.author,
        createdAt: row.created_at,
      })),
    );
  }),
);

// Only administrators can publish a new announcement.
announcementsRouter.post(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { title, body } = req.body ?? {};
    if (typeof title !== 'string' || typeof body !== 'string' || !title.trim() || !body.trim()) {
      res.status(400).json({ error: 'título e conteúdo são obrigatórios' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO announcements (title, body, created_by) VALUES ($1, $2, $3) RETURNING id, title, body, created_at',
      [title.trim(), body.trim(), req.user!.sub],
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    });
  }),
);
