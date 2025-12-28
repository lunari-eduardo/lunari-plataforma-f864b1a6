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
  hasLoadedOnce: false, // Nova flag: já carregou pelo menos uma vez
  statusSalvamento: 'salvo' as StatusSalvamento, // Persistir status no cache
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
  // Inicializar estado com cache para evitar loading desnecessário
  const [estruturaCustos, setEstruturaCustos] = useState<EstruturaCustosFixos | null>(
    pricingCache.estruturaCustos
  );
  const [metas, setMetas] = useState<MetasPrecificacao | null>(pricingCache.metas);
  const [padraoHoras, setPadraoHoras] = useState<PadraoHoras | null>(pricingCache.padraoHoras);
  
  // Loading só é true se NUNCA carregou e não tem dados no cache
  const [loading, setLoading] = useState(
    !pricingCache.hasLoadedOnce && !pricingCache.estruturaCustos
  );
  
  // Status de salvamento vem do cache para persistir entre navegações
  const [statusSalvamento, setStatusSalvamentoLocal] = useState<StatusSalvamento>(
    pricingCache.statusSalvamento
  );
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const adapterRef = useRef(new SupabasePricingAdapter());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const loadAllDataRef = useRef<() => Promise<void>>();
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapper para setStatusSalvamento que também atualiza o cache
  const setStatusSalvamento = useCallback((status: StatusSalvamento) => {
    setStatusSalvamentoLocal(status);
    pricingCache.statusSalvamento = status;
  }, []);

  // Funções de carregamento - com cache inteligente
  const loadAllData = useCallback(async () => {
    // Se já tem dados no cache, usar imediatamente (sem loading spinner)
    if (pricingCache.estruturaCustos) {
      setEstruturaCustos(pricingCache.estruturaCustos);
      setMetas(pricingCache.metas);
      setPadraoHoras(pricingCache.padraoHoras);
      setLoading(false);
      
      // Se cache ainda válido, não precisa recarregar
      if (isCacheValid()) {
        console.log('📦 Cache válido, usando dados existentes');
        return;
      }
      
      // Recarregar em background silenciosamente
      console.log('🔄 Atualizando dados em background...');
    }

    // Evitar múltiplas requisições simultâneas
    if (pricingCache.isLoading) {
      console.log('⏳ Já está carregando dados de precificação...');
      return;
    }

    pricingCache.isLoading = true;
    
    // Só mostrar loading se não tem dados ainda
    if (!pricingCache.estruturaCustos) {
      setLoading(true);
    }
    
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
      pricingCache.hasLoadedOnce = true; // Marcar que já carregou
      
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
  }, [setStatusSalvamento]);

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

  // Handler para mudanças realtime com debounce
  const handleRealtimeChange = useCallback(() => {
    if (realtimeDebounceRef.current) {
      clearTimeout(realtimeDebounceRef.current);
    }
    
    realtimeDebounceRef.current = setTimeout(() => {
      console.log('🔄 Realtime: recarregando dados...');
      invalidatePricingCache();
      loadAllDataRef.current?.();
    }, 1000); // 1 segundo de debounce
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
            invalidatePricingCache();
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
        pricingCache.hasLoadedOnce = false; // Reset para forçar novo load
        await loadAllData();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setEstruturaCustos(null);
        setMetas(null);
        setPadraoHoras(null);
        invalidatePricingCache();
        pricingCache.hasLoadedOnce = false;
      }
    });
    
    return () => subscription.unsubscribe();
  }, []); // loadAllData removido das deps para evitar loop

  // Real-time listener para mudanças - com debounce
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
          if (isMounted) handleRealtimeChange();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_gastos_pessoais',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) handleRealtimeChange();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_custos_estudio',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) handleRealtimeChange();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pricing_equipamentos',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (isMounted) handleRealtimeChange();
        })
        .subscribe();
    };
    
    setupRealtimeListeners();
    
    // Cleanup correto
    return () => {
      isMounted = false;
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAuthenticated, handleRealtimeChange]);

  // Função para executar save pendente imediatamente
  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (pendingSaveRef.current) {
      try {
        console.log('🔄 Executando save pendente...');
        await pendingSaveRef.current();
        console.log('✅ Save pendente executado');
      } catch (error) {
        console.error('❌ Erro no save pendente:', error);
      }
      pendingSaveRef.current = null;
    }
  }, []);

  // ============= SAVE IMEDIATO (SEM DEBOUNCE) =============
  // Para ações críticas como adicionar equipamento ou alterar pró-labore
  const saveImmediate = useCallback(async (
    saveFn: () => Promise<boolean>,
    optimisticUpdate: () => void
  ): Promise<boolean> => {
    // Cancelar qualquer debounce pendente
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
    
    // Update otimista imediato
    optimisticUpdate();
    setStatusSalvamento('salvando');
    
    try {
      console.log('💾 [IMMEDIATE] Salvando dados IMEDIATAMENTE...');
      const success = await saveFn();
      console.log(success ? '✅ [IMMEDIATE] Dados salvos com sucesso!' : '❌ [IMMEDIATE] Falha ao salvar');
      setStatusSalvamento(success ? 'salvo' : 'erro');
      
      if (success) {
        pricingCache.lastFetch = Date.now();
        toast.success('Dados salvos com sucesso');
      } else {
        toast.error('Erro ao salvar dados');
      }
      
      return success;
    } catch (error) {
      console.error('❌ [IMMEDIATE] Erro ao salvar:', error);
      setStatusSalvamento('erro');
      toast.error('Erro ao salvar dados');
      return false;
    }
  }, [setStatusSalvamento]);

  // Função de salvamento com debounce (para edições contínuas)
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
    
    // Guardar referência ao save pendente
    pendingSaveRef.current = saveFn;
    
    // Debounce reduzido para 200ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('💾 [DEBOUNCE] Salvando dados de precificação...');
        const success = await saveFn();
        console.log(success ? '✅ [DEBOUNCE] Dados salvos' : '❌ [DEBOUNCE] Falha ao salvar');
        setStatusSalvamento(success ? 'salvo' : 'erro');
        
        // Limpar referência pendente
        pendingSaveRef.current = null;
        
        // Atualizar cache após salvar
        if (success) {
          pricingCache.lastFetch = Date.now();
        }
      } catch (error) {
        console.error('❌ [DEBOUNCE] Erro ao salvar:', error);
        setStatusSalvamento('erro');
        pendingSaveRef.current = null;
      }
    }, 200);
  }, [setStatusSalvamento]);

  // Cleanup: executar saves pendentes ao desmontar e ao sair da página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Se há save pendente, avisar usuário e tentar salvar
      if (pendingSaveRef.current) {
        console.log('🔄 Página fechando, executando save pendente...');
        e.preventDefault();
        e.returnValue = 'Há alterações não salvas. Deseja sair?';
        // Executar save de forma síncrona (melhor esforço)
        pendingSaveRef.current();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Ao desmontar, forçar execução do save pendente
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        console.log('🔄 Componente desmontando, executando save pendente...');
        pendingSaveRef.current();
        pendingSaveRef.current = null;
      }
    };
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

  // ============= EQUIPAMENTOS (SAVE IMEDIATO) =============
  const adicionarEquipamento = useCallback(async (equipamento: Omit<Equipamento, 'id'>): Promise<boolean> => {
    if (!estruturaCustos) {
      console.error('❌ [EQUIPAMENTO] estruturaCustos é null');
      return false;
    }
    
    const novoEquipamento: Equipamento = {
      ...equipamento,
      id: crypto.randomUUID()
    };
    
    console.log('🔧 [EQUIPAMENTO] Adicionando:', novoEquipamento);
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: [...estruturaCustos.equipamentos, novoEquipamento]
    };
    
    // USAR SAVE IMEDIATO (não debounce!) para equipamentos
    return saveImmediate(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
    );
  }, [estruturaCustos, saveImmediate]);

  const removerEquipamento = useCallback(async (equipamentoId: string): Promise<boolean> => {
    if (!estruturaCustos) return false;
    
    console.log('🗑️ [EQUIPAMENTO] Removendo:', equipamentoId);
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: estruturaCustos.equipamentos.filter(e => e.id !== equipamentoId)
    };
    
    // USAR SAVE IMEDIATO
    return saveImmediate(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
    );
  }, [estruturaCustos, saveImmediate]);

  const atualizarEquipamento = useCallback(async (equipamentoId: string, campo: keyof Equipamento, valor: any): Promise<boolean> => {
    if (!estruturaCustos) return false;
    
    const novosDados = {
      ...estruturaCustos,
      equipamentos: estruturaCustos.equipamentos.map(e => 
        e.id === equipamentoId ? { ...e, [campo]: valor } : e
      )
    };
    
    // Debounce para edições contínuas
    saveWithDebounce(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
    );
    
    return true;
  }, [estruturaCustos, saveWithDebounce]);

  // ============= PRÓ-LABORE (SAVE IMEDIATO) =============
  const atualizarPercentualProLabore = useCallback(async (percentual: number): Promise<boolean> => {
    if (!estruturaCustos) {
      console.error('❌ [PRO-LABORE] estruturaCustos é null');
      return false;
    }
    
    console.log('💰 [PRO-LABORE] Atualizando para:', percentual, '%');
    
    const novosDados = {
      ...estruturaCustos,
      percentualProLabore: percentual
    };
    
    // USAR SAVE IMEDIATO para pró-labore
    return saveImmediate(
      () => adapterRef.current.saveEstruturaCustos(novosDados),
      () => {
        setEstruturaCustos(novosDados);
        pricingCache.estruturaCustos = novosDados;
      }
    );
  }, [estruturaCustos, saveImmediate]);

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
    calcularTotal,
    flushPendingSave
  };
}
