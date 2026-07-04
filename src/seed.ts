import crypto from 'node:crypto';
import { config } from './config';
import { hashPassword } from './auth';
import * as store from './store';

// Estrutura organizacional da SEPLAG (NÃO é dado pessoal — pode ser versionada).
const DEPARTAMENTOS: { code: string; name: string; description: string }[] = [
  { code: 'SECOGE', name: 'SECOGE - Secretaria de Controladoria Geral do Estado', description: 'Controladoria Geral' },
  { code: 'SEPO', name: 'SEPO - Secretaria Executiva de Planejamento e Orçamento', description: 'Planejamento e Orçamento' },
  { code: 'IGPE', name: 'IGPE - Instituto de Gestão Pública de Pernambuco', description: 'Gestão Pública' },
  { code: 'GABINETE', name: 'GABINETE', description: 'Gabinete do Secretário' },
  { code: 'SEDRC', name: 'SEDRC - Sec. Exec. de Desenv. Regional e Captação', description: 'Desenvolvimento Regional' },
  { code: 'SEGPR', name: 'SEGPR - Sec. Exec. de Gestão para Resultados', description: 'Gestão para Resultados' },
  { code: 'SEGES', name: 'SEGES - Secretaria Executiva de Gestão Estratégica', description: 'Gestão Estratégica' },
  { code: 'CEDIDA', name: 'CEDIDA', description: 'Servidores cedidos a outros órgãos' },
  { code: 'OUTROS', name: 'OUTROS', description: 'Outros Setores' },
];

const LINKS: { title: string; url: string; description: string; category: string; order: number }[] = [
  { title: 'Portal do Servidor', url: 'https://portal.seplag.pe.gov.br', description: 'Acesso a contracheques e informações.', category: 'Servidor', order: 1 },
  { title: 'Sistema de Ponto', url: 'https://ponto.seplag.pe.gov.br', description: 'Registro de frequência diário.', category: 'Interno', order: 2 },
  { title: 'Email (Webmail)', url: 'https://webmail.seplag.pe.gov.br', description: 'Acesso ao e-mail corporativo.', category: 'Ferramentas', order: 3 },
  { title: 'SEI (Sistema Eletrônico)', url: 'https://sei.pe.gov.br', description: 'Protocolo e gestão de processos.', category: 'Interno', order: 4 },
];

export async function seed(): Promise<void> {
  for (const d of DEPARTAMENTOS) {
    await store.upsertDepartment(d);
  }
  if (store.countLinks() === 0) {
    for (const l of LINKS) {
      await store.createLink(l);
    }
  }
  // Bootstrap do primeiro admin, só se ainda não houver nenhum usuário.
  if (store.countUsers() === 0) {
    const senha = config.adminPassword ?? crypto.randomBytes(9).toString('base64url');
    await store.createUser({
      email: config.adminEmail,
      passwordHash: hashPassword(senha),
      role: 'admin',
      name: 'Administrador',
    });
    if (!config.adminPassword) {
      console.log('\n=================== ADMIN CRIADO ===================');
      console.log(`  e-mail: ${config.adminEmail}`);
      console.log(`  senha : ${senha}`);
      console.log('  (anote agora — não será exibida novamente)');
      console.log('===================================================\n');
    }
  }
}
