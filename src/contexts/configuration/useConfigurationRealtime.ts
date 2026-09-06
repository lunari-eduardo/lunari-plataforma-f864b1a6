import { useEffect, useCallback, useRef, useMemo } from "react";
import { configurationService } from "@/services/ConfigurationService";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { realtimeSubscriptionManager } from "@/services/RealtimeSubscriptionManager";
import type { Categoria, Pacote, Produto, EtapaTrabalho } from "@/types/configuration";
import { CONFIGURATION_DEBUG, SUPPRESS_TTL } from "./types";

interface UseConfigurationRealtimeProps {
  user: { id: string } | null | undefined;
  categoriasOps: { set: (data: Categoria[]) => void };
  pacotesOps: { set: (data: Pacote[]) => void };
  produtosOps: { set: (data: Produto[]) => void };
  etapasOps: { set: (data: EtapaTrabalho[]) => void };
  categoriasRef: React.MutableRefObject<Categoria[]>;
  pacotesRef: React.MutableRefObject<Pacote[]>;
  produtosRef: React.MutableRefObject<Produto[]>;
  etapasRef: React.MutableRefObject<EtapaTrabalho[]>;
}

export function useConfigurationRealtime({
  user,
  categoriasOps,
  pacotesOps,
  produtosOps,
  etapasOps,
  categoriasRef,
  pacotesRef,
  produtosRef,
  etapasRef,
}: UseConfigurationRealtimeProps) {
  const previousUserIdRef = useRef<string | null>(null);

  // ID-based suppression with TTL (prevents realtime loops)
  const suppressedIdsRef = useRef<Map<string, number>>(new Map());

  const suppress = useCallback((id: string) => {
    suppressedIdsRef.current.set(id, Date.now());
    if (CONFIGURATION_DEBUG) console.log(`🔕 Suppressing ID: ${id}`);
  }, []);

  const isSuppressed = useCallback((id: string): boolean => {
    const timestamp = suppressedIdsRef.current.get(id);
    if (!timestamp) return false;

    const elapsed = Date.now() - timestamp;
    const expired = elapsed > SUPPRESS_TTL;

    if (expired) {
      suppressedIdsRef.current.delete(id);
      return false;
    }

    if (CONFIGURATION_DEBUG)
      console.log(`🔕 ID ${id} is suppressed (${SUPPRESS_TTL - elapsed}ms remaining)`);
    return true;
  }, []);

  // Helper functions for idempotent realtime operations
  const upsertById = useCallback(<T extends { id: string }>(list: T[], item: T): T[] => {
    const exists = list.some((i) => i.id === item.id);
    if (exists) {
      return list.map((i) => (i.id === item.id ? item : i));
    }
    return [...list, item];
  }, []);

  const removeById = useCallback(<T extends { id: string }>(list: T[], id: string): T[] => {
    return list.filter((i) => i.id !== id);
  }, []);

  // ==================== REALTIME CALLBACKS ====================

  const categoriasCallbacks = useMemo(
    () => ({
      onInsert: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Categorias] Ignoring suppressed INSERT");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("➕ [Categorias] INSERT:", payload.new);
        const categoria: Categoria = {
          id: payload.new.id,
          nome: payload.new.nome,
          cor: payload.new.cor,
        };
        categoriasOps.set(upsertById(categoriasRef.current, categoria));
      },
      onUpdate: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Categorias] Ignoring suppressed UPDATE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("✏️ [Categorias] UPDATE:", payload.new);
        const categoria: Categoria = {
          id: payload.new.id,
          nome: payload.new.nome,
          cor: payload.new.cor,
        };
        categoriasOps.set(upsertById(categoriasRef.current, categoria));
      },
      onDelete: (payload: any) => {
        if (isSuppressed(payload.old.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Categorias] Ignoring suppressed DELETE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("🗑️ [Categorias] DELETE:", payload.old);
        categoriasOps.set(removeById(categoriasRef.current, payload.old.id));
      },
    }),
    [isSuppressed, upsertById, removeById, categoriasOps, categoriasRef],
  );

  const pacotesCallbacks = useMemo(
    () => ({
      onInsert: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Pacotes] Ignoring suppressed INSERT");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("➕ [Pacotes] INSERT:", payload.new);
        const pacote: Pacote = {
          id: payload.new.id,
          nome: payload.new.nome,
          valor_base: payload.new.valor_base,
          categoria_id: payload.new.categoria_id,
          valor_foto_extra: payload.new.valor_foto_extra,
          fotos_incluidas: payload.new.fotos_incluidas || 0,
          produtosIncluidos: payload.new.produtos_incluidos || [],
        };
        pacotesOps.set(upsertById(pacotesRef.current, pacote));
      },
      onUpdate: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Pacotes] Ignoring suppressed UPDATE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("✏️ [Pacotes] UPDATE:", payload.new);
        const pacote: Pacote = {
          id: payload.new.id,
          nome: payload.new.nome,
          valor_base: payload.new.valor_base,
          categoria_id: payload.new.categoria_id,
          valor_foto_extra: payload.new.valor_foto_extra,
          fotos_incluidas: payload.new.fotos_incluidas || 0,
          produtosIncluidos: payload.new.produtos_incluidos || [],
        };
        pacotesOps.set(upsertById(pacotesRef.current, pacote));
      },
      onDelete: (payload: any) => {
        if (isSuppressed(payload.old.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Pacotes] Ignoring suppressed DELETE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("🗑️ [Pacotes] DELETE:", payload.old);
        pacotesOps.set(removeById(pacotesRef.current, payload.old.id));
      },
    }),
    [isSuppressed, upsertById, removeById, pacotesOps, pacotesRef],
  );

  const produtosCallbacks = useMemo(
    () => ({
      onInsert: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Produtos] Ignoring suppressed INSERT");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("➕ [Produtos] INSERT:", payload.new);
        const produto: Produto = {
          id: payload.new.id,
          nome: payload.new.nome,
          preco_custo: payload.new.preco_custo,
          preco_venda: payload.new.preco_venda,
          favorito: Boolean(payload.new.favorito),
          favorited_at: payload.new.favorited_at ?? null,
        };
        produtosOps.set(upsertById(produtosRef.current, produto));
      },
      onUpdate: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Produtos] Ignoring suppressed UPDATE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("✏️ [Produtos] UPDATE:", payload.new);
        const produto: Produto = {
          id: payload.new.id,
          nome: payload.new.nome,
          preco_custo: payload.new.preco_custo,
          preco_venda: payload.new.preco_venda,
          favorito: Boolean(payload.new.favorito),
          favorited_at: payload.new.favorited_at ?? null,
        };
        produtosOps.set(upsertById(produtosRef.current, produto));
      },
      onDelete: (payload: any) => {
        if (isSuppressed(payload.old.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Produtos] Ignoring suppressed DELETE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("🗑️ [Produtos] DELETE:", payload.old);
        produtosOps.set(removeById(produtosRef.current, payload.old.id));
      },
    }),
    [isSuppressed, upsertById, removeById, produtosOps, produtosRef],
  );

  const etapasCallbacks = useMemo(
    () => ({
      onInsert: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Etapas] Ignoring suppressed INSERT");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("➕ [Etapas] INSERT:", payload.new);
        const etapa: EtapaTrabalho = {
          id: payload.new.id,
          nome: payload.new.nome,
          cor: payload.new.cor,
          ordem: payload.new.ordem,
        };
        etapasOps.set(upsertById(etapasRef.current, etapa).sort((a, b) => a.ordem - b.ordem));
      },
      onUpdate: (payload: any) => {
        if (isSuppressed(payload.new.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Etapas] Ignoring suppressed UPDATE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("✏️ [Etapas] UPDATE:", payload.new);
        const etapa: EtapaTrabalho = {
          id: payload.new.id,
          nome: payload.new.nome,
          cor: payload.new.cor,
          ordem: payload.new.ordem,
        };
        etapasOps.set(upsertById(etapasRef.current, etapa).sort((a, b) => a.ordem - b.ordem));
      },
      onDelete: (payload: any) => {
        if (isSuppressed(payload.old.id)) {
          if (CONFIGURATION_DEBUG) console.log("🔕 [Etapas] Ignoring suppressed DELETE");
          return;
        }
        if (CONFIGURATION_DEBUG) console.log("🗑️ [Etapas] DELETE:", payload.old);
        etapasOps.set(removeById(etapasRef.current, payload.old.id));
      },
    }),
    [isSuppressed, upsertById, removeById, etapasOps, etapasRef],
  );

  // Setup realtime subscriptions (stable callbacks)
  useSupabaseRealtime("categorias", categoriasCallbacks, true);
  useSupabaseRealtime("pacotes", pacotesCallbacks, true);
  useSupabaseRealtime("produtos", produtosCallbacks, true);
  useSupabaseRealtime("etapas_trabalho", etapasCallbacks, true);

  // ==================== INITIAL DATA LOAD (reacts to auth) ====================

  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;

    // Se user não mudou, não recarregar
    if (currentUserId === previousUserId) return;

    previousUserIdRef.current = currentUserId;

    // Logout: limpar estado e realtime
    if (!currentUserId) {
      console.log("🔧 [ConfigurationProvider] User logged out — clearing state and realtime");
      categoriasOps.set([]);
      pacotesOps.set([]);
      produtosOps.set([]);
      etapasOps.set([]);
      realtimeSubscriptionManager.cleanupAll();
      return;
    }

    // Login/re-login: recarregar dados
    const loadInitialData = async () => {
      try {
        console.log("📥 [ConfigurationProvider] Loading data for user:", currentUserId);

        await configurationService.initialize();

        const [cats, pacs, prods, steps] = await Promise.all([
          configurationService.loadCategoriasAsync(),
          configurationService.loadPacotesAsync(),
          configurationService.loadProdutosAsync(),
          configurationService.loadEtapasAsync(),
        ]);

        categoriasOps.set(cats);
        pacotesOps.set(pacs);
        produtosOps.set(prods);
        etapasOps.set(steps);

        console.log("✅ [ConfigurationProvider] Data loaded:", {
          categorias: cats.length,
          pacotes: pacs.length,
          produtos: prods.length,
          etapas: steps.length,
        });
      } catch (error) {
        console.error("❌ [ConfigurationProvider] Error loading initial data:", error);
      }
    };

    loadInitialData();
  }, [user?.id, categoriasOps, pacotesOps, produtosOps, etapasOps]);

  return {
    suppress,
    isSuppressed,
  };
}
