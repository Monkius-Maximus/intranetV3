import { z } from 'zod';

const textoCurto = z.string().trim().min(1).max(255);

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  senha: z.string().min(1).max(255),
});

const dia = z.number().int().min(1).max(31).nullable();
const mes = z.number().int().min(1).max(12).nullable();

export const employeeCreateSchema = z.object({
  name: textoCurto,
  email: z.string().trim().max(255).nullable().default(null),
  phoneExtension: z.string().trim().max(20).nullable().default(null),
  departmentCode: z.string().trim().max(50).nullable().default(null),
  departmentFull: z.string().trim().max(255).nullable().default(null),
  birthDay: dia.default(null),
  birthMonth: mes.default(null),
});

// Atualização parcial: todos os campos opcionais.
export const employeeUpdateSchema = employeeCreateSchema.partial();

export const announcementCreateSchema = z.object({
  title: textoCurto,
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
});

export const linkCreateSchema = z.object({
  title: textoCurto,
  url: z.string().trim().url().max(500),
  description: z.string().trim().max(500).nullable().default(null),
  category: z.string().trim().max(100).nullable().default(null),
  order: z.number().int().min(0).optional(),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type EmployeeCreateBody = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateBody = z.infer<typeof employeeUpdateSchema>;
