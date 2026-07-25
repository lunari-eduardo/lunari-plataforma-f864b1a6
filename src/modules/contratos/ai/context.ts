/**
 * Snapshot da página Contratos para o Assistente Lu (v1).
 *
 * Limites:
 *  - `visibleTemplateIds` ≤ 20
 *  - `visibleContratoIds` ≤ 30
 *  - Payload alvo ≤ ~8 KB serializado.
 */

import type { AuthUser } from "@/shared/ports";
import type {
  ContratoResumo,
  ContratoTemplateResumo,
  ContratosFiltros,
} from "../domain/types";
import { listContratosCapabilityIds, CONTRATO_VARIAVEIS_SUPORTADAS } from "./";

export type ContratosView = "templates" | "instancias" | "editor" | "detail";

export interface ContratosPageSnapshot {
  version: 1;
  route: "/contratos";
  view: ContratosView;
  filters: ContratosFiltros;
  selection: { templateId: string | null; contratoId: string | null };
  counts: {
    templates: number;
    templatesAtivos: number;
    contratos: number;
    rascunhos: number;
    enviados: number;
    assinados: number;
  };
  visibleTemplateIds: string[];
  visibleContratoIds: string[];
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  variaveisSuportadas: readonly string[];
  userTz: string;
  notes: string[];
}

export interface BuildContratosSnapshotInput {
  user: AuthUser | null;
  view?: ContratosView;
  filters?: Partial<ContratosFiltros>;
  selection?: { templateId: string | null; contratoId: string | null };
  templates?: ContratoTemplateResumo[];
  contratos?: ContratoResumo[];
  maxTemplates?: number;
  maxContratos?: number;
}

const DEFAULT_FILTERS: ContratosFiltros = {
  search: "",
  status: "all",
  clienteId: null,
};

export function buildContratosPageSnapshot(
  input: BuildContratosSnapshotInput,
): ContratosPageSnapshot {
  const {
    user,
    view = "templates",
    filters,
    selection,
    templates = [],
    contratos = [],
    maxTemplates = 20,
    maxContratos = 30,
  } = input;
  const mergedFilters: ContratosFiltros = {
    ...DEFAULT_FILTERS,
    ...(filters ?? {}),
  };

  const counts = {
    templates: templates.length,
    templatesAtivos: templates.filter((t) => t.ativo).length,
    contratos: contratos.length,
    rascunhos: contratos.filter((c) => c.status === "rascunho").length,
    enviados: contratos.filter((c) => c.status === "enviado").length,
    assinados: contratos.filter((c) => c.status === "assinado").length,
  };

  return {
    version: 1,
    route: "/contratos",
    view,
    filters: mergedFilters,
    selection: {
      templateId: selection?.templateId ?? null,
      contratoId: selection?.contratoId ?? null,
    },
    counts,
    visibleTemplateIds: templates.slice(0, maxTemplates).map((t) => t.id),
    visibleContratoIds: contratos.slice(0, maxContratos).map((c) => c.id),
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listContratosCapabilityIds(),
    variaveisSuportadas: CONTRATO_VARIAVEIS_SUPORTADAS,
    userTz: "America/Sao_Paulo",
    notes: [
      "Placeholder oficial é `{{variavel}}`; IA só pode usar variáveis suportadas.",
      "Marcar contrato como enviado é irreversível na UX — sempre gate humano.",
      "Assinatura eletrônica externa não é operada pelo assistente na v1.",
      "Geração IA devolve proposta — nunca grava direto no template/contrato.",
    ],
  };
}

export function snapshotForContratos(user: AuthUser | null): ContratosPageSnapshot {
  return buildContratosPageSnapshot({ user });
}

export function debugContratosSnapshot(
  s: ContratosPageSnapshot,
): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    counts: s.counts,
    templates: s.visibleTemplateIds.length,
    contratos: s.visibleContratoIds.length,
    capabilities: s.capabilities.length,
  };
}
