/**
 * Hook unificado para gestão de configurações
 * Centraliza estado e operações de todas as configurações do sistema
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { configurationService } from '@/services/ConfigurationService';
import { useAuth } from '@/hooks/useAuth';
import type {
  Categoria,
  Pacote, 
  Produto,
  EtapaTrabalho,
  ConfigurationState,
  ConfigurationActions
} from '@/types/configuration';

export function useConfiguration(): ConfigurationState & ConfigurationActions {
  const { user } = useAuth();
  
  // ============= ESTADOS =============
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [etapas, setEtapas] = useState<EtapaTrabalho[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============= CARREGAMENTO INICIAL =============
  
  useEffect(() => {
    async function loadConfigurations() {
      setIsLoading(true);
      try {
        const configs = await configurationService.loadConfigurationsAsync();
        setCategorias(configs.categorias);
        setPacotes(configs.pacotes);
        setProdutos(configs.produtos);
        setEtapas(configs.etapas);
      } catch (error) {
        console.error('❌ [useConfiguration] Erro ao carregar configurações:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setIsLoading(false);
      }
    }

    loadConfigurations();
  }, [user]); // Recarrega quando usuário muda

  // ============= EFEITOS DE PERSISTÊNCIA =============
  
  useEffect(() => {
    if (!isLoading && categorias.length >= 0) {
      configurationService.saveCategoriasAsync(categorias).catch(console.error);
    }
  }, [categorias, isLoading]);

  useEffect(() => {
    if (!isLoading && pacotes.length >= 0) {
      configurationService.savePacotesAsync(pacotes).catch(console.error);
    }
  }, [pacotes, isLoading]);

  useEffect(() => {
    if (!isLoading && produtos.length >= 0) {
      configurationService.saveProdutosAsync(produtos).catch(console.error);
    }
  }, [produtos, isLoading]);

  useEffect(() => {
    if (!isLoading && etapas.length >= 0) {
      configurationService.saveEtapasAsync(etapas).catch(console.error);
    }
  }, [etapas, isLoading]);

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

  const removerCategoria = useCallback((id: string): boolean => {
    if (!configurationService.canDeleteCategoria(id, pacotes)) {
      toast.error('Esta categoria não pode ser removida pois está sendo usada em pacotes');
      return false;
    }

    setCategorias(prev => prev.filter(cat => cat.id !== id));
    toast.success('Categoria removida com sucesso!');
    return true;
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

  const removerPacote = useCallback((id: string) => {
    setPacotes(prev => prev.filter(pac => pac.id !== id));
    toast.success('Pacote removido com sucesso!');
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

  const removerProduto = useCallback((id: string) => {
    if (!configurationService.canDeleteProduto(id, pacotes)) {
      toast.error('Este produto não pode ser removido pois está sendo usado em pacotes');
      return;
    }

    setProdutos(prev => prev.filter(prod => prod.id !== id));
    toast.success('Produto removido com sucesso!');
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

  const removerEtapa = useCallback((id: string) => {
    setEtapas(prev => prev.filter(etapa => etapa.id !== id));
    toast.success('Etapa removida com sucesso!');
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