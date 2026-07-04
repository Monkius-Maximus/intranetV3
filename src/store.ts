import { carregar, salvar } from './persistencia';

export type Role = 'admin' | 'viewer';

export interface Department {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface Employee {
  id: number;
  name: string;
  email: string | null;
  phoneExtension: string | null;
  departmentCode: string | null;
  departmentFull: string | null;
  birthDay: number | null;
  birthMonth: number | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdBy: number | null;
  createdAt: string;
}

export interface Link {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  order: number;
}

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
}

interface DB {
  departments: Department[];
  employees: Employee[];
  announcements: Announcement[];
  links: Link[];
  users: User[];
  seq: Record<string, number>;
}

function bancoVazio(): DB {
  return { departments: [], employees: [], announcements: [], links: [], users: [], seq: {} };
}

let db: DB = bancoVazio();

export class NaoEncontrado extends Error {}
export class JaExiste extends Error {}

export async function iniciar(): Promise<void> {
  db = await carregar<DB>(bancoVazio());
}

function persistir(): Promise<void> {
  return salvar(() => db);
}

function proximoId(colecao: string): number {
  db.seq[colecao] = (db.seq[colecao] ?? 0) + 1;
  return db.seq[colecao];
}

// Busca acento-insensível para o diretório (~centenas de registros).
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// ---------------------------------------------------------------- Employees
export function listEmployees(opcoes: { busca?: string; departamento?: string } = {}): Employee[] {
  let itens = db.employees;
  if (opcoes.departamento) {
    itens = itens.filter((e) => e.departmentCode === opcoes.departamento);
  }
  if (opcoes.busca) {
    const q = normalizar(opcoes.busca);
    itens = itens.filter(
      (e) =>
        normalizar(e.name).includes(q) ||
        normalizar(e.email ?? '').includes(q) ||
        normalizar(e.departmentFull ?? '').includes(q) ||
        (e.phoneExtension ?? '').includes(q),
    );
  }
  return [...itens].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

export function getEmployee(id: number): Employee {
  const e = db.employees.find((x) => x.id === id);
  if (!e) throw new NaoEncontrado('funcionário não encontrado');
  return e;
}

export async function createEmployee(dados: Omit<Employee, 'id'>): Promise<Employee> {
  const e: Employee = { id: proximoId('employees'), ...dados };
  db.employees.push(e);
  await persistir();
  return e;
}

export async function updateEmployee(id: number, patch: Partial<Omit<Employee, 'id'>>): Promise<Employee> {
  const e = getEmployee(id);
  Object.assign(e, patch);
  await persistir();
  return e;
}

export async function removeEmployee(id: number): Promise<Employee> {
  const i = db.employees.findIndex((x) => x.id === id);
  if (i < 0) throw new NaoEncontrado('funcionário não encontrado');
  const [e] = db.employees.splice(i, 1);
  await persistir();
  return e;
}

export function countEmployees(): number {
  return db.employees.length;
}

// Substitui todo o quadro de funcionários (usado pelo importador de dados
// reais). Idempotente: rodar de novo troca o conjunto inteiro.
export async function replaceEmployees(lista: Omit<Employee, 'id'>[]): Promise<number> {
  db.employees = lista.map((e, i) => ({ id: i + 1, ...e }));
  db.seq.employees = lista.length;
  await persistir();
  return db.employees.length;
}

// -------------------------------------------------------------- Departments
export function listDepartments(): Department[] {
  return [...db.departments].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

export function getDepartmentByCode(code: string): Department | undefined {
  return db.departments.find((d) => d.code === code);
}

export async function upsertDepartment(dados: Omit<Department, 'id'>): Promise<Department> {
  const existente = db.departments.find((d) => d.code === dados.code);
  if (existente) {
    Object.assign(existente, dados);
    await persistir();
    return existente;
  }
  const d: Department = { id: proximoId('departments'), ...dados };
  db.departments.push(d);
  await persistir();
  return d;
}

// ------------------------------------------------------------ Announcements
export function listAnnouncements(): Announcement[] {
  return [...db.announcements].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function createAnnouncement(dados: {
  title: string;
  body: string;
  pinned?: boolean;
  createdBy: number | null;
}): Promise<Announcement> {
  const a: Announcement = {
    id: proximoId('announcements'),
    title: dados.title,
    body: dados.body,
    pinned: Boolean(dados.pinned),
    createdBy: dados.createdBy,
    createdAt: new Date().toISOString(),
  };
  db.announcements.push(a);
  await persistir();
  return a;
}

export async function removeAnnouncement(id: number): Promise<Announcement> {
  const i = db.announcements.findIndex((x) => x.id === id);
  if (i < 0) throw new NaoEncontrado('comunicado não encontrado');
  const [a] = db.announcements.splice(i, 1);
  await persistir();
  return a;
}

// -------------------------------------------------------------------- Links
export function listLinks(): Link[] {
  return [...db.links].sort((a, b) => a.order - b.order);
}

export async function createLink(dados: {
  title: string;
  url: string;
  description?: string | null;
  category?: string | null;
  order?: number;
}): Promise<Link> {
  const l: Link = {
    id: proximoId('links'),
    title: dados.title,
    url: dados.url,
    description: dados.description ?? null,
    category: dados.category ?? null,
    order: dados.order ?? db.links.length + 1,
  };
  db.links.push(l);
  await persistir();
  return l;
}

export async function removeLink(id: number): Promise<Link> {
  const i = db.links.findIndex((x) => x.id === id);
  if (i < 0) throw new NaoEncontrado('link não encontrado');
  const [l] = db.links.splice(i, 1);
  await persistir();
  return l;
}

export function countLinks(): number {
  return db.links.length;
}

// -------------------------------------------------------------------- Users
export function findUserByEmail(email: string): User | undefined {
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getUser(id: number): User | undefined {
  return db.users.find((u) => u.id === id);
}

export async function createUser(dados: Omit<User, 'id'>): Promise<User> {
  if (findUserByEmail(dados.email)) throw new JaExiste('e-mail já cadastrado');
  const u: User = { id: proximoId('users'), ...dados };
  db.users.push(u);
  await persistir();
  return u;
}

export function countUsers(): number {
  return db.users.length;
}
