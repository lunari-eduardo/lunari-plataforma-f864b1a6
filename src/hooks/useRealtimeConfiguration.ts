/**
 * Main hook for real-time configuration management
 * Combines optimistic updates with Supabase real-time subscriptions
 * WITH STABLE CALLBACKS TO PREVENT RE-SUBSCRIPTION LOOPS
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useSupabaseRealtime } from './useSupabaseRealtime';
import { useOptimisticConfiguration } from './useOptimisticConfiguration';
import { configurationService } from '@/services/ConfigurationService';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho,
  ConfigurationState,
  ConfigurationActions
} from '@/types/configuration';

const REALTIME_DEBUG = false; // Set to true for debugging

export function useRealtimeConfiguration(): ConfigurationState & ConfigurationActions {
  
  // ============= OPTIMISTIC STATE MANAGEMENT =============
  
  const [categoriasState, categoriasOps] = useOptimisticConfiguration<Categoria>([]);
  const [pacotesState, pacotesOps] = useOptimisticConfiguration<Pacote>([]);
  const [produtosState, produtosOps] = useOptimisticConfiguration<Produto>([]);
  const [etapasState, etapasOps] = useOptimisticConfiguration<EtapaTrabalho>([]);

  // ============= REFS FOR STABLE CALLBACKS =============
  
  const categoriasRef = useRef(categoriasState);
  const pacotesRef = useRef(pacotesState);
  const produtosRef = useRef(produtosState);
  const etapasRef = useRef(etapasState);

  // Flag to ignore own updates and prevent loops
  const isOwnUpdateRef = useRef(false);

  // Update refs when state changes
  useEffect(() => { categoriasRef.current = categoriasState; }, [categoriasState]);
  useEffect(() => { pacotesRef.current = pacotesState; }, [pacotesState]);
  useEffect(() => { produtosRef.current = produtosState; }, [produtosState]);
  useEffect(() => { etapasRef.current = etapasState; }, [etapasState]);

  // ============= REAL-TIME SUBSCRIPTIONS WITH STABLE CALLBACKS =============
  
  const categoriasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own INSERT on categorias');
        return;
      }
      const newItem = payload.new as any;
      const categoria: Categoria = {
        id: newItem.id,
        nome: newItem.nome,
        cor: newItem.cor,
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      const currentData = categoriasRef.current.data;
      if (!currentData.find(c => c.id === categoria.id)) {
        categoriasOps.set([...currentData, categoria]);
      }
    },
    onUpdate: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own UPDATE on categorias');
        return;
      }
      const updated = payload.new as any;
      const currentData = categoriasRef.current.data;
      categoriasOps.set(
        currentData.map(c => 
          c.id === updated.id 
            ? { ...c, nome: updated.nome, cor: updated.cor, updated_at: updated.updated_at }
            : c
        )
      );
    },
    onDelete: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own DELETE on categorias');
        return;
      }
      const deleted = payload.old as any;
      const currentData = categoriasRef.current.data;
      categoriasOps.set(currentData.filter(c => c.id !== deleted.id));
    }
  }), [categoriasOps]);
  
  useSupabaseRealtime('categorias', categoriasCallbacks);

  const pacotesCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own INSERT on pacotes');
        return;
      }
      const newItem = payload.new as any;
      const pacote: Pacote = {
        id: newItem.id,
        nome: newItem.nome,
        categoria_id: newItem.categoria_id,
        valor_base: Number(newItem.valor_base),
        valor_foto_extra: Number(newItem.valor_foto_extra),
        produtosIncluidos: newItem.produtos_incluidos || [],
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      const currentData = pacotesRef.current.data;
      if (!currentData.find(p => p.id === pacote.id)) {
        pacotesOps.set([...currentData, pacote]);
      }
    },
    onUpdate: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own UPDATE on pacotes');
        return;
      }
      const updated = payload.new as any;
      const currentData = pacotesRef.current.data;
      pacotesOps.set(
        currentData.map(p => 
          p.id === updated.id 
            ? {
                ...p,
                nome: updated.nome,
                categoria_id: updated.categoria_id,
                valor_base: Number(updated.valor_base),
                valor_foto_extra: Number(updated.valor_foto_extra),
                produtosIncluidos: updated.produtos_incluidos || [],
                updated_at: updated.updated_at
              }
            : p
        )
      );
    },
    onDelete: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own DELETE on pacotes');
        return;
      }
      const deleted = payload.old as any;
      const currentData = pacotesRef.current.data;
      pacotesOps.set(currentData.filter(p => p.id !== deleted.id));
    }
  }), [pacotesOps]);
  
  useSupabaseRealtime('pacotes', pacotesCallbacks);

  const produtosCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own INSERT on produtos');
        return;
      }
      const newItem = payload.new as any;
      const produto: Produto = {
        id: newItem.id,
        nome: newItem.nome,
        preco_custo: Number(newItem.preco_custo),
        preco_venda: Number(newItem.preco_venda),
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      const currentData = produtosRef.current.data;
      if (!currentData.find(p => p.id === produto.id)) {
        produtosOps.set([...currentData, produto]);
      }
    },
    onUpdate: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own UPDATE on produtos');
        return;
      }
      const updated = payload.new as any;
      const currentData = produtosRef.current.data;
      produtosOps.set(
        currentData.map(p => 
          p.id === updated.id 
            ? {
                ...p,
                nome: updated.nome,
                preco_custo: Number(updated.preco_custo),
                preco_venda: Number(updated.preco_venda),
                updated_at: updated.updated_at
              }
            : p
        )
      );
    },
    onDelete: (payload) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own DELETE on produtos');
        return;
      }
      const deleted = payload.old as any;
      const currentData = produtosRef.current.data;
      produtosOps.set(currentData.filter(p => p.id !== deleted.id));
    }
  }), [produtosOps]);
  
  useSupabaseRealtime('produtos', produtosCallbacks);

  const etapasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own INSERT on etapas');
        return;
      }
      const newItem = payload.new as any;
      const etapa: EtapaTrabalho = {
        id: newItem.id,
        nome: newItem.nome,
        cor: newItem.cor,
        ordem: newItem.ordem,
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      const currentData = etapasRef.current.data;
      if (!currentData.find(e => e.id === etapa.id)) {
        etapasOps.set([...currentData, etapa].sort((a, b) => a.ordem - b.ordem));
      }
    },
    onUpdate: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own UPDATE on etapas');
        return;
      }
      const updated = payload.new as any;
      const currentData = etapasRef.current.data;
      etapasOps.set(
        currentData.map(e => 
          e.id === updated.id 
            ? {
                ...e,
                nome: updated.nome,
                cor: updated.cor,
                ordem: updated.ordem,
                updated_at: updated.updated_at
              }
            : e
        ).sort((a, b) => a.ordem - b.ordem)
      );
    },
    onDelete: (payload: any) => {
      if (isOwnUpdateRef.current) {
        if (REALTIME_DEBUG) console.log('⏭️ Ignoring own DELETE on etapas');
        return;
      }
      const deleted = payload.old as any;
      const currentData = etapasRef.current.data;
      etapasOps.set(currentData.filter(e => e.id !== deleted.id));
    }
  }), [etapasOps]);
  
  useSupabaseRealtime('etapas_trabalho', etapasCallbacks);

  // ============= INITIAL DATA LOADING =============
  
  useEffect(() => {
    const loadAllData = async () => {
      try {
        await configurationService.initialize();
        
        const [categorias, pacotes, produtos, etapas] = await Promise.all([
          configurationService.loadCategoriasAsync(),
          configurationService.loadPacotesAsync(), 
          configurationService.loadProdutosAsync(),
          configurationService.loadEtapasAsync()
        ]);

        categoriasOps.set(categorias);
        pacotesOps.set(pacotes);
        produtosOps.set(produtos);
        etapasOps.set(etapas);
        
        console.log('✅ All configuration data loaded');
      } catch (error) {
        console.error('❌ Error loading configuration data:', error);
        toast.error('Erro ao carregar configurações');
      }
    };

    loadAllData();
  }, []);

  // ============= OPERATIONS WITH OWN-UPDATE FLAG =============
  
  const adicionarCategoria = useCallback(async (categoria: Omit<Categoria, 'id'>) => {
    const validation = configurationService.validateCategoria(categoria);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novaCategoria: Categoria = {
      ...categoria,
      id: configurationService.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    isOwnUpdateRef.current = true;
    try {
      await categoriasOps.add(novaCategoria, async () => {
        await configurationService.saveCategorias([...categoriasState.data, novaCategoria]);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [categoriasState.data, categoriasOps]);

  const atualizarCategoria = useCallback(async (id: string, dados: Partial<Categoria>) => {
    isOwnUpdateRef.current = true;
    try {
      await categoriasOps.update(id, dados, async () => {
        const updatedCategorias = categoriasState.data.map(cat => 
          cat.id === id ? { ...cat, ...dados, updated_at: new Date().toISOString() } : cat
        );
        await configurationService.saveCategorias(updatedCategorias);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [categoriasState.data, categoriasOps]);

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteCategoria(id, pacotesState.data)) {
      toast.error('Esta categoria não pode ser removida pois está sendo usada em pacotes');
      return false;
    }

    isOwnUpdateRef.current = true;
    try {
      await categoriasOps.remove(id, async () => {
        await configurationService.deleteCategoriaById(id);
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [pacotesState.data, categoriasOps]);

  const adicionarPacote = useCallback(async (pacote: Omit<Pacote, 'id'>) => {
    const validation = configurationService.validatePacote(pacote);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novoPacote: Pacote = {
      ...pacote,
      id: configurationService.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    isOwnUpdateRef.current = true;
    try {
      await pacotesOps.add(novoPacote, async () => {
        await configurationService.savePacotes([...pacotesState.data, novoPacote]);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [pacotesState.data, pacotesOps]);

  const atualizarPacote = useCallback(async (id: string, dados: Partial<Pacote>) => {
    isOwnUpdateRef.current = true;
    try {
      await pacotesOps.update(id, dados, async () => {
        const updatedPacotes = pacotesState.data.map(pac => 
          pac.id === id ? { ...pac, ...dados, updated_at: new Date().toISOString() } : pac
        );
        await configurationService.savePacotes(updatedPacotes);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [pacotesState.data, pacotesOps]);

  const removerPacote = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    try {
      await pacotesOps.remove(id, async () => {
        await configurationService.deletePacoteById(id);
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [pacotesOps]);

  const adicionarProduto = useCallback(async (produto: Omit<Produto, 'id'>) => {
    const validation = configurationService.validateProduto(produto);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novoProduto: Produto = {
      ...produto,
      id: configurationService.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    isOwnUpdateRef.current = true;
    try {
      await produtosOps.add(novoProduto, async () => {
        await configurationService.saveProdutos([...produtosState.data, novoProduto]);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [produtosState.data, produtosOps]);

  const atualizarProduto = useCallback(async (id: string, dados: Partial<Produto>) => {
    isOwnUpdateRef.current = true;
    try {
      await produtosOps.update(id, dados, async () => {
        const updatedProdutos = produtosState.data.map(prod => 
          prod.id === id ? { ...prod, ...dados, updated_at: new Date().toISOString() } : prod
        );
        await configurationService.saveProdutos(updatedProdutos);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [produtosState.data, produtosOps]);

  const removerProduto = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteProduto(id, pacotesState.data)) {
      toast.error('Este produto não pode ser removido pois está sendo usado em pacotes');
      return false;
    }

    isOwnUpdateRef.current = true;
    try {
      await produtosOps.remove(id, async () => {
        await configurationService.deleteProdutoById(id);
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [pacotesState.data, produtosOps]);

  const adicionarEtapa = useCallback(async (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => {
    const validation = configurationService.validateEtapa(etapa);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novaOrdem = etapasState.data.length > 0 ? Math.max(...etapasState.data.map(e => e.ordem)) + 1 : 1;
    const novaEtapa: EtapaTrabalho = {
      ...etapa,
      id: configurationService.generateId(),
      ordem: novaOrdem,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    isOwnUpdateRef.current = true;
    try {
      await etapasOps.add(novaEtapa, async () => {
        await configurationService.saveEtapas([...etapasState.data, novaEtapa]);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [etapasState.data, etapasOps]);

  const atualizarEtapa = useCallback(async (id: string, dados: Partial<EtapaTrabalho>) => {
    isOwnUpdateRef.current = true;
    try {
      await etapasOps.update(id, dados, async () => {
        const updatedEtapas = etapasState.data.map(etapa => 
          etapa.id === id ? { ...etapa, ...dados, updated_at: new Date().toISOString() } : etapa
        );
        await configurationService.saveEtapas(updatedEtapas);
      });
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [etapasState.data, etapasOps]);

  const removerEtapa = useCallback(async (id: string): Promise<boolean> => {
    isOwnUpdateRef.current = true;
    try {
      await etapasOps.remove(id, async () => {
        await configurationService.deleteEtapaById(id);
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [etapasOps]);

  const moverEtapa = useCallback(async (id: string, direcao: 'cima' | 'baixo') => {
    const index = etapasState.data.findIndex(e => e.id === id);
    if (
      (direcao === 'cima' && index === 0) || 
      (direcao === 'baixo' && index === etapasState.data.length - 1)
    ) {
      return;
    }

    const etapasAtualizadas = [...etapasState.data];
    const etapaAtual = etapasAtualizadas[index];
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    const etapaTroca = etapasAtualizadas[novoIndex];

    const ordemTemp = etapaAtual.ordem;
    etapaAtual.ordem = etapaTroca.ordem;
    etapaTroca.ordem = ordemTemp;

    etapasAtualizadas.sort((a, b) => a.ordem - b.ordem);

    isOwnUpdateRef.current = true;
    etapasOps.set(etapasAtualizadas);
    
    try {
      await configurationService.saveEtapas(etapasAtualizadas);
      toast.success('Ordem das etapas atualizada');
    } catch (error) {
      etapasOps.set(etapasState.data);
      toast.error('Erro ao atualizar ordem das etapas');
    } finally {
      setTimeout(() => { isOwnUpdateRef.current = false; }, 500);
    }
  }, [etapasState.data, etapasOps]);

  // ============= COMPUTED VALUES =============
  
  const isLoading = useMemo(() => 
    categoriasState.syncing || 
    pacotesState.syncing || 
    produtosState.syncing || 
    etapasState.syncing
  , [categoriasState.syncing, pacotesState.syncing, produtosState.syncing, etapasState.syncing]);

  return {
    categorias: categoriasState.data,
    pacotes: pacotesState.data,
    produtos: produtosState.data,
    etapas: etapasState.data,
    
    isLoadingCategorias: categoriasState.syncing,
    isLoadingPacotes: pacotesState.syncing,
    isLoadingProdutos: produtosState.syncing,
    isLoadingEtapas: etapasState.syncing,
    
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
    moverEtapa
  };
}