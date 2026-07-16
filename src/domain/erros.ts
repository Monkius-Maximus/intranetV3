// Erros de domínio — o HTTP os mapeia para status (404/409/503).
export class NaoEncontrado extends Error {}
export class JaExiste extends Error {}

// Registro referenciado por outros (ex.: setor com pessoas) — remoção bloqueada.
export class EmUso extends Error {}

// Falha ao gravar o banco em disco (permissão, antivírus, OneDrive…).
// O HTTP devolve 503 com a mensagem — é um problema do AMBIENTE, não do
// pedido, e o admin precisa ler a causa para conseguir agir.
export class FalhaDeGravacao extends Error {}
