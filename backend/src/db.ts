import { Pool } from 'pg';
import { config } from './config';

// Single shared connection pool. The backend always connects to PostgreSQL
// over the local loopback interface (see architecture in DEPLOY-OFFLINE.md).
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
});

// An error on an idle client (e.g. the database restarted) would otherwise be
// thrown as an uncaught exception and crash the process. Log it instead; the
// pool discards the broken client and the next query opens a fresh one.
pool.on('error', (err) => {
  console.error('Erro em cliente ocioso do pool PostgreSQL:', err);
});
