import ExcelJS from 'exceljs';
import type { Pessoa } from '../domain/pessoa';

// Gera um .xlsx do diretório de servidores (o que a rota /api/pessoas/export.xlsx
// devolve). Recebe a lista JÁ filtrada/ordenada pelo repositório, então a
// planilha reflete exatamente a busca/setor aplicados na tela.

const MESES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export async function gerarXlsxPessoas(pessoas: Pessoa[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Intranet SEPLAG';
  wb.created = new Date();
  const ws = wb.addWorksheet('Servidores');

  ws.columns = [
    { header: 'Nome', key: 'nome', width: 40 },
    { header: 'Setores', key: 'setores', width: 24 },
    { header: 'Setor completo', key: 'full', width: 24 },
    { header: 'Cargo', key: 'cargo', width: 24 },
    { header: 'Ramal', key: 'ramal', width: 10 },
    { header: 'E-mail', key: 'email', width: 36 },
    { header: 'Dia', key: 'dia', width: 6 },
    { header: 'Mês', key: 'mes', width: 12 },
    { header: 'Status', key: 'status', width: 10 },
  ];

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  head.alignment = { vertical: 'middle' };

  for (const p of pessoas) {
    ws.addRow({
      nome: p.name,
      setores: (p.setores ?? []).join(', '),
      full: p.departmentFull ?? '',
      cargo: p.cargo ?? '',
      ramal: p.phoneExtension ?? '',
      email: p.email ?? '',
      dia: p.birthDay ?? '',
      mes: p.birthMonth ? MESES[p.birthMonth] : '',
      status: (p.status || 'ativo') === 'ex' ? 'Inativo' : 'Ativo',
    });
  }

  ws.autoFilter = { from: 'A1', to: 'I1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // writeBuffer devolve um ArrayBuffer-like; normaliza para Buffer do Node.
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
