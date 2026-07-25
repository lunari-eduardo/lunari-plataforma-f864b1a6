/**
 * Snapshot da página Configurações para o Assistente Lu (v1).
 *
 * Reflete o estado visível da página `/configuracoes` (aba ativa, seleção,
 * contagens do catálogo). Não é fonte de verdade — escrita passa por
 * capabilities `configuracoes.*`.
 *
 * Limites:
 *  - `visibleCategoriaIds` ≤ 30
 *  - `visiblePacoteIds` ≤ 30
 *  - `visibleProdutoIds` ≤ 30
 *  - Payload alvo ≤ ~8 KB serializado.
 */

import type { AuthUser } from "@/shared/ports";
import type {
  CategoriaResumo,
  ConfiguracoesSelection,
  ConfiguracoesTab,
  ContratoTemplateResumo,
  EtapaResumo,
  PacoteResumo,
  PricingModelo,
  ProdutoResumo,
} from "../domain/types";
import { listConfiguracoesCapabilityIds } from "./permissions";

export interface ConfiguracoesPageSnapshot {
  version: 1;
  route: "/configuracoes";
  activeTab: ConfiguracoesTab | null;
  selection: ConfiguracoesSelection;
  counts: {
    categorias: number;
    pacotes: number;
    produtos: number;
    produtosAtivos: number;
    etapas: number;
    contratosTemplates: number;
  };
  pricing: {
    modelo: PricingModelo;
    hasGlobalTable: boolean;
  };
  visibleCategoriaIds: string[];
  visiblePacoteIds: string[];
  visibleProdutoIds: string[];
  etapasOrdenadas: Array<{ id: string; nome: string; ordem: number }>;
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildConfiguracoesSnapshotInput {
  user: AuthUser | null;
  activeTab?: ConfiguracoesTab | null;
  selection?: Partial<ConfiguracoesSelection>;
  categorias?: CategoriaResumo[];
  pacotes?: PacoteResumo[];
  produtos?: ProdutoResumo[];
  etapas?: EtapaResumo[];
  contratosTemplates?: ContratoTemplateResumo[];
  pricing?: { modelo?: PricingModelo; hasGlobalTable?: boolean };
  maxVisible?: number;
}

const EMPTY_SELECTION: ConfiguracoesSelection = {
  categoriaId: null,
  pacoteId: null,
  produtoId: null,
  etapaId: null,
  contratoTemplateId: null,
};

export function buildConfiguracoesPageSnapshot(
  input: BuildConfiguracoesSnapshotInput,
): ConfiguracoesPageSnapshot {
  const {
    user,
    activeTab = null,
    selection,
    categorias = [],
    pacotes = [],
    produtos = [],
    etapas = [],
    contratosTemplates = [],
    pricing,
    maxVisible = 30,
  } = input;

  const counts = {
    categorias: categorias.length,
    pacotes: pacotes.length,
    produtos: produtos.length,
    produtosAtivos: produtos.filter((p) => p.ativo !== false).length,
    etapas: etapas.length,
    contratosTemplates: contratosTemplates.length,
  };

  const etapasOrdenadas = [...etapas]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem }));

  return {
    version: 1,
    route: "/configuracoes",
    activeTab,
    selection: { ...EMPTY_SELECTION, ...(selection ?? {}) },
    counts,
    pricing: {
      modelo: pricing?.modelo ?? "fixo",
      hasGlobalTable: !!pricing?.hasGlobalTable,
    },
    visibleCategoriaIds: categorias.slice(0, maxVisible).map((c) => c.id),
    visiblePacoteIds: pacotes.slice(0, maxVisible).map((p) => p.id),
    visibleProdutoIds: produtos.slice(0, maxVisible).map((p) => p.id),
    etapasOrdenadas,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listConfiguracoesCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Deletes de catálogo (categoria/pacote/produto/etapa/contrato) têm cascata em sessões, orçamentos e contratos — exigem aprovação humana.",
      "Mudar `pricing.modelo` (fixo/global/categoria) afeta apenas sessões novas; sessões existentes seguem regra congelada.",
      "Atualizar tabelas de preço (global ou por categoria) exige aprovação humana; nunca reprecificar sessões congeladas.",
      "Etapas de trabalho têm espelhos em tasks/workflow; renomear é seguro, deletar/reordenar requer avaliação.",
      "Configurações financeiras (contas, categorias contábeis) pertencem ao módulo Finance — fora desta superfície.",
      "Integrações de pagamento (Asaas/MP/InfinitePay/Stripe) NÃO são configuráveis pelo Lu na v1.",
    ],
  };
}

export function snapshotForConfiguracoes(
  user: AuthUser | null,
): ConfiguracoesPageSnapshot {
  return buildConfiguracoesPageSnapshot({ user });
}

export function debugConfiguracoesSnapshot(
  s: ConfiguracoesPageSnapshot,
): Record<string, unknown> {
  return {
    route: s.route,
    activeTab: s.activeTab,
    counts: s.counts,
    pricing: s.pricing,
    capabilities: s.capabilities.length,
  };
}
