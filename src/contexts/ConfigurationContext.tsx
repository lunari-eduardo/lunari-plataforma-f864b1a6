import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { configurationService } from '@/services/ConfigurationService';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { useOptimisticConfiguration } from '@/hooks/useOptimisticConfiguration';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeSubscriptionManager } from '@/services/RealtimeSubscriptionManager';
import { toast } from 'sonner';
import type { Categoria, Pacote, Produto, EtapaTrabalho } from '@/types/configuration';

const CONFIGURATION_DEBUG = false;

interface ConfigurationContextType {
  // State
  categorias: Categoria[];
  pacotes: Pacote[];
  produtos: Produto[];
  etapas: EtapaTrabalho[];
  
  // Loading states
  isLoadingCategorias: boolean;
  isLoadingPacotes: boolean;
  isLoadingProdutos: boolean;
  isLoadingEtapas: boolean;
  isLoading: boolean;
  
  // Operations - matching ConfigurationActions interface
  adicionarCategoria: (categoria: Omit<Categoria, 'id'>) => void;
  atualizarCategoria: (id: string, dados: Partial<Categoria>) => Promise<void>;
  removerCategoria: (id: string) => Promise<boolean>;
  
  adicionarPacote: (pacote: Omit<Pacote, 'id'>) => void;
  atualizarPacote: (id: string, dados: Partial<Pacote>) => Promise<void>;
  removerPacote: (id: string) => Promise<boolean>;
  
  adicionarProduto: (produto: Omit<Produto, 'id'>) => void;
  atualizarProduto: (id: string, dados: Partial<Produto>) => Promise<void>;
  removerProduto: (id: string) => Promise<boolean>;
  
  adicionarEtapa: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  atualizarEtapa: (id: string, dados: Partial<EtapaTrabalho>) => Promise<void>;
  removerEtapa: (id: string) => Promise<boolean>;
  moverEtapa: (id: string, direcao: 'cima' | 'baixo') => void;
}

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

export const useConfigurationContext = () => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfigurationContext must be used within ConfigurationProvider');
  }
  return context;
};

export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

  // Optimistic state management - array destructuring [state, operations]
  const [categoriasState, categoriasOps] = useOptimisticConfiguration<Categoria>([]);
  const [pacotesState, pacotesOps] = useOptimisticConfiguration<Pacote>([]);
  const [produtosState, produtosOps] = useOptimisticConfiguration<Produto>([]);
  const [etapasState, etapasOps] = useOptimisticConfiguration<EtapaTrabalho>([]);

  // Refs to store current state (prevents callback recreation)
  const categoriasRef = useRef(categoriasState.data);
  const pacotesRef = useRef(pacotesState.data);
  const produtosRef = useRef(produtosState.data);
  const etapasRef = useRef(etapasState.data);

  // Update refs when state changes
  useEffect(() => { categoriasRef.current = categoriasState.data; }, [categoriasState.data]);
  useEffect(() => { pacotesRef.current = pacotesState.data; }, [pacotesState.data]);
  useEffect(() => { produtosRef.current = produtosState.data; }, [produtosState.data]);
  useEffect(() => { etapasRef.current = etapasState.data; }, [etapasState.data]);

  // ID-based suppression with TTL (prevents realtime loops)
  const suppressedIdsRef = useRef<Map<string, number>>(new Map());
  const SUPPRESS_TTL = 3000; // 3 seconds
  
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
    
    if (CONFIGURATION_DEBUG) console.log(`🔕 ID ${id} is suppressed (${SUPPRESS_TTL - elapsed}ms remaining)`);
    return true;
  }, []);

  // Helper functions for idempotent realtime operations
  const upsertById = useCallback(<T extends { id: string }>(list: T[], item: T): T[] => {
    const exists = list.some(i => i.id === item.id);
    if (exists) {
      return list.map(i => i.id === item.id ? item : i);
    }
    return [...list, item];
  }, []);

  const removeById = useCallback(<T extends { id: string }>(list: T[], id: string): T[] => {
    return list.filter(i => i.id !== id);
  }, []);

  // ==================== REALTIME CALLBACKS ====================
  
  const categoriasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring suppressed INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Categorias] INSERT:', payload.new);
      const categoria: Categoria = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor
      };
      categoriasOps.set(upsertById(categoriasRef.current, categoria));
    },
    onUpdate: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring suppressed UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Categorias] UPDATE:', payload.new);
      const categoria: Categoria = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor
      };
      categoriasOps.set(upsertById(categoriasRef.current, categoria));
    },
    onDelete: (payload: any) => {
      if (isSuppressed(payload.old.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring suppressed DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Categorias] DELETE:', payload.old);
      categoriasOps.set(removeById(categoriasRef.current, payload.old.id));
    }
  }), [isSuppressed, upsertById, removeById]); // Empty deps - callbacks are stable, use refs internally

  const pacotesCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring suppressed INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Pacotes] INSERT:', payload.new);
      const pacote: Pacote = {
        id: payload.new.id,
        nome: payload.new.nome,
        valor_base: payload.new.valor_base,
        categoria_id: payload.new.categoria_id,
        valor_foto_extra: payload.new.valor_foto_extra,
        fotos_incluidas: payload.new.fotos_incluidas || 0,
        produtosIncluidos: payload.new.produtos_incluidos || []
      };
      pacotesOps.set(upsertById(pacotesRef.current, pacote));
    },
    onUpdate: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring suppressed UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Pacotes] UPDATE:', payload.new);
      const pacote: Pacote = {
        id: payload.new.id,
        nome: payload.new.nome,
        valor_base: payload.new.valor_base,
        categoria_id: payload.new.categoria_id,
        valor_foto_extra: payload.new.valor_foto_extra,
        fotos_incluidas: payload.new.fotos_incluidas || 0,
        produtosIncluidos: payload.new.produtos_incluidos || []
      };
      pacotesOps.set(upsertById(pacotesRef.current, pacote));
    },
    onDelete: (payload: any) => {
      if (isSuppressed(payload.old.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring suppressed DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Pacotes] DELETE:', payload.old);
      pacotesOps.set(removeById(pacotesRef.current, payload.old.id));
    }
  }), [isSuppressed, upsertById, removeById]);

  const produtosCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring suppressed INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Produtos] INSERT:', payload.new);
      const produto: Produto = {
        id: payload.new.id,
        nome: payload.new.nome,
        preco_custo: payload.new.preco_custo,
        preco_venda: payload.new.preco_venda
      };
      produtosOps.set(upsertById(produtosRef.current, produto));
    },
    onUpdate: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring suppressed UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Produtos] UPDATE:', payload.new);
      const produto: Produto = {
        id: payload.new.id,
        nome: payload.new.nome,
        preco_custo: payload.new.preco_custo,
        preco_venda: payload.new.preco_venda
      };
      produtosOps.set(upsertById(produtosRef.current, produto));
    },
    onDelete: (payload: any) => {
      if (isSuppressed(payload.old.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring suppressed DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Produtos] DELETE:', payload.old);
      produtosOps.set(removeById(produtosRef.current, payload.old.id));
    }
  }), [isSuppressed, upsertById, removeById]);

  const etapasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring suppressed INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Etapas] INSERT:', payload.new);
      const etapa: EtapaTrabalho = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor,
        ordem: payload.new.ordem
      };
      etapasOps.set(upsertById(etapasRef.current, etapa).sort((a, b) => a.ordem - b.ordem));
    },
    onUpdate: (payload: any) => {
      if (isSuppressed(payload.new.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring suppressed UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Etapas] UPDATE:', payload.new);
      const etapa: EtapaTrabalho = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor,
        ordem: payload.new.ordem
      };
      etapasOps.set(upsertById(etapasRef.current, etapa).sort((a, b) => a.ordem - b.ordem));
    },
    onDelete: (payload: any) => {
      if (isSuppressed(payload.old.id)) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring suppressed DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Etapas] DELETE:', payload.old);
      etapasOps.set(removeById(etapasRef.current, payload.old.id));
    }
  }), [isSuppressed, upsertById, removeById]);

  // Setup realtime subscriptions (stable callbacks)
  useSupabaseRealtime('categorias', categoriasCallbacks, true);
  useSupabaseRealtime('pacotes', pacotesCallbacks, true);
  useSupabaseRealtime('produtos', produtosCallbacks, true);
  useSupabaseRealtime('etapas_trabalho', etapasCallbacks, true);

  // ==================== INITIAL DATA LOAD (reacts to auth) ====================
  
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    
    // Se user não mudou, não recarregar
    if (currentUserId === previousUserId) return;
    
    previousUserIdRef.current = currentUserId;
    
    // Logout: limpar estado e realtime
    if (!currentUserId) {
      console.log('🔧 [ConfigurationProvider] User logged out — clearing state and realtime');
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
        console.log('📥 [ConfigurationProvider] Loading data for user:', currentUserId);
        
        await configurationService.initialize();
        
        const [cats, pacs, prods, steps] = await Promise.all([
          configurationService.loadCategoriasAsync(),
          configurationService.loadPacotesAsync(),
          configurationService.loadProdutosAsync(),
          configurationService.loadEtapasAsync()
        ]);

        categoriasOps.set(cats);
        pacotesOps.set(pacs);
        produtosOps.set(prods);
        etapasOps.set(steps);
        
        console.log('✅ [ConfigurationProvider] Data loaded:', {
          categorias: cats.length,
          pacotes: pacs.length,
          produtos: prods.length,
          etapas: steps.length
        });
      } catch (error) {
        console.error('❌ [ConfigurationProvider] Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [user?.id]);

  // ==================== OPERATIONS WITH OWN-UPDATE FLAG ====================
  
  const adicionarCategoria = useCallback(async (categoria: Omit<Categoria, 'id'>) => {
    if (!categoria.nome.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }
    
    console.log('📋 [adicionarCategoria] Iniciando...', { categoria, currentCount: categoriasRef.current.length });
    
    const newCategoria: Categoria = { id: crypto.randomUUID(), ...categoria };
    suppress(newCategoria.id);
    
    console.log('📋 [adicionarCategoria] Nova categoria criada:', newCategoria);
    
    await categoriasOps.add(
      newCategoria,
      async () => {
        console.log('📋 [adicionarCategoria] Salvando no Supabase...');
        await configurationService.saveCategorias([newCategoria]);
        console.log('📋 [adicionarCategoria] Salvo com sucesso!');
      }
    );
  }, [suppress]);

  const atualizarCategoria = useCallback(async (id: string, dados: Partial<Categoria>): Promise<void> => {
    // Capturar o item atual ANTES do update otimista
    const currentItem = categoriasRef.current.find(c => c.id === id);
    if (!currentItem) {
      console.error('[atualizarCategoria] Item not found:', id);
      toast.error('Categoria não encontrada');
      throw new Error('Categoria não encontrada');
    }
    
    suppress(id);
    
    return categoriasOps.update(
      id,
      dados,
      async () => {
        // Use the specific update method that persists to Supabase
        await configurationService.updateCategoriaById(id, dados);
        console.log('✅ [atualizarCategoria] Salvo:', { id, dados });
      }
    );
  }, [suppress]);

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    console.log('🗑️ [removerCategoria] Iniciando exclusão', id);
    
    if (!configurationService.canDeleteCategoria(id, pacotesRef.current)) {
      const pacotesVinculados = pacotesRef.current
        .filter(p => p.categoria_id === id)
        .map(p => p.nome)
        .join(', ');
      
      toast.error(
        `Não é possível excluir esta categoria. Ela está sendo usada pelos pacotes: ${pacotesVinculados}`
      );
      return false;
    }

    const existsLocally = categoriasRef.current.some(c => c.id === id);
    
    if (existsLocally) {
      suppress(id);
      try {
        await categoriasOps.remove(
          id,
          async () => {
            await configurationService.deleteCategoriaById(id);
          }
        );
      } catch (error) {
        console.error('❌ [removerCategoria] Erro ao excluir', error);
        toast.error('Erro ao excluir categoria. Alteração foi revertida.');
        return false;
      }
    } else {
      try {
        await configurationService.deleteCategoriaById(id);
      } catch (error) {
        console.error('❌ [removerCategoria] Erro ao excluir diretamente', error);
        toast.error('Erro ao excluir categoria.');
        return false;
      }
    }
    
    toast.success('Categoria excluída com sucesso');
    console.log('✅ [removerCategoria] Exclusão confirmada', id);
    return true;
  }, [categoriasOps, suppress]);

  const canDeleteCategoria = useCallback((id: string) => {
    return configurationService.canDeleteCategoria(id, pacotesRef.current);
  }, []);

  const adicionarPacote = useCallback(async (pacote: Omit<Pacote, 'id'>) => {
    if (!pacote.nome.trim()) {
      toast.error('Nome do pacote é obrigatório');
      return;
    }
    
    console.log('📦 [adicionarPacote] Iniciando...', { pacote, currentCount: pacotesRef.current.length });
    
    const newPacote: Pacote = { 
      id: crypto.randomUUID(), 
      ...pacote
    };
    suppress(newPacote.id);
    
    console.log('📦 [adicionarPacote] Novo pacote criado:', newPacote);
    
    await pacotesOps.add(
      newPacote,
      async () => {
        console.log('📦 [adicionarPacote] Salvando no Supabase...');
        await configurationService.savePacotes([newPacote]);
        console.log('📦 [adicionarPacote] Salvo com sucesso!');
      }
    );
  }, [suppress]);

  const atualizarPacote = useCallback(async (id: string, dados: Partial<Pacote>): Promise<void> => {
    // Capturar o item atual ANTES do update otimista
    const currentItem = pacotesRef.current.find(p => p.id === id);
    if (!currentItem) {
      console.error('[atualizarPacote] Item not found:', id);
      toast.error('Pacote não encontrado');
      throw new Error('Pacote não encontrado');
    }
    
    const updatedItem = { ...currentItem, ...dados };
    
    return pacotesOps.update(
      id,
      dados,
      async () => {
        // Usar o item já mesclado, não reprocessar do ref
        await configurationService.savePacotes([updatedItem]);
        console.log('✅ [atualizarPacote] Salvo:', updatedItem);
      }
    );
  }, [suppress]);

  const removerPacote = useCallback(async (id: string): Promise<boolean> => {
    console.log('🗑️ [removerPacote] Iniciando exclusão', id);
    
    const existsLocally = pacotesRef.current.some(p => p.id === id);
    
    if (existsLocally) {
      suppress(id);
      try {
        await pacotesOps.remove(
          id,
          async () => {
            await configurationService.deletePacoteById(id);
          }
        );
      } catch (error) {
        console.error('❌ [removerPacote] Erro ao excluir', error);
        toast.error('Erro ao excluir pacote. Alteração foi revertida.');
        return false;
      }
    } else {
      try {
        await configurationService.deletePacoteById(id);
      } catch (error) {
        console.error('❌ [removerPacote] Erro ao excluir diretamente', error);
        toast.error('Erro ao excluir pacote.');
        return false;
      }
    }
    
    toast.success('Pacote excluído com sucesso');
    console.log('✅ [removerPacote] Exclusão confirmada', id);
    return true;
  }, [pacotesOps, suppress]);

  const adicionarProduto = useCallback(async (produto: Omit<Produto, 'id'>) => {
    if (!produto.nome.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }
    
    console.log('🛍️ [adicionarProduto] Iniciando...', { produto, currentCount: produtosRef.current.length });
    
    const newProduto: Produto = { id: crypto.randomUUID(), ...produto };
    suppress(newProduto.id);
    
    console.log('🛍️ [adicionarProduto] Novo produto criado:', newProduto);
    
    await produtosOps.add(
      newProduto,
      async () => {
        console.log('🛍️ [adicionarProduto] Salvando no Supabase...');
        await configurationService.saveProdutos([newProduto]);
        console.log('🛍️ [adicionarProduto] Salvo com sucesso!');
      }
    );
  }, [suppress]);

  const atualizarProduto = useCallback(async (id: string, dados: Partial<Produto>): Promise<void> => {
    // Capturar o item atual ANTES do update otimista
    const currentItem = produtosRef.current.find(p => p.id === id);
    if (!currentItem) {
      console.error('[atualizarProduto] Item not found:', id);
      toast.error('Produto não encontrado');
      throw new Error('Produto não encontrado');
    }
    
    const updatedItem = { ...currentItem, ...dados };
    
    return produtosOps.update(
      id,
      dados,
      async () => {
        // Usar o item já mesclado, não reprocessar do ref
        await configurationService.saveProdutos([updatedItem]);
        console.log('✅ [atualizarProduto] Salvo:', updatedItem);
      }
    );
  }, [suppress]);

  const removerProduto = useCallback(async (id: string): Promise<boolean> => {
    console.log('🗑️ [removerProduto] Iniciando exclusão', id);
    
    if (!configurationService.canDeleteProduto(id, pacotesRef.current)) {
      const pacotesVinculados = pacotesRef.current
        .filter(p => p.produtosIncluidos?.some(pid => pid.produtoId === id))
        .map(p => p.nome)
        .join(', ');
      
      toast.error(
        `Não é possível excluir este produto. Ele está sendo usado pelos pacotes: ${pacotesVinculados}`
      );
      return false;
    }

    const existsLocally = produtosRef.current.some(p => p.id === id);
    
    if (existsLocally) {
      suppress(id);
      try {
        await produtosOps.remove(
          id,
          async () => {
            await configurationService.deleteProdutoById(id);
          }
        );
      } catch (error) {
        console.error('❌ [removerProduto] Erro ao excluir', error);
        toast.error('Erro ao excluir produto. Alteração foi revertida.');
        return false;
      }
    } else {
      try {
        await configurationService.deleteProdutoById(id);
      } catch (error) {
        console.error('❌ [removerProduto] Erro ao excluir diretamente', error);
        toast.error('Erro ao excluir produto.');
        return false;
      }
    }
    
    toast.success('Produto excluído com sucesso');
    console.log('✅ [removerProduto] Exclusão confirmada', id);
    return true;
  }, [produtosOps, suppress]);

  const canDeleteProduto = useCallback((id: string) => {
    return configurationService.canDeleteProduto(id, pacotesRef.current);
  }, []);

  const adicionarEtapa = useCallback(async (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => {
    if (!etapa.nome.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }
    
    console.log('📋 [adicionarEtapa] Iniciando...', { etapa, currentCount: etapasRef.current.length });
    
    const ordem = etapasRef.current.length > 0 
      ? Math.max(...etapasRef.current.map(e => e.ordem)) + 1 
      : 1;
    const newEtapa: EtapaTrabalho = { id: crypto.randomUUID(), ...etapa, ordem };
    suppress(newEtapa.id);
    
    console.log('📋 [adicionarEtapa] Nova etapa criada:', newEtapa);
    
    await etapasOps.add(
      newEtapa,
      async () => {
        console.log('📋 [adicionarEtapa] Salvando no Supabase...');
        await configurationService.saveEtapas([newEtapa]);
        console.log('📋 [adicionarEtapa] Salvo com sucesso!');
      }
    );
    
    console.log('📋 [adicionarEtapa] Concluído');
  }, [suppress]);

  const atualizarEtapa = useCallback(async (id: string, dados: Partial<EtapaTrabalho>): Promise<void> => {
    // Capturar o item atual ANTES do update otimista
    const currentItem = etapasRef.current.find(e => e.id === id);
    if (!currentItem) {
      console.error('[atualizarEtapa] Item not found:', id);
      toast.error('Etapa não encontrada');
      throw new Error('Etapa não encontrada');
    }
    
    const updatedItem = { ...currentItem, ...dados };
    
    return etapasOps.update(
      id,
      dados,
      async () => {
        // Usar o item já mesclado, não reprocessar do ref
        await configurationService.saveEtapas([updatedItem]);
        console.log('✅ [atualizarEtapa] Salvo:', updatedItem);
      }
    );
  }, [suppress]);

  const removerEtapa = useCallback(async (id: string): Promise<boolean> => {
    console.log('🗑️ [removerEtapa] Iniciando exclusão', id);
    
    const existsLocally = etapasRef.current.some(e => e.id === id);
    
    if (existsLocally) {
      suppress(id);
      try {
        await etapasOps.remove(
          id,
          async () => {
            await configurationService.deleteEtapaById(id);
          }
        );
      } catch (error) {
        console.error('❌ [removerEtapa] Erro ao excluir', error);
        toast.error('Erro ao excluir etapa. Alteração foi revertida.');
        return false;
      }
    } else {
      try {
        await configurationService.deleteEtapaById(id);
      } catch (error) {
        console.error('❌ [removerEtapa] Erro ao excluir diretamente', error);
        toast.error('Erro ao excluir etapa.');
        return false;
      }
    }
    
    toast.success('Etapa excluída com sucesso');
    console.log('✅ [removerEtapa] Exclusão confirmada', id);
    return true;
  }, [etapasOps, suppress]);

  const moverEtapa = useCallback(async (id: string, direcao: 'cima' | 'baixo') => {
    // Reordenar pelo índice e RENORMALIZAR ordens (1..N) para evitar duplicatas
    const sorted = [...etapasRef.current].sort((a, b) => a.ordem - b.ordem);
    const currentIndex = sorted.findIndex(e => e.id === id);
    if (currentIndex === -1) return;

    const newIndex = direcao === 'cima' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;

    // Move o item no array ordenado
    const reordered = [...sorted];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Renumera para ordens únicas e sequenciais
    const updated = reordered.map((e, idx) => ({ ...e, ordem: idx + 1 }));

    // Suprimir todos IDs para evitar loops de realtime enquanto persistimos
    updated.forEach(e => suppress(e.id));

    // Atualização otimista
    etapasOps.set(updated);

    try {
      await configurationService.saveEtapas(updated);
    } catch (error) {
      console.error('❌ [moverEtapa] Erro ao salvar reordenação', error);
      toast.error('Erro ao reordenar etapas. Alteração pode não ter sido salva.');
      try {
        const reloaded = await configurationService.loadEtapasAsync();
        etapasOps.set(reloaded);
      } catch (reloadError) {
        console.error('❌ [moverEtapa] Erro ao recarregar etapas', reloadError);
      }
    }
  }, [suppress]);

  // ==================== COMPUTED VALUES ====================
  
  const isLoading = 
    categoriasState.syncing || 
    pacotesState.syncing || 
    produtosState.syncing || 
    etapasState.syncing;

  const value: ConfigurationContextType = {
    // State
    categorias: categoriasState.data,
    pacotes: pacotesState.data,
    produtos: produtosState.data,
    etapas: etapasState.data,
    
    // Loading
    isLoadingCategorias: categoriasState.syncing,
    isLoadingPacotes: pacotesState.syncing,
    isLoadingProdutos: produtosState.syncing,
    isLoadingEtapas: etapasState.syncing,
    isLoading,
    
    // Operations
    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,
    adicionarPacote,
    atualizarPacote,
    removerPacote,
    adicionarProduto,
    atualizarProduto,
    removerProduto,
    adicionarEtapa,
    atualizarEtapa,
    removerEtapa,
    moverEtapa,
  };

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
};
