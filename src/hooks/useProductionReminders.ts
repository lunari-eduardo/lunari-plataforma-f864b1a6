import { useState, useEffect, useCallback } from 'react';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';

interface ProductionReminder {
  id: string;
  cliente: string;
  produto: string;
  tipo: string;
}

export function useProductionReminders(): ProductionReminder[] {
  const { subscribe, getAllCachedSessionsSync } = useWorkflowCache();
  const [reminders, setReminders] = useState<ProductionReminder[]>([]);

  const extractReminders = useCallback((sessions: WorkflowSession[]) => {
    const pending: ProductionReminder[] = [];
    
    sessions.forEach(session => {
      const produtos = session.produtos_incluidos as any[] || [];
      const clienteNome = session.clientes?.nome || 'Cliente desconhecido';
      
      produtos.forEach((p: any) => {
        if (!p.produzido) {
          pending.push({
            id: `${session.id}-${p.nome}`,
            cliente: clienteNome,
            produto: p.nome,
            tipo: p.tipo || 'incluso'
          });
        }
      });
    });
    
    return pending;
  }, []);

  useEffect(() => {
    // Carregar inicial
    const initialSessions = getAllCachedSessionsSync();
    setReminders(extractReminders(initialSessions));
    
    // Subscrever para atualizações em tempo real
    const unsubscribe = subscribe((sessions) => {
      setReminders(extractReminders(sessions));
    });

    return unsubscribe;
  }, [subscribe, getAllCachedSessionsSync, extractReminders]);

  return reminders;
}
