/**
 * Snapshot da página Gallery para o Assistente Lu (v1).
 *
 * Reflete o estado visível na área de galerias (front-office do fotógrafo).
 * Não é fonte de verdade: operações devem sempre passar pelas capabilities
 * `gallery.*`. Snapshot enxuto — foco em contexto de acesso, contadores e
 * itens em seleção/expirando.
 *
 * Limites:
 *  - `visibleGalleryIds` ≤ 30
 *  - `expiringSoon` ≤ 20
 *  - Payload alvo ≤ ~6 KB serializado.
 */

import type { AuthUser } from "@/shared/ports";
import { listGalleryCapabilityIds } from "./permissions";

export type GalleryView = "list" | "grid" | "detail";

export interface GalleryPageSnapshot {
  version: 1;
  route: "/galerias";
  view: GalleryView;
  hasAccess: boolean | null;
  selection: { galleryId: string | null };
  counts: {
    total: number;
    ativas: number;
    expiradas: number;
    aguardandoSelecao: number;
    selecaoFinalizada: number;
    inSelectionOpen: number;
  };
  visibleGalleryIds: string[];
  expiringSoon: Array<{
    id: string;
    name?: string;
    expiresAt: string; // ISO
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

export interface BuildGallerySnapshotInput {
  user: AuthUser | null;
  view?: GalleryView;
  hasAccess?: boolean | null;
  selection?: { galleryId: string | null };
  galleries?: Array<{
    id: string;
    name?: string;
    status?: string;
    expiresAt?: string | null;
    inSelection?: boolean;
  }>;
  maxVisible?: number;
  maxExpiring?: number;
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

export function buildGalleryPageSnapshot(
  input: BuildGallerySnapshotInput,
): GalleryPageSnapshot {
  const {
    user,
    view = "list",
    hasAccess = null,
    selection,
    galleries = [],
    maxVisible = 30,
    maxExpiring = 20,
  } = input;

  const counts = {
    total: galleries.length,
    ativas: galleries.filter((g) => g.status === "ativa").length,
    expiradas: galleries.filter((g) => g.status === "expirada").length,
    aguardandoSelecao: galleries.filter((g) => g.status === "aguardando_selecao").length,
    selecaoFinalizada: galleries.filter((g) => g.status === "selecao_finalizada").length,
    inSelectionOpen: galleries.filter((g) => g.inSelection && g.status !== "selecao_finalizada").length,
  };

  const visibleGalleryIds = galleries.slice(0, maxVisible).map((g) => g.id);

  const expiringSoon = galleries
    .filter((g) => g.expiresAt && daysUntil(g.expiresAt) <= 7 && daysUntil(g.expiresAt) >= 0)
    .slice(0, maxExpiring)
    .map((g) => ({ id: g.id, name: g.name, expiresAt: g.expiresAt! }));

  return {
    version: 1,
    route: "/galerias",
    view,
    hasAccess,
    selection: { galleryId: selection?.galleryId ?? null },
    counts,
    visibleGalleryIds,
    expiringSoon,
    permissions: {
      canWrite: !!user,
      canDelete: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listGalleryCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Acesso à Gallery é decidido por gallery.checkAccess (RPC user_has_gallery_access) — nunca por plano local.",
      "gallery.reopenSelection exige aprovação humana (reabre seleção finalizada).",
      "Status financeiro de sessões vinculadas é gerado por trigger — não escrever daqui.",
      "Sessões devem ser sincronizadas via shared edge functions (não escrever storage direto).",
    ],
  };
}

export function snapshotForGallery(user: AuthUser | null): GalleryPageSnapshot {
  return buildGalleryPageSnapshot({ user });
}

export function debugGallerySnapshot(s: GalleryPageSnapshot): Record<string, unknown> {
  return {
    route: s.route,
    view: s.view,
    hasAccess: s.hasAccess,
    counts: s.counts,
    visible: s.visibleGalleryIds.length,
    expiring: s.expiringSoon.length,
    capabilities: s.capabilities.length,
  };
}
