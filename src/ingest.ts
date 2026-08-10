import type { Repositorio } from './data/repositorio';
import { type Pessoa, type PessoaImportada, chaveDePessoa, codigosDeCaminho, pessoaVazia } from './domain/pessoa';

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
  const nucleosParaCriar = new Map<string, string>(); // código do núcleo -> sigla da secretaria-mãe
  const tocados = new Set<number>();
  let novos = 0;
  let atualizados = 0;

  // Une a lista atual (que pode ter setores adicionados à mão) com a derivada da
  // importação, garantindo o principal e sem remover extras do admin.
  const mesclarSetores = (atual: string[] | undefined, derivados: string[], principal: string | null): string[] => {
    const set = new Set<string>();
    if (principal) set.add(principal);
    for (const s of atual ?? []) set.add(s);
    for (const s of derivados) set.add(s);
    return [...set];
  };

  for (const reg of registros) {
    let code = reg.departmentCode;
    if (code && !codigosValidos.has(code)) {
      // Só a SECRETARIA (topo) desconhecida é reportada; núcleos são criados abaixo.
      setoresDesconhecidos[code] = (setoresDesconhecidos[code] ?? 0) + 1;
      code = null; // mantém o texto do setor, zera o código não reconhecido
    }
    // 'SECOGE/NSI' -> ['SECOGE','NSI']: o índice 0 é a secretaria; 1+ são núcleos.
    const setoresReg = codigosDeCaminho(code, reg.departmentFull);
    for (let i = 1; i < setoresReg.length; i++) {
      const sub = setoresReg[i];
      if (code && !codigosValidos.has(sub)) nucleosParaCriar.set(sub, code);
    }

    const nucleo = {
      name: reg.name,
      departmentCode: code,
      departmentFull: reg.departmentFull,
      birthDay: reg.birthDay,
      birthMonth: reg.birthMonth,
    };

    // Enriquecimento vindo da origem (ex.: CSV com e-mail/ramal): aplica só
    // onde estiver vazio — o que o admin preencheu tem precedência.
    const preencherVazios = (p: Pessoa): void => {
      if (reg.email && !p.email) p.email = reg.email;
      if (reg.phoneExtension && !p.phoneExtension) p.phoneExtension = reg.phoneExtension;
      if (reg.cargo && !p.cargo) p.cargo = reg.cargo;
    };

    const k = chave(reg);
    const atual = porChave.get(k);
    if (atual) {
      Object.assign(atual, nucleo, { fonte: origem }); // só núcleo; enriquecimento intacto
      atual.setores = mesclarSetores(atual.setores, setoresReg, code);
      preencherVazios(atual);
      tocados.add(atual.id);
      atualizados += 1;
    } else {
      const nova: Pessoa = {
        ...pessoaVazia(),
        ...nucleo,
        setores: mesclarSetores([], setoresReg, code),
        fonte: origem,
        id: ++maxId,
      };
      preencherVazios(nova);
      porChave.set(k, nova);
      tocados.add(nova.id);
      novos += 1;
    }
  }

  // Núcleos descobertos na importação viram setores de verdade (filtráveis),
  // pendurados na secretaria-mãe. upsert é idempotente.
  for (const [sub, mae] of nucleosParaCriar) {
    await repo.departamentos.upsert({ code: sub, name: sub, parent: mae });
  }

  const lista = [...porChave.values()];
  await repo.pessoas.definirTodas(lista);
  const preservados = existentes.filter((p) => !tocados.has(p.id)).length;
  return { total: lista.length, novos, atualizados, preservados, setoresDesconhecidos };
}
