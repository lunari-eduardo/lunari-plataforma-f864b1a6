import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { SupabasePricingAdapter } from '@/services/pricing/SupabasePricingAdapter';
import { MetasService } from '@/services/PricingService';
import type {
  EstruturaCustosFixos,
  MetasPrecificacao,
  GastoItem,
  Equipamento,
  StatusSalvamento,
} from '@/types/precificacao';
import { pricingCache } from './pricingCache';

interface UsePricingMutationsProps {
  adapterRef: React.MutableRefObject<SupabasePricingAdapter>;
  estruturaCustos: EstruturaCustosFixos | null;
  setEstruturaCustos: React.Dispatch<React.SetStateAction<EstruturaCustosFixos | null>>;
  metas: MetasPrecificacao | null;
  setMetas: React.Dispatch<React.SetStateAction<MetasPrecificacao | null>>;
  setStatusSalvamento: (status: StatusSalvamento) => void;
}

export const usePricingMutations = ({
  adapterRef,
  estruturaCustos,
  setEstruturaCustos,
  metas,
  setMetas,
  setStatusSalvamento,
}: UsePricingMutationsProps) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<(() => Promise<boolean>) | null>(null);

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

  const saveImmediate = useCallback(
    async (
      saveFn: () => Promise<boolean>,
      optimisticUpdate: () => void,
    ): Promise<boolean> => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      pendingSaveRef.current = null;

      optimisticUpdate();
      setStatusSalvamento('salvando');

      try {
        console.log('💾 [IMMEDIATE] Salvando dados IMEDIATAMENTE...');
        const success = await saveFn();
        console.log(
          success
            ? '✅ [IMMEDIATE] Dados salvos com sucesso!'
            : '❌ [IMMEDIATE] Falha ao salvar',
        );
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
    },
    [setStatusSalvamento],
  );

  const saveWithDebounce = useCallback(
    async (saveFn: () => Promise<boolean>, optimisticUpdate: () => void) => {
      optimisticUpdate();
      setStatusSalvamento('salvando');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      pendingSaveRef.current = saveFn;

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('💾 [DEBOUNCE] Salvando dados de precificação...');
          const success = await saveFn();
          console.log(success ? '✅ [DEBOUNCE] Dados salvos' : '❌ [DEBOUNCE] Falha ao salvar');
          setStatusSalvamento(success ? 'salvo' : 'erro');

          pendingSaveRef.current = null;

          if (success) {
            pricingCache.lastFetch = Date.now();
          }
        } catch (error) {
          console.error('❌ [DEBOUNCE] Erro ao salvar:', error);
          setStatusSalvamento('erro');
          pendingSaveRef.current = null;
        }
      }, 200);
    },
    [setStatusSalvamento],
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaveRef.current) {
        console.log('🔄 Página fechando, executando save pendente...');
        e.preventDefault();
        e.returnValue = 'Há alterações não salvas. Deseja sair?';
        pendingSaveRef.current();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

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

  const adicionarGastoPessoal = useCallback(
    async (gasto: Omit<GastoItem, 'id'>) => {
      if (!estruturaCustos) return false;

      const novoGasto: GastoItem = {
        ...gasto,
        id: crypto.randomUUID(),
      };

      const novosDados = {
        ...estruturaCustos,
        gastosPessoais: [...estruturaCustos.gastosPessoais, novoGasto],
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const removerGastoPessoal = useCallback(
    async (gastoId: string) => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        gastosPessoais: estruturaCustos.gastosPessoais.filter((g) => g.id !== gastoId),
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const atualizarGastoPessoal = useCallback(
    async (gastoId: string, campo: keyof GastoItem, valor: any) => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        gastosPessoais: estruturaCustos.gastosPessoais.map((g) =>
          g.id === gastoId ? { ...g, [campo]: valor } : g,
        ),
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const adicionarCustoEstudio = useCallback(
    async (custo: Omit<GastoItem, 'id'>) => {
      if (!estruturaCustos) return false;

      const novoCusto: GastoItem = {
        ...custo,
        id: crypto.randomUUID(),
      };

      const novosDados = {
        ...estruturaCustos,
        custosEstudio: [...estruturaCustos.custosEstudio, novoCusto],
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const removerCustoEstudio = useCallback(
    async (custoId: string) => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        custosEstudio: estruturaCustos.custosEstudio.filter((c) => c.id !== custoId),
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const atualizarCustoEstudio = useCallback(
    async (custoId: string, campo: keyof GastoItem, valor: any) => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        custosEstudio: estruturaCustos.custosEstudio.map((c) =>
          c.id === custoId ? { ...c, [campo]: valor } : c,
        ),
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const adicionarEquipamento = useCallback(
    async (
      equipamento: Omit<Equipamento, 'id'> & { fin_transaction_id?: string },
    ): Promise<boolean> => {
      if (!estruturaCustos) {
        console.error('❌ [EQUIPAMENTO] estruturaCustos é null');
        return false;
      }

      const novoEquipamento: Equipamento = {
        id: crypto.randomUUID(),
        nome: equipamento.nome,
        valorPago: equipamento.valorPago,
        dataCompra: equipamento.dataCompra,
        vidaUtil: equipamento.vidaUtil,
        fin_transaction_id: equipamento.fin_transaction_id,
      };

      const novosDados = {
        ...estruturaCustos,
        equipamentos: [...estruturaCustos.equipamentos, novoEquipamento],
      };

      return saveImmediate(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );
    },
    [estruturaCustos, saveImmediate, adapterRef, setEstruturaCustos],
  );

  const removerEquipamento = useCallback(
    async (equipamentoId: string): Promise<boolean> => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        equipamentos: estruturaCustos.equipamentos.filter((e) => e.id !== equipamentoId),
      };

      return saveImmediate(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );
    },
    [estruturaCustos, saveImmediate, adapterRef, setEstruturaCustos],
  );

  const atualizarEquipamento = useCallback(
    async (equipamentoId: string, campo: keyof Equipamento, valor: any): Promise<boolean> => {
      if (!estruturaCustos) return false;

      const novosDados = {
        ...estruturaCustos,
        equipamentos: estruturaCustos.equipamentos.map((e) =>
          e.id === equipamentoId ? { ...e, [campo]: valor } : e,
        ),
      };

      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );

      return true;
    },
    [estruturaCustos, saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const atualizarPercentualProLabore = useCallback(
    async (percentual: number): Promise<boolean> => {
      if (!estruturaCustos) {
        console.error('❌ [PRO-LABORE] estruturaCustos é null');
        return false;
      }

      const novosDados = {
        ...estruturaCustos,
        percentualProLabore: percentual,
      };

      return saveImmediate(
        () => adapterRef.current.saveEstruturaCustos(novosDados),
        () => {
          setEstruturaCustos(novosDados);
          pricingCache.estruturaCustos = novosDados;
        },
      );
    },
    [estruturaCustos, saveImmediate, adapterRef, setEstruturaCustos],
  );

  const salvarEstruturaCustos = useCallback(
    async (dados: EstruturaCustosFixos) => {
      saveWithDebounce(
        () => adapterRef.current.saveEstruturaCustos(dados),
        () => {
          setEstruturaCustos(dados);
          pricingCache.estruturaCustos = dados;
        },
      );
      return true;
    },
    [saveWithDebounce, adapterRef, setEstruturaCustos],
  );

  const atualizarMetas = useCallback(
    async (novasMetas: MetasPrecificacao) => {
      saveWithDebounce(
        async () => {
          const success = await adapterRef.current.saveMetas(novasMetas);
          if (success) {
            MetasService.salvar(novasMetas);
          }
          return success;
        },
        () => {
          setMetas(novasMetas);
          pricingCache.metas = novasMetas;
        },
      );
      return true;
    },
    [saveWithDebounce, adapterRef, setMetas],
  );

  const atualizarMargemLucro = useCallback(
    async (margem: number) => {
      if (!metas) return false;

      const novasMetas = {
        ...metas,
        margemLucroDesejada: margem,
      };

      return atualizarMetas(novasMetas);
    },
    [metas, atualizarMetas],
  );

  return {
    flushPendingSave,
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
    atualizarMetas,
    atualizarMargemLucro,
  };
};
