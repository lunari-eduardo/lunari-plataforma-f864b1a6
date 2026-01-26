import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * provision-gallery-workflow-statuses
 * 
 * Edge Function para provisionar os status de sistema do Gallery para um usuário.
 * É chamada quando o usuário adquire o plano PRO + Gallery.
 * 
 * Status criados/atualizados:
 * - "Enviado para seleção" (is_system_status = true)
 * - "Seleção finalizada" (is_system_status = true)
 * 
 * Se o usuário já tem etapas com esses nomes, elas são marcadas como is_system_status.
 * Se não existem, são criadas automaticamente.
 */

const GALLERY_SYSTEM_STATUSES = [
  { nome: 'Enviado para seleção', cor: '#3B82F6' },
  { nome: 'Seleção finalizada', cor: '#10B981' }
];

interface ProvisionRequest {
  userId: string;
  action: 'provision' | 'deprovision';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ProvisionRequest = await req.json();
    console.log('🔧 [provision-gallery-workflow-statuses] Request:', body);

    if (!body.userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'userId é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { userId, action = 'provision' } = body;

    if (action === 'deprovision') {
      // Remover flag is_system_status (status vira editável novamente)
      const { error } = await supabase
        .from('etapas_trabalho')
        .update({ is_system_status: false })
        .eq('user_id', userId)
        .eq('is_system_status', true);

      if (error) {
        console.error('❌ Erro ao remover status de sistema:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Status de sistema removidos para usuário:', userId);
      return new Response(JSON.stringify({
        success: true,
        message: 'Status de sistema removidos com sucesso'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // action === 'provision'
    // Buscar ordem máxima atual
    const { data: maxOrdemData } = await supabase
      .from('etapas_trabalho')
      .select('ordem')
      .eq('user_id', userId)
      .order('ordem', { ascending: false })
      .limit(1);

    let nextOrdem = (maxOrdemData?.[0]?.ordem || 0) + 1;

    const results = [];

    for (const statusDef of GALLERY_SYSTEM_STATUSES) {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('etapas_trabalho')
        .select('id, nome, is_system_status')
        .eq('user_id', userId)
        .eq('nome', statusDef.nome)
        .maybeSingle();

      if (existing) {
        // Já existe, apenas marcar como system status se não estiver
        if (!existing.is_system_status) {
          const { error } = await supabase
            .from('etapas_trabalho')
            .update({ is_system_status: true })
            .eq('id', existing.id);

          if (error) {
            console.error(`❌ Erro ao atualizar ${statusDef.nome}:`, error);
            results.push({ nome: statusDef.nome, action: 'error', error: error.message });
          } else {
            console.log(`✅ Marcado como system status: ${statusDef.nome}`);
            results.push({ nome: statusDef.nome, action: 'updated' });
          }
        } else {
          console.log(`ℹ️ Já é system status: ${statusDef.nome}`);
          results.push({ nome: statusDef.nome, action: 'unchanged' });
        }
      } else {
        // Criar novo status de sistema
        const { error } = await supabase
          .from('etapas_trabalho')
          .insert({
            user_id: userId,
            nome: statusDef.nome,
            cor: statusDef.cor,
            ordem: nextOrdem,
            is_system_status: true
          });

        if (error) {
          console.error(`❌ Erro ao criar ${statusDef.nome}:`, error);
          results.push({ nome: statusDef.nome, action: 'error', error: error.message });
        } else {
          console.log(`✅ Criado system status: ${statusDef.nome} (ordem: ${nextOrdem})`);
          results.push({ nome: statusDef.nome, action: 'created' });
          nextOrdem++;
        }
      }
    }

    console.log('📋 Resultados:', results);

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Exception in provision-gallery-workflow-statuses:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
