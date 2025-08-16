import { useEffect, useMemo, useState, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

export interface LeadStatusDef {
  id: string;
  key: string; // valor salvo no lead
  name: string; // rótulo exibido
  order: number;
  color?: string; // cor do status
  isConverted?: boolean; // identifica status de convertido
  isLost?: boolean; // identifica status de perdido
}

const DEFAULT_LEAD_STATUSES: LeadStatusDef[] = [
  { id: 'novo_interessado', key: 'novo_interessado', name: 'Novo - Interessado', order: 1, color: '#3b82f6' }, // blue
  { id: 'aguardando', key: 'aguardando', name: 'Aguardando', order: 2, color: '#f59e0b' }, // amber
  { id: 'orcamento_enviado', key: 'orcamento_enviado', name: 'Orçamento Enviado', order: 3, color: '#8b5cf6' }, // violet
  { id: 'followup', key: 'followup', name: 'Follow-up', order: 4, color: '#f97316' }, // orange
  { id: 'fechado', key: 'fechado', name: 'Fechado', order: 5, isConverted: true, color: '#10b981' }, // emerald
  { id: 'perdido', key: 'perdido', name: 'Perdido', order: 6, isLost: true, color: '#ef4444' }, // red
];

export const useLeadStatuses = () => {
  const [tick, setTick] = useState(0);

  const statuses = useMemo<LeadStatusDef[]>(() => {
    const saved = storage.load<LeadStatusDef[]>(STORAGE_KEYS.LEAD_STATUSES, []);
    if (!saved || saved.length === 0) return DEFAULT_LEAD_STATUSES;
    
    // Check if we have old statuses and need to migrate
    const hasOldStatuses = saved.some(s => 
      ['novo_contato', 'interessado', 'proposta_enviada', 'convertido'].includes(s.key)
    );
    
    if (hasOldStatuses) {
      // Migrate to new status structure
      const migrated = saved.map(status => {
        switch (status.key) {
          case 'novo_contato':
          case 'interessado':
            return { ...status, key: 'novo_interessado', name: 'Novo - Interessado', id: 'novo_interessado' };
          case 'proposta_enviada':
            return { ...status, key: 'orcamento_enviado', name: 'Orçamento Enviado', id: 'orcamento_enviado' };
          case 'convertido':
            return { ...status, key: 'fechado', name: 'Fechado', id: 'fechado', isConverted: true };
          default:
            return status;
        }
      });
      
      // Add missing new statuses
      const existingKeys = migrated.map(s => s.key);
      const newStatuses = DEFAULT_LEAD_STATUSES.filter(s => !existingKeys.includes(s.key));
      
      const fullMigrated = [...migrated, ...newStatuses].sort((a, b) => a.order - b.order);
      storage.save(STORAGE_KEYS.LEAD_STATUSES, fullMigrated);
      return fullMigrated;
    }
    
    return [...saved].sort((a, b) => a.order - b.order);
  }, [tick]);

  const save = useCallback((items: LeadStatusDef[]) => {
    storage.save(STORAGE_KEYS.LEAD_STATUSES, items);
    setTick((v) => v + 1);
    window.dispatchEvent(new Event('leadStatusesUpdated'));
  }, []);

  const addStatus = useCallback((name: string) => {
    const id = `lead_status_${Date.now()}`;
    const next: LeadStatusDef = { 
      id, 
      key: id, 
      name: name.trim() || 'Novo status', 
      order: (statuses[statuses.length - 1]?.order ?? 0) + 1 
    };
    save([...statuses, next]);
    return next;
  }, [save, statuses]);

  const updateStatus = useCallback((id: string, patch: Partial<LeadStatusDef>) => {
    const next = statuses.map((s) => (s.id === id ? { ...s, ...patch } : s));
    save(next);
  }, [save, statuses]);

  const removeStatus = useCallback((id: string) => {
    save(statuses.filter((s) => s.id !== id));
    return true;
  }, [save, statuses]);

  const moveStatus = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = statuses.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= statuses.length) return;
    const copy = [...statuses];
    const a = copy[idx];
    const b = copy[swapWith];
    // swap order
    const tmp = a.order; a.order = b.order; b.order = tmp;
    copy[idx] = b; copy[swapWith] = a;
    save(copy.sort((x, y) => x.order - y.order));
  }, [save, statuses]);

  const getConvertedKey = useCallback(() => {
    return statuses.find((s) => s.isConverted)?.key || 'fechado';
  }, [statuses]);

  const getDefaultOpenKey = useCallback(() => {
    return (statuses.find((s) => !s.isConverted && !s.isLost)?.key) || statuses[0]?.key || 'novo_contato';
  }, [statuses]);

  // Força atualização quando localStorage externo alterar
  useEffect(() => {
    const onChange = () => setTick((v) => v + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('leadStatusesUpdated', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('leadStatusesUpdated', onChange);
    };
  }, []);

  return {
    statuses,
    addStatus,
    updateStatus,
    removeStatus,
    moveStatus,
    getConvertedKey,
    getDefaultOpenKey,
  };
};