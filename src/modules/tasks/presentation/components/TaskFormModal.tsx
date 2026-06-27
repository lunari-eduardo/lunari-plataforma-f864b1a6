/**
 * TaskFormModal — ponto único canônico do módulo Tasks.
 *
 * Onda 4b passo 2: aponta para `TaskQuickModal` (modal enxuto com seções
 * avançadas opcionais e botão de exclusão em modo edit). O antigo
 * `UnifiedTaskModal` segue no repositório como referência mas não é mais
 * o ponto de entrada padrão.
 */

export { default } from "./TaskQuickModal";
export type { TaskQuickModalProps as TaskFormModalProps } from "./TaskQuickModal";
