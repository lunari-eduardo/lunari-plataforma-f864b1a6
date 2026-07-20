/**
 * Classificação de tarefas do Workflow.
 *
 * Tarefas com a tag `workflow:produto` (MIRROR_ROOT_TAG) são "tarefas-espelho"
 * geradas automaticamente pelo reconciliador Produto → Tarefa. Elas são
 * PRIVADAS ao dock lateral do Workflow — nunca devem aparecer em `/tarefas`,
 * dashboard, agenda ou notificações.
 */
import { MIRROR_ROOT_TAG } from "./productTaskMirror";

export const isMirrorTask = (t: { tags?: string[] | null }): boolean =>
  Array.isArray(t.tags) && t.tags.includes(MIRROR_ROOT_TAG);

export const excludeMirror = <T extends { tags?: string[] | null }>(list: T[]): T[] =>
  list.filter((t) => !isMirrorTask(t));
