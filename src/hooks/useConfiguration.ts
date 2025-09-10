/**
 * Hook unificado para gestão de configurações
 * Centraliza estado e operações de todas as configurações do sistema
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { configurationService } from '@/services/ConfigurationService';
import type {
  Categoria,
  Pacote, 
  Produto,
  EtapaTrabalho,
  ConfigurationState,
  ConfigurationActions
} from '@/types/configuration';

export function useConfiguration(): ConfigurationState & ConfigurationActions {
  // ============= ESTADOS =============
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoadingCategorias, setIsLoadingCategorias] = useState(true);
  
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [isLoadingPacotes, setIsLoadingPacotes] = useState(true);
  
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(true);
  
  const [etapas, setEtapas] = useState<EtapaTrabalho[]>([]);
  const [isLoadingEtapas, setIsLoadingEtapas] = useState(true);

  // ============= INICIALIZAÇÃO E CARREGAMENTO =============
  
  useEffect(() => {
    const initializeAllData = async () => {
      try {
        setIsLoadingCategorias(true);
        setIsLoadingPacotes(true);
        setIsLoadingProdutos(true);
        setIsLoadingEtapas(true);
        
        // Carrega todos os dados de forma assíncrona
        const [loadedCategorias, loadedPacotes, loadedProdutos, loadedEtapas] = await Promise.all([
          configurationService.loadCategoriasAsync(),
          configurationService.loadPacotesAsync(),
          configurationService.loadProdutosAsync(),
          configurationService.loadEtapasAsync()
        ]);

        setCategorias(loadedCategorias);
        setPacotes(loadedPacotes);
        setProdutos(loadedProdutos);
        setEtapas(loadedEtapas);
      } catch (error) {
        console.error('Error loading configuration data:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setIsLoadingCategorias(false);
        setIsLoadingPacotes(false);
        setIsLoadingProdutos(false);
        setIsLoadingEtapas(false);
      }
    };

    initializeAllData();
  }, []);

  // ============= EFEITOS DE PERSISTÊNCIA =============
  
  useEffect(() => {
    if (!isLoadingCategorias) {
      configurationService.syncCategorias(categorias).catch(error => {
        console.error('Error syncing categorias:', error);
        toast.error('Erro ao sincronizar categorias');
      });
    }
  }, [categorias, isLoadingCategorias]);

  useEffect(() => {
    if (!isLoadingPacotes) {
      configurationService.syncPacotes(pacotes).catch(error => {
        console.error('Error syncing pacotes:', error);
        toast.error('Erro ao sincronizar pacotes');
      });
    }
  }, [pacotes, isLoadingPacotes]);

  useEffect(() => {
    if (!isLoadingProdutos) {
      configurationService.syncProdutos(produtos).catch(error => {
        console.error('Error syncing produtos:', error);
        toast.error('Erro ao sincronizar produtos');
      });
    }
  }, [produtos, isLoadingProdutos]);

  useEffect(() => {
    if (!isLoadingEtapas) {
      configurationService.syncEtapas(etapas).catch(error => {
        console.error('Error syncing etapas:', error);
        toast.error('Erro ao sincronizar etapas');
      });
    }
  }, [etapas, isLoadingEtapas]);

  // ============= OPERAÇÕES DE CATEGORIAS =============
  
  const adicionarCategoria = useCallback((categoria: Omit<Categoria, 'id'>) => {
    const validation = configurationService.validateCategoria(categoria);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novaCategoria: Categoria = {
      ...categoria,
      id: configurationService.generateId()
    };

    setCategorias(prev => [...prev, novaCategoria]);
    toast.success('Categoria adicionada com sucesso!');
  }, []);

  const atualizarCategoria = useCallback((id: string, dados: Partial<Categoria>) => {
    setCategorias(prev => prev.map(cat => 
      cat.id === id ? { ...cat, ...dados } : cat
    ));
    toast.success('Categoria atualizada com sucesso!');
  }, []);

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteCategoria(id, pacotes)) {
      toast.error('Esta categoria não pode ser removida pois está sendo usada em pacotes');
      return false;
    }

    try {
      // Delete directly from Supabase first
      await configurationService.deleteCategoriaById(id);
      // Only update local state after successful Supabase deletion
      setCategorias(prev => prev.filter(cat => cat.id !== id));
      toast.success('Categoria removida com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting categoria:', error);
      toast.error('Erro ao remover categoria');
      return false;
    }
  }, [pacotes]);

  // ============= OPERAÇÕES DE PACOTES =============
  
  const adicionarPacote = useCallback((pacote: Omit<Pacote, 'id'>) => {
    const validation = configurationService.validatePacote(pacote);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novoPacote: Pacote = {
      ...pacote,
      id: configurationService.generateId()
    };

    setPacotes(prev => [...prev, novoPacote]);
    toast.success('Pacote adicionado com sucesso!');
  }, []);

  const atualizarPacote = useCallback((id: string, dados: Partial<Pacote>) => {
    setPacotes(prev => prev.map(pac => 
      pac.id === id ? { ...pac, ...dados } : pac
    ));
    toast.success('Pacote atualizado com sucesso!');
  }, []);

  const removerPacote = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete directly from Supabase first
      await configurationService.deletePacoteById(id);
      // Only update local state after successful Supabase deletion
      setPacotes(prev => prev.filter(pac => pac.id !== id));
      toast.success('Pacote removido com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting pacote:', error);
      toast.error('Erro ao remover pacote');
      return false;
    }
  }, []);

  // ============= OPERAÇÕES DE PRODUTOS =============
  
  const adicionarProduto = useCallback((produto: Omit<Produto, 'id'>) => {
    const validation = configurationService.validateProduto(produto);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novoProduto: Produto = {
      ...produto,
      id: configurationService.generateId()
    };

    setProdutos(prev => [...prev, novoProduto]);
    toast.success('Produto adicionado com sucesso!');
  }, []);

  const atualizarProduto = useCallback((id: string, dados: Partial<Produto>) => {
    setProdutos(prev => prev.map(prod => 
      prod.id === id ? { ...prod, ...dados } : prod
    ));
    toast.success('Produto atualizado com sucesso!');
  }, []);

  const removerProduto = useCallback(async (id: string): Promise<boolean> => {
    if (!configurationService.canDeleteProduto(id, pacotes)) {
      toast.error('Este produto não pode ser removido pois está sendo usado em pacotes');
      return false;
    }

    try {
      // Delete directly from Supabase first
      await configurationService.deleteProdutoById(id);
      // Only update local state after successful Supabase deletion
      setProdutos(prev => prev.filter(prod => prod.id !== id));
      toast.success('Produto removido com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting produto:', error);
      toast.error('Erro ao remover produto');
      return false;
    }
  }, [pacotes]);

  // ============= OPERAÇÕES DE ETAPAS =============
  
  const adicionarEtapa = useCallback((etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => {
    const validation = configurationService.validateEtapa(etapa);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const novaOrdem = etapas.length > 0 ? Math.max(...etapas.map(e => e.ordem)) + 1 : 1;
    const novaEtapa: EtapaTrabalho = {
      ...etapa,
      id: configurationService.generateId(),
      ordem: novaOrdem
    };

    setEtapas(prev => [...prev, novaEtapa]);
    toast.success('Etapa adicionada com sucesso!');
  }, [etapas]);

  const atualizarEtapa = useCallback((id: string, dados: Partial<EtapaTrabalho>) => {
    setEtapas(prev => prev.map(etapa => 
      etapa.id === id ? { ...etapa, ...dados } : etapa
    ));
    toast.success('Etapa atualizada com sucesso!');
  }, []);

  const removerEtapa = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete directly from Supabase first
      await configurationService.deleteEtapaById(id);
      // Only update local state after successful Supabase deletion
      setEtapas(prev => prev.filter(etapa => etapa.id !== id));
      toast.success('Etapa removida com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting etapa:', error);
      toast.error('Erro ao remover etapa');
      return false;
    }
  }, []);

  const moverEtapa = useCallback((id: string, direcao: 'cima' | 'baixo') => {
    const index = etapas.findIndex(e => e.id === id);
    if (
      (direcao === 'cima' && index === 0) || 
      (direcao === 'baixo' && index === etapas.length - 1)
    ) {
      return;
    }

    const etapasAtualizadas = [...etapas];
    const etapaAtual = etapasAtualizadas[index];
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    const etapaTroca = etapasAtualizadas[novoIndex];

    // Troca as ordens
    const ordemTemp = etapaAtual.ordem;
    etapaAtual.ordem = etapaTroca.ordem;
    etapaTroca.ordem = ordemTemp;

    // Reorganiza o array baseado na nova ordem
    etapasAtualizadas.sort((a, b) => a.ordem - b.ordem);
    setEtapas(etapasAtualizadas);
    toast.success('Ordem das etapas atualizada');
  }, [etapas]);

  // ============= RETORNO DO HOOK =============
  
  return {
    // Estado
    categorias,
    pacotes, 
    produtos,
    etapas,
    
    // Loading states
    isLoadingCategorias,
    isLoadingPacotes,
    isLoadingProdutos,
    isLoadingEtapas,
    
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