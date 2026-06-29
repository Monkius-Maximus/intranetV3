import dotenv from 'dotenv';

// On the server the variables come from systemd (EnvironmentFile=.env). For
// local development they come from a .env file. dotenv does not override
// variables that are already set, so both paths coexist without conflict.
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variável de ambiente ${name} deve ser numérica (recebido: "${raw}")`);
  }
  return parsed;
}

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: numberFromEnv('PORT', 3000),
  jwtSecret: required('JWT_SECRET'),
  // Token lifetime in seconds (default: 8 hours).
  jwtExpiresInSeconds: numberFromEnv('JWT_EXPIRES_IN', 28800),
  bcryptCost: numberFromEnv('BCRYPT_COST', 12),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: numberFromEnv('DB_PORT', 5432),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
} as const;
