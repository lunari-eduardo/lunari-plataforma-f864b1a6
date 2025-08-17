import { useMemo } from 'react';
import { useNovoFinancas } from './useNovoFinancas';
import { FinancialEngine } from '@/services/FinancialEngine';

interface CriticalFinancialItem {
  id: string;
  itemName: string;
  amount: number;
  dueDate: string;
  status: 'Agendado' | 'Faturado' | 'Pago';
  daysUntilDue: number;
  urgency: 'today' | 'tomorrow' | 'soon';
}

interface TodayBilledSummary {
  totalAmount: number;
  count: number;
  transactions: CriticalFinancialItem[];
}

export function useFinancialDashboardData() {
  const { itensFinanceiros, marcarComoPago } = useNovoFinancas();
  
  // Load transactions from FinancialEngine
  const transacoes = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  // Enhanced transactions with item details
  const transacoesComItens = useMemo(() => {
    return transacoes.map(transacao => {
      const item = itensFinanceiros.find(item => item.id === transacao.itemId);
      return {
        ...transacao,
        item: item || null
      };
    });
  }, [transacoes, itensFinanceiros]);

  // Critical data: upcoming scheduled/billed accounts (next 3 days)
  const upcomingAccounts = useMemo((): CriticalFinancialItem[] => {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    return transacoesComItens
      .filter(t => 
        t.item && 
        (t.status === 'Agendado' || t.status === 'Faturado') &&
        t.dataVencimento >= todayStr &&
        t.dataVencimento <= threeDaysStr
      )
      .map(t => {
        const dueDate = new Date(t.dataVencimento + 'T00:00:00');
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let urgency: 'today' | 'tomorrow' | 'soon';
        if (diffDays <= 0) urgency = 'today';
        else if (diffDays === 1) urgency = 'tomorrow';
        else urgency = 'soon';

        const amount = typeof t.valor === 'string' 
          ? parseFloat((t.valor as string).replace(/[^\d,.-]/g, '').replace(',', '.')) 
          : (t.valor as number);

        return {
          id: t.id,
          itemName: t.item?.nome || 'Item sem nome',
          amount: isNaN(amount) ? 0 : amount,
          dueDate: t.dataVencimento,
          status: t.status as 'Agendado' | 'Faturado' | 'Pago',
          daysUntilDue: diffDays,
          urgency
        };
      })
      .sort((a, b) => {
        // Sort by urgency first, then by amount (desc)
        const urgencyOrder = { today: 0, tomorrow: 1, soon: 2 };
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return b.amount - a.amount;
      })
      .slice(0, 5); // Top 5 most critical
  }, [transacoesComItens]);

  // Today's billed accounts summary
  const todayBilledSummary = useMemo((): TodayBilledSummary => {
    const today = new Date().toISOString().split('T')[0];
    
    const todayBilled = transacoesComItens
      .filter(t => 
        t.item &&
        t.status === 'Faturado' &&
        t.dataVencimento === today
      )
      .map(t => {
        const amount = typeof t.valor === 'string' 
          ? parseFloat((t.valor as string).replace(/[^\d,.-]/g, '').replace(',', '.')) 
          : (t.valor as number);

        return {
          id: t.id,
          itemName: t.item?.nome || 'Item sem nome',
          amount: isNaN(amount) ? 0 : amount,
          dueDate: t.dataVencimento,
          status: t.status as 'Agendado' | 'Faturado' | 'Pago',
          daysUntilDue: 0,
          urgency: 'today' as const
        };
      });

    const totalAmount = todayBilled.reduce((sum, item) => sum + item.amount, 0);

    return {
      totalAmount,
      count: todayBilled.length,
      transactions: todayBilled.sort((a, b) => b.amount - a.amount)
    };
  }, [transacoesComItens]);

  // Quick action: mark as paid
  const markAsPaidQuick = async (transactionId: string) => {
    try {
      await marcarComoPago(transactionId);
      return true;
    } catch (error) {
      console.error('Error marking as paid:', error);
      return false;
    }
  };

  // Utility functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getUrgencyColor = (urgency: 'today' | 'tomorrow' | 'soon') => {
    switch (urgency) {
      case 'today': return 'text-destructive';
      case 'tomorrow': return 'text-lunar-warning';
      case 'soon': return 'text-primary';
      default: return 'text-lunar-textSecondary';
    }
  };

  const getUrgencyBgColor = (urgency: 'today' | 'tomorrow' | 'soon') => {
    switch (urgency) {
      case 'today': return 'bg-destructive/10 border-destructive/20';
      case 'tomorrow': return 'bg-lunar-warning/10 border-lunar-warning/20';
      case 'soon': return 'bg-primary/10 border-primary/20';
      default: return 'bg-lunar-surface border-lunar-border';
    }
  };

  return {
    upcomingAccounts,
    todayBilledSummary,
    markAsPaidQuick,
    formatCurrency,
    formatDate,
    getUrgencyColor,
    getUrgencyBgColor
  };
}