import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppNotification, NotificationCategory, NotificationPriority } from '@/types/notifications';
import { NotificationStateService } from '@/services/NotificationStateService';
import { useFinancialNotifications } from './notifications/useFinancialNotifications';
import { useTaskNotifications } from './notifications/useTaskNotifications';
import { useContractNotifications } from './notifications/useContractNotifications';
import { useClientNotifications } from './notifications/useClientNotifications';
import { useAgendaNotifications } from './notifications/useAgendaNotifications';
import { useProductionReminders } from './useProductionReminders';

const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  countByCategory: Record<NotificationCategory | 'all', number>;
}

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const userId = user?.id || '';

  const financial = useFinancialNotifications();
  const tasks = useTaskNotifications();
  const contracts = useContractNotifications();
  const clients = useClientNotifications();
  const agenda = useAgendaNotifications();
  const productionReminders = useProductionReminders();

  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Hidratar estado do localStorage por usuário
  useEffect(() => {
    if (!userId) {
      setReadIds([]);
      setDismissedIds([]);
      return;
    }
    const s = NotificationStateService.load(userId);
    setReadIds(s.readIds);
    setDismissedIds(s.dismissedIds);
  }, [userId]);

  // Converter lembretes de produção para AppNotification
  const productionAsNotifs = useMemo<AppNotification[]>(
    () => productionReminders.map((p) => ({
      id: `prod-pending-${p.id}`,
      category: 'pendencia',
      priority: 'alta',
      title: 'Produto pendente de produção',
      description: `${p.quantidade > 1 ? p.quantidade + 'x ' : ''}${p.produto} — ${p.cliente}`,
      timestamp: p.dataSessao + 'T00:00:00Z',
      route: '/app/workflow',
      icon: 'package',
    })),
    [productionReminders]
  );

  const all = useMemo<AppNotification[]>(() => {
    const dismissed = new Set(dismissedIds);
    const merged = [
      ...financial,
      ...tasks,
      ...contracts,
      ...clients,
      ...agenda,
      ...productionAsNotifs,
    ].filter((n) => !dismissed.has(n.id));

    // Dedupe por id (caso fontes coincidam)
    const map = new Map<string, AppNotification>();
    merged.forEach((n) => map.set(n.id, n));

    return Array.from(map.values()).sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [financial, tasks, contracts, clients, agenda, productionAsNotifs, dismissedIds]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const unreadCount = useMemo(
    () => all.filter((n) => !readSet.has(n.id)).length,
    [all, readSet]
  );

  const countByCategory = useMemo(() => {
    const acc: Record<NotificationCategory | 'all', number> = {
      all: 0,
      pendencia: 0,
      financeiro: 0,
      cliente: 0,
      documento: 0,
      agenda: 0,
    };
    all.forEach((n) => {
      acc.all += 1;
      acc[n.category] += 1;
    });
    return acc;
  }, [all]);

  const isRead = useCallback((id: string) => readSet.has(id), [readSet]);

  const markAsRead = useCallback((id: string) => {
    if (!userId) return;
    const s = NotificationStateService.markRead(userId, id);
    setReadIds(s.readIds);
  }, [userId]);

  const markAllAsRead = useCallback(() => {
    if (!userId) return;
    const ids = all.map((n) => n.id);
    const s = NotificationStateService.markAllRead(userId, ids);
    setReadIds(s.readIds);
  }, [userId, all]);

  const dismiss = useCallback((id: string) => {
    if (!userId) return;
    const s = NotificationStateService.dismiss(userId, id);
    setDismissedIds(s.dismissedIds);
  }, [userId]);

  return {
    notifications: all,
    unreadCount,
    isRead,
    markAsRead,
    markAllAsRead,
    dismiss,
    countByCategory,
  };
}
