import { Router } from 'express';
import { asyncHandler } from '../asyncHandler';
import { pool } from '../db';

export const healthRouter = Router();

// Liveness + database reachability. Always returns 200 when the process is up
// so status.sh can use it as a simple availability probe; the `db` field
// reports whether the database connection is working.
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok' });
    } catch {
      res.json({ status: 'ok', db: 'error' });
    }
  }),
);
