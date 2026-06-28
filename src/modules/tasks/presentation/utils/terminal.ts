/**
 * Helpers para checar se uma `status key` é terminal (concluído) sem hardcode `=== 'done'`.
 * Operam sobre `TaskStatusDef[]` do store legado (campo `isDone`) ou do domínio
 * (campo `isTerminal`). Mantêm fallback para keys históricas.
 */

const LEGACY_TERMINAL_KEYS = new Set([
  "done",
  "concluido",
  "concluida",
  "finalizada",
  "finalizado",
]);

type StatusLike = { key: string; isDone?: boolean; isTerminal?: boolean };

export function isTerminalKey(key: string | undefined | null, statuses: StatusLike[] = []): boolean {
  if (!key) return false;
  const def = statuses.find((s) => s.key === key);
  if (def?.isDone || def?.isTerminal) return true;
  // Se o status existe e está marcado como NÃO terminal, respeita.
  if (def) return false;
  // Status não encontrado no array (ex.: chamada sem statuses carregados): fallback legado.
  return LEGACY_TERMINAL_KEYS.has(key.toLowerCase());
}

export function terminalKeysOf(statuses: StatusLike[] = []): string[] {
  const fromStore = statuses.filter((s) => s.isDone || s.isTerminal).map((s) => s.key);
  if (fromStore.length > 0) return fromStore;
  return Array.from(LEGACY_TERMINAL_KEYS);
}
