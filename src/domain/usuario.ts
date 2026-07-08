export type Papel = 'admin' | 'viewer';

export interface Usuario {
  id: number;
  email: string;
  passwordHash: string;
  role: Papel;
  name: string;
}

// O que sai para o cliente (nunca o hash de senha).
export interface UsuarioPublico {
  id: number;
  email: string;
  role: Papel;
  name: string;
}

export function paraPublico(u: Usuario): UsuarioPublico {
  return { id: u.id, email: u.email, role: u.role, name: u.name };
}
