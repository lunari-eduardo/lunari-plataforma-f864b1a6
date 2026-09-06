import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import { formatDateForStorage, getCurrentDateString } from "@/utils/dateUtils";
import { toast } from "@/hooks/use-toast";
import type { Projeto, CriarProjetoInput } from "@/types/projeto";
import { ProjetoService } from "@/services/ProjetoService";
import type { WorkflowItem, WorkflowFilters } from "./types";

interface UseAppWorkflowProps {
  pacotes: any[];
  produtos: any[];
  capabilityUser: any;
}

export function useAppWorkflow({ pacotes, produtos, capabilityUser }: UseAppWorkflowProps) {
  const capabilityUserRef = useRef(capabilityUser);
  useEffect(() => {
    capabilityUserRef.current = capabilityUser;
  }, [capabilityUser]);

  const [projetos, setProjetos] = useState<Projeto[]>([]);

  // COMPATIBILIDADE: WorkflowItems derivados dos Projetos
  const workflowItems: WorkflowItem[] = useMemo(
    () =>
      projetos.map((projeto) => ({
        id: projeto.projectId,
        sessionId: projeto.projectId,
        data: formatDateForStorage(projeto.dataAgendada),
        hora: projeto.horaAgendada,
        nome: projeto.nome,
        whatsapp: projeto.whatsapp,
        email: projeto.email,
        descricao: projeto.descricao,
        status: projeto.status,
        categoria: projeto.categoria,
        pacote: projeto.pacote,
        valorPacote: projeto.valorPacote,
        desconto: projeto.desconto,
        valorFotoExtra: projeto.valorFotoExtra,
        qtdFotoExtra: projeto.qtdFotosExtra,
        valorTotalFotoExtra: projeto.valorTotalFotosExtra,
        produto: projeto.produto,
        qtdProduto: projeto.qtdProduto,
        valorTotalProduto: projeto.valorTotalProduto,
        produtosList: projeto.produtosList.map((p) => ({
          nome: p.nome,
          quantidade: p.quantidade,
          valorUnitario: p.valorUnitario,
          tipo: p.tipo,
          produzido: p.produzido,
          entregue: p.entregue,
        })),
        valorAdicional: projeto.valorAdicional,
        detalhes: projeto.detalhes,
        total: projeto.total,
        valorPago: projeto.valorPago,
        restante: projeto.restante,
        pagamentos: projeto.pagamentos.map((p) => ({
          id: p.id,
          valor: p.valor,
          data: p.data,
        })),
        fonte: projeto.fonte as "agenda" | "orcamento",
        dataOriginal: projeto.dataOriginal || projeto.dataAgendada,
        valorFinalAjustado: Boolean(projeto.valorFinalAjustado),
        valorOriginalOrcamento: projeto.valorOriginalOrcamento,
        percentualAjusteOrcamento: projeto.percentualAjusteOrcamento,
        regrasDePrecoFotoExtraCongeladas: projeto.regrasDePrecoFotoExtraCongeladas
          ? ({ valorFotoExtra: projeto.valorFotoExtra } as any)
          : undefined,
        clienteId: projeto.clienteId,
      })),
    [projetos],
  );

  // SYNC: workflow_sessions → Projetos (inclui inclusos e manuais)
  const syncSessionsToProjects = useCallback(
    (sessionsRaw: any[]) => {
      try {
        if (!Array.isArray(sessionsRaw) || sessionsRaw.length === 0) return;
        const projetosExistentes = ProjetoService.carregarProjetos();
        let houveAlteracao = false;

        const normalizar = (s: any) => ({
          id: s.id,
          data: s.data,
          hora: s.hora,
          nome: (s.nome || "").trim(),
          clienteId: s.clienteId || "",
          produtosList: Array.isArray(s.produtosList) ? s.produtosList : [],
        });

        sessionsRaw.map(normalizar).forEach((session) => {
          let dataSessao: Date | null = null;
          if (typeof session.data === "string" && session.data.includes("/")) {
            const [dia, mes, ano] = session.data.split("/").map((n: string) => parseInt(n, 10));
            if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
              dataSessao = new Date(ano, mes - 1, dia);
            }
          }

          const proj = projetosExistentes.find((p) => {
            const mesmoCliente = session.clienteId
              ? p.clienteId === session.clienteId
              : p.nome.trim().toLowerCase() === session.nome.toLowerCase();
            const mesmaHora = session.hora ? p.horaAgendada === session.hora : true;
            let mesmaData = true;
            if (dataSessao) {
              const diff = Math.abs(p.dataAgendada.getTime() - dataSessao.getTime());
              mesmaData = diff < 12 * 60 * 60 * 1000; // 12h
            }
            return mesmoCliente && mesmaHora && mesmaData;
          });

          if (!proj) return;

          const produtosNorm = session.produtosList.map((p: any) => ({
            nome: p.nome,
            quantidade: Number(p.quantidade) || 0,
            valorUnitario: Number(p.valorUnitario) || 0,
            tipo: p.tipo === "incluso" ? ("incluso" as const) : ("manual" as const),
            produzido: !!p.produzido,
            entregue: !!p.entregue,
          }));

          const valorProdutosManuais = produtosNorm
            .filter((p: any) => p.tipo === "manual")
            .reduce((sum: number, p: any) => sum + p.valorUnitario * p.quantidade, 0);

          const updates: Partial<Projeto> = {
            produtosList: produtosNorm as any,
            valorTotalProduto: valorProdutosManuais,
            valorProdutos: valorProdutosManuais,
            produto: produtosNorm.map((p: any) => p.nome).join(", "),
            qtdProduto: produtosNorm.reduce((acc: number, p: any) => acc + p.quantidade, 0),
          };

          ProjetoService.atualizarProjeto(proj.projectId, updates);
          houveAlteracao = true;
        });

        if (houveAlteracao) {
          setProjetos(ProjetoService.carregarProjetos());
        }
      } catch (e) {
        console.error("❌ Erro ao sincronizar workflow_sessions → projetos:", e);
      }
    },
    [setProjetos],
  );

  // Workflow State
  const [workflowFilters, setWorkflowFilters] = useState<WorkflowFilters>(() => {
    const hoje = new Date();
    return {
      mes: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`,
      busca: "",
    };
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const stored = storage.load(STORAGE_KEYS.WORKFLOW_COLUMNS, {});
    return {
      categoria: true,
      pacote: true,
      desconto: true,
      valorFotoExtra: true,
      valorAdicional: true,
      status: true,
      valorPago: true,
      restante: true,
      ...stored,
    };
  });

  useEffect(() => {
    storage.save(STORAGE_KEYS.WORKFLOW_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  // Listener para eventos e backfill inicial - ignorar eventos internos do Workflow
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e?.detail?.source !== "workflow-internal") {
        const sessions = e?.detail?.sessions || [];
        syncSessionsToProjects(sessions);
      }
    };

    window.addEventListener("workflow-sessions-updated", handler as EventListener);

    try {
      const existingSessions = JSON.parse(localStorage.getItem("workflow_sessions") || "[]");
      if (existingSessions.length > 0) {
        syncSessionsToProjects(existingSessions);
      }
    } catch (e) {
      console.error("❌ Erro no backfill inicial de workflow_sessions:", e);
    }

    return () =>
      window.removeEventListener("workflow-sessions-updated", handler as EventListener);
  }, [syncSessionsToProjects]);

  // Store workflow_sessions whenever workflowItems changes
  const prevWorkflowItemsRef = useRef<WorkflowItem[]>([]);
  useEffect(() => {
    const prev = prevWorkflowItemsRef.current;
    const current = workflowItems;

    const changed =
      prev.length !== current.length ||
      prev.some((item, index) => JSON.stringify(item) !== JSON.stringify(current[index]));

    if (changed) {
      try {
        const serialized = current.map((item) => ({
          ...item,
          dataOriginal: item.dataOriginal.toISOString(),
        }));
        localStorage.setItem("workflow_sessions", JSON.stringify(serialized));

        window.dispatchEvent(
          new CustomEvent("workflow-sessions-updated", { detail: { sessions: serialized } }),
        );
      } catch (error) {
        console.error("❌ Erro ao salvar workflow_sessions:", error);
      }
    }

    prevWorkflowItemsRef.current = current;
  }, [workflowItems]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("workflow_sessions") || "[]");
    const saved = stored.map((item: any) => ({ ...item }));
    localStorage.setItem("workflow_sessions", JSON.stringify(saved));

    window.dispatchEvent(
      new CustomEvent("workflow-sessions-updated", { detail: { sessions: saved } }),
    );
  }, [pacotes, produtos]);

  // Calculate workflow summary
  const workflowSummary = useMemo(() => {
    const filteredItems = workflowItems.filter((item) => {
      const itemDate = new Date(item.data);
      const itemMonth = itemDate.getMonth() + 1;
      const itemYear = itemDate.getFullYear();

      const [filterYear, filterMonth] = workflowFilters.mes.split("-").map(Number);

      return itemYear === filterYear && itemMonth === filterMonth;
    });

    const receita = filteredItems.reduce((sum, item) => {
      return item.status === "entregue" ? sum + (item.valorPago || 0) : sum;
    }, 0);

    const aReceber = filteredItems.reduce((sum, item) => {
      return ["agendado", "executando", "producao", "concluido"].includes(item.status)
        ? sum + (item.restante || 0)
        : sum;
    }, 0);

    const previsto = filteredItems.reduce((sum, item) => sum + (item.total || 0), 0);

    return { receita, aReceber, previsto };
  }, [workflowItems, workflowFilters]);

  // Workflow actions
  const updateWorkflowItem = useCallback((id: string, updates: Partial<WorkflowItem>) => {
    try {
      ProjetoService.atualizarProjeto(id, updates as any);
      setProjetos(ProjetoService.carregarProjetos());
    } catch (error) {
      console.error("❌ Erro ao atualizar item do workflow:", error);
    }
  }, []);

  const addPayment = useCallback(async (id: string, valor: number) => {
    console.log("💰 Adicionando pagamento rápido:", { id, valor });

    const intentKey = `quick:${id}:${valor.toFixed(2)}:${Math.floor(Date.now() / 2000)}:sessao`;
    let optimisticTarget: string | null = null;

    try {
      const { USE_CAPABILITY_ADD_PAYMENT } = await import("@/features/workflow/config");
      const { PaymentSupabaseService } = await (
        await import("@/utils/dynamicImport")
      ).dynamicImport(() => import("@/services/PaymentSupabaseService"));

      const binding = await PaymentSupabaseService.getSessionBinding(id);
      if (!binding) {
        console.warn("⚠️ Sessão ainda não encontrada, pode estar sendo criada...");
        toast({
          title: "Aguarde",
          description: "A sessão ainda está sendo criada. Tente novamente em alguns segundos.",
          variant: "default",
        });
        return;
      }

      optimisticTarget = binding.session_id;
      window.dispatchEvent(
        new CustomEvent("payment-optimistic", {
          detail: { sessionId: optimisticTarget, sessionUuid: binding.id, delta: valor },
        }),
      );

      const paymentId = `quick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      let success = false;
      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      if (USE_CAPABILITY_ADD_PAYMENT) {
        const { addPayment: addPaymentCapability } = await import("@/modules/workflow");
        const { isOk } = await import("@/shared/result");
        const today = getCurrentDateString();
        const result = await addPaymentCapability.execute(
          {
            sessionId: binding.id,
            valor: Math.round(valor * 100),
            dataTransacao: today,
            formaPagamento: "dinheiro",
            descricao: "Pagamento rápido",
            intentKey,
            paymentId,
          },
          { user: capabilityUserRef.current, runtime: "client" },
        );
        success = isOk(result);
        if (!success) {
          const e = (result as any).error;
          errorCode = e?.code ?? null;
          errorMessage = e?.message ?? null;
          console.error("❌ Capability workflow.addPayment falhou:", e);
        }
      } else {
        success = await PaymentSupabaseService.saveSinglePaymentTracked(
          binding.session_id,
          paymentId,
          {
            valor,
            data: getCurrentDateString(),
            observacoes: "Pagamento rápido",
            forma_pagamento: "dinheiro",
          },
          { binding, intentKey },
        );
      }

      if (!success) {
        window.dispatchEvent(
          new CustomEvent("payment-optimistic", {
            detail: { sessionId: optimisticTarget, sessionUuid: binding.id, delta: -valor },
          }),
        );
        optimisticTarget = null;
        console.error("❌ Falha ao salvar pagamento no Supabase");
        const friendly =
          errorCode === "UNAUTHENTICATED"
            ? {
                title: "Sessão expirada",
                description: "Faça login novamente para registrar pagamentos.",
              }
            : errorCode === "FORBIDDEN"
              ? {
                  title: "Sem permissão",
                  description: "Seu usuário não pode registrar pagamentos.",
                }
              : errorCode === "VALIDATION"
                ? {
                    title: "Dados inválidos",
                    description: errorMessage ?? "Verifique o valor informado.",
                  }
                : errorCode === "NOT_FOUND"
                  ? {
                      title: "Sessão não encontrada",
                      description: "Recarregue a página e tente novamente.",
                    }
                  : {
                      title: "Erro ao adicionar pagamento",
                      description:
                        errorMessage ??
                        "Não foi possível salvar o pagamento. Verifique sua conexão.",
                    };
        toast({ ...friendly, variant: "destructive" });
        return;
      }

      window.dispatchEvent(
        new CustomEvent("payment-created", {
          detail: { sessionId: binding.session_id, sessionUuid: binding.id, paymentId, valor },
        }),
      );

      console.log("✅ Pagamento adicionado:", valor, "sessão:", binding.session_id);
    } catch (error) {
      if (optimisticTarget) {
        window.dispatchEvent(
          new CustomEvent("payment-optimistic", {
            detail: { sessionId: optimisticTarget, delta: -valor },
          }),
        );
      }
      console.error("❌ Erro ao adicionar pagamento:", error);
      toast({
        title: "Erro ao adicionar pagamento",
        description: "Ocorreu um erro ao processar o pagamento",
        variant: "destructive",
      });
    }
  }, []);

  const toggleColumnVisibility = useCallback((column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }, []);

  const updateWorkflowFilters = useCallback((newFilters: Partial<WorkflowFilters>) => {
    setWorkflowFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const navigateMonth = useCallback((direction: number) => {
    setWorkflowFilters((prev) => {
      const [year, month] = prev.mes.split("-").map(Number);
      const date = new Date(year, month - 1 + direction, 1);
      return {
        ...prev,
        mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      };
    });
  }, []);

  return {
    workflowItems,
    workflowSummary,
    workflowFilters,
    visibleColumns,
    updateWorkflowItem,
    addPayment,
    toggleColumnVisibility,
    updateWorkflowFilters,
    navigateMonth,
  };
}
