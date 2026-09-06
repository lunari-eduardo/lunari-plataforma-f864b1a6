import { supabase } from '@/integrations/supabase/client';

export interface SessionBinding {
  id: string;
  session_id: string;
  cliente_id: string;
}

/**
 * Buscar dados da sessão através de UUID ou session_id (text)
 * Retorna { id: UUID, session_id: string, cliente_id: UUID }
 */
export async function getSessionBinding(sessionKey: string): Promise<SessionBinding | null> {
  try {
    console.log('🔍 Buscando sessão por chave:', sessionKey);
    
    // Verificar se parece um UUID válido
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionKey);
    
    let data = null;
    let error = null;
    
    // FASE 3: Buscar separadamente para evitar erro no .or() com formatos diferentes
    if (isUUID) {
      // Buscar por UUID (id) primeiro
      const result = await supabase
        .from('clientes_sessoes')
        .select('id, session_id, cliente_id')
        .eq('id', sessionKey)
        .maybeSingle();
      data = result.data;
      error = result.error;
      
      if (data) {
        console.log('✅ Sessão encontrada por UUID (id):', data.id);
      }
    }
    
    // Se não encontrou por UUID ou não é UUID, buscar por session_id (TEXT)
    if (!data) {
      const result = await supabase
        .from('clientes_sessoes')
        .select('id, session_id, cliente_id')
        .eq('session_id', sessionKey)
        .maybeSingle();
      data = result.data;
      error = result.error;
      
      if (data) {
        console.log('✅ Sessão encontrada por session_id (TEXT):', data.session_id);
      }
    }

    if (error) {
      console.error('❌ Erro ao buscar sessão:', error);
      return null;
    }

    if (!data) {
      console.warn('⚠️ Nenhuma sessão encontrada para chave:', sessionKey);
      return null;
    }

    console.log('✅ Sessão encontrada:', { 
      id: data.id, 
      session_id: data.session_id,
      cliente_id: data.cliente_id 
    });

    return data;
  } catch (error) {
    console.error('❌ Erro ao buscar sessão:', error);
    return null;
  }
}
