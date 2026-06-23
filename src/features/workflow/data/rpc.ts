/**
 * RPC tipadas do escopo workflow.
 * Onda 2 — Data layer. Hoje cobre `delete_workflow_session_cascade`.
 */

import { supabase } from "@/integrations/supabase/client";

export type WorkflowDeleteAction = "preserve" | "refund" | "remove";

export interface WorkflowDeleteResult {
  deleted_transactions?: number;
  deleted_cobrancas?: number;
  unlinked_cobrancas?: number;
  deleted_session?: number;
  deleted_appointment?: number;
  estornos_criados?: number;
  soft_deleted?: boolean;
}

export const workflowRpc = {
  /**
   * Excluir/arquivar sessão atomicamente — espelha o caminho hoje chamado
   * direto no `pages/Workflow.tsx:handleDeleteSession`.
   */
  async deleteWorkflowSessionCascade(
    sessionId: string,
    action: WorkflowDeleteAction,
  ): Promise<WorkflowDeleteResult> {
    if (!sessionId) throw new Error("workflowRpc.deleteWorkflowSessionCascade: sessionId obrigatório");
    const { data, error } = await supabase.rpc("delete_workflow_session_cascade", {
      p_session_pk: sessionId,
      p_action: action,
    });
    if (error) throw error;
    return (data ?? {}) as WorkflowDeleteResult;
  },
};

export type WorkflowRpc = typeof workflowRpc;
