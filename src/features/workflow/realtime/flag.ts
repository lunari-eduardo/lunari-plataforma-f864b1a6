/**
 * Flag de ativação do realtime unificado (Onda 3).
 * Ligado por padrão. Desativar com VITE_WORKFLOW_REALTIME_V2="false".
 *
 * Quando ligado, canais legados (`workflow-realtime`, `workflow-sessions-*`,
 * `workflow-metrics-*`) NÃO devem subir, evitando duplicação de eventos.
 */
export function isWorkflowRealtimeV2Enabled(): boolean {
  const flag = (import.meta.env.VITE_WORKFLOW_REALTIME_V2 ?? "")
    .toString()
    .toLowerCase();
  return flag !== "false" && flag !== "0";
}
