/**
 * TaskFormModal — ponto único canônico do módulo Tasks.
 *
 * Aponta agora para `TaskModal` (redesign com View+Edit e blocos de texto múltiplos).
 * Substitui o antigo `TaskQuickModal`/`UnifiedTaskModal`.
 */

export { default } from "./TaskModal";
export type { TaskModalProps as TaskFormModalProps } from "./TaskModal";
