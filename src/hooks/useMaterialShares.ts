import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_LEAD_STATUSES } from '@/utils/leadTransformers';

export function useMaterialShares(materialId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['material-shares', materialId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!materialId) return [];
      const { data, error } = await (supabase as any)
        .from('material_shares')
        .select(`
          *,
          lead:leads(nome, email, whatsapp, status),
          cliente:clientes(nome, email, whatsapp)
        `)
        .eq('material_id', materialId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!materialId
  });

  const createShare = useMutation({
    mutationFn: async ({ lead_id, cliente_id, custom_message }: { lead_id?: string; cliente_id?: string; custom_message?: string }) => {
      if (!materialId) throw new Error('Material não informado');

      // Primeiro, pegar o active_version_id do material
      const { data: material, error: matErr } = await (supabase as any)
        .from('commercial_materials')
        .select('active_version_id, user_id')
        .eq('id', materialId)
        .single();

      if (matErr || !material) throw new Error('Material não encontrado');
      if (!material.active_version_id) throw new Error('O material precisa ser publicado antes de enviar.');

      // Gerar um token opaco criptograficamente seguro
      const token = crypto.randomUUID().replace(/-/g, '');

      const { data, error } = await (supabase as any)
        .from('material_shares')
        .insert({
          material_id: materialId,
          version_id: material.active_version_id,
          user_id: material.user_id,
          lead_id: lead_id || null,
          cliente_id: cliente_id || null,
          token,
          custom_message: custom_message || null
        })
        .select()
        .single();

      if (error) throw error;

      // Automação: Avançar status do lead (Fase 6)
      if (lead_id) {
        try {
          // 1. Pega ou cria config de automação via RPC
          const { data: config } = await (supabase as any)
            .rpc('get_or_create_automation_config', { p_user_id: material.user_id })
            .single();

          if (config && config.auto_advance_stage_on_share) {
            const targetStage = config.target_stage_key;

            // 2. Busca status atual e histórico do lead
            const { data: lead } = await (supabase as any)
              .from('leads')
              .select('status, historico_status')
              .eq('id', lead_id)
              .single();

            if (lead) {
              const currentStatusOrder = DEFAULT_LEAD_STATUSES.find(s => s.key === lead.status)?.order || 0;
              const targetStatusOrder = DEFAULT_LEAD_STATUSES.find(s => s.key === targetStage)?.order || 0;

              // 3. Regra de Não-Regressão: só avança se a ordem atual for menor que a do alvo
              if (currentStatusOrder < targetStatusOrder) {
                const now = new Date().toISOString();
                const currentHistory = lead.historico_status || [];
                const newHistory = [...currentHistory, { status: targetStage, data: now }];

                await (supabase as any)
                  .from('leads')
                  .update({
                    status: targetStage,
                    status_timestamp: now,
                    historico_status: newHistory
                  })
                  .eq('id', lead_id);
                  
                toast.success(`Lead movido automaticamente para "${DEFAULT_LEAD_STATUSES.find(s => s.key === targetStage)?.name}"`);
              }
            }
          }
        } catch (automationErr) {
          console.error('Erro na automação do lead:', automationErr);
          // Não falha a criação do link se a automação falhar
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Compartilhamento rastreável criado!');
    },
    onError: (err: any) => {
      toast.error('Erro ao enviar: ' + err.message);
    }
  });

  return {
    shares: query.data || [],
    isLoading: query.isLoading,
    createShare
  };
}

export function useAllMaterialShares() {
  const queryKey = ['all-material-shares'];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // 1. Fetch shares with joined material and lead
      const { data, error } = await (supabase as any)
        .from('material_shares')
        .select(`
          *,
          material:commercial_materials(title),
          lead:leads(nome, email, whatsapp, status),
          cliente:clientes(nome, email, whatsapp),
          version:material_versions(version_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // 2. Fetch session aggregations to calculate status
      // Get all session counts per share_id
      const shareIds = data.map((d: any) => d.id);
      const { data: sessionsData, error: sessErr } = await (supabase as any)
        .from('material_share_sessions')
        .select('share_id, started_at, duration_seconds')
        .in('share_id', shareIds);

      if (sessErr) throw sessErr;

      // Group sessions by share_id
      const sessionsByShare: Record<string, any[]> = {};
      if (sessionsData) {
        sessionsData.forEach((s: any) => {
          if (!s.share_id) return;
          if (!sessionsByShare[s.share_id]) sessionsByShare[s.share_id] = [];
          sessionsByShare[s.share_id].push(s);
        });
      }

      // Map back to shares
      return data.map((share: any) => {
        const sessions = sessionsByShare[share.id] || [];
        
        let first_open = null;
        let last_open = null;
        
        if (sessions.length > 0) {
          const sorted = [...sessions].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
          first_open = sorted[0].started_at;
          last_open = sorted[sorted.length - 1].started_at;
        }

        return {
          ...share,
          sessions_count: sessions.length,
          first_open,
          last_open
        };
      });
    }
  });

  return {
    shares: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch
  };
}
