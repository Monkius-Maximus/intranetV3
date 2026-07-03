import express, { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { announcementsRouter } from './routes/announcements';

const app = express();
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/announcements', announcementsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'recurso não encontrado' });
});

// Error-handling middleware: Express identifies it by the 4-argument signature,
// so _next must stay in the list even though it is unused.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'erro interno' });
});

// Bind exclusively to the loopback interface: only nginx (same host) may reach
// the backend. Nothing on the LAN can connect to port 3000 directly.
app.listen(config.port, config.host, () => {
  console.log(`Intranet SEPLAG backend ouvindo em ${config.host}:${config.port}`);
});
