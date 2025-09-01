import { useMemo } from 'react';
import { useLeads } from '../core/useLeads';
import { getLossReasons } from '@/config/motivosPerda';

export interface LossReasonStat {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

export function useLeadLossReasons() {
  const { leads } = useLeads();
  const lossReasons = getLossReasons();

  const lossReasonStats = useMemo<LossReasonStat[]>(() => {
    const lostLeads = leads.filter(lead => lead.status === 'perdido');
    const totalLost = lostLeads.length;

    if (totalLost === 0) {
      return lossReasons.map(reason => ({
        id: reason.id,
        label: reason.label,
        count: 0,
        percentage: 0
      }));
    }

    // Count leads by loss reason
    const reasonCounts = lossReasons.reduce((acc, reason) => {
      acc[reason.id] = lostLeads.filter(lead => lead.motivoPerda === reason.id).length;
      return acc;
    }, {} as Record<string, number>);

    // Count leads without reason
    const withoutReason = lostLeads.filter(lead => !lead.motivoPerda).length;
    if (withoutReason > 0) {
      reasonCounts['sem_motivo'] = withoutReason;
    }

    // Create stats array
    const stats: LossReasonStat[] = [];
    
    // Add configured reasons
    lossReasons.forEach(reason => {
      const count = reasonCounts[reason.id] || 0;
      stats.push({
        id: reason.id,
        label: reason.label,
        count,
        percentage: totalLost > 0 ? Math.round((count / totalLost) * 100) : 0
      });
    });

    // Add "without reason" if exists
    if (withoutReason > 0) {
      stats.push({
        id: 'sem_motivo',
        label: 'Motivo não informado',
        count: withoutReason,
        percentage: Math.round((withoutReason / totalLost) * 100)
      });
    }

    // Sort by count descending
    return stats.sort((a, b) => b.count - a.count);
  }, [leads, lossReasons]);

  const totalLostLeads = useMemo(() => {
    return leads.filter(lead => lead.status === 'perdido').length;
  }, [leads]);

  const leadsWithoutReason = useMemo(() => {
    return leads.filter(lead => lead.status === 'perdido' && !lead.motivoPerda).length;
  }, [leads]);

  return {
    lossReasonStats,
    totalLostLeads,
    leadsWithoutReason,
    hasData: totalLostLeads > 0
  };
}