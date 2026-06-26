import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionData } from "@/types/workflow";
import type { WorkflowSession } from "@/hooks/useWorkflowRealtime";
import { usePersistedState } from "@/hooks/usePersistedState";
import { parseDateFromStorage, parseHoraToMinutes } from "@/utils/dateUtils";

const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type SortDirection = "asc" | "desc";
type SituacaoFilter = "todos" | "pago" | "pendente";

/**
 * Onda 5a — extrai do god-component:
 *  - estado persistido de busca/categoria/situação/ordenação
 *  - saneamento de valores legados (parcial → pendente)
 *  - contagens por situação
 *  - filtragem + ordenação memoizadas
 */
export function useWorkflowFilters(
  sessionsData: SessionData[],
  workflowSessions: WorkflowSession[],
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = usePersistedState<string>(
    "lunari_workflow_filter_category",
    "",
    localStorage,
  );
  const [sortField, setSortField] = usePersistedState<string>(
    "lunari_workflow_filter_sort_field",
    "",
    localStorage,
  );
  const [sortDirection, setSortDirection] = usePersistedState<SortDirection>(
    "lunari_workflow_filter_sort_direction",
    "asc",
    localStorage,
  );
  const [situacaoFilter, setSituacaoFilter] = usePersistedState<SituacaoFilter>(
    "lunari_workflow_filter_situacao",
    "todos",
    localStorage,
  );

  // Sanear estado persistido legado
  useEffect(() => {
    if ((situacaoFilter as string) === "parcial") setSituacaoFilter("pendente");
    if (sortField === "situacao") setSortField("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rawSessionMap = useMemo(() => {
    const map = new Map<string, WorkflowSession>();
    for (const s of workflowSessions) map.set(s.id, s);
    return map;
  }, [workflowSessions]);

  const getPaymentFilterStatus = useCallback(
    (raw: WorkflowSession | undefined): "pago" | "pendente" => {
      if (!raw) return "pendente";
      if (raw.status_financeiro === "pago") return "pago";
      const total = Number(raw.valor_total) || 0;
      const pago = Number(raw.valor_pago) || 0;
      if (total > 0 && pago >= total) return "pago";
      return "pendente";
    },
    [],
  );

  const situacaoCounts = useMemo(() => {
    let pago = 0;
    let pendente = 0;
    for (const session of sessionsData) {
      if (categoryFilter && session.categoria !== categoryFilter) continue;
      if (searchTerm.trim()) {
        const q = removeAccents(searchTerm.toLowerCase());
        const nome = removeAccents((session.nome || "").toLowerCase());
        const email = removeAccents((session.email || "").toLowerCase());
        if (!nome.includes(q) && !email.includes(q)) continue;
      }
      const status = getPaymentFilterStatus(rawSessionMap.get(session.id));
      if (status === "pago") pago++;
      else pendente++;
    }
    return { pago, pendente, total: pago + pendente };
  }, [sessionsData, categoryFilter, searchTerm, rawSessionMap, getPaymentFilterStatus]);

  const filteredSessions = useMemo(() => {
    let result = sessionsData;
    if (categoryFilter) result = result.filter((s) => s.categoria === categoryFilter);
    if (situacaoFilter !== "todos") {
      result = result.filter(
        (s) => getPaymentFilterStatus(rawSessionMap.get(s.id)) === situacaoFilter,
      );
    }
    if (searchTerm.trim()) {
      const q = removeAccents(searchTerm.toLowerCase());
      result = result.filter((s) => {
        const nome = removeAccents((s.nome || "").toLowerCase());
        const email = removeAccents((s.email || "").toLowerCase());
        return nome.includes(q) || email.includes(q);
      });
    }
    return result;
  }, [sessionsData, categoryFilter, situacaoFilter, searchTerm, rawSessionMap, getPaymentFilterStatus]);

  const calculateTotal = useCallback((session: SessionData) => {
    const valorPacote = Number(session.valorPacote) || 0;
    const valorFotoExtra = Number(session.valorTotalFotoExtra) || 0;
    const valorProduto = Number(session.valorTotalProduto) || 0;
    const valorAdicional = Number(session.valorAdicional) || 0;
    const desconto = Number(session.desconto) || 0;
    return valorPacote + valorFotoExtra + valorProduto + valorAdicional - desconto;
  }, []);

  const calculateRestante = useCallback(
    (session: SessionData) => calculateTotal(session) - (Number(session.valorPago) || 0),
    [calculateTotal],
  );

  const getFieldMapping = useCallback((headerKey: string): keyof SessionData => {
    const mapping: Record<string, keyof SessionData> = {
      client: "nome",
      date: "data",
      status: "status",
      category: "categoria",
      package: "pacote",
      extraPhotoQty: "qtdFotosExtra",
      productTotal: "valorTotalProduto",
      total: "total",
      remaining: "restante",
      paid: "valorPago",
    };
    return (mapping[headerKey] || headerKey) as keyof SessionData;
  }, []);

  const getSortValue = useCallback(
    (session: SessionData, headerKey: string): string | number => {
      const field = getFieldMapping(headerKey);
      if (headerKey === "total") return calculateTotal(session);
      if (headerKey === "remaining") return calculateRestante(session);
      if (headerKey === "nome" || field === "nome")
        return removeAccents((session.nome || "").toLowerCase());
      if (headerKey === "date" || field === "data") {
        const dateObj = parseDateFromStorage(session.data);
        const baseTs = dateObj ? dateObj.getTime() : 0;
        return baseTs + parseHoraToMinutes(session.hora) * 60_000;
      }
      const currencyFields = ["valorPago", "valorTotalProduto", "valorPacote", "desconto", "valorAdicional"];
      if (currencyFields.includes(field as string)) {
        const value = session[field];
        if (typeof value === "string")
          return parseFloat(value.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
        return Number(value) || 0;
      }
      if (headerKey === "extraPhotoQty" || field === "qtdFotosExtra")
        return Number(session.qtdFotosExtra) || 0;
      const value = session[field];
      if (typeof value === "string") return value.toLowerCase();
      return (value as any) || "";
    },
    [getFieldMapping, calculateTotal, calculateRestante],
  );

  const sortedSessions = useMemo(() => {
    if (!sortField) {
      return [...filteredSessions].sort((a, b) => {
        const dateA = parseDateFromStorage(a.data);
        const dateB = parseDateFromStorage(b.data);
        const tsA = dateA ? dateA.getTime() : 0;
        const tsB = dateB ? dateB.getTime() : 0;
        if (tsA !== tsB) return tsB - tsA;
        return parseHoraToMinutes(a.hora) - parseHoraToMinutes(b.hora);
      });
    }
    return [...filteredSessions].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredSessions, sortField, sortDirection, getSortValue]);

  const handleSort = useCallback(
    (field: string) => {
      setSortField((prevField) => {
        if (prevField !== field) {
          setSortDirection("asc");
          return field;
        }
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        return field;
      });
    },
    [setSortDirection, setSortField],
  );

  return {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    situacaoFilter,
    setSituacaoFilter,
    situacaoCounts,
    filteredSessions,
    sortedSessions,
    handleSort,
    calculateTotal,
    calculateRestante,
  };
}
