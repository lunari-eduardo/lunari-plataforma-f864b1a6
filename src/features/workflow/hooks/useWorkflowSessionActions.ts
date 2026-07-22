import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWorkflowRealtime } from "@/features/workflow";
import type { WorkflowSession } from "@/features/workflow";
import { workflowStore } from "@/features/workflow/store/workflowStore";
import { sessionsRepo } from "@/features/workflow/data/sessionsRepo";
import { isOk } from "@/shared/result";
import { useRunCapability } from "@/shared/capability";
import {
  deleteSession as deleteSessionCapability,
  updateSessionFields as updateSessionFieldsCapability,
  advanceCard as advanceCardCapability,
} from "@/modules/workflow";
import { USE_CAPABILITY_UPDATE_FIELDS, updatesRequireRefreeze } from "@/features/workflow/config";
import { recalcFotosExtras, recalcSessionValorTotal } from "@/utils/fotosExtrasCalculator";
import { deriveDenormalizedProdutos } from "@/features/workflow/domain/productDenorm";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
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
  const { pacotes: pacotesCtx, categoriasFull: categoriasCtx } = useAppContext();
  const { user } = useAuth();

  // Ref sempre com o snapshot mais recente — evita closure stale em chamadas
  // seriais dentro do mesmo tick (bug clássico do modal com 4 onFieldUpdate).
  const workflowSessionsRef = useRef(workflowSessions);
  useEffect(() => {
    workflowSessionsRef.current = workflowSessions;
  }, [workflowSessions]);

  // Localiza a sessão em qualquer fonte: React state (mês corrente),
  // workflowStore (cache global) ou DB (último recurso). Fecha o buraco
  // onde dock/venda avulsa clicavam em sessão fora do mês em cache e o
  // updateSession lançava "Sessão não encontrada".
  const resolveCurrentSession = useCallback(
    async (sessionId: string): Promise<WorkflowSession | null> => {
      const fromState = workflowSessionsRef.current.find((s) => s.id === sessionId);
      if (fromState) return fromState;
      const fromStore = workflowStore.getById(sessionId);
      if (fromStore) return fromStore;
      if (!user?.id) return null;
      try {
        const fresh = await sessionsRepo.getById(user.id, sessionId);
        return (fresh as WorkflowSession) ?? null;
      } catch (e) {
        console.warn("[updateSession] fallback DB falhou", e);
        return null;
      }
    },
    [user?.id],
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<WorkflowSession>, silent = false) => {
      try {
        const currentSession = await resolveCurrentSession(sessionId);
        if (!currentSession) throw new Error("Sessão não encontrada");

        const validUpdates = { ...updates };
        if ((validUpdates as any).clientes) delete (validUpdates as any).clientes;
        if ((validUpdates as any).pagamentos) delete (validUpdates as any).pagamentos;
        if (validUpdates.created_at) delete validUpdates.created_at;

        const needsRefreeze = false;

        const cacheSafeUpdates: Partial<WorkflowSession> = {};
        // Denormalizados (camelCase) que existem só no cache/store da UI —
        // nunca são enviados ao DB/RPC (não existem no schema).
        let uiDenormFields: Record<string, unknown> | null = null;
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
              (cacheSafeUpdates as any)[field] = value;
              break;
            case "status": {
              const raw = typeof value === "string" ? value.trim() : value;
              (cacheSafeUpdates as any).status =
                raw === "" || raw === "__CLEAR__" ? null : raw;
              break;
            }
            case "produtosList": {
              const produtosArr = Array.isArray(value) ? (value as any[]) : [];
              cacheSafeUpdates.produtos_incluidos = produtosArr as any;
              // Denormalizados são derivados apenas para o cache local
              // (camelCase — não existem no schema do DB). Vão em
              // `uiDenormFields` e são merged no payload otimista, nunca
              // no RPC. Substitui as 3 chamadas extras do modal que
              // sobrescreviam produtos_incluidos por closure stale.
              const { produto, qtdProduto, valorTotalProduto } =
                deriveDenormalizedProdutos(produtosArr as any);
              uiDenormFields = {
                produto,
                qtdProduto,
                valorTotalProduto: `R$ ${valorTotalProduto.toFixed(2).replace(".", ",")}`,
              };
              break;
            }
            case "pacote": {
              // Otimista completo: resolve o pacote localmente (AppContext já
              // hidratado — sem network) e preenche o snapshot que o servidor
              // vai persistir. Sem isso, o card fica ~4s mostrando o UUID cru.
              const rawVal = typeof value === "string" ? value : "";
              const currentAny = currentSession as any;
              if (rawVal === "") {
                cacheSafeUpdates.pacote = "";
                (cacheSafeUpdates as any).categoria = "";
                (cacheSafeUpdates as any).valor_base_pacote = 0;
                (cacheSafeUpdates as any).valor_foto_extra = 0;
                (cacheSafeUpdates as any).valor_total_foto_extra = 0;
                const manuais = Array.isArray(currentAny.produtos_incluidos)
                  ? currentAny.produtos_incluidos.filter((p: any) => p?.tipo === "manual")
                  : [];
                (cacheSafeUpdates as any).produtos_incluidos = manuais;
                (cacheSafeUpdates as any).regras_congeladas = {
                  pacote: null,
                  precificacaoFotoExtra: null,
                  produtos: [],
                  dataCongelamento: new Date().toISOString(),
                };
              } else {
                const pkg = (pacotesCtx || []).find(
                  (p: any) => p.id === rawVal || p.nome === rawVal,
                );
                if (pkg) {
                  const catNome =
                    (categoriasCtx || []).find((c: any) => c.id === pkg.categoria_id)?.nome ||
                    currentAny.categoria ||
                    "";
                  const qtdAtual = Number(currentAny.qtd_fotos_extra) || 0;
                  const valorFotoExtra = Number(pkg.valor_foto_extra) || 0;
                  const manuais = Array.isArray(currentAny.produtos_incluidos)
                    ? currentAny.produtos_incluidos.filter((p: any) => p?.tipo === "manual")
                    : [];
                  const produtosPacote = Array.isArray(pkg.produtosIncluidos)
                    ? pkg.produtosIncluidos
                    : [];
                  cacheSafeUpdates.pacote = pkg.nome;
                  (cacheSafeUpdates as any).categoria = catNome;
                  (cacheSafeUpdates as any).valor_base_pacote = Number(pkg.valor_base) || 0;
                  (cacheSafeUpdates as any).valor_foto_extra = valorFotoExtra;
                  (cacheSafeUpdates as any).valor_total_foto_extra = Number(
                    (qtdAtual * valorFotoExtra).toFixed(2),
                  );
                  (cacheSafeUpdates as any).produtos_incluidos = [...produtosPacote, ...manuais];
                  (cacheSafeUpdates as any).regras_congeladas = {
                    ...(currentAny.regras_congeladas || {}),
                    pacote: {
                      id: pkg.id,
                      nome: pkg.nome,
                      categoria: catNome,
                      valorBase: Number(pkg.valor_base) || 0,
                      valorFotoExtra,
                      valorFotoExtraEfetivo: valorFotoExtra,
                      fotosIncluidas: Number(pkg.fotos_incluidas) || 0,
                    },
                    dataCongelamento: new Date().toISOString(),
                  };
                } else {
                  cacheSafeUpdates.pacote = rawVal as any;
                }
              }
              break;
            }
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
          "produtos_incluidos" in cacheSafeUpdates ||
          "valor_base_pacote" in cacheSafeUpdates ||
          "valor_total_foto_extra" in cacheSafeUpdates;

        if (touchedTotalAffectingField) {
          const currentAny = currentSession as any;
          const qtd =
            (cacheSafeUpdates as any).qtd_fotos_extra ?? Number(currentAny.qtd_fotos_extra) ?? 0;
          const valorUnit =
            (cacheSafeUpdates as any).valor_foto_extra ?? Number(currentAny.valor_foto_extra) ?? 0;

          if (touchedFotoExtra) {
            const galeriaInfo = {
              galeriaId: currentAny.galeria_id,
              valorTotalVendido: currentAny.galerias?.valor_total_vendido,
              totalFotosExtrasVendidas: currentAny.galerias?.total_fotos_extras_vendidas,
            };
            const hasGalleryConsolidated =
              !!galeriaInfo.galeriaId &&
              (galeriaInfo.valorTotalVendido ?? 0) > 0 &&
              (galeriaInfo.totalFotosExtrasVendidas ?? 0) > 0 &&
              qtd === galeriaInfo.totalFotosExtrasVendidas;

            if (hasGalleryConsolidated) {
              const result = recalcFotosExtras({
                qtd,
                valorFotoExtra: valorUnit,
                regrasCongeladas: currentAny.regras_congeladas,
                galeriaInfo,
              });
              if (!result.respeitarBanco) {
                (cacheSafeUpdates as any).valor_total_foto_extra = result.valorTotalFotoExtra;
                if (Math.abs(result.valorUnitarioEfetivo - valorUnit) > 0.001) {
                  (cacheSafeUpdates as any).valor_foto_extra = result.valorUnitarioEfetivo;
                }
              }
            } else {
              // Edição manual sem galeria consolidada: respeita literalmente
              // o qtd × unit digitado; marca override para a trigger DB
              // não sobrescrever com faixa de desconto progressivo.
              (cacheSafeUpdates as any).valor_total_foto_extra = Number(
                (qtd * valorUnit).toFixed(2),
              );
              (cacheSafeUpdates as any).extras_overridden = true;
              (cacheSafeUpdates as any).extras_overridden_at = new Date().toISOString();
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

        if ((Object.keys(cacheSafeUpdates).length > 0 || uiDenormFields) && !needsRefreeze) {
          const nowIso = new Date().toISOString();
          const merged: WorkflowSession = {
            ...currentSession,
            ...cacheSafeUpdates,
            ...(uiDenormFields ?? {}),
            updated_at: nowIso,
          };
          // mergeUpdate recebe payload PARCIAL (só id + delta + updated_at) —
          // o cache faz shallow-merge internamente. Spread do currentSession
          // stale causava overwrite de produtos_incluidos em chamadas seriais.
          const deltaPayload = {
            id: sessionId,
            ...cacheSafeUpdates,
            ...(uiDenormFields ?? {}),
            updated_at: nowIso,
          } as unknown as WorkflowSession;
          mergeUpdate(deltaPayload);
          // Store SEMPRE recebe o merged completo quando produtos_incluidos
          // muda — reconciliador Produto→Tarefa lê daqui e precisa do row
          // inteiro (clientes, cliente_id, etc.).
          if ("produtos_incluidos" in cacheSafeUpdates) {
            try {
              workflowStore.upsert(merged);
            } catch (e) {
              console.warn("[updateSession] upsert otimista falhou", e);
            }
          }
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
    [resolveCurrentSession, mergeUpdate, forceRefresh, updateSessionRealtime, runCapability, pacotesCtx, categoriasCtx],
  );

  const handleStatusChange = useCallback(
    async (sessionId: string, newStatus: string) => {
      const normalized =
        typeof newStatus === "string" && (newStatus.trim() === "" || newStatus === "__CLEAR__")
          ? null
          : newStatus;
      const currentSession = workflowSessions.find((s) => s.id === sessionId);
      const currentNormalized =
        currentSession && (currentSession.status ?? "") !== ""
          ? currentSession.status
          : null;
      if (currentSession && currentNormalized === normalized) return;
      if (currentSession) {
        mergeUpdate({
          ...currentSession,
          status: normalized as any,
          updated_at: new Date().toISOString(),
        });
      }
      if (USE_CAPABILITY_UPDATE_FIELDS) {
        const result = await runCapability(advanceCardCapability, {
          sessionId,
          toStatus: normalized,
        });
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
      await updateSession(sessionId, { status: normalized ?? "" });
    },
    [updateSession, workflowSessions, mergeUpdate, forceRefresh, runCapability],
  );

  const handleEditSession = useCallback((sessionId: string) => {
    console.log("Edit session:", sessionId);
  }, []);


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
        description = "Sessão movida para o histórico do cliente. Agendamento mantido na agenda como compromisso avulso.";
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
    handleDeleteSession,
    handleFieldUpdate,
  };
}
