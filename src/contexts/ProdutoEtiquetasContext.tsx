/**
 * Contexto único para etiquetas de produtos.
 * Centraliza state + assinatura realtime + mutações otimistas.
 * Substitui múltiplas instâncias do antigo hook (que mantinham state divergente).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ProdutoEtiqueta } from '@/types/configuration';

interface LinkRow {
  produto_id: string;
  etiqueta_id: string;
}

export interface ProdutoEtiquetasContextValue {
  etiquetas: ProdutoEtiqueta[];
  linksByProduto: Map<string, string[]>;
  contagemPorEtiqueta: Map<string, number>;
  isLoading: boolean;
  criarEtiqueta: (nome: string, cor: string) => Promise<ProdutoEtiqueta | null>;
  renomearEtiqueta: (id: string, nome: string) => Promise<void>;
  mudarCorEtiqueta: (id: string, cor: string) => Promise<void>;
  removerEtiqueta: (id: string) => Promise<void>;
  setProdutoEtiquetas: (produtoId: string, etiquetaIds: string[]) => Promise<void>;
}

const Ctx = createContext<ProdutoEtiquetasContextValue | null>(null);

function sortByNome(list: ProdutoEtiqueta[]): ProdutoEtiqueta[] {
  return [...list].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

export function ProdutoEtiquetasProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [etiquetas, setEtiquetas] = useState<ProdutoEtiqueta[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initializedFor = useRef<string | null>(null);

  // Carga inicial
  useEffect(() => {
    if (!userId) {
      setEtiquetas([]);
      setLinks([]);
      setIsLoading(false);
      initializedFor.current = null;
      return;
    }
    if (initializedFor.current === userId) return;
    initializedFor.current = userId;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [{ data: tagsData }, { data: linksData }] = await Promise.all([
          (supabase as any).from('produto_etiquetas').select('*').eq('user_id', userId).order('nome'),
          (supabase as any).from('produto_etiqueta_links').select('produto_id, etiqueta_id').eq('user_id', userId),
        ]);
        if (cancelled) return;
        setEtiquetas(sortByNome((tagsData ?? []).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          cor: t.cor,
          ordem: t.ordem ?? 0,
        }))));
        setLinks((linksData ?? []) as LinkRow[]);
      } catch (e) {
        console.error('[ProdutoEtiquetas] load error', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Realtime — etiquetas
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`produto_etiquetas:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produto_etiquetas', filter: `user_id=eq.${userId}` }, (payload: any) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const t = payload.new;
          const novo: ProdutoEtiqueta = { id: t.id, nome: t.nome, cor: t.cor, ordem: t.ordem ?? 0 };
          setEtiquetas(prev => {
            const exists = prev.some(p => p.id === novo.id);
            const next = exists ? prev.map(p => p.id === novo.id ? novo : p) : [...prev, novo];
            return sortByNome(next);
          });
        } else if (payload.eventType === 'DELETE') {
          setEtiquetas(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Realtime — links
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`produto_etiqueta_links:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produto_etiqueta_links', filter: `user_id=eq.${userId}` }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const row = { produto_id: payload.new.produto_id, etiqueta_id: payload.new.etiqueta_id };
          setLinks(prev => prev.some(l => l.produto_id === row.produto_id && l.etiqueta_id === row.etiqueta_id) ? prev : [...prev, row]);
        } else if (payload.eventType === 'DELETE') {
          const row = { produto_id: payload.old.produto_id, etiqueta_id: payload.old.etiqueta_id };
          setLinks(prev => prev.filter(l => !(l.produto_id === row.produto_id && l.etiqueta_id === row.etiqueta_id)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const linksByProduto = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      const arr = m.get(l.produto_id) ?? [];
      arr.push(l.etiqueta_id);
      m.set(l.produto_id, arr);
    }
    return m;
  }, [links]);

  const contagemPorEtiqueta = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.etiqueta_id, (m.get(l.etiqueta_id) ?? 0) + 1);
    return m;
  }, [links]);

  // ===== Mutações com otimismo local =====

  const criarEtiqueta = useCallback(async (nome: string, cor: string): Promise<ProdutoEtiqueta | null> => {
    if (!userId) return null;
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      toast.error('Informe o nome da etiqueta');
      return null;
    }
    if (etiquetas.some(e => e.nome.toLowerCase() === nomeTrim.toLowerCase())) {
      toast.error('Já existe uma etiqueta com esse nome');
      return null;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: ProdutoEtiqueta = { id: tempId, nome: nomeTrim, cor, ordem: etiquetas.length };
    setEtiquetas(prev => sortByNome([...prev, optimistic]));

    const { data, error } = await (supabase as any)
      .from('produto_etiquetas')
      .insert({ nome: nomeTrim, cor, user_id: userId })
      .select()
      .single();

    if (error) {
      setEtiquetas(prev => prev.filter(e => e.id !== tempId));
      toast.error(error.code === '23505' ? 'Já existe uma etiqueta com esse nome' : 'Erro ao criar etiqueta');
      return null;
    }

    const real: ProdutoEtiqueta = { id: data.id, nome: data.nome, cor: data.cor, ordem: data.ordem ?? 0 };
    setEtiquetas(prev => {
      const semTemp = prev.filter(e => e.id !== tempId && e.id !== real.id);
      return sortByNome([...semTemp, real]);
    });
    return real;
  }, [userId, etiquetas]);

  const renomearEtiqueta = useCallback(async (id: string, nome: string) => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;

    let snapshot: ProdutoEtiqueta | undefined;
    setEtiquetas(prev => {
      snapshot = prev.find(e => e.id === id);
      return sortByNome(prev.map(e => e.id === id ? { ...e, nome: nomeTrim } : e));
    });

    const { error } = await (supabase as any)
      .from('produto_etiquetas').update({ nome: nomeTrim }).eq('id', id);

    if (error) {
      if (snapshot) {
        setEtiquetas(prev => sortByNome(prev.map(e => e.id === id ? snapshot! : e)));
      }
      toast.error(error.code === '23505' ? 'Já existe uma etiqueta com esse nome' : 'Erro ao renomear etiqueta');
    }
  }, []);

  const mudarCorEtiqueta = useCallback(async (id: string, cor: string) => {
    let snapshot: ProdutoEtiqueta | undefined;
    setEtiquetas(prev => {
      snapshot = prev.find(e => e.id === id);
      return prev.map(e => e.id === id ? { ...e, cor } : e);
    });

    const { error } = await (supabase as any)
      .from('produto_etiquetas').update({ cor }).eq('id', id);

    if (error) {
      if (snapshot) setEtiquetas(prev => prev.map(e => e.id === id ? snapshot! : e));
      toast.error('Erro ao atualizar cor');
    }
  }, []);

  const removerEtiqueta = useCallback(async (id: string) => {
    let snapshotEt: ProdutoEtiqueta | undefined;
    let snapshotLinks: LinkRow[] = [];

    setEtiquetas(prev => {
      snapshotEt = prev.find(e => e.id === id);
      return prev.filter(e => e.id !== id);
    });
    setLinks(prev => {
      snapshotLinks = prev.filter(l => l.etiqueta_id === id);
      return prev.filter(l => l.etiqueta_id !== id);
    });

    const { error } = await (supabase as any)
      .from('produto_etiquetas').delete().eq('id', id);

    if (error) {
      if (snapshotEt) setEtiquetas(prev => sortByNome([...prev, snapshotEt!]));
      if (snapshotLinks.length > 0) setLinks(prev => [...prev, ...snapshotLinks]);
      toast.error('Erro ao remover etiqueta');
    }
  }, []);

  const setProdutoEtiquetas = useCallback(async (produtoId: string, etiquetaIds: string[]) => {
    if (!userId) return;
    const atuais = new Set(linksByProduto.get(produtoId) ?? []);
    const proximos = new Set(etiquetaIds);
    const aAdicionar = [...proximos].filter(id => !atuais.has(id));
    const aRemover = [...atuais].filter(id => !proximos.has(id));

    const ops: Promise<any>[] = [];
    if (aAdicionar.length > 0) {
      ops.push((supabase as any).from('produto_etiqueta_links').insert(
        aAdicionar.map(eid => ({ produto_id: produtoId, etiqueta_id: eid, user_id: userId }))
      ));
    }
    for (const eid of aRemover) {
      ops.push((supabase as any).from('produto_etiqueta_links')
        .delete().eq('produto_id', produtoId).eq('etiqueta_id', eid));
    }

    // otimismo local
    setLinks(prev => {
      const semRemovidos = prev.filter(l => !(l.produto_id === produtoId && aRemover.includes(l.etiqueta_id)));
      const novosLinks = aAdicionar.map(eid => ({ produto_id: produtoId, etiqueta_id: eid }));
      return [...semRemovidos, ...novosLinks];
    });

    const results = await Promise.allSettled(ops);
    const falhou = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any)?.error));
    if (falhou) toast.error('Algumas etiquetas não foram salvas');
  }, [userId, linksByProduto]);

  const value: ProdutoEtiquetasContextValue = {
    etiquetas,
    linksByProduto,
    contagemPorEtiqueta,
    isLoading,
    criarEtiqueta,
    renomearEtiqueta,
    mudarCorEtiqueta,
    removerEtiqueta,
    setProdutoEtiquetas,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProdutoEtiquetasContext(): ProdutoEtiquetasContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useProdutoEtiquetasContext deve ser usado dentro de <ProdutoEtiquetasProvider>');
  }
  return ctx;
}
