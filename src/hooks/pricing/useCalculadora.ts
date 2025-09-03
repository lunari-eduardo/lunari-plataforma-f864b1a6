/**
 * Hook para Calculadora de Serviços
 * Gerencia estado e ações da calculadora de precificação
 */

import { useState, useEffect, useCallback } from 'react';
import { PricingServiceFactory } from '@/services/pricing';
import type { EstadoCalculadora, ProdutoAdicional, CustoExtra, StatusSalvamento } from '@/types/precificacao';

export function useCalculadora() {
  const [estado, setEstado] = useState<EstadoCalculadora | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Criar serviços
  const services = PricingServiceFactory.createLocalServices();

  // Carregar estado salvo
  useEffect(() => {
    carregarEstado();
  }, []);

  const carregarEstado = useCallback(async () => {
    try {
      setLoading(true);
      
      const estadoSalvo = await services.calculadora.carregar();
      
      if (estadoSalvo) {
        setEstado(estadoSalvo);
        setStatusSalvamento('salvo');
      } else {
        // Criar estado padrão
        const estadoPadrao = services.calculadora.criarPadrao();
        setEstado(estadoPadrao);
        setStatusSalvamento('nao_salvo');
      }
      
    } catch (error) {
      console.error('Erro ao carregar calculadora:', error);
      const estadoPadrao = services.calculadora.criarPadrao();
      setEstado(estadoPadrao);
      setStatusSalvamento('erro');
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarEstado = useCallback(async (novoEstado?: EstadoCalculadora, autoSave = true) => {
    try {
      const estadoParaSalvar = novoEstado || estado;
      if (!estadoParaSalvar) return false;
      
      setStatusSalvamento('salvando');
      
      const sucesso = await services.calculadora.salvar(estadoParaSalvar, autoSave);
      
      if (sucesso) {
        setEstado(estadoParaSalvar);
        setStatusSalvamento('salvo');
        return true;
      } else {
        setStatusSalvamento('erro');
        return false;
      }
      
    } catch (error) {
      console.error('Erro ao salvar calculadora:', error);
      setStatusSalvamento('erro');
      return false;
    }
  }, [estado]);

  // Auto-save com debounce
  useEffect(() => {
    if (!estado || !autoSaveEnabled) return;
    
    const timeoutId = setTimeout(() => {
      salvarEstado(estado, true);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [estado, autoSaveEnabled, salvarEstado]);

  const limparCalculadora = useCallback(async () => {
    try {
      const sucesso = await services.calculadora.limpar();
      
      if (sucesso) {
        const estadoPadrao = services.calculadora.criarPadrao();
        setEstado(estadoPadrao);
        setStatusSalvamento('nao_salvo');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Erro ao limpar calculadora:', error);
      return false;
    }
  }, []);

  // Ações de atualização
  const atualizarHoras = useCallback((horas: number) => {
    if (!estado) return;
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      horasEstimadas: horas,
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  const atualizarMarkup = useCallback((markup: number) => {
    if (!estado) return;
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      markup: markup,
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  const adicionarProduto = useCallback((produto: Omit<ProdutoAdicional, 'id'>) => {
    if (!estado) return;
    
    const novoProduto: ProdutoAdicional = {
      ...produto,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      produtos: [...estado.produtos, novoProduto],
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  const removerProduto = useCallback((produtoId: string) => {
    if (!estado) return;
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      produtos: estado.produtos.filter(p => p.id !== produtoId),
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  const adicionarCustoExtra = useCallback((custo: Omit<CustoExtra, 'id'>) => {
    if (!estado) return;
    
    const novoCusto: CustoExtra = {
      ...custo,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      custosExtras: [...estado.custosExtras, novoCusto],
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  const removerCustoExtra = useCallback((custoId: string) => {
    if (!estado) return;
    
    const novoEstado: EstadoCalculadora = {
      ...estado,
      custosExtras: estado.custosExtras.filter(c => c.id !== custoId),
      updated_at: new Date().toISOString()
    };
    
    setEstado(novoEstado);
  }, [estado]);

  // Função para calcular preços com custos fixos externos
  const calcularPrecos = useCallback((custosFixosHora: number) => {
    if (!estado) return null;
    
    const calculos = services.calculadora.calcularPrecoFinal(
      estado.horasEstimadas,
      custosFixosHora,
      estado.markup,
      estado.produtos,
      estado.custosExtras
    );
    
    // Atualizar estado com cálculos
    const estadoAtualizado: EstadoCalculadora = {
      ...estado,
      ...calculos,
      updated_at: new Date().toISOString()
    };
    
    setEstado(estadoAtualizado);
    
    return calculos;
  }, [estado]);

  return {
    // Estado
    estado,
    loading,
    statusSalvamento,
    autoSaveEnabled,
    
    // Configurações
    setAutoSaveEnabled,
    
    // Ações de estado
    carregarEstado,
    salvarEstado,
    limparCalculadora,
    
    // Ações de dados
    atualizarHoras,
    atualizarMarkup,
    adicionarProduto,
    removerProduto,
    adicionarCustoExtra,
    removerCustoExtra,
    calcularPrecos
  };
}