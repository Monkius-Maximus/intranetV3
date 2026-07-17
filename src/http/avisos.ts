import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import { type AuthedRequest, autenticar, exigirGestao } from '../auth';
import { UPLOADS_DIR } from '../config';
import type { Repositorio } from '../data/repositorio';
import { atualizarAvisoSchema, criarAvisoSchema } from '../domain/aviso';
import { auditar, idParam, validar } from './util';

// Comunicados: leitura pública. Escrita para admin e gestor — o gestor só
// edita/exclui os PRÓPRIOS comunicados (o admin, todos). Anexos ficam em
// data/uploads/ (fora do git, dentro do backup da pasta).

const EXTENSOES = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.zip',
]);
const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    // Nome no disco gerado por nós (nunca o original): sem traversal/colisão.
    filename: (_req, file, cb) => {
      const ext = (file.originalname.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
    if (EXTENSOES.has(ext)) cb(null, true);
    else cb(new Error(`tipo de arquivo não permitido (${ext || 'sem extensão'})`));
  },
});

// Traduz erros do multer (tamanho/tipo) para respostas claras.
function receberArquivo(req: Request, res: Response, next: NextFunction): void {
  upload.single('arquivo')(req, res, (err) => {
    if (!err) return next();
    const msg =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? `arquivo maior que ${TAMANHO_MAXIMO / 1024 / 1024} MB`
        : err.message || 'falha no upload';
    res.status(422).json({ erro: msg });
  });
}

export function montarAvisos(repo: Repositorio): Router {
  const r = Router();

  // O gestor só mexe no que criou; o admin, em tudo.
  async function podeGerir(req: AuthedRequest, res: Response, id: number): Promise<boolean> {
    const aviso = await repo.avisos.obter(id);
    if (!aviso) {
      res.status(404).json({ erro: 'comunicado não encontrado' });
      return false;
    }
    if (req.user!.role !== 'admin' && aviso.createdBy !== req.user!.sub) {
      res.status(403).json({ erro: 'só é possível alterar os próprios comunicados' });
      return false;
    }
    return true;
  }

  r.get('/', async (_req, res) => {
    res.json(await repo.avisos.listar());
  });

  r.post('/', autenticar, exigirGestao, validar(criarAvisoSchema), async (req: AuthedRequest, res) => {
    const aviso = await repo.avisos.criar({ ...req.body, createdBy: req.user!.sub, autor: req.user!.name ?? null });
    await auditar(repo, req, 'publicou', 'comunicado', aviso.title);
    res.status(201).json(aviso);
  });

  r.put('/:id', autenticar, exigirGestao, validar(atualizarAvisoSchema), async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null || !(await podeGerir(req, res, id))) return;
    const aviso = await repo.avisos.atualizar(id, req.body);
    await auditar(repo, req, 'editou', 'comunicado', aviso.title);
    res.json(aviso);
  });

  r.delete('/:id', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null || !(await podeGerir(req, res, id))) return;
    const aviso = await repo.avisos.remover(id);
    // apaga os arquivos dos anexos junto (melhor-esforço)
    for (const a of aviso.anexos) {
      await unlink(join(UPLOADS_DIR, a.arquivo)).catch(() => {});
    }
    await auditar(repo, req, 'excluiu', 'comunicado', aviso.title);
    res.json(aviso);
  });

  // ------------------------------------------------------------- anexos
  r.post('/:id/anexos', autenticar, exigirGestao, receberArquivo, async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    if (!req.file) {
      res.status(422).json({ erro: 'envie o arquivo no campo "arquivo"' });
      return;
    }
    if (!(await podeGerir(req, res, id))) {
      await unlink(req.file.path).catch(() => {});
      return;
    }
    const aviso = await repo.avisos.adicionarAnexo(id, {
      nome: req.file.originalname,
      arquivo: req.file.filename,
      tamanho: req.file.size,
    });
    await auditar(repo, req, 'anexou', 'comunicado', `${req.file.originalname} em "${aviso.title}"`);
    res.status(201).json(aviso);
  });

  r.delete('/:id/anexos/:anexoId', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null || !(await podeGerir(req, res, id))) return;
    const anexoId = Number(req.params.anexoId);
    if (!Number.isInteger(anexoId)) {
      res.status(400).json({ erro: 'id inválido' });
      return;
    }
    const anexo = await repo.avisos.removerAnexo(id, anexoId);
    await unlink(join(UPLOADS_DIR, anexo.arquivo)).catch(() => {});
    await auditar(repo, req, 'removeu anexo', 'comunicado', anexo.nome);
    res.json({ ok: true });
  });

  // Download público (comunicados são públicos). O nome no disco é gerado por
  // nós; o registro no aviso é a única fonte — nada de caminho vindo do cliente.
  r.get('/:id/anexos/:anexoId/download', async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const aviso = await repo.avisos.obter(id);
    const anexo = aviso?.anexos.find((a) => a.id === Number(req.params.anexoId));
    if (!aviso || !anexo) {
      res.status(404).json({ erro: 'anexo não encontrado' });
      return;
    }
    res.download(join(UPLOADS_DIR, anexo.arquivo), anexo.nome);
  });

  return r;
}
