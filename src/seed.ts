import crypto from 'node:crypto';
import { hashPassword } from './auth';
import { config } from './config';
import type { Repositorio } from './data/repositorio';
import { perfil } from './perfil';

// Semeadura inicial: aplica o conteúdo do PERFIL DO PROJETO (src/perfil.ts) e
// cria o primeiro administrador. Genérico de propósito — não conhece nenhum
// assunto; para mudar o que nasce com o sistema, edite o perfil, não este
// arquivo.
//
// Cada bloco só roda quando a coleção está VAZIA: depois da primeira execução
// quem manda é o que o admin editou pela tela — reaplicar desfaria as edições.

export async function seed(repo: Repositorio): Promise<void> {
  if ((await repo.departamentos.contar()) === 0) {
    for (const d of perfil.departamentos) {
      await repo.departamentos.upsert(d);
    }
  }

  if ((await repo.tiles.contar()) === 0) {
    for (const t of perfil.tiles) {
      await repo.tiles.criar(t);
    }
  }

  if ((await repo.navegacao.contarGrupos()) === 0) {
    for (const g of perfil.navegacao) {
      const grupo = await repo.navegacao.criarGrupo({
        nome: g.nome,
        url: g.url ?? null,
        destaque: Boolean(g.destaque),
      });
      for (const it of g.itens) {
        await repo.navegacao.criarItem({
          grupoId: grupo.id,
          label: it.label,
          url: it.url,
          descricao: it.descricao ?? null,
        });
      }
    }
  }

  if ((await repo.usuarios.contar()) === 0) {
    const senha = config.adminPassword ?? crypto.randomBytes(9).toString('base64url');
    await repo.usuarios.criar({
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
