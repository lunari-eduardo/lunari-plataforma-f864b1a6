import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComercialKPIs {
  propostasCriadas: number;
  compartilhamentosEnviados: number;
  aberturasUnicas: number;
  taxaAbertura: number;
  ctasClicados: number;
  taxaConversaoLead: number;
  leadsComProposta: number;
  leadsConvertidos: number;
}

export function useComercialIntelligence() {
  return useQuery({
    queryKey: ['comercial-intelligence'],
    queryFn: async (): Promise<ComercialKPIs> => {
      // 1. Propostas criadas (commercial_materials)
      const { count: propostasCriadas } = await supabase
        .from('commercial_materials')
        .select('*', { count: 'exact', head: true });

      // 2. Compartilhamentos enviados (material_shares)
      const { data: shares, count: compartilhamentosEnviados } = await supabase
        .from('material_shares')
        .select('id, lead_id', { count: 'exact' });

      // 3. Statuses de lead convertidos
      const { data: leadStatuses } = await supabase
        .from('lead_statuses')
        .select('key')
        .eq('is_converted', true);
      const convertedStageKeys = leadStatuses?.map(s => s.key) || [];

      // 4. Se não tem shares, retorna zero
      if (!shares || shares.length === 0) {
        return {
          propostasCriadas: propostasCriadas || 0,
          compartilhamentosEnviados: 0,
          aberturasUnicas: 0,
          taxaAbertura: 0,
          ctasClicados: 0,
          taxaConversaoLead: 0,
          leadsComProposta: 0,
          leadsConvertidos: 0,
        };
      }

      // Extrair IDs de shares e leads
      const shareIds = shares.map(s => s.id);
      const leadIdsComProposta = [...new Set(shares.map(s => s.lead_id).filter(Boolean))];

      // 5. Quantas propostas tiveram pelo menos 1 sessão?
      // Usar a edge de shares -> sessions -> session para fazer distinct
      const { data: openedSessions } = await supabase
        .from('material_share_sessions')
        .select('share_id')
        .in('share_id', shareIds);
        
      const sharesAbertos = new Set(openedSessions?.map(s => s.share_id)).size;
      const taxaAbertura = compartilhamentosEnviados && compartilhamentosEnviados > 0 
        ? (sharesAbertos / compartilhamentosEnviados) * 100 
        : 0;

      // 6. Cliques no CTA
      const { count: ctasClicados } = await supabase
        .from('material_share_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'cta_click');

      // 7. Qual taxa de conversão dos leads que receberam proposta?
      let leadsConvertidos = 0;
      if (leadIdsComProposta.length > 0 && convertedStageKeys.length > 0) {
        const { count: convertedCount } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .in('id', leadIdsComProposta)
          .in('status', convertedStageKeys);
          
        leadsConvertidos = convertedCount || 0;
      }
      
      const taxaConversaoLead = leadIdsComProposta.length > 0
        ? (leadsConvertidos / leadIdsComProposta.length) * 100
        : 0;

      return {
        propostasCriadas: propostasCriadas || 0,
        compartilhamentosEnviados: compartilhamentosEnviados || 0,
        aberturasUnicas: sharesAbertos,
        taxaAbertura,
        ctasClicados: ctasClicados || 0,
        leadsComProposta: leadIdsComProposta.length,
        leadsConvertidos,
        taxaConversaoLead
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });
}
