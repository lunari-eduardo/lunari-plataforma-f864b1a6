/**
 * Hook para Estrutura de Custos Fixos
 * Gerencia estado e ações da estrutura de custos
 */

import { useState, useEffect, useCallback } from 'react';
import { PricingServiceFactory } from '@/services/pricing';
import type { EstruturaCustosFixos, GastoItem, Equipamento, StatusSalvamento } from '@/types/precificacao';

export function useEstruturaCustos() {
  const [dados, setDados] = useState<EstruturaCustosFixos | null>(null);
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
      
      const dadosCarregados = await services.estruturaCustos.carregar();
      setDados(dadosCarregados);
      setStatusSalvamento('salvo');
      setErros([]);
      
    } catch (error) {
      console.error('Erro ao carregar estrutura de custos:', error);
      setStatusSalvamento('erro');
      setErros(['Erro ao carregar dados']);
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarDados = useCallback(async (novosDados: EstruturaCustosFixos) => {
    try {
      setStatusSalvamento('salvando');
      
      // Validar antes de salvar
      const errosValidacao = services.estruturaCustos.validar(novosDados);
      if (errosValidacao.length > 0) {
        setErros(errosValidacao);
        setStatusSalvamento('erro');
        return false;
      }
      
      // Recalcular total
      const totalCalculado = services.estruturaCustos.calcularTotal(novosDados);
      const dadosAtualizados = {
        ...novosDados,
        totalCalculado
      };
      
      const sucesso = await services.estruturaCustos.salvar(dadosAtualizados);
      
      if (sucesso) {
        setDados(dadosAtualizados);
        setStatusSalvamento('salvo');
        setErros([]);
        return true;
      } else {
        setStatusSalvamento('erro');
        setErros(['Falha ao salvar dados']);
        return false;
      }
      
    } catch (error) {
      console.error('Erro ao salvar estrutura de custos:', error);
      setStatusSalvamento('erro');
      setErros(['Erro inesperado ao salvar']);
      return false;
    }
  }, []);

  // Ações específicas
  const adicionarGastoPessoal = useCallback(async (gasto: Omit<GastoItem, 'id'>) => {
    if (!dados) return false;
    
    const novoGasto: GastoItem = {
      ...gasto,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    
    const novosDados = {
      ...dados,
      gastosPessoais: [...dados.gastosPessoais, novoGasto]
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const removerGastoPessoal = useCallback(async (gastoId: string) => {
    if (!dados) return false;
    
    const novosDados = {
      ...dados,
      gastosPessoais: dados.gastosPessoais.filter(g => g.id !== gastoId)
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const adicionarCustoEstudio = useCallback(async (custo: Omit<GastoItem, 'id'>) => {
    if (!dados) return false;
    
    const novoCusto: GastoItem = {
      ...custo,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    
    const novosDados = {
      ...dados,
      custosEstudio: [...dados.custosEstudio, novoCusto]
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const removerCustoEstudio = useCallback(async (custoId: string) => {
    if (!dados) return false;
    
    const novosDados = {
      ...dados,
      custosEstudio: dados.custosEstudio.filter(c => c.id !== custoId)
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const adicionarEquipamento = useCallback(async (equipamento: Omit<Equipamento, 'id'>) => {
    if (!dados) return false;
    
    const novoEquipamento: Equipamento = {
      ...equipamento,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    
    const novosDados = {
      ...dados,
      equipamentos: [...dados.equipamentos, novoEquipamento]
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const removerEquipamento = useCallback(async (equipamentoId: string) => {
    if (!dados) return false;
    
    const novosDados = {
      ...dados,
      equipamentos: dados.equipamentos.filter(e => e.id !== equipamentoId)
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  const atualizarPercentualProLabore = useCallback(async (percentual: number) => {
    if (!dados) return false;
    
    const novosDados = {
      ...dados,
      percentualProLabore: percentual
    };
    
    return await salvarDados(novosDados);
  }, [dados, salvarDados]);

  // Cálculos derivados
  const totalCustosFixos = dados?.totalCalculado || 0;
  const custosFixosHora = dados ? (function() {
    // Assumir 22 dias úteis por mês e 8 horas por dia
    const horasPorMes = 22 * 8;
    return totalCustosFixos / horasPorMes;
  })() : 0;

  return {
    // Estado
    dados,
    loading,
    statusSalvamento,
    erros,
    
    // Valores calculados
    totalCustosFixos,
    custosFixosHora,
    
    // Ações
    carregarDados,
    salvarDados,
    adicionarGastoPessoal,
    removerGastoPessoal,
    adicionarCustoEstudio,
    removerCustoEstudio,
    adicionarEquipamento,
    removerEquipamento,
    atualizarPercentualProLabore
  };
}