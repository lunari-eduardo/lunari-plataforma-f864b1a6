/**
 * Hook para gerenciar dados de Pricing via Supabase
 * Substitui a lógica de localStorage por Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabasePricingAdapter } from '@/services/pricing/SupabasePricingAdapter';
import { PricingMigrationToSupabase } from '@/services/pricing/PricingMigrationToSupabase';
import { toast } from 'sonner';
import type { 
  EstruturaCustosFixos, 
  MetasPrecificacao, 
  PadraoHoras,
  GastoItem, 
  Equipamento, 
  StatusSalvamento 
} from '@/types/precificacao';

export function usePricingSupabaseData() {
  const [estruturaCustos, setEstruturaCustos] = useState<EstruturaCustosFixos | null>(null);
  const [metas, setMetas] = useState<MetasPrecificacao | null>(null);
  const [padraoHoras, setPadraoHoras] = useState<PadraoHoras | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const adapterRef = useRef(new SupabasePricingAdapter());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Verificar autenticação e migrar dados se necessário
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        setIsAuthenticated(true);
        
        // Verificar e executar migração se necessário
        const needsMigration = await PricingMigrationToSupabase.needsMigration();
        if (needsMigration) {
          const result = await PricingMigrationToSupabase.executeMigration();
          if (result.success) {
            toast.success('Dados de precificação migrados para a nuvem');
          }
        }
        
        // Carregar dados
        await loadAllData();
        
      } catch (error) {
        console.error('Erro na inicialização:', error);
        setLoading(false);
      }
    };
    
    initialize();
    
    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticated(true);
        await loadAllData();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setEstruturaCustos(null);
        setMetas(null);
        setPadraoHoras(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Real-time listener para mudanças
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const setupRealtimeListeners = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const channel = supabase
        .channel('pricing-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_configuracoes',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadAllData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_gastos_pessoais',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadEstruturaCustos();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_custos_estudio',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadEstruturaCustos();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_equipamentos',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadEstruturaCustos();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    };
    
    setupRealtimeListeners();
  }, [isAuthenticated]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [estrutura, metasData, horasData] = await Promise.all([
        adapterRef.current.loadEstruturaCustos(),
        adapterRef.current.loadMetas(),
        adapterRef.current.loadPadraoHoras()
      ]);
      
      setEstruturaCustos(estrutura);
      setMetas(metasData);
      setPadraoHoras(horasData);
      setStatusSalvamento('salvo');
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setStatusSalvamento('erro');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEstruturaCustos = useCallback(async () => {
    try {
      const estrutura = await adapterRef.current.loadEstruturaCustos();
      setEstruturaCustos(estrutura);
    } catch (error) {
      console.error('Erro ao recarregar estrutura:', error);
    }
  }, []);

  // Função de salvamento com debounce
  const saveWithDebounce = useCallback(async (
    saveFn: () => Promise<boolean>,
    optimisticUpdate: () => void
  ) => {
    // Update otimista imediato
    optimisticUpdate();
    setStatusSalvamento('salvando');
    
    // Cancelar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce de 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const success = await saveFn();
        setStatusSalvamento(success ? 'salvo' : 'erro');
      } catch (error) {
        console.error('Erro ao salvar:', error);
        setStatusSalvamento('erro');
      }
    }, 500);
  }, []);

  // ============= AÇÕES DE ESTRUTURA DE CUSTOS =============

  const adicionarGastoPessoal = useCallback(async (gasto: Omit<GastoItem, 'id'>) => {
    if (!estruturaCustos) return false;
    
    const novoGasto: GastoItem = {
      ...gasto,
      id: crypto.randomUUID()
    };
    
    const novosDados = {
      ...estruturaCustos,
      gastosPessoais: [...estruturaCustos.gastosPessoais, novoGasto]
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const removerGastoPessoal = useCallback(async (gastoId: string) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      gastosPessoais: estruturaCustos.gastosPessoais.filter(g => g.id !== gastoId)
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const atualizarGastoPessoal = useCallback(async (gastoId: string, campo: keyof GastoItem, valor: any) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      gastosPessoais: estruturaCustos.gastosPessoais.map(g => 
        g.id === gastoId ? { ...g, [campo]: valor } : g
      )
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const adicionarCustoEstudio = useCallback(async (custo: Omit<GastoItem, 'id'>) => {
    if (!estruturaCustos) return false;
    
    const novoCusto: GastoItem = {
      ...custo,
      id: crypto.randomUUID()
    };
    
    const novosDados = {
      ...estruturaCustos,
      custosEstudio: [...estruturaCustos.custosEstudio, novoCusto]
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const removerCustoEstudio = useCallback(async (custoId: string) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      custosEstudio: estruturaCustos.custosEstudio.filter(c => c.id !== custoId)
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const atualizarCustoEstudio = useCallback(async (custoId: string, campo: keyof GastoItem, valor: any) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      custosEstudio: estruturaCustos.custosEstudio.map(c => 
        c.id === custoId ? { ...c, [campo]: valor } : c
      )
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const adicionarEquipamento = useCallback(async (equipamento: Omit<Equipamento, 'id'>) => {
    if (!estruturaCustos) return false;
    
    const novoEquipamento: Equipamento = {
      ...equipamento,
      id: crypto.randomUUID()
    };
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: [...estruturaCustos.equipamentos, novoEquipamento]
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const removerEquipamento = useCallback(async (equipamentoId: string) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: estruturaCustos.equipamentos.filter(e => e.id !== equipamentoId)
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const atualizarEquipamento = useCallback(async (equipamentoId: string, campo: keyof Equipamento, valor: any) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: estruturaCustos.equipamentos.map(e => 
        e.id === equipamentoId ? { ...e, [campo]: valor } : e
      )
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const atualizarPercentualProLabore = useCallback(async (percentual: number) => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      percentualProLabore: percentual
    };
    
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => setEstruturaCustos(novosDados)
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const salvarEstruturaCustos = useCallback(async (dados: EstruturaCustosFixos) => {
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(dados),
      () => setEstruturaCustos(dados)
    );
    return true;
  }, [saveWithDebounce]);

  // ============= AÇÕES DE METAS =============

  const atualizarMetas = useCallback(async (novasMetas: MetasPrecificacao) => {
    saveWithDebounce(
      () => adapterRef.current.saveMetas(novasMetas),
      () => setMetas(novasMetas)
    );
    return true;
  }, [saveWithDebounce]);

  const atualizarMargemLucro = useCallback(async (margem: number) => {
    if (!metas) return false;
    
    const novasMetas = {
      ...metas,
      margemLucroDesejada: margem
    };
    
    return atualizarMetas(novasMetas);
  }, [metas, atualizarMetas]);

  // ============= CÁLCULOS =============

  const calcularTotal = useCallback((dados: EstruturaCustosFixos): number => {
    const totalGastos = dados.gastosPessoais.reduce((sum, g) => sum + g.valor, 0);
    const proLaboreCalculado = totalGastos * (1 + dados.percentualProLabore / 100);
    const totalCustos = dados.custosEstudio.reduce((sum, c) => sum + c.valor, 0);
    const totalDepreciacao = dados.equipamentos.reduce((sum, eq) => 
      sum + (eq.valorPago / (eq.vidaUtil * 12)), 0
    );
    
    return proLaboreCalculado + totalCustos + totalDepreciacao;
  }, []);

  const totalCustosFixos = estruturaCustos ? calcularTotal(estruturaCustos) : 0;
  
  const custosFixosHora = (() => {
    const horasPorMes = (padraoHoras?.horasDisponiveis || 8) * (padraoHoras?.diasTrabalhados || 5) * 4;
    return horasPorMes > 0 ? totalCustosFixos / horasPorMes : 0;
  })();

  return {
    // Estado
    estruturaCustos,
    metas,
    padraoHoras,
    loading,
    statusSalvamento,
    isAuthenticated,
    
    // Valores calculados
    totalCustosFixos,
    custosFixosHora,
    
    // Ações de estrutura
    adicionarGastoPessoal,
    removerGastoPessoal,
    atualizarGastoPessoal,
    adicionarCustoEstudio,
    removerCustoEstudio,
    atualizarCustoEstudio,
    adicionarEquipamento,
    removerEquipamento,
    atualizarEquipamento,
    atualizarPercentualProLabore,
    salvarEstruturaCustos,
    
    // Ações de metas
    atualizarMetas,
    atualizarMargemLucro,
    
    // Utilitários
    recarregar: loadAllData,
    calcularTotal
  };
}
