/**
 * Snapshot da página Clientes (CRM) para o Assistente Lu (v1).
 *
 * Reflete o estado visível na lista/detalhe de clientes do fotógrafo.
 * Não é fonte de verdade — operações devem passar por `clientes.*`
 * quando as capabilities forem registradas.
 *
 * Limites:
 *  - `visibleClientIds` ≤ 40
 *  - `topRecentes` ≤ 10
 *  - Payload alvo ≤ ~8 KB serializado.
 */

import type { AuthUser } from "@/shared/ports";
import type { ClienteFiltros, ClienteResumo } from "../domain/types";
import { listClientesCapabilityIds } from "./permissions";

export type ClientesView = "list" | "grid" | "detail";

export interface ClientesPageSnapshot {
  version: 1;
  route: "/clientes";
  view: ClientesView;
  filters: ClienteFiltros;
  selection: { clientId: string | null };
  counts: {
    total: number;
    ativos: number;
    inativos: number;
    comCreditos: number;
  };
  visibleClientIds: string[];
  topRecentes: Array<{
    id: string;
    nome: string;
    ultimaSessaoAt: string | null;
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

export interface BuildClientesSnapshotInput {
  user: AuthUser | null;
  view?: ClientesView;
  filters?: Partial<ClienteFiltros>;
  selection?: { clientId: string | null };
  clientes?: ClienteResumo[];
  maxVisible?: number;
  maxRecentes?: number;
}

const DEFAULT_FILTERS: ClienteFiltros = {
  search: "",
  origem: "all",
  status: "ativos",
};

export function buildClientesPageSnapshot(
  input: BuildClientesSnapshotInput,
): ClientesPageSnapshot {
  const {
    user,
    view = "list",
    filters,
    selection,
    clientes = [],
    maxVisible = 40,
    maxRecentes = 10,
  } = input;
  const mergedFilters: ClienteFiltros = { ...DEFAULT_FILTERS, ...(filters ?? {}) };

  const counts = {
    total: clientes.length,
    ativos: clientes.filter((c) => c.ativo !== false).length,
    inativos: clientes.filter((c) => c.ativo === false).length,
    comCreditos: clientes.filter((c) => (c.saldoCreditos ?? 0) > 0).length,
  };

  const visibleClientIds = clientes.slice(0, maxVisible).map((c) => c.id);

  const topRecentes = [...clientes]
    .filter((c) => !!c.ultimaSessaoAt)
    .sort((a, b) => (a.ultimaSessaoAt! < b.ultimaSessaoAt! ? 1 : -1))
    .slice(0, maxRecentes)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      ultimaSessaoAt: c.ultimaSessaoAt ?? null,
    }));

  return {
    version: 1,
    route: "/clientes",
    view,
    filters: mergedFilters,
    selection: { clientId: selection?.clientId ?? null },
    counts,
    visibleClientIds,
    topRecentes,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listClientesCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Créditos de fotos vivem em cliente_creditos_ledger — nunca escrever direto: use capability clientes.adjustCredits (requer aprovação).",
      "Merge/exclusão de clientes é irreversível e exige aprovação humana.",
      "Dados pessoais (email/telefone) são sensíveis: não ecoar em respostas amplas sem necessidade.",
      "Vínculos com sessões/cobranças devem ser consultados via workflow.* e billing.*.",
    ],
  };
}

export function snapshotForClientes(user: AuthUser | null): ClientesPageSnapshot {
  return buildClientesPageSnapshot({ user });
}

export function debugClientesSnapshot(s: ClientesPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    counts: s.counts,
    visible: s.visibleClientIds.length,
    recentes: s.topRecentes.length,
    capabilities: s.capabilities.length,
  };
}
