/**
 * Snapshot da página Formulários (Briefings) para o Assistente Lu (v1).
 *
 * Reflete o estado visível do listador de formulários / detalhe.
 * Não é fonte de verdade — escrita passa por capabilities `formularios.*`.
 *
 * Limites:
 *  - `visibleFormIds` ≤ 30
 *  - `respostasRecentes` ≤ 15
 *  - Payload alvo ≤ ~8 KB serializado.
 */

import type { AuthUser } from "@/shared/ports";
import type {
  FormularioResumo,
  FormulariosFiltros,
  RespostaResumo,
} from "../domain/types";
import { listFormulariosCapabilityIds } from "./permissions";

export type FormulariosView = "list" | "editor" | "respostas" | "detail";

export interface FormulariosPageSnapshot {
  version: 1;
  route: "/formularios";
  view: FormulariosView;
  filters: FormulariosFiltros;
  selection: { formularioId: string | null; respostaId: string | null };
  counts: {
    total: number;
    publicados: number;
    rascunhos: number;
    arquivados: number;
    respostas: number;
    respostasAbertas: number;
  };
  visibleFormIds: string[];
  respostasRecentes: Array<{
    id: string;
    formularioId: string;
    submetidoEm: string;
    fechado: boolean;
  }>;
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildFormulariosSnapshotInput {
  user: AuthUser | null;
  view?: FormulariosView;
  filters?: Partial<FormulariosFiltros>;
  selection?: { formularioId: string | null; respostaId: string | null };
  formularios?: FormularioResumo[];
  respostas?: RespostaResumo[];
  maxVisible?: number;
  maxRecentes?: number;
}

const DEFAULT_FILTERS: FormulariosFiltros = {
  search: "",
  tipo: "all",
  status: "all",
};

export function buildFormulariosPageSnapshot(
  input: BuildFormulariosSnapshotInput,
): FormulariosPageSnapshot {
  const {
    user,
    view = "list",
    filters,
    selection,
    formularios = [],
    respostas = [],
    maxVisible = 30,
    maxRecentes = 15,
  } = input;
  const mergedFilters: FormulariosFiltros = { ...DEFAULT_FILTERS, ...(filters ?? {}) };

  const counts = {
    total: formularios.length,
    publicados: formularios.filter((f) => f.status === "publicado").length,
    rascunhos: formularios.filter((f) => f.status === "rascunho").length,
    arquivados: formularios.filter((f) => f.status === "arquivado").length,
    respostas: respostas.length,
    respostasAbertas: respostas.filter((r) => !r.fechado).length,
  };

  const visibleFormIds = formularios.slice(0, maxVisible).map((f) => f.id);

  const respostasRecentes = [...respostas]
    .sort((a, b) => (a.submetidoEm < b.submetidoEm ? 1 : -1))
    .slice(0, maxRecentes)
    .map((r) => ({
      id: r.id,
      formularioId: r.formularioId,
      submetidoEm: r.submetidoEm,
      fechado: !!r.fechado,
    }));

  return {
    version: 1,
    route: "/formularios",
    view,
    filters: mergedFilters,
    selection: {
      formularioId: selection?.formularioId ?? null,
      respostaId: selection?.respostaId ?? null,
    },
    counts,
    visibleFormIds,
    respostasRecentes,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listFormulariosCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Publicar/despublicar formulário altera URL pública consumida por clientes — exige aprovação humana.",
      "Estado de submissão é gerado por trigger DB (integrity lock); nunca escrever `fechado` direto.",
      "Reabrir submissão pode disparar cobranças/tarefas — passa por gate humano.",
      "generateAIBriefing consome créditos de IA e escreve conteúdo sobre resposta do cliente — sempre requer aprovação.",
      "Respostas contêm dados pessoais do cliente: não ecoar campos livres em respostas amplas.",
    ],
  };
}

export function snapshotForFormularios(user: AuthUser | null): FormulariosPageSnapshot {
  return buildFormulariosPageSnapshot({ user });
}

export function debugFormulariosSnapshot(s: FormulariosPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    counts: s.counts,
    visible: s.visibleFormIds.length,
    recentes: s.respostasRecentes.length,
    capabilities: s.capabilities.length,
  };
}
