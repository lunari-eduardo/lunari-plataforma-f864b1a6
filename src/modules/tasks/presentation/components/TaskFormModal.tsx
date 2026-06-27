/**
 * TaskFormModal — ponto único canônico do módulo Tasks.
 *
 * Onda 4b (passo 1): unifica criação/edição da página Tarefas, Agenda e
 * Workflow num único componente. Por ora, encapsula o UnifiedTaskModal
 * legado para evitar regressão visual. Próximos passos da onda:
 *   - roteamento via capabilities (`createTask`/`updateTask`).
 *   - substituição do QuickTaskModal e do TaskDetailsModal por drawer.
 */

export { default } from "@/components/tarefas/UnifiedTaskModal";
export type { default as TaskFormModalDefault } from "@/components/tarefas/UnifiedTaskModal";
