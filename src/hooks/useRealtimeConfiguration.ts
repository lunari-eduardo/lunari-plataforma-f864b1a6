/**
 * Main hook for real-time configuration management
 * Combines optimistic updates with Supabase real-time subscriptions
 */

import { useEffect, useCallback, useMemo } from 'react';
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

export function useRealtimeConfiguration(): ConfigurationState & ConfigurationActions {
  
  // ============= OPTIMISTIC STATE MANAGEMENT =============
  
  const [categoriasState, categoriasOps] = useOptimisticConfiguration<Categoria>([]);
  const [pacotesState, pacotesOps] = useOptimisticConfiguration<Pacote>([]);
  const [produtosState, produtosOps] = useOptimisticConfiguration<Produto>([]);
  const [etapasState, etapasOps] = useOptimisticConfiguration<EtapaTrabalho>([]);

  // ============= REAL-TIME SUBSCRIPTIONS =============
  
  // Memoize callbacks to prevent re-subscriptions
  const categoriasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      const newItem = payload.new as any;
      const categoria: Categoria = {
        id: newItem.id,
        nome: newItem.nome,
        cor: newItem.cor,
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      // Only add if not already in state (avoid duplicates from own operations)
      if (!categoriasState.data.find(c => c.id === categoria.id)) {
        categoriasOps.set([...categoriasState.data, categoria]);
      }
    },
    onUpdate: (payload) => {
      const updated = payload.new as any;
      categoriasOps.set(
        categoriasState.data.map(c => 
          c.id === updated.id 
            ? { ...c, nome: updated.nome, cor: updated.cor, updated_at: updated.updated_at }
            : c
        )
      );
    },
    onDelete: (payload) => {
      const deleted = payload.old as any;
      categoriasOps.set(categoriasState.data.filter(c => c.id !== deleted.id));
    }
  }), [categoriasState.data, categoriasOps]);
  
  // Categorias realtime
  useSupabaseRealtime('categorias', categoriasCallbacks);

  const pacotesCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
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
      
      if (!pacotesState.data.find(p => p.id === pacote.id)) {
        pacotesOps.set([...pacotesState.data, pacote]);
      }
    },
    onUpdate: (payload) => {
      const updated = payload.new as any;
      pacotesOps.set(
        pacotesState.data.map(p => 
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
      const deleted = payload.old as any;
      pacotesOps.set(pacotesState.data.filter(p => p.id !== deleted.id));
    }
  }), [pacotesState.data, pacotesOps]);
  
  // Pacotes realtime  
  useSupabaseRealtime('pacotes', pacotesCallbacks);

  const produtosCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      const newItem = payload.new as any;
      const produto: Produto = {
        id: newItem.id,
        nome: newItem.nome,
        preco_custo: Number(newItem.preco_custo),
        preco_venda: Number(newItem.preco_venda),
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      if (!produtosState.data.find(p => p.id === produto.id)) {
        produtosOps.set([...produtosState.data, produto]);
      }
    },
    onUpdate: (payload) => {
      const updated = payload.new as any;
      produtosOps.set(
        produtosState.data.map(p => 
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
      const deleted = payload.old as any;
      produtosOps.set(produtosState.data.filter(p => p.id !== deleted.id));
    }
  }), [produtosState.data, produtosOps]);
  
  // Produtos realtime
  useSupabaseRealtime('produtos', produtosCallbacks);

  const etapasCallbacks = useMemo(() => ({
    onInsert: (payload: any) => {
      const newItem = payload.new as any;
      const etapa: EtapaTrabalho = {
        id: newItem.id,
        nome: newItem.nome,
        cor: newItem.cor,
        ordem: newItem.ordem,
        created_at: newItem.created_at,
        updated_at: newItem.updated_at
      };
      
      if (!etapasState.data.find(e => e.id === etapa.id)) {
        etapasOps.set([...etapasState.data, etapa].sort((a, b) => a.ordem - b.ordem));
      }
    },
    onUpdate: (payload: any) => {
      const updated = payload.new as any;
      etapasOps.set(
        etapasState.data.map(e => 
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
      const deleted = payload.old as any;
      etapasOps.set(etapasState.data.filter(e => e.id !== deleted.id));
    }
  }), [etapasState.data, etapasOps]);
  
  // Etapas realtime
  useSupabaseRealtime('etapas_trabalho', etapasCallbacks);

  // ============= INITIAL DATA LOADING =============
  
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // Wait for service initialization (includes default data setup)
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
        
        console.log('✅ All configuration data loaded with initialization');
      } catch (error) {
        console.error('❌ Error loading configuration data:', error);
        toast.error('Erro ao carregar configurações');
      }
    };

    loadAllData();
  }, []);

  // ============= CATEGORIA OPERATIONS =============
  
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

    await categoriasOps.add(novaCategoria, async () => {
      await configurationService.saveCategorias([...categoriasState.data, novaCategoria]);
    });
  }, [categoriasState.data, categoriasOps]);

  const atualizarCategoria = useCallback(async (id: string, dados: Partial<Categoria>) => {
    await categoriasOps.update(id, dados, async () => {
      const updatedCategorias = categoriasState.data.map(cat => 
        cat.id === id ? { ...cat, ...dados, updated_at: new Date().toISOString() } : cat
      );
      await configurationService.saveCategorias(updatedCategorias);
    });
  }, [categoriasState.data, categoriasOps]);

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteCategoria(id, pacotesState.data)) {
      toast.error('Esta categoria não pode ser removida pois está sendo usada em pacotes');
      return false;
    }

    try {
      await categoriasOps.remove(id, async () => {
        await configurationService.deleteCategoriaById(id);
      });
      return true;
    } catch (error) {
      return false;
    }
  }, [pacotesState.data, categoriasOps]);

  // ============= PACOTE OPERATIONS =============
  
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

    await pacotesOps.add(novoPacote, async () => {
      await configurationService.savePacotes([...pacotesState.data, novoPacote]);
    });
  }, [pacotesState.data, pacotesOps]);

  const atualizarPacote = useCallback(async (id: string, dados: Partial<Pacote>) => {
    await pacotesOps.update(id, dados, async () => {
      const updatedPacotes = pacotesState.data.map(pac => 
        pac.id === id ? { ...pac, ...dados, updated_at: new Date().toISOString() } : pac
      );
      await configurationService.savePacotes(updatedPacotes);
    });
  }, [pacotesState.data, pacotesOps]);

  const removerPacote = useCallback(async (id: string): Promise<boolean> => {
    try {
      await pacotesOps.remove(id, async () => {
        await configurationService.deletePacoteById(id);
      });
      return true;
    } catch (error) {
      return false;
    }
  }, [pacotesOps]);

  // ============= PRODUTO OPERATIONS =============
  
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

    await produtosOps.add(novoProduto, async () => {
      await configurationService.saveProdutos([...produtosState.data, novoProduto]);
    });
  }, [produtosState.data, produtosOps]);

  const atualizarProduto = useCallback(async (id: string, dados: Partial<Produto>) => {
    await produtosOps.update(id, dados, async () => {
      const updatedProdutos = produtosState.data.map(prod => 
        prod.id === id ? { ...prod, ...dados, updated_at: new Date().toISOString() } : prod
      );
      await configurationService.saveProdutos(updatedProdutos);
    });
  }, [produtosState.data, produtosOps]);

  const removerProduto = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteProduto(id, pacotesState.data)) {
      toast.error('Este produto não pode ser removido pois está sendo usado em pacotes');
      return false;
    }

    try {
      await produtosOps.remove(id, async () => {
        await configurationService.deleteProdutoById(id);
      });
      return true;
    } catch (error) {
      return false;
    }
  }, [pacotesState.data, produtosOps]);

  // ============= ETAPA OPERATIONS =============
  
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

    await etapasOps.add(novaEtapa, async () => {
      await configurationService.saveEtapas([...etapasState.data, novaEtapa]);
    });
  }, [etapasState.data, etapasOps]);

  const atualizarEtapa = useCallback(async (id: string, dados: Partial<EtapaTrabalho>) => {
    await etapasOps.update(id, dados, async () => {
      const updatedEtapas = etapasState.data.map(etapa => 
        etapa.id === id ? { ...etapa, ...dados, updated_at: new Date().toISOString() } : etapa
      );
      await configurationService.saveEtapas(updatedEtapas);
    });
  }, [etapasState.data, etapasOps]);

  const removerEtapa = useCallback(async (id: string): Promise<boolean> => {
    try {
      await etapasOps.remove(id, async () => {
        await configurationService.deleteEtapaById(id);
      });
      return true;
    } catch (error) {
      return false;
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

    // Troca as ordens
    const ordemTemp = etapaAtual.ordem;
    etapaAtual.ordem = etapaTroca.ordem;
    etapaTroca.ordem = ordemTemp;

    // Reorganiza o array baseado na nova ordem
    etapasAtualizadas.sort((a, b) => a.ordem - b.ordem);

    etapasOps.set(etapasAtualizadas);
    
    // Persiste as mudanças
    try {
      await configurationService.saveEtapas(etapasAtualizadas);
      toast.success('Ordem das etapas atualizada');
    } catch (error) {
      // Rollback on error
      etapasOps.set(etapasState.data);
      toast.error('Erro ao atualizar ordem das etapas');
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
    // Estado
    categorias: categoriasState.data,
    pacotes: pacotesState.data,
    produtos: produtosState.data,
    etapas: etapasState.data,
    
    // Loading states
    isLoadingCategorias: categoriasState.syncing,
    isLoadingPacotes: pacotesState.syncing,
    isLoadingProdutos: produtosState.syncing,
    isLoadingEtapas: etapasState.syncing,
    
    // Ações de Categorias
    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,
    
    // Ações de Pacotes
    adicionarPacote,
    atualizarPacote,
    removerPacote,
    
    // Ações de Produtos
    adicionarProduto,
    atualizarProduto,
    removerProduto,
    
    // Ações de Etapas
    adicionarEtapa,
    atualizarEtapa,
    removerEtapa,
    moverEtapa
  };
}