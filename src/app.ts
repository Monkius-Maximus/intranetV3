import express, { type NextFunction, type Request, type Response } from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import {
  announcementCreateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  linkCreateSchema,
  loginSchema,
} from './schemas';
import * as store from './store';
import { JaExiste, NaoEncontrado } from './store';
import { type AuthedRequest, authenticate, requireAdmin, signToken, verifyPassword } from './auth';

export const app = express();
app.use(express.json());

// UI estática (public/index.html servido em "/").
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

// Middleware único de validação de formato (uma forma só de validar).
function validar<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      res.status(422).json({ erro: 'validação falhou', detalhes: r.error.issues });
      return;
    }
    req.body = r.data;
    next();
  };
}

function idParam(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'id inválido' });
    return null;
  }
  return id;
}

// ----------------------------------------------------------------- Público
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', validar(loginSchema), (req, res) => {
  const { email, senha } = req.body as z.infer<typeof loginSchema>;
  const user = store.findUserByEmail(email);
  if (!user || !verifyPassword(senha, user.passwordHash)) {
    res.status(401).json({ erro: 'credenciais inválidas' });
    return;
  }
  const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// -------------------------------------------------- Autenticado (qualquer)
app.get('/api/me', authenticate, (req: AuthedRequest, res) => {
  const u = store.getUser(req.user!.sub);
  if (!u) {
    res.status(404).json({ erro: 'usuário não encontrado' });
    return;
  }
  res.json({ id: u.id, email: u.email, role: u.role, name: u.name });
});

// -------------------------------------------- Leitura pública (sem login)
// O usuário comum NÃO se cadastra nem faz login: consulta o diretório, os
// comunicados e os links direto. Só a ESCRITA exige o admin (abaixo).
// Nota LGPD: isto expõe dados de contato dos servidores a quem alcança a porta
// na LAN. Se um dia precisar de um portão, ver README (seção Segurança).
app.get('/api/departments', (_req, res) => {
  res.json(store.listDepartments());
});

app.get('/api/employees', (req, res) => {
  const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
  const departamento = typeof req.query.departamento === 'string' ? req.query.departamento : undefined;
  res.json(store.listEmployees({ busca, departamento }));
});

app.get('/api/employees/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  res.json(store.getEmployee(id));
});

app.get('/api/announcements', (_req, res) => {
  res.json(store.listAnnouncements());
});

app.get('/api/links', (_req, res) => {
  res.json(store.listLinks());
});

// ---------------------------------------------------- Somente administrador
app.post('/api/employees', authenticate, requireAdmin, validar(employeeCreateSchema), async (req, res) => {
  res.status(201).json(await store.createEmployee(req.body));
});

app.put('/api/employees/:id', authenticate, requireAdmin, validar(employeeUpdateSchema), async (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  res.json(await store.updateEmployee(id, req.body));
});

app.delete('/api/employees/:id', authenticate, requireAdmin, async (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  res.json(await store.removeEmployee(id));
});

app.post('/api/announcements', authenticate, requireAdmin, validar(announcementCreateSchema), async (req: AuthedRequest, res) => {
  const { title, body, pinned } = req.body as z.infer<typeof announcementCreateSchema>;
  res.status(201).json(await store.createAnnouncement({ title, body, pinned, createdBy: req.user!.sub }));
});

app.delete('/api/announcements/:id', authenticate, requireAdmin, async (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  res.json(await store.removeAnnouncement(id));
});

app.post('/api/links', authenticate, requireAdmin, validar(linkCreateSchema), async (req, res) => {
  res.status(201).json(await store.createLink(req.body));
});

app.delete('/api/links/:id', authenticate, requireAdmin, async (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  res.json(await store.removeLink(id));
});

// Tratador de erros: mapeia erros de domínio para status HTTP. O Express 5
// encaminha rejeições de handlers async para cá automaticamente.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof NaoEncontrado) {
    res.status(404).json({ erro: err.message });
    return;
  }
  if (err instanceof JaExiste) {
    res.status(409).json({ erro: err.message });
    return;
  }
  // Erros de parsing do corpo (express.json) trazem um status 4xx próprio.
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ erro: 'requisição inválida' });
    return;
  }
  console.error('erro inesperado:', err);
  res.status(500).json({ erro: 'erro interno' });
});
