/**
 * Hook para Metas e Indicadores
 * Gerencia estado e ações das metas de precificação
 */

import { useState, useEffect, useCallback } from 'react';
import { PricingServiceFactory } from '@/services/pricing';
import type { MetasPrecificacao, StatusSalvamento } from '@/types/precificacao';

export function useMetas() {
  const [dados, setDados] = useState<MetasPrecificacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');
  const [erros, setErros] = useState<string[]>([]);

  // Criar serviços
  const services = PricingServiceFactory.createLocalServices();

  // Carregar dados iniciais
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setStatusSalvamento('salvando');
      
      const dadosCarregados = await services.metas.carregar();
      setDados(dadosCarregados);
      setStatusSalvamento('salvo');
      setErros([]);
      
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      setStatusSalvamento('erro');
      setErros(['Erro ao carregar dados das metas']);
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarDados = useCallback(async (novosDados: MetasPrecificacao) => {
    try {
      setStatusSalvamento('salvando');
      
      // Validar antes de salvar
      const errosValidacao = services.metas.validar(novosDados);
      if (errosValidacao.length > 0) {
        setErros(errosValidacao);
        setStatusSalvamento('erro');
        return false;
      }
      
      const sucesso = await services.metas.salvar(novosDados);
      
      if (sucesso) {
        setDados(novosDados);
        setStatusSalvamento('salvo');
        setErros([]);
        return true;
      } else {
        setStatusSalvamento('erro');
        setErros(['Falha ao salvar metas']);
        return false;
      }
      
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      setStatusSalvamento('erro');
      setErros(['Erro inesperado ao salvar metas']);
      return false;
    }
  }, []);

  const atualizarMargemLucro = useCallback(async (margem: number) => {
    if (!dados) return false;
    
    const novosDados: MetasPrecificacao = {
      ...dados,
      margemLucroDesejada: margem,
      updated_at: new Date().toISOString()
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  // Auto-save com debounce quando margem de lucro muda
  useEffect(() => {
    if (!dados) return;
    
    const timeoutId = setTimeout(() => {
      salvarDados(dados);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [dados?.margemLucroDesejada]);

  // Calcular indicadores financeiros
  const calcularIndicadores = useCallback((custosFixosMensais: number) => {
    if (!dados) {
      return {
        faturamentoMinimoAnual: 0,
        metaFaturamentoAnual: 0,
        metaFaturamentoMensal: 0,
        metaLucroAnual: 0
      };
    }
    
    const faturamentoMinimoAnual = custosFixosMensais * 12;
    const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - dados.margemLucroDesejada / 100);
    const metaFaturamentoMensal = metaFaturamentoAnual / 12;
    const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
    
    return {
      faturamentoMinimoAnual,
      metaFaturamentoAnual,
      metaFaturamentoMensal,
      metaLucroAnual
    };
  }, [dados]);

  // Calcular e atualizar metas baseadas nos custos fixos
  const atualizarMetasComCustos = useCallback(async (custosFixosMensais: number) => {
    if (!dados) return false;
    
    try {
      const indicadores = await services.metas.calcularMetasAnuais(
        custosFixosMensais,
        dados.margemLucroDesejada
      );
      
      const novosDados: MetasPrecificacao = {
        ...dados,
        metaFaturamentoAnual: indicadores.metaFaturamentoAnual,
        metaLucroAnual: indicadores.metaLucroAnual,
        updated_at: new Date().toISOString()
      };
      
      const sucesso = await salvarDados(novosDados);
      
      if (sucesso) {
        return indicadores;
      }
      
      return null;
      
    } catch (error) {
      console.error('Erro ao atualizar metas com custos:', error);
      return null;
    }
  }, [dados, salvarDados]);

  // Obter histórico de metas (para futuro)
  const obterHistorico = useCallback(async () => {
    try {
      return await services.metas.obterHistoricoMetas();
    } catch (error) {
      console.error('Erro ao obter histórico de metas:', error);
      return [];
    }
  }, []);

  // Verificar se as metas estão sendo atingidas (placeholder para futuro)
  const verificarProgresso = useCallback((faturamentoAtual: number) => {
    if (!dados) return null;
    
    const indicadores = calcularIndicadores(0); // Será calculado externamente
    const progressoAnual = (faturamentoAtual / indicadores.metaFaturamentoAnual) * 100;
    const progressoMensal = (faturamentoAtual / indicadores.metaFaturamentoMensal) * 100;
    
    return {
      progressoAnual: Math.min(progressoAnual, 100),
      progressoMensal: Math.min(progressoMensal, 100),
      faturamentoRestante: Math.max(indicadores.metaFaturamentoAnual - faturamentoAtual, 0),
      noRitmo: progressoAnual >= (new Date().getMonth() + 1) * (100 / 12)
    };
  }, [dados, calcularIndicadores]);

  return {
    // Estado
    dados,
    loading,
    statusSalvamento,
    erros,
    
    // Ações
    carregarDados,
    salvarDados,
    atualizarMargemLucro,
    atualizarMetasComCustos,
    obterHistorico,
    
    // Cálculos
    calcularIndicadores,
    verificarProgresso
  };
}