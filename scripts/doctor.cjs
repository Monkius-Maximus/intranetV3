#!/usr/bin/env node
// Diagnóstico do ambiente — roda com Node PURO, sem dependências (funciona
// mesmo quando tsx/node_modules estão quebrados; é justamente para isso).
//
// Uso:  npm run doctor                      (checa só o ambiente)
//       npm run doctor -- arquivo.sql       (checa também o arquivo de dados)
'use strict';
const fs = require('node:fs');
const path = require('node:path');

let problemas = 0;
const ok = (m) => console.log(`[OK ] ${m}`);
const falha = (m, dica) => {
  problemas++;
  console.log(`[ERRO] ${m}`);
  if (dica) console.log(`       -> ${dica}`);
};

// 1. Versão do Node
const major = Number(process.versions.node.split('.')[0]);
if (major >= 18) {
  ok(`Node ${process.versions.node} (requer 18+)`);
} else {
  falha(
    `Node ${process.versions.node} é antigo demais (requer 18+)`,
    'Instale o Node LTS em nodejs.org e rode tudo de novo a partir do npm install.',
  );
}

// 2. Plataforma (e detecção de WSL)
const emWSL =
  process.platform === 'linux' &&
  fs.existsSync('/proc/version') &&
  /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8'));
ok(`Plataforma: ${process.platform}-${process.arch}${emWSL ? ' (WSL)' : ''}`);

// 3. node_modules e o esbuild da plataforma CERTA
//    (se node_modules foi copiado de outro sistema — ex.: WSL -> Windows — o
//    tsx quebra com "You installed esbuild for another platform")
const raiz = path.join(__dirname, '..');
const nm = path.join(raiz, 'node_modules');
if (!fs.existsSync(nm)) {
  falha('node_modules/ não existe', 'Rode: npm install');
} else {
  const esbuildDir = path.join(nm, '@esbuild');
  const esperado = `${process.platform}-${process.arch}`;
  if (fs.existsSync(esbuildDir)) {
    const instalados = fs.readdirSync(esbuildDir);
    if (instalados.includes(esperado)) {
      ok(`esbuild da plataforma certa (${esperado})`);
    } else {
      falha(
        `esbuild instalado para OUTRA plataforma (${instalados.join(', ') || 'nenhuma'}); esta máquina é ${esperado}`,
        'O node_modules foi copiado de outro sistema (ex.: WSL <-> Windows). Apague node_modules e rode `npm install` NESTA máquina.',
      );
    }
  } else {
    falha('esbuild não encontrado dentro de node_modules', 'Rode: npm install');
  }
  const tsxBin = path.join(nm, '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  if (fs.existsSync(tsxBin)) {
    ok('tsx presente');
  } else {
    falha('tsx não encontrado em node_modules/.bin', 'Rode: npm install');
  }
}

// 4. Diretório de dados gravável
const dataDir = process.env.INTRANET_DATA || path.join(raiz, 'data');
try {
  fs.mkdirSync(dataDir, { recursive: true });
  const teste = path.join(dataDir, `.teste-${Date.now()}`);
  fs.writeFileSync(teste, 'ok');
  fs.unlinkSync(teste);
  ok(`diretório de dados gravável (${dataDir})`);
} catch (e) {
  falha(`não consigo escrever em ${dataDir}: ${e.message}`);
}

// 5. Arquivo SQL (opcional)
const arquivo = process.argv[2];
if (arquivo) {
  if (!fs.existsSync(arquivo)) {
    falha(`arquivo não encontrado: ${arquivo}`, 'Confira o caminho (no Windows, use aspas se houver espaços).');
  } else if (/\.xlsx$/i.test(arquivo)) {
    // XLSX é um zip: só valida a assinatura ("PK") e o tamanho; o parsing
    // completo é feito pelo importador (npm run importar-aniversariantes).
    const buf = fs.readFileSync(arquivo);
    if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
      ok(`arquivo XLSX válido: ${arquivo} (${buf.length} bytes)`);
      console.log('       -> importe com: npm run importar-aniversariantes -- ' + arquivo);
    } else {
      falha(`${arquivo} não parece um XLSX válido (assinatura zip ausente)`, 'Reexporte a planilha e tente de novo.');
    }
  } else {
    const buf = fs.readFileSync(arquivo);
    let texto;
    let codificacao = 'utf8';
    if (buf[0] === 0xff && buf[1] === 0xfe) {
      codificacao = 'utf16le (BOM)';
      texto = buf.subarray(2).toString('utf16le');
    } else if (buf[0] === 0xfe && buf[1] === 0xff) {
      codificacao = 'utf16be (BOM)';
      texto = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
    } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      codificacao = 'utf8 (BOM)';
      texto = buf.subarray(3).toString('utf8');
    } else {
      texto = buf.toString('utf8');
    }
    ok(`arquivo lido: ${arquivo} (${buf.length} bytes, codificação ${codificacao})`);
    const linhas = (texto.match(/\(SELECT id FROM departments WHERE code = '[^']+'\)/g) || []).length;
    if (linhas > 0) {
      ok(`${linhas} linha(s) de funcionário reconhecida(s) no formato esperado`);
    } else {
      falha(
        'nenhuma linha de funcionário reconhecida neste arquivo',
        "O importador espera INSERTs com linhas no formato: ('Nome', 'email', 'ramal', 'setor', dia, mes, (SELECT id FROM departments WHERE code = 'SIGLA')). " +
          'Confira se este é o arquivo certo (ex.: employees_real_data_complete.sql, e não add_all_employees.sql, que só tem comentários).',
      );
    }
  }
}

console.log('');
if (problemas === 0) {
  const importador = arquivo && /\.xlsx$/i.test(arquivo) ? 'importar-aniversariantes' : 'importar-funcionarios';
  console.log('Ambiente OK. Próximo passo:');
  console.log(`  npm run ${importador} -- ${arquivo || '<arquivo>'}`);
} else {
  console.log(`${problemas} problema(s) encontrado(s) — corrija acima e rode de novo.`);
  console.log('Se persistir, envie a saída COMPLETA deste diagnóstico junto com o erro original.');
  process.exitCode = 1;
}
