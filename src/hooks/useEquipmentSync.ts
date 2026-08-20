import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EquipmentCandidate {
  transacaoId: string;
  nome: string;
  valor: number;
  data: string;
  observacoes?: string;
  allTransactionIds: string[];
}

// Eventos customizados para comunicação entre sistemas
export const EQUIPMENT_SYNC_EVENT = 'equipment-sync:candidate';
export const EQUIPMENT_CREATED_EVENT = 'equipment-sync:created';
export const EQUIPMENT_FORCE_SCAN_EVENT = 'equipment-sync:force-scan';

// Chave para IDs processados no localStorage
const PROCESSED_IDS_KEY = 'equipment_processed_ids';

// Obter IDs já processados
const getProcessedIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PROCESSED_IDS_KEY) || '[]');
  } catch {
    return [];
  }
};

// Marcar ID como processado
export const markTransactionAsProcessed = (transactionId: string) => {
  const processedIds = getProcessedIds();
  if (!processedIds.includes(transactionId)) {
    processedIds.push(transactionId);
    localStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(processedIds));
  }
};

export function useEquipmentSync() {
  const [isMonitoring, setIsMonitoring] = useState(true);

  const checkForNewEquipment = useCallback(async () => {
    try {
      // Verificar se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🔧 [EquipmentSync] Usuário não autenticado');
        return;
      }

      // Calcular data limite (últimas 24 horas)
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);
      const dataLimiteStr = dataLimite.toISOString();

      // Buscar transações recentes que são "Equipamentos" (Investimento)
      const { data: transacoes, error } = await supabase
        .from('fin_transactions')
        .select(`
          id,
          valor,
          data_vencimento,
          data_compra,
          observacoes,
          created_at,
          item_id,
          parent_id,
          fin_items_master!inner(nome, grupo_principal)
        `)
        .eq('fin_items_master.nome', 'Equipamentos')
        .eq('fin_items_master.grupo_principal', 'Investimento')
        .gte('created_at', dataLimiteStr)
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) {
        console.error('🔧 [EquipmentSync] Erro ao buscar transações:', error);
        return;
      }

      if (!transacoes || transacoes.length === 0) {
        return;
      }

      // Buscar equipamentos já criados com fin_transaction_id
      const { data: equipamentosExistentes } = await supabase
        .from('pricing_equipamentos')
        .select('fin_transaction_id')
        .eq('user_id', user.id)
        .not('fin_transaction_id', 'is', null);
      
      const existingFinIds = new Set(
        equipamentosExistentes?.map(e => e.fin_transaction_id) || []
      );

      // Buscar transações ignoradas persistidas no Supabase
      const { data: ignoredTransactions } = await supabase
        .from('pricing_ignored_transactions' as any)
        .select('transaction_id')
        .eq('user_id', user.id);
      
      const ignoredIds = new Set(
        (ignoredTransactions as any[] || []).map((t: any) => t.transaction_id)
      );

      // Filtrar transações não processadas
      const processedIds = getProcessedIds();
      const novasTransacoes = transacoes.filter(t => 
        !processedIds.includes(t.id) && 
        !existingFinIds.has(t.id) &&
        !ignoredIds.has(t.id)
      );

      if (novasTransacoes.length === 0) {
        return;
      }

      console.log(`🔧 [EquipmentSync] ${novasTransacoes.length} transações de equipamento detectadas`);

      // Agrupar transações por parent_id (parcelas do mesmo equipamento)
      const groupedByParent = new Map<string, typeof novasTransacoes>();
      
      novasTransacoes.forEach(t => {
        // Se tem parent_id, usa ele como chave do grupo; senão, usa próprio id
        const groupKey = (t as any).parent_id || t.id;
        if (!groupedByParent.has(groupKey)) {
          groupedByParent.set(groupKey, []);
        }
        groupedByParent.get(groupKey)!.push(t);
      });

      console.log(`🔧 [EquipmentSync] ${groupedByParent.size} equipamento(s) agrupado(s)`);

      // Emitir UM evento por GRUPO (não por transação individual)
      groupedByParent.forEach((transactions, groupKey) => {
        // Somar valores de todas as parcelas para obter valor TOTAL
        const valorTotal = transactions.reduce((sum, t) => sum + t.valor, 0);
        
        // Usar dados da primeira parcela (já ordenado por data_vencimento)
        const primeiraParcela = transactions[0];
        
        // Coletar todos os IDs do grupo
        const allIds = transactions.map(t => t.id);
        
        let nomeLimpo = primeiraParcela.observacoes?.split(' · ')[0] || '';
        nomeLimpo = nomeLimpo.replace(/\s*\(\d+\/\d+\)$/, '').replace(/\s*\(Cartão:[^)]+\)$/, '').trim();
        const nomeEquipamento = nomeLimpo || `Equipamento R$ ${valorTotal.toFixed(2)}`;
        
        const candidate: EquipmentCandidate = {
          transacaoId: primeiraParcela.id,
          nome: nomeEquipamento,
          valor: valorTotal,
          data: primeiraParcela.data_compra || primeiraParcela.data_vencimento,
          observacoes: nomeLimpo || undefined,
          allTransactionIds: allIds
        };

        const event = new CustomEvent(EQUIPMENT_SYNC_EVENT, {
          detail: candidate
        });
        
        window.dispatchEvent(event);
        console.log('🔧 [EquipmentSync] Candidato a equipamento emitido:', candidate);
      });
    } catch (error) {
      console.error('🔧 [EquipmentSync] Erro ao verificar equipamentos:', error);
    }
  }, []);

  useEffect(() => {
    if (!isMonitoring) return;

    // Listener para force-scan (imediato após criação de transação)
    const handleForceScan = () => {
      console.log('🔧 [EquipmentSync] Force scan solicitado');
      checkForNewEquipment();
    };

    // Verificação inicial (com pequeno delay para garantir auth)
    const initialTimeout = setTimeout(() => {
      checkForNewEquipment();
    }, 1000);

    // Verificar a cada 30 segundos (reduzido de 10s para evitar muitas queries)
    const interval = setInterval(checkForNewEquipment, 30000);
    
    // Listener para force-scan
    window.addEventListener(EQUIPMENT_FORCE_SCAN_EVENT, handleForceScan);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      window.removeEventListener(EQUIPMENT_FORCE_SCAN_EVENT, handleForceScan);
    };
  }, [isMonitoring, checkForNewEquipment]);

  const startMonitoring = () => setIsMonitoring(true);
  const stopMonitoring = () => setIsMonitoring(false);

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    checkForNewEquipment
  };
}

// Função utilitária para emitir evento de equipamento diretamente
export const emitEquipmentCandidate = (candidate: EquipmentCandidate) => {
  const event = new CustomEvent(EQUIPMENT_SYNC_EVENT, {
    detail: candidate
  });
  window.dispatchEvent(event);
  console.log('🔧 [EquipmentSync] Candidato emitido diretamente:', candidate);
};
