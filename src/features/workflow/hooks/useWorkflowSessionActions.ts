import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWorkflowRealtime } from "@/hooks/useWorkflowRealtime";
import type { WorkflowSession } from "@/hooks/useWorkflowRealtime";
import { isOk } from "@/shared/result";
import { useRunCapability } from "@/shared/capability";
import {
  deleteSession as deleteSessionCapability,
  updateSessionFields as updateSessionFieldsCapability,
  advanceCard as advanceCardCapability,
} from "@/modules/workflow";
import { USE_CAPABILITY_UPDATE_FIELDS, updatesRequireRefreeze } from "@/features/workflow/config";
import { recalcFotosExtras, recalcSessionValorTotal } from "@/utils/fotosExtrasCalculator";
import type { WorkflowCurrentMonth } from "./useWorkflowMonthSessions";

interface Params {
  workflowSessions: WorkflowSession[];
  setWorkflowSessions: React.Dispatch<React.SetStateAction<WorkflowSession[]>>;
  mergeUpdate: (s: WorkflowSession) => void;
  removeSessionFromCache: (id: string) => void;
  forceRefresh: () => Promise<void> | void;
  ensureMonthLoaded: (year: number, month: number, force?: boolean) => Promise<unknown>;
  currentMonth: WorkflowCurrentMonth;
}

/**
 * Onda 5a — concentra os handlers de mutação do Workflow:
 *  - updateSession (otimista + recálculo + Capability/legado)
 *  - handleStatusChange (drag-and-drop kanban via advanceCard)
 *  - handleDeleteSession (Capability deleteSession + UX)
 *  - handleFieldUpdate (proxy granular)
 *  - handleAddPayment / ManualPaymentModal state
 *  - handleEditSession (placeholder mantido)
 */
