import { z } from 'zod';

const textoCurto = z.string().trim().min(1).max(255);

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  senha: z.string().min(1).max(255),
});

const dia = z.number().int().min(1).max(31).nullable();
const mes = z.number().int().min(1).max(12).nullable();

// Validadores compartilhados entre criação e atualização (fonte única).
const emailFunc = z.string().trim().max(255).nullable();
const ramalFunc = z.string().trim().max(20).nullable();
const setorCodigo = z.string().trim().max(50).nullable();
const setorDetalhe = z.string().trim().max(255).nullable();

// Criação: campo ausente vira null (registro completo no store).
export const employeeCreateSchema = z.object({
  name: textoCurto,
  email: emailFunc.default(null),
  phoneExtension: ramalFunc.default(null),
  departmentCode: setorCodigo.default(null),
  departmentFull: setorDetalhe.default(null),
  birthDay: dia.default(null),
  birthMonth: mes.default(null),
});

// Atualização parcial: só o que vier no corpo é alterado. Definido SEM
// .default() — um default aqui faria todo PUT parcial apagar os campos
// não enviados (o Zod preenche defaults mesmo com a chave ausente).
export const employeeUpdateSchema = z
  .object({
    name: textoCurto,
    email: emailFunc,
    phoneExtension: ramalFunc,
    departmentCode: setorCodigo,
    departmentFull: setorDetalhe,
    birthDay: dia,
    birthMonth: mes,
  })
  .partial();

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
