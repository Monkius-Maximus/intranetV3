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