export function useWorkflowSessionActions({
  workflowSessions,
  setWorkflowSessions,
  mergeUpdate,
  removeSessionFromCache,
  forceRefresh,
  ensureMonthLoaded,
  currentMonth,
}: Params) {
  const { updateSession: updateSessionRealtime } = useWorkflowRealtime();
  const runCapability = useRunCapability();

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<WorkflowSession>, silent = false) => {
      try {
        const currentSession = workflowSessions.find((s) => s.id === sessionId);
        if (!currentSession) throw new Error("Sessão não encontrada");

        const validUpdates = { ...updates };
        if ((validUpdates as any).clientes) delete (validUpdates as any).clientes;
        if ((validUpdates as any).pagamentos) delete (validUpdates as any).pagamentos;
        if (validUpdates.created_at) delete validUpdates.created_at;

        const needsRefreeze = false;

        const cacheSafeUpdates: Partial<WorkflowSession> = {};
        for (const [field, value] of Object.entries(validUpdates)) {
          switch (field) {
            case "desconto":
            case "valorAdicional":
            case "valorFotoExtra":
            case "valorTotalFotoExtra": {
              const snakeField =
                field === "valorAdicional"
                  ? "valor_adicional"
                  : field === "valorFotoExtra"
                    ? "valor_foto_extra"
                    : field === "valorTotalFotoExtra"
                      ? "valor_total_foto_extra"
                      : field;
              (cacheSafeUpdates as any)[snakeField] =
                typeof value === "string"
                  ? parseFloat(value.replace(/[^\d,]/g, "").replace(",", ".")) || 0
                  : Number(value) || 0;
              break;
            }
            case "qtdFotosExtra":
              cacheSafeUpdates.qtd_fotos_extra = Number(value) || 0;
              break;
            case "descricao":
            case "observacoes":
            case "detalhes":
            case "status":
              (cacheSafeUpdates as any)[field] = value;
              break;
            case "produtosList":
              cacheSafeUpdates.produtos_incluidos = value as any;
              break;
            case "pacote":
              cacheSafeUpdates.pacote = value as any;
              break;
            case "categoria":
              cacheSafeUpdates.categoria = value as any;
              break;
            default:
              break;
          }
        }

        // Recálculo otimista (espelha triggers DB)
        const touchedFotoExtra =
          "qtd_fotos_extra" in cacheSafeUpdates || "valor_foto_extra" in cacheSafeUpdates;
        const touchedTotalAffectingField =
          touchedFotoExtra ||
          "valor_adicional" in cacheSafeUpdates ||
          "desconto" in cacheSafeUpdates ||
          "produtos_incluidos" in cacheSafeUpdates;

        if (touchedTotalAffectingField) {
          const currentAny = currentSession as any;
          const qtd =
            (cacheSafeUpdates as any).qtd_fotos_extra ?? Number(currentAny.qtd_fotos_extra) ?? 0;
          const valorUnit =
            (cacheSafeUpdates as any).valor_foto_extra ?? Number(currentAny.valor_foto_extra) ?? 0;

          if (touchedFotoExtra) {
            const result = recalcFotosExtras({
              qtd,
              valorFotoExtra: valorUnit,
              regrasCongeladas: currentAny.regras_congeladas,
              galeriaInfo: {
                galeriaId: currentAny.galeria_id,
                valorTotalVendido: currentAny.galerias?.valor_total_vendido,
                totalFotosExtrasVendidas: currentAny.galerias?.total_fotos_extras_vendidas,
              },
            });
            if (!result.respeitarBanco) {
              (cacheSafeUpdates as any).valor_total_foto_extra = result.valorTotalFotoExtra;
              if (Math.abs(result.valorUnitarioEfetivo - valorUnit) > 0.001) {
                (cacheSafeUpdates as any).valor_foto_extra = result.valorUnitarioEfetivo;
              }
            }
          }

          const novoValorTotal = recalcSessionValorTotal({
            valorBasePacote:
              (cacheSafeUpdates as any).valor_base_pacote ?? Number(currentAny.valor_base_pacote) ?? 0,
            valorTotalFotoExtra:
              (cacheSafeUpdates as any).valor_total_foto_extra ??
              Number(currentAny.valor_total_foto_extra) ??
              0,
            produtosIncluidos:
              (cacheSafeUpdates as any).produtos_incluidos ?? currentAny.produtos_incluidos ?? [],
            valorAdicional:
              (cacheSafeUpdates as any).valor_adicional ?? Number(currentAny.valor_adicional) ?? 0,
            desconto: (cacheSafeUpdates as any).desconto ?? Number(currentAny.desconto) ?? 0,
          });
          (cacheSafeUpdates as any).valor_total = novoValorTotal;
        }

        if (Object.keys(cacheSafeUpdates).length > 0 && !needsRefreeze) {
          mergeUpdate({
            ...currentSession,
            ...cacheSafeUpdates,
            updated_at: new Date().toISOString(),
          });
        }

        const needsLegacyPath = updatesRequireRefreeze(validUpdates);
        if (
          USE_CAPABILITY_UPDATE_FIELDS &&
          !needsLegacyPath &&
          Object.keys(cacheSafeUpdates).length > 0
        ) {
          const result = await runCapability(updateSessionFieldsCapability, {
            sessionId,
            fields: cacheSafeUpdates as Record<string, unknown>,
          });
          if (!isOk(result)) {
            throw new Error(result.error.message || "Falha ao atualizar sessão.");
          }
        } else {
          await updateSessionRealtime(sessionId, validUpdates, silent);
        }
      } catch (error) {
        console.error("Error updating session:", error);
        await forceRefresh();
        const errorMsg =
          error instanceof Error ? error.message : "Não foi possível salvar as alterações.";
        toast({ title: "Erro ao atualizar", description: errorMsg, variant: "destructive" });
        throw error;
      }
    },
    [workflowSessions, mergeUpdate, forceRefresh, updateSessionRealtime, runCapability],
  );

  const handleStatusChange = useCallback(
    async (sessionId: string, newStatus: string) => {
      const currentSession = workflowSessions.find((s) => s.id === sessionId);
      if (currentSession && currentSession.status === newStatus) return;
      if (currentSession) {
        mergeUpdate({
          ...currentSession,
          status: newStatus,
          updated_at: new Date().toISOString(),
        });
      }
      if (USE_CAPABILITY_UPDATE_FIELDS) {
        const result = await runCapability(advanceCardCapability, { sessionId, toStatus: newStatus });
        if (!isOk(result)) {
          console.error("[handleStatusChange] capability failed:", result.error);
          await forceRefresh();
          toast({
            title: "Erro ao mover card",
            description: result.error.message || "Não foi possível atualizar a etapa.",
            variant: "destructive",
          });
        }
        return;
      }
      await updateSession(sessionId, { status: newStatus });
    },
    [updateSession, workflowSessions, mergeUpdate, forceRefresh, runCapability],
  );

  const handleEditSession = useCallback((sessionId: string) => {
    console.log("Edit session:", sessionId);
  }, []);

  // Manual payment modal (Onda 4b)
  const [manualPaymentSessionId, setManualPaymentSessionId] = useState<string | null>(null);

  const handleAddPayment = useCallback((sessionId: string) => {
    setManualPaymentSessionId(sessionId);
  }, []);

  const handleManualPaymentClose = useCallback(() => setManualPaymentSessionId(null), []);

  const handleManualPaymentSuccess = useCallback(
    (sessionId: string) => {
      void ensureMonthLoaded(currentMonth.year, currentMonth.month, true);
      window.dispatchEvent(
        new CustomEvent("payment-created", { detail: { sessionId, valor: 0, paymentId: null } }),
      );
    },
    [ensureMonthLoaded, currentMonth],
  );

  const handleDeleteSession = useCallback(
    async (
      sessionId: string,
      _sessionTitle: string,
      _paymentCount: number,
      action?: string,
    ) => {
      const deleteAction = (action || "remove") as "preserve" | "refund" | "remove";

      const previousSessions = workflowSessions;
      setWorkflowSessions((prev) => prev.filter((s) => s.id !== sessionId));
      removeSessionFromCache(sessionId);

      const result = await runCapability(deleteSessionCapability, {
        sessionId,
        action: deleteAction,
      });

      if (!isOk(result)) {
        const { code, message } = result.error;
        console.error("❌ [WORKFLOW-DELETE] capability failed", result.error);
        setWorkflowSessions(previousSessions);
        void ensureMonthLoaded(currentMonth.year, currentMonth.month, true);
        if (code === "CONFLICT") {
          toast({
            title: "Nada foi excluído",
            description: "A sessão pode já ter sido removida ou você não tem permissão.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Erro ao excluir",
          description: message || "Não foi possível excluir a sessão.",
          variant: "destructive",
        });
        return;
      }

      const { deletedTransactions, unlinkedCobrancas, deletedAppointment, estornosCriados } =
        result.value;

      let title: string;
      let description: string;
      let durationMs = 5000;

      if (deleteAction === "preserve") {
        title = "Sessão arquivada";
        description = "Sessão movida para o histórico do cliente.";
      } else if (deleteAction === "refund") {
        title = "Sessão excluída com estorno";
        const partes: string[] = ["Sessão e agendamento removidos"];
        if (estornosCriados) partes.push(`${estornosCriados} estorno(s) registrado(s)`);
        description = partes.join(" • ") + ".";
      } else {
        title = "Sessão excluída";
        const pagamentos = deletedTransactions ?? 0;
        const cobrancasPreservadas = unlinkedCobrancas ?? 0;
        const agendamentoRemovido = !!deletedAppointment;
        const acoes: string[] = ["Sessão"];
        if (pagamentos > 0) acoes.push(`${pagamentos} pagamento(s)`);
        if (agendamentoRemovido) acoes.push("agendamento");
        description = `${acoes.join(", ").replace(/, ([^,]*)$/, " e $1")} excluídos permanentemente.`;
        if (cobrancasPreservadas > 0) {
          description += ` ${cobrancasPreservadas} pagamento(s) recebido(s) via gateway (Asaas/Mercado Pago/InfinitePay) foram mantidos no extrato fiscal para auditoria contábil.`;
          durationMs = 8000;
        }
      }

      toast({ title, description, duration: durationMs });
    },
    [
      runCapability,
      workflowSessions,
      setWorkflowSessions,
      removeSessionFromCache,
      ensureMonthLoaded,
      currentMonth,
    ],
  );

  const handleFieldUpdate = useCallback(
    (sessionId: string, field: string, value: any, silent = false) =>
      updateSession(sessionId, { [field]: value }, silent),
    [updateSession],
  );

  return {
    updateSession,
    handleStatusChange,
    handleEditSession,
    handleAddPayment,
    handleDeleteSession,
    handleFieldUpdate,
    manualPaymentSessionId,
    handleManualPaymentClose,
    handleManualPaymentSuccess,
  };
}
