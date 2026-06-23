/**
 * Bridge React que monta o realtime v2 (single channel) sob feature flag.
 *
 * Não renderiza nada. Coexiste com o canal legado: o store interno
 * dedupe por `lastSeq`, então ouvir duas fontes simultaneamente é seguro
 * durante o período de validação da Onda 3.
 */
import { useWorkflowRealtimeV2 } from "./useWorkflowRealtimeV2";

export function WorkflowRealtimeBridge(): null {
  useWorkflowRealtimeV2();
  return null;
}
