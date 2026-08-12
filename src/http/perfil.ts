import { Router } from 'express';
import { identidade } from '../perfil';

// Identidade do projeto (nome, organização, marca, logo) para a interface se
// montar sozinha. Leitura pública: é a marca do portal, aparece antes de
// qualquer login. Não expõe o conteúdo de seed — só o que a tela desenha.
export function montarPerfil(): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json(identidade());
  });

  return r;
}
