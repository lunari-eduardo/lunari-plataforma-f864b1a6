import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * FASE 4: Migration utility to fix valor_base_pacote for existing sessions
 * 
 * This function corrects sessions where valor_base_pacote is 0 or NULL by:
 * 1. Using regras_congeladas.valorBase (frozen data - most reliable)
 * 2. Falling back to valor_total if frozen data is missing
 */
export async function migrateValorBasePacoteForClient(clienteId: string): Promise<number> {
  try {
    console.log('🔧 [Migration] Starting valor_base_pacote migration for client:', clienteId);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Fetch sessions with valor_base_pacote = 0 or NULL
    const { data: sessions, error: fetchError } = await supabase
      .from('clientes_sessoes')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('user_id', user.id)
      .or('valor_base_pacote.is.null,valor_base_pacote.eq.0');

    if (fetchError) throw fetchError;

    if (!sessions || sessions.length === 0) {
      console.log('✅ [Migration] No sessions need migration');
      return 0;
    }

    console.log(`🔧 [Migration] Found ${sessions.length} sessions to migrate`);

    let corrected = 0;

    for (const session of sessions) {
      let newValorBasePacote = 0;

      // Priority 1: Extract from regras_congeladas
      const regrasCongeladas = session.regras_congeladas as any;
      if (regrasCongeladas?.valorBase) {
        newValorBasePacote = Number(regrasCongeladas.valorBase);
        console.log(`💰 [Migration] Using frozen valorBase: ${newValorBasePacote} for session ${session.id}`);
      }
      // Priority 2: Calculate by subtraction (FASE 4 improvement)
      else if (session.valor_total && session.valor_total > 0) {
        const total = Number(session.valor_total);
        const fotoExtra = Number(session.valor_total_foto_extra) || 0;
        const adicional = Number(session.valor_adicional) || 0;
        const desconto = Number(session.desconto) || 0;
        
        // Calcular produtos manuais
        const produtosList = Array.isArray(session.produtos_incluidos) 
          ? session.produtos_incluidos : [];
        let valorProdutos = 0;
        for (const p of produtosList) {
          const prod = p as any;
          if (prod.tipo === 'manual') {
            valorProdutos += (Number(prod.valorUnitario) || 0) * (Number(prod.quantidade) || 0);
          }
        }
        
        // valor_base_pacote = total - fotos - produtos - adicional + desconto
        const soma = total - fotoExtra - valorProdutos - adicional;
        newValorBasePacote = Math.max(0, soma + desconto);
        console.log(`💰 [Migration] Calculated by subtraction: ${newValorBasePacote} for session ${session.id}`);
      }
      // Priority 3: Keep as 0 if nothing available
      else {
        console.warn(`⚠️ [Migration] No value available for session ${session.id}, keeping as 0`);
        continue;
      }

      // Update session with corrected valor_base_pacote
      const { error: updateError } = await supabase
        .from('clientes_sessoes')
        .update({ 
          valor_base_pacote: newValorBasePacote,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error(`❌ [Migration] Error updating session ${session.id}:`, updateError);
      } else {
        corrected++;
        console.log(`✅ [Migration] Corrected session ${session.id}: valor_base_pacote = ${newValorBasePacote}`);
      }
    }

    console.log(`✅ [Migration] Migration complete: ${corrected}/${sessions.length} sessions corrected`);
    return corrected;

  } catch (error) {
    console.error('❌ [Migration] Error during migration:', error);
    throw error;
  }
}

/**
 * FASE 4: Migrate all sessions for current user
 */
export async function migrateAllValorBasePacote(): Promise<{ total: number; corrected: number }> {
  try {
    console.log('🔧 [Migration] Starting global valor_base_pacote migration...');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Fetch all sessions with valor_base_pacote = 0 or NULL
    const { data: sessions, error: fetchError } = await supabase
      .from('clientes_sessoes')
      .select('*')
      .eq('user_id', user.id)
      .or('valor_base_pacote.is.null,valor_base_pacote.eq.0');

    if (fetchError) throw fetchError;

    if (!sessions || sessions.length === 0) {
      toast.success('Nenhuma sessão precisa de correção');
      return { total: 0, corrected: 0 };
    }

    console.log(`🔧 [Migration] Found ${sessions.length} sessions to migrate`);

    let corrected = 0;

    for (const session of sessions) {
      let newValorBasePacote = 0;

      // Priority 1: Extract from regras_congeladas
      const regrasCongeladas = session.regras_congeladas as any;
      if (regrasCongeladas?.valorBase) {
        newValorBasePacote = Number(regrasCongeladas.valorBase);
      }
      // Priority 2: Calculate by subtraction (FASE 4 improvement)
      else if (session.valor_total && session.valor_total > 0) {
        const total = Number(session.valor_total);
        const fotoExtra = Number(session.valor_total_foto_extra) || 0;
        const adicional = Number(session.valor_adicional) || 0;
        const desconto = Number(session.desconto) || 0;
        
        // Calcular produtos manuais
        const produtosList = Array.isArray(session.produtos_incluidos) 
          ? session.produtos_incluidos : [];
        let valorProdutos = 0;
        for (const p of produtosList) {
          const prod = p as any;
          if (prod.tipo === 'manual') {
            valorProdutos += (Number(prod.valorUnitario) || 0) * (Number(prod.quantidade) || 0);
          }
        }
        
        // valor_base_pacote = total - fotos - produtos - adicional + desconto
        const soma = total - fotoExtra - valorProdutos - adicional;
        newValorBasePacote = Math.max(0, soma + desconto);
      }
      // Priority 3: Keep as 0 if nothing available
      else {
        console.warn(`⚠️ [Migration] No value available for session ${session.id}`);
        continue;
      }

      // Update session
      const { error: updateError } = await supabase
        .from('clientes_sessoes')
        .update({ 
          valor_base_pacote: newValorBasePacote,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)
        .eq('user_id', user.id);

      if (!updateError) {
        corrected++;
      }
    }

    toast.success(`Correção concluída: ${corrected}/${sessions.length} sessões corrigidas`);
    return { total: sessions.length, corrected };

  } catch (error) {
    console.error('❌ [Migration] Error during global migration:', error);
    toast.error('Erro ao corrigir valores do histórico');
    throw error;
  }
}
