import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * gallery-update-session-photos
 * 
 * Edge Function para o Gallery atualizar campos de fotos extras na sessão do Gestão.
 * Usa Service Role para bypass de RLS, já que o cliente do Gallery não tem JWT do fotógrafo.
 * 
 * Campos que podem ser atualizados:
 * - qtd_fotos_extra: quantidade de fotos extras selecionadas
 * - valor_foto_extra: preço unitário (já calculado com desconto progressivo pelo Gallery)
 * - valor_total_foto_extra: total calculado (qtd × valor unitário)
 * - status_galeria: status da galeria na sessão
 * 
 * O trigger recalculate_session_valor_total automaticamente recalcula o valor_total da sessão.
 */

interface UpdateSessionPhotosRequest {
  sessionId?: string;      // Formato texto: "workflow-xxx"
  sessionUuid?: string;    // UUID da sessão
  galeriaId?: string;      // ID da galeria (alternativo)
  
  // Campos de fotos extras
  qtdFotosExtra?: number;
  valorFotoExtra?: number;        // Preço unitário com desconto
  valorTotalFotoExtra?: number;   // Total calculado
  
  // Status da galeria
  statusGaleria?: string;
  
  // Flag para indicar que a seleção foi finalizada
  selecaoFinalizada?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use Service Role para bypass de RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateSessionPhotosRequest = await req.json();
    console.log('📸 [gallery-update-session-photos] Request:', JSON.stringify(body, null, 2));

    // Validar que temos identificador da sessão
    if (!body.sessionId && !body.sessionUuid && !body.galeriaId) {
      console.error('❌ Nenhum identificador de sessão fornecido');
      return new Response(JSON.stringify({
        success: false,
        error: 'sessionId, sessionUuid ou galeriaId é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Primeiro, buscar a sessão para obter user_id (necessário para verificar system status)
    let sessionUserId: string | null = null;
    let sessionId: string | null = null;
    
    // Buscar a sessão primeiro
    let findQuery = supabase.from('clientes_sessoes').select('id, session_id, user_id');
    
    if (body.sessionUuid) {
      findQuery = findQuery.eq('id', body.sessionUuid);
    } else if (body.sessionId) {
      findQuery = findQuery.eq('session_id', body.sessionId);
    } else if (body.galeriaId) {
      findQuery = findQuery.eq('galeria_id', body.galeriaId);
    }
    
    const { data: sessionData } = await findQuery.maybeSingle();
    
    if (sessionData) {
      sessionUserId = sessionData.user_id;
      sessionId = sessionData.id;
      console.log('📍 Sessão encontrada, user_id:', sessionUserId);
    }

    // Montar objeto de atualização
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    // Campos de fotos extras
    if (body.qtdFotosExtra !== undefined) {
      updateData.qtd_fotos_extra = body.qtdFotosExtra;
    }
    if (body.valorFotoExtra !== undefined) {
      updateData.valor_foto_extra = body.valorFotoExtra;
    }
    if (body.valorTotalFotoExtra !== undefined) {
      updateData.valor_total_foto_extra = body.valorTotalFotoExtra;
    }
    
    // Status da galeria
    if (body.statusGaleria !== undefined) {
      updateData.status_galeria = body.statusGaleria;
    }
    
    // Lógica de seleção finalizada - atualizar status da sessão automaticamente
    if (body.selecaoFinalizada === true && sessionUserId) {
      console.log('🎯 Seleção finalizada detectada, verificando status de sistema...');
      
      // Verificar se o usuário tem o status de sistema "Seleção finalizada"
      const { data: systemStatus } = await supabase
        .from('etapas_trabalho')
        .select('nome')
        .eq('user_id', sessionUserId)
        .eq('nome', 'Seleção finalizada')
        .eq('is_system_status', true)
        .maybeSingle();
      
      if (systemStatus) {
        console.log('✅ Status de sistema encontrado, atualizando status da sessão para "Seleção finalizada"');
        updateData.status = 'Seleção finalizada';
        updateData.status_galeria = 'selecao_completa';
      } else {
        console.log('ℹ️ Usuário não tem status de sistema PRO + Gallery, ignorando atualização automática de status');
      }
    }

    // Verificar se há campos para atualizar além de updated_at
    const fieldsToUpdate = Object.keys(updateData).filter(k => k !== 'updated_at');
    if (fieldsToUpdate.length === 0) {
      console.warn('⚠️ Nenhum campo para atualizar');
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhum campo para atualizar'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📝 Campos a atualizar:', updateData);

    // Construir query de busca
    let query = supabase.from('clientes_sessoes').update(updateData);
    
    if (body.sessionUuid) {
      query = query.eq('id', body.sessionUuid);
      console.log('🔍 Buscando por UUID:', body.sessionUuid);
    } else if (body.sessionId) {
      query = query.eq('session_id', body.sessionId);
      console.log('🔍 Buscando por session_id:', body.sessionId);
    } else if (body.galeriaId) {
      query = query.eq('galeria_id', body.galeriaId);
      console.log('🔍 Buscando por galeria_id:', body.galeriaId);
    }

    const { data, error } = await query.select('id, session_id, qtd_fotos_extra, valor_foto_extra, valor_total_foto_extra, valor_total, status_galeria');

    if (error) {
      console.error('❌ Erro ao atualizar sessão:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ Sessão não encontrada');
      return new Response(JSON.stringify({
        success: false,
        error: 'Sessão não encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedSession = data[0];
    console.log('✅ Sessão atualizada com sucesso:', updatedSession);

    return new Response(JSON.stringify({
      success: true,
      session: {
        id: updatedSession.id,
        sessionId: updatedSession.session_id,
        qtdFotosExtra: updatedSession.qtd_fotos_extra,
        valorFotoExtra: updatedSession.valor_foto_extra,
        valorTotalFotoExtra: updatedSession.valor_total_foto_extra,
        valorTotal: updatedSession.valor_total, // Recalculado pelo trigger
        statusGaleria: updatedSession.status_galeria
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Exception in gallery-update-session-photos:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
