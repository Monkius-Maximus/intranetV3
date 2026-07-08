import type { Repositorio } from './data/repositorio';
import { type Pessoa, type PessoaImportada, chaveDePessoa, pessoaVazia } from './domain/pessoa';

// Serviço de ingestão: mescla registros de QUALQUER origem no repositório,
// preservando o ENRIQUECIMENTO (e-mail, ramal, cargo, redes…). Uma reimportação
// atualiza só o NÚCLEO (nome, setor, dia/mês) das pessoas já existentes e cria
// as novas — sem apagar o que o admin/Synergy+ preencheu.

export interface ResultadoIngest {
  total: number;
  novos: number;
  atualizados: number;
  preservados: number; // existentes que a origem não trouxe (mantidos intactos)
  setoresDesconhecidos: Record<string, number>;
}

// Chave de casamento entre importações. Nome + aniversário reduz colisão de
// homônimos. Quando o e-mail passar a existir, ele será a chave melhor.
function chave(p: { name: string; birthDay: number | null; birthMonth: number | null }): string {
  return `${chaveDePessoa(p)}#${p.birthMonth ?? ''}-${p.birthDay ?? ''}`;
}

export async function mesclarPessoas(
  repo: Repositorio,
  registros: PessoaImportada[],
  origem: string,
): Promise<ResultadoIngest> {
  const existentes = await repo.pessoas.todas();
  const codigosValidos = new Set((await repo.departamentos.listar()).map((d) => d.code));

  const porChave = new Map<string, Pessoa>();
  for (const p of existentes) porChave.set(chave(p), p);
  let maxId = existentes.reduce((m, p) => Math.max(m, p.id), 0);

  const setoresDesconhecidos: Record<string, number> = {};
  const tocados = new Set<number>();
  let novos = 0;
  let atualizados = 0;

  for (const reg of registros) {
    let code = reg.departmentCode;
    if (code && !codigosValidos.has(code)) {
      setoresDesconhecidos[code] = (setoresDesconhecidos[code] ?? 0) + 1;
      code = null; // mantém o texto do setor, zera o código não reconhecido
    }
    const nucleo = {
      name: reg.name,
      departmentCode: code,
      departmentFull: reg.departmentFull,
      birthDay: reg.birthDay,
      birthMonth: reg.birthMonth,
    };

    const k = chave(reg);
    const atual = porChave.get(k);
    if (atual) {
      Object.assign(atual, nucleo, { fonte: origem }); // só núcleo; enriquecimento intacto
      tocados.add(atual.id);
      atualizados += 1;
    } else {
      const nova: Pessoa = { ...pessoaVazia(), ...nucleo, fonte: origem, id: ++maxId };
      porChave.set(k, nova);
      tocados.add(nova.id);
      novos += 1;
    }
  }

  const lista = [...porChave.values()];
  await repo.pessoas.definirTodas(lista);
  const preservados = existentes.filter((p) => !tocados.has(p.id)).length;
  return { total: lista.length, novos, atualizados, preservados, setoresDesconhecidos };
}
