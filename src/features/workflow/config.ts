/**
 * Feature flags do escopo Workflow.
 *
 * Onda 4a — migração `updateSession`/`handleStatusChange` para Capabilities.
 * Permite rollback em runtime sem deploy.
 *
 * Setar `VITE_WORKFLOW_USE_CAPABILITY_UPDATE=false` desativa o roteamento via
 * Capability e mantém 100% no caminho legado `useWorkflowRealtime.updateSession`.
 */
export const USE_CAPABILITY_UPDATE_FIELDS =
  import.meta.env.VITE_WORKFLOW_USE_CAPABILITY_UPDATE !== "false";

/**
 * Campos cuja edição dispara recongelamento de regras / sincronização com
 * pacote/produtos. Continuam roteados pelo `useWorkflowRealtime` legado
 * porque a Capability `workflow.updateFields` ainda não cobre essa orquestração.
 *
 * Mantido aqui (e não dentro da Capability) para ser fonte única de verdade
 * tanto para a Page (decisão de roteamento) quanto para futura paridade.
 */
export const REFREEZE_TRIGGERING_FIELDS = new Set<string>([
  "pacote",
  "produtosList",
  "produtos_incluidos",
  "qtdFotosExtra",
  "qtd_fotos_extra",
  "valorFotoExtra",
  "valor_foto_extra",
  "valorPacote",
  "valorTotal",
]);

export function updatesRequireRefreeze(updates: Record<string, unknown>): boolean {
  for (const key of Object.keys(updates)) {
    if (REFREEZE_TRIGGERING_FIELDS.has(key)) return true;
  }
  return false;
}
