// Erros de domínio — o HTTP os mapeia para status (404/409).
export class NaoEncontrado extends Error {}
export class JaExiste extends Error {}
