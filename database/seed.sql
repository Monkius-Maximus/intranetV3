-- Intranet SEPLAG — dados iniciais de EXEMPLO.
--
-- Estes dados são fictícios e servem para validar a instalação ponta a ponta.
-- Os dados REAIS de funcionários NÃO ficam aqui e NÃO são versionados (ver
-- GITIGNORE-ADDITIONS.txt). Para produção, substitua/complemente este arquivo
-- pelo SQL de dados reais antes de gerar o bundle.
--
-- A senha do admin é definida interativamente pelo install-server.sh na
-- primeira instalação (o placeholder abaixo nunca confere com bcrypt).

INSERT INTO users (username, password_hash, full_name, role)
VALUES ('admin', 'SET_AT_INSTALL', 'Administrador do Sistema', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, password_hash, full_name, role)
VALUES ('usuario.exemplo', 'SET_AT_INSTALL', 'Usuário de Exemplo', 'user')
ON CONFLICT (username) DO NOTHING;

INSERT INTO announcements (title, body, created_by)
SELECT
    'Bem-vindo à Intranet SEPLAG',
    'Instalação concluída com sucesso. Este é um comunicado de exemplo.',
    u.id
FROM users u
WHERE u.username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM announcements);
