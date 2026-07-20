/**
 * Memo singleton para anti-eco da bidirecionalidade Produto ↔ Tarefa.
 *
 * Quando o toggle da tarefa-espelho no dock grava novas etapas no produto,
 * o realtime da tabela `clientes_sessoes` vai devolver a mesma sessão para o
 * reconciliador `useProductTaskMirror`. Sem memo, o reconciliador emitiria
 * uma nova atualização da tarefa (mesmo título, mesmo status → idempotente,
 * mas ruidoso e caro em rede/UI). O memo permite que o reconciliador pule
 * silenciosamente o `applySpec` para o produto em janela curta.
 */

interface Entry {
  produtoId: string;
  etapasHash: string;
  at: number;
}

const WINDOW_MS = 3000;
const state = new Map<string, Entry>();

export const mirrorMemoStore = {
  memorize(sessionId: string, produtoId: string, etapasHash: string) {
    state.set(sessionId, { produtoId, etapasHash, at: Date.now() });
  },
  matches(sessionId: string, produtoId: string, etapasHash: string): boolean {
    const entry = state.get(sessionId);
    if (!entry) return false;
    if (entry.produtoId !== produtoId) return false;
    if (entry.etapasHash !== etapasHash) return false;
    if (Date.now() - entry.at > WINDOW_MS) {
      state.delete(sessionId);
      return false;
    }
    return true;
  },
  clear(sessionId?: string) {
    if (sessionId) state.delete(sessionId);
    else state.clear();
  },
};
