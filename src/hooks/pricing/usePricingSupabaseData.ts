/**
 * Hook para gerenciar dados de Pricing via Supabase
 * Com cache em memória e sincronização localStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabasePricingAdapter } from '@/services/pricing/SupabasePricingAdapter';
import { PricingMigrationToSupabase } from '@/services/pricing/PricingMigrationToSupabase';
import { MetasService } from '@/services/PricingService';
import { toast } from 'sonner';
import type { 
  EstruturaCustosFixos, 
  MetasPrecificacao, 
  PadraoHoras,
  GastoItem, 
  Equipamento, 
  StatusSalvamento 
} from '@/types/precificacao';

// ============= SINGLETON CACHE =============
// Persiste entre navegações de página
const pricingCache = {
  estruturaCustos: null as EstruturaCustosFixos | null,
  metas: null as MetasPrecificacao | null,
  padraoHoras: null as PadraoHoras | null,
  lastFetch: 0,
  isLoading: false,
  CACHE_TTL: 5 * 60 * 1000 // 5 minutos
};

// Verificar se cache ainda é válido
const isCacheValid = () => {
  return pricingCache.lastFetch > 0 && 
         Date.now() - pricingCache.lastFetch < pricingCache.CACHE_TTL;
};

// Invalidar cache (para forçar reload)
export const invalidatePricingCache = () => {
  pricingCache.lastFetch = 0;
};

export function usePricingSupabaseData() {
  const [estruturaCustos, setEstruturaCustos] = useState<EstruturaCustosFixos | null>(
    pricingCache.estruturaCustos
  );
  const [metas, setMetas] = useState<MetasPrecificacao | null>(pricingCache.metas);
  const [padraoHoras, setPadraoHoras] = useState<PadraoHoras | null>(pricingCache.padraoHoras);
  const [loading, setLoading] = useState(!isCacheValid());
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('salvo');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const adapterRef = useRef(new SupabasePricingAdapter());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadAllDataRef = useRef<() => Promise<void>>();

  // Funções de carregamento - com cache
  const loadAllData = useCallback(async () => {
    // Se cache ainda válido e temos dados, usar cache
    if (isCacheValid() && pricingCache.estruturaCustos) {
      console.log('📦 Usando cache de precificação');
      setEstruturaCustos(pricingCache.estruturaCustos);
      setMetas(pricingCache.metas);
      setPadraoHoras(pricingCache.padraoHoras);
      setLoading(false);
      setStatusSalvamento('salvo');
      return;
    }

    // Evitar múltiplas requisições simultâneas
    if (pricingCache.isLoading) {
      console.log('⏳ Já está carregando dados de precificação...');
      return;
    }

    pricingCache.isLoading = true;
    setLoading(true);
    
    // Timeout de 5 segundos
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Timeout no carregamento de dados de precificação');
      setLoading(false);
      setStatusSalvamento('erro');
      pricingCache.isLoading = false;
    }, 5000);
    
    try {
      // Carregamento progressivo: estrutura primeiro (mais importante)
      const estrutura = await adapterRef.current.loadEstruturaCustos();
      setEstruturaCustos(estrutura);
      pricingCache.estruturaCustos = estrutura;
      setLoading(false); // Mostrar UI imediatamente
      
      // Carregar resto em paralelo (secundário)
      const [metasData, horasData] = await Promise.all([
        adapterRef.current.loadMetas(),
        adapterRef.current.loadPadraoHoras()
      ]);
      
      setMetas(metasData);
      setPadraoHoras(horasData);
      
      // Atualizar cache
      pricingCache.metas = metasData;
      pricingCache.padraoHoras = horasData;
      pricingCache.lastFetch = Date.now();
      
      // Sincronizar com localStorage para GoalsIntegrationService
      if (metasData) {
        MetasService.salvar(metasData);
        console.log('✅ Metas sincronizadas com localStorage');
      }
      
      setStatusSalvamento('salvo');
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setStatusSalvamento('erro');
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
      pricingCache.isLoading = false;
    }
  }, []);

  // Manter referência atualizada para o realtime listener
  loadAllDataRef.current = loadAllData;

  const loadEstruturaCustos = useCallback(async () => {
    try {
      const estrutura = await adapterRef.current.loadEstruturaCustos();
      setEstruturaCustos(estrutura);
      pricingCache.estruturaCustos = estrutura;
    } catch (error) {
      console.error('Erro ao recarregar estrutura:', error);
    }
  }, []);

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
            invalidatePricingCache(); // Forçar reload após migração
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
        invalidatePricingCache();
        await loadAllData();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setEstruturaCustos(null);
        setMetas(null);
        setPadraoHoras(null);
        invalidatePricingCache();
      }
    });
    
    return () => subscription.unsubscribe();
  }, []); // loadAllData removido das deps para evitar loop

  // Real-time listener para mudanças - com cleanup correto
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupRealtimeListeners = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;
      
      channel = supabase
        .channel('pricing-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_configuracoes',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) {
            invalidatePricingCache();
            loadAllDataRef.current?.();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_gastos_pessoais',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) loadEstruturaCustos();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_custos_estudio',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) loadEstruturaCustos();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_equipamentos',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) loadEstruturaCustos();
        })
        .subscribe();
    };
    
    setupRealtimeListeners();
    
    // Cleanup correto
    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAuthenticated, loadEstruturaCustos]);

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
        
        // Atualizar cache após salvar
        if (success) {
          pricingCache.lastFetch = Date.now();
        }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
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
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  const salvarEstruturaCustos = useCallback(async (dados: EstruturaCustosFixos) => {
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(dados),
      () => {
        setEstruturaCustos(dados);
        pricingCache.estruturaCustos = dados;
      }
    );
    return true;
  }, [saveWithDebounce]);

  // ============= AÇÕES DE METAS =============

  const atualizarMetas = useCallback(async (novasMetas: MetasPrecificacao) => {
    saveWithDebounce(
      async () => {
        const success = await adapterRef.current.saveMetas(novasMetas);
        if (success) {
          // Sincronizar com localStorage
          MetasService.salvar(novasMetas);
        }
        return success;
      },
      () => {
        setMetas(novasMetas);
        pricingCache.metas = novasMetas;
      }
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
