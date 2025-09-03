/**
 * Hook para Validação do Sistema de Precificação
 * Validações em tempo real e monitoramento de integridade
 */

import { useState, useEffect, useCallback } from 'react';
import { PricingServiceFactory } from '@/services/pricing';
import type { DadosValidacao } from '@/types/precificacao';

export function usePricingValidation() {
  const [validacao, setValidacao] = useState<DadosValidacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Criar serviços
  const services = PricingServiceFactory.createLocalServices();

  const executarValidacao = useCallback(async () => {
    try {
      setLoading(true);
      
      const resultado = await services.validation.validarTodosSistemas();
      setValidacao(resultado);
      
      return resultado;
      
    } catch (error) {
      console.error('Erro na validação:', error);
      
      const falhaValidacao: DadosValidacao = {
        estruturaCustos: false,
        padraoHoras: false,
        metas: false,
        calculadora: false,
        ultimaValidacao: new Date().toISOString()
      };
      
      setValidacao(falhaValidacao);
      return falhaValidacao;
      
    } finally {
      setLoading(false);
    }
  }, []);

  const validarEstruturaCustos = useCallback(async () => {
    try {
      return await services.validation.validarEstruturaCustos();
    } catch (error) {
      console.error('Erro ao validar estrutura de custos:', error);
      return { valido: false, erros: ['Erro na validação'] };
    }
  }, []);

  const validarPadraoHoras = useCallback(async () => {
    try {
      return await services.validation.validarPadraoHoras();
    } catch (error) {
      console.error('Erro ao validar padrão de horas:', error);
      return { valido: false, erros: ['Erro na validação'] };
    }
  }, []);

  const validarMetas = useCallback(async () => {
    try {
      return await services.validation.validarMetas();
    } catch (error) {
      console.error('Erro ao validar metas:', error);
      return { valido: false, erros: ['Erro na validação'] };
    }
  }, []);

  const validarCalculadora = useCallback(async () => {
    try {
      return await services.validation.validarCalculadora();
    } catch (error) {
      console.error('Erro ao validar calculadora:', error);
      return { valido: false, erros: ['Erro na validação'] };
    }
  }, []);

  const recuperarSistema = useCallback(async () => {
    try {
      const sucesso = await services.validation.recuperarDadosCorrompidos();
      
      if (sucesso) {
        // Re-executar validação após recuperação
        await executarValidacao();
      }
      
      return sucesso;
      
    } catch (error) {
      console.error('Erro na recuperação do sistema:', error);
      return false;
    }
  }, [executarValidacao]);

  const obterDiagnostico = useCallback(async () => {
    try {
      return await services.validation.obterRelatorioDiagnostico();
    } catch (error) {
      console.error('Erro ao obter diagnóstico:', error);
      return {
        sistemaIntegro: false,
        problemasEncontrados: ['Erro ao gerar diagnóstico'],
        sugestoes: ['Tente novamente ou contate o suporte'],
        ultimaValidacao: new Date().toISOString()
      };
    }
  }, []);

  // Iniciar validação automática
  const iniciarValidacaoAutomatica = useCallback((intervalMs = 30000) => {
    // Parar validação existente se houver
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    // Executar validação inicial
    executarValidacao();
    
    // Configurar validação periódica
    const novoIntervalId = setInterval(() => {
      executarValidacao();
    }, intervalMs);
    
    setIntervalId(novoIntervalId);
    
    return () => {
      clearInterval(novoIntervalId);
      setIntervalId(null);
    };
  }, [executarValidacao, intervalId]);

  const pararValidacaoAutomatica = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [intervalId]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  // Getters para facilitar acesso
  const sistemaValido = validacao ? 
    validacao.estruturaCustos && validacao.padraoHoras && validacao.metas && validacao.calculadora :
    false;

  const temProblemas = validacao ?
    !validacao.estruturaCustos || !validacao.padraoHoras || !validacao.metas :
    true;

  const ultimaValidacao = validacao?.ultimaValidacao;

  // Indicadores específicos
  const indicadores = {
    estruturaCustosOk: validacao?.estruturaCustos || false,
    padraoHorasOk: validacao?.padraoHoras || false,
    metasOk: validacao?.metas || false,
    calculadoraOk: validacao?.calculadora || false
  };

  return {
    // Estado
    validacao,
    loading,
    sistemaValido,
    temProblemas,
    ultimaValidacao,
    indicadores,
    
    // Ações de validação
    executarValidacao,
    validarEstruturaCustos,
    validarPadraoHoras,
    validarMetas,
    validarCalculadora,
    
    // Ações de recuperação
    recuperarSistema,
    obterDiagnostico,
    
    // Controle de validação automática
    iniciarValidacaoAutomatica,
    pararValidacaoAutomatica
  };
}