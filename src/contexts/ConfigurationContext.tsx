import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { configurationService } from '@/services/ConfigurationService';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { useOptimisticConfiguration } from '@/hooks/useOptimisticConfiguration';
import { toast } from 'sonner';
import type { Categoria, Pacote, Produto, EtapaTrabalho } from '@/types/configuration';

const CONFIGURATION_DEBUG = false;

// Singleton guard to prevent multiple initializations
let isInitialized = false;
let activeInstances = 0;

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
  atualizarCategoria: (id: string, dados: Partial<Categoria>) => void;
  removerCategoria: (id: string) => Promise<boolean>;
  
  adicionarPacote: (pacote: Omit<Pacote, 'id'>) => void;
  atualizarPacote: (id: string, dados: Partial<Pacote>) => void;
  removerPacote: (id: string) => Promise<boolean>;
  
  adicionarProduto: (produto: Omit<Produto, 'id'>) => void;
  atualizarProduto: (id: string, dados: Partial<Produto>) => void;
  removerProduto: (id: string) => Promise<boolean>;
  
  adicionarEtapa: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  atualizarEtapa: (id: string, dados: Partial<EtapaTrabalho>) => void;
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
  // Singleton guard
  useEffect(() => {
    activeInstances++;
    if (activeInstances > 1) {
      console.warn(`⚠️ Multiple ConfigurationProvider instances detected! Active: ${activeInstances}`);
    }
    if (CONFIGURATION_DEBUG) {
      console.log(`🔧 [ConfigurationProvider] Mounted (instance #${activeInstances})`);
    }
    
    return () => {
      activeInstances--;
      if (CONFIGURATION_DEBUG) {
        console.log(`🔧 [ConfigurationProvider] Unmounted (remaining: ${activeInstances})`);
      }
    };
  }, []);

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

  // Flag to ignore own updates (prevents loops)
  const isOwnUpdateRef = useRef(false);

  // ==================== REALTIME CALLBACKS ====================
  
  const categoriasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring own INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Categorias] INSERT:', payload.new);
      const categoria: Categoria = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor
      };
      categoriasOps.set([...categoriasRef.current, categoria]);
    },
    onUpdate: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring own UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Categorias] UPDATE:', payload.new);
      categoriasOps.set(
        categoriasRef.current.map(c => 
          c.id === payload.new.id 
            ? { id: payload.new.id, nome: payload.new.nome, cor: payload.new.cor }
            : c
        )
      );
    },
    onDelete: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Categorias] Ignoring own DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Categorias] DELETE:', payload.old);
      categoriasOps.set(
        categoriasRef.current.filter(c => c.id !== payload.old.id)
      );
    }
  }), []); // Empty deps - callbacks are stable, use refs internally

  const pacotesCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring own INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Pacotes] INSERT:', payload.new);
      const pacote: Pacote = {
        id: payload.new.id,
        nome: payload.new.nome,
        valor_base: payload.new.valor_base,
        categoria_id: payload.new.categoria_id,
        valor_foto_extra: payload.new.valor_foto_extra,
        produtosIncluidos: payload.new.produtos_incluidos || []
      };
      pacotesOps.set([...pacotesRef.current, pacote]);
    },
    onUpdate: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring own UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Pacotes] UPDATE:', payload.new);
      pacotesOps.set(
        pacotesRef.current.map(p =>
          p.id === payload.new.id
            ? {
                id: payload.new.id,
                nome: payload.new.nome,
                valor_base: payload.new.valor_base,
                categoria_id: payload.new.categoria_id,
                valor_foto_extra: payload.new.valor_foto_extra,
                produtosIncluidos: payload.new.produtos_incluidos || []
              }
            : p
        )
      );
    },
    onDelete: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Pacotes] Ignoring own DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Pacotes] DELETE:', payload.old);
      pacotesOps.set(
        pacotesRef.current.filter(p => p.id !== payload.old.id)
      );
    }
  }), []);

  const produtosCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring own INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Produtos] INSERT:', payload.new);
      const produto: Produto = {
        id: payload.new.id,
        nome: payload.new.nome,
        preco_custo: payload.new.preco_custo,
        preco_venda: payload.new.preco_venda
      };
      produtosOps.set([...produtosRef.current, produto]);
    },
    onUpdate: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring own UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Produtos] UPDATE:', payload.new);
      produtosOps.set(
        produtosRef.current.map(p =>
          p.id === payload.new.id
            ? { id: payload.new.id, nome: payload.new.nome, preco_custo: payload.new.preco_custo, preco_venda: payload.new.preco_venda }
            : p
        )
      );
    },
    onDelete: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Produtos] Ignoring own DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Produtos] DELETE:', payload.old);
      produtosOps.set(
        produtosRef.current.filter(p => p.id !== payload.old.id)
      );
    }
  }), []);

  const etapasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring own INSERT');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('➕ [Etapas] INSERT:', payload.new);
      const etapa: EtapaTrabalho = {
        id: payload.new.id,
        nome: payload.new.nome,
        cor: payload.new.cor,
        ordem: payload.new.ordem
      };
      etapasOps.set([...etapasRef.current, etapa].sort((a, b) => a.ordem - b.ordem));
    },
    onUpdate: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring own UPDATE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('✏️ [Etapas] UPDATE:', payload.new);
      etapasOps.set(
        etapasRef.current.map(e =>
          e.id === payload.new.id
            ? { id: payload.new.id, nome: payload.new.nome, cor: payload.new.cor, ordem: payload.new.ordem }
            : e
        ).sort((a, b) => a.ordem - b.ordem)
      );
    },
    onDelete: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (CONFIGURATION_DEBUG) console.log('🔕 [Etapas] Ignoring own DELETE');
        return;
      }
      if (CONFIGURATION_DEBUG) console.log('🗑️ [Etapas] DELETE:', payload.old);
      etapasOps.set(
        etapasRef.current.filter(e => e.id !== payload.old.id)
      );
    }
  }), []);

  // Setup realtime subscriptions (stable callbacks)
  useSupabaseRealtime('categorias', categoriasCallbacks, true);
  useSupabaseRealtime('pacotes', pacotesCallbacks, true);
  useSupabaseRealtime('produtos', produtosCallbacks, true);
  useSupabaseRealtime('etapas_trabalho', etapasCallbacks, true);

  // ==================== INITIAL DATA LOAD ====================
  
  useEffect(() => {
    if (isInitialized) {
      if (CONFIGURATION_DEBUG) console.log('⏭️ [ConfigurationProvider] Already initialized, skipping');
      return;
    }
    
    isInitialized = true;
    
    const loadInitialData = async () => {
      try {
        if (CONFIGURATION_DEBUG) console.log('📥 [ConfigurationProvider] Loading initial data...');
        
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
        
        if (CONFIGURATION_DEBUG) {
          console.log('✅ [ConfigurationProvider] Initial data loaded:', {
            categorias: cats.length,
            pacotes: pacs.length,
            produtos: prods.length,
            etapas: steps.length
          });
        }
      } catch (error) {
        console.error('❌ [ConfigurationProvider] Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  // ==================== OPERATIONS WITH OWN-UPDATE FLAG ====================
  
  const adicionarCategoria = useCallback(async (categoria: Omit<Categoria, 'id'>) => {
    if (!categoria.nome.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }
    
    console.log('📋 [adicionarCategoria] Iniciando...', { categoria, currentCount: categoriasRef.current.length });
    
    isOwnUpdateRef.current = true;
    const newCategoria: Categoria = { id: crypto.randomUUID(), ...categoria };
    
    console.log('📋 [adicionarCategoria] Nova categoria criada:', newCategoria);
    
    await categoriasOps.add(
      newCategoria,
      async () => {
        console.log('📋 [adicionarCategoria] Salvando no Supabase...');
        await configurationService.saveCategorias([newCategoria]);
        console.log('📋 [adicionarCategoria] Salvo com sucesso!');
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const atualizarCategoria = useCallback(async (id: string, dados: Partial<Categoria>) => {
    isOwnUpdateRef.current = true;
    
    await categoriasOps.update(
      id,
      dados,
      async () => {
        const updated = categoriasRef.current.map(c => c.id === id ? { ...c, ...dados } : c);
        await configurationService.saveCategorias(updated);
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    
    try {
      await categoriasOps.remove(
        id,
        async () => {
          await configurationService.deleteCategoriaById(id);
        }
      );
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return true;
    } catch (error) {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return false;
    }
  }, []);

  const canDeleteCategoria = useCallback((id: string) => {
    return configurationService.canDeleteCategoria(id, pacotesRef.current);
  }, []);

  const adicionarPacote = useCallback(async (pacote: Omit<Pacote, 'id'>) => {
    if (!pacote.nome.trim()) {
      toast.error('Nome do pacote é obrigatório');
      return;
    }
    
    console.log('📦 [adicionarPacote] Iniciando...', { pacote, currentCount: pacotesRef.current.length });
    
    isOwnUpdateRef.current = true;
    const newPacote: Pacote = { 
      id: crypto.randomUUID(), 
      ...pacote
    };
    
    console.log('📦 [adicionarPacote] Novo pacote criado:', newPacote);
    
    await pacotesOps.add(
      newPacote,
      async () => {
        console.log('📦 [adicionarPacote] Salvando no Supabase...');
        await configurationService.savePacotes([newPacote]);
        console.log('📦 [adicionarPacote] Salvo com sucesso!');
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const atualizarPacote = useCallback(async (id: string, dados: Partial<Pacote>) => {
    isOwnUpdateRef.current = true;
    
    await pacotesOps.update(
      id,
      dados,
      async () => {
        const updated = pacotesRef.current.map(p => 
          p.id === id ? { ...p, ...dados } : p
        );
        await configurationService.savePacotes(updated);
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const removerPacote = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    
    try {
      await pacotesOps.remove(
        id,
        async () => {
          await configurationService.deletePacoteById(id);
        }
      );
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return true;
    } catch (error) {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return false;
    }
  }, []);

  const adicionarProduto = useCallback(async (produto: Omit<Produto, 'id'>) => {
    if (!produto.nome.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }
    
    console.log('🛍️ [adicionarProduto] Iniciando...', { produto, currentCount: produtosRef.current.length });
    
    isOwnUpdateRef.current = true;
    const newProduto: Produto = { id: crypto.randomUUID(), ...produto };
    
    console.log('🛍️ [adicionarProduto] Novo produto criado:', newProduto);
    
    await produtosOps.add(
      newProduto,
      async () => {
        console.log('🛍️ [adicionarProduto] Salvando no Supabase...');
        await configurationService.saveProdutos([newProduto]);
        console.log('🛍️ [adicionarProduto] Salvo com sucesso!');
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const atualizarProduto = useCallback(async (id: string, dados: Partial<Produto>) => {
    isOwnUpdateRef.current = true;
    
    await produtosOps.update(
      id,
      dados,
      async () => {
        const updated = produtosRef.current.map(p => 
          p.id === id ? { ...p, ...dados } : p
        );
        await configurationService.saveProdutos(updated);
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const removerProduto = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    
    try {
      await produtosOps.remove(
        id,
        async () => {
          await configurationService.deleteProdutoById(id);
        }
      );
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return true;
    } catch (error) {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return false;
    }
  }, []);

  const canDeleteProduto = useCallback((id: string) => {
    return configurationService.canDeleteProduto(id, pacotesRef.current);
  }, []);

  const adicionarEtapa = useCallback(async (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => {
    if (!etapa.nome.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }
    
    console.log('📋 [adicionarEtapa] Iniciando...', { etapa, currentCount: etapasRef.current.length });
    
    isOwnUpdateRef.current = true;
    const ordem = etapasRef.current.length > 0 
      ? Math.max(...etapasRef.current.map(e => e.ordem)) + 1 
      : 1;
    const newEtapa: EtapaTrabalho = { id: crypto.randomUUID(), ...etapa, ordem };
    
    console.log('📋 [adicionarEtapa] Nova etapa criada:', newEtapa);
    
    await etapasOps.add(
      newEtapa,
      async () => {
        console.log('📋 [adicionarEtapa] Salvando no Supabase...');
        await configurationService.saveEtapas([newEtapa]);
        console.log('📋 [adicionarEtapa] Salvo com sucesso!');
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    console.log('📋 [adicionarEtapa] Concluído');
  }, []);

  const atualizarEtapa = useCallback(async (id: string, dados: Partial<EtapaTrabalho>) => {
    isOwnUpdateRef.current = true;
    
    await etapasOps.update(
      id,
      dados,
      async () => {
        const updated = etapasRef.current.map(e => e.id === id ? { ...e, ...dados } : e);
        await configurationService.saveEtapas(updated);
      }
    );
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

  const removerEtapa = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    
    try {
      await etapasOps.remove(
        id,
        async () => {
          await configurationService.deleteEtapaById(id);
        }
      );
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return true;
    } catch (error) {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
      return false;
    }
  }, []);

  const moverEtapa = useCallback(async (id: string, direcao: 'cima' | 'baixo') => {
    isOwnUpdateRef.current = true;
    
    const etapa = etapasRef.current.find(e => e.id === id);
    if (!etapa) return;
    
    const sorted = [...etapasRef.current].sort((a, b) => a.ordem - b.ordem);
    const currentIndex = sorted.findIndex(e => e.id === id);
    
    if (direcao === 'cima' && currentIndex > 0) {
      const targetEtapa = sorted[currentIndex - 1];
      const tempOrdem = etapa.ordem;
      
      await etapasOps.update(id, { ordem: targetEtapa.ordem }, async () => {
        const updated = etapasRef.current.map(e => {
          if (e.id === id) return { ...e, ordem: targetEtapa.ordem };
          if (e.id === targetEtapa.id) return { ...e, ordem: tempOrdem };
          return e;
        });
        await configurationService.saveEtapas(updated);
      });
    } else if (direcao === 'baixo' && currentIndex < sorted.length - 1) {
      const targetEtapa = sorted[currentIndex + 1];
      const tempOrdem = etapa.ordem;
      
      await etapasOps.update(id, { ordem: targetEtapa.ordem }, async () => {
        const updated = etapasRef.current.map(e => {
          if (e.id === id) return { ...e, ordem: targetEtapa.ordem };
          if (e.id === targetEtapa.id) return { ...e, ordem: tempOrdem };
          return e;
        });
        await configurationService.saveEtapas(updated);
      });
    }
    
    setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
  }, []);

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
