/**
 * Snapshot da página Cobranças (billing) para o Assistente Lu.
 *
 * Onda A.3 — buildBillingPageSnapshot(v1).
 *
 * Injeta no prompt o estado agregado das cobranças visíveis. Não é fonte
 * de verdade — reflete o que a UI carregou. Operações de escrita devem
 * sempre passar pelas capabilities (`billing.*`).
 *
 * Limites:
 *  - `visibleCobrancaIds` ≤ 30
 *  - Payload ≤ ~6 KB serializado
 */

import type { AuthUser } from "@/shared/ports";
import { listBillingCapabilityIds } from "./permissions";

export type BillingTab = "cobrancas" | "recebimentos" | "conciliacao";

export type BillingStatus =
  | "pendente"
  | "confirmada"
  | "vencida"
  | "cancelada"
  | "estornada";

export interface BillingCobrancaLite {
  id: string;
  status: BillingStatus;
  valor: number;
  valorPago: number;
  provedor: string | null;
  vencimento: string | null;
}

export interface BillingPageSnapshot {
  version: 1;
  route: "/cobrancas";
  tab: BillingTab;
  filtroMesAno: { year: number; month: number };
  kpis: {
    totalEmitido: number;
    totalRecebido: number;
    totalPendente: number;
    totalVencido: number;
    cobrancasAbertas: number;
  };
  statusCounts: Record<BillingStatus, number>;
  visibleCobrancaIds: string[];
  visibleCobrancas: BillingCobrancaLite[];
  permissions: {
    canWrite: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildBillingSnapshotInput {
  user: AuthUser | null;
  tab?: BillingTab;
  filtroMesAno?: { year: number; month: number };
  cobrancas?: BillingCobrancaLite[];
  maxVisible?: number;
}

const EMPTY_STATUS_COUNTS: Record<BillingStatus, number> = {
  pendente: 0,
  confirmada: 0,
  vencida: 0,
  cancelada: 0,
  estornada: 0,
};

export function buildBillingPageSnapshot(
  input: BuildBillingSnapshotInput,
): BillingPageSnapshot {
  const {
    user,
    tab = "cobrancas",
    cobrancas = [],
    maxVisible = 30,
  } = input;

  const now = new Date();
  const filtroMesAno =
    input.filtroMesAno ?? { year: now.getFullYear(), month: now.getMonth() + 1 };

  const kpis = {
    totalEmitido: 0,
    totalRecebido: 0,
    totalPendente: 0,
    totalVencido: 0,
    cobrancasAbertas: 0,
  };
  const statusCounts: Record<BillingStatus, number> = { ...EMPTY_STATUS_COUNTS };

  for (const c of cobrancas) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    kpis.totalEmitido += c.valor;
    kpis.totalRecebido += c.valorPago;
    const pendente = Math.max(0, c.valor - c.valorPago);
    if (c.status === "pendente") {
      kpis.totalPendente += pendente;
      kpis.cobrancasAbertas += 1;
    }
    if (c.status === "vencida") {
      kpis.totalVencido += pendente;
      kpis.cobrancasAbertas += 1;
    }
  }

  const visible = cobrancas.slice(0, maxVisible);

  return {
    version: 1,
    route: "/cobrancas",
    tab,
    filtroMesAno,
    kpis,
    statusCounts,
    visibleCobrancaIds: visible.map((c) => c.id),
    visibleCobrancas: visible,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listBillingCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Cobranças com status confirmada/estornada NÃO podem ser reabertas — exija nova cobrança.",
      "billing.registerManualPayment e billing.createGalleryPayment exigem aprovação humana.",
      "Idempotência: cobranca_id é a única âncora — nunca dedup por sessão+valor+provedor.",
      "Nunca envie status/valor_pago no payload — são derivados por trigger no banco.",
    ],
  };
}

export function snapshotForBilling(user: AuthUser | null): BillingPageSnapshot {
  return buildBillingPageSnapshot({ user });
}

export function debugBillingSnapshot(s: BillingPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    tab: s.tab,
    filtroMesAno: s.filtroMesAno,
    kpis: s.kpis,
    capabilities: s.capabilities.length,
    visible: s.visibleCobrancaIds.length,
  };
}
