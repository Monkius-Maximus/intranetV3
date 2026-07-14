import { z } from 'zod';

// Papéis de acesso. 'admin' gerencia tudo; 'viewer' loga mas não escreve
// (reservado para papéis mais finos no futuro, ex.: gestor por setor).
export type Papel = 'admin' | 'viewer';

export interface Usuario {
  id: number;
  email: string;
  passwordHash: string;
  role: Papel;
  name: string;
  ativo: boolean; // desativada = não loga (mantém histórico)
  mustChangePassword: boolean; // exige trocar a senha no próximo login
}

// O que sai para o cliente (nunca o hash de senha).
export interface UsuarioPublico {
  id: number;
  email: string;
  role: Papel;
  name: string;
  ativo: boolean;
  mustChangePassword: boolean;
}

export function paraPublico(u: Usuario): UsuarioPublico {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    name: u.name,
    ativo: u.ativo !== false, // contas antigas (sem o campo) contam como ativas
    mustChangePassword: u.mustChangePassword === true,
  };
}

// ----------------------------------------------------------------- validação
const email = z.string().trim().toLowerCase().min(3).max(255);
const senha = z.string().min(8, 'a senha precisa de pelo menos 8 caracteres').max(255);

export const criarContaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email,
  senha,
  role: z.enum(['admin', 'viewer']).default('admin'),
  mustChangePassword: z.boolean().default(true), // padrão seguro: troca no 1º acesso
});

// Atualização parcial (dados da conta; senha tem rota própria).
export const atualizarContaSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    email,
    role: z.enum(['admin', 'viewer']),
    ativo: z.boolean(),
  })
  .partial();

// Admin redefine a senha de uma conta.
export const redefinirSenhaSchema = z.object({
  senha,
  mustChangePassword: z.boolean().default(true),
});

// A própria pessoa troca a senha (exige a atual).
export const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1).max(255),
  novaSenha: senha,
});

export type DadosNovaConta = z.infer<typeof criarContaSchema>;
export type PatchConta = z.infer<typeof atualizarContaSchema>;
