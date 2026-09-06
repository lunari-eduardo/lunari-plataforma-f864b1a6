/**
 * Serviços de migração, correção e verificação de integridade de sessões
 */

import { RegrasCongeladas, IntegridadeIssue } from './types';

/**
 * FASE 4: Migra sessões existentes para incluir dados completos congelados
 * Busca TODAS as sessões SEM regras_congeladas completas
 */
export async function migrarSessoesExistentes(
  congelarDadosCompletosFn: (pacoteId?: string, categoria?: string) => Promise<RegrasCongeladas>
): Promise<{ migrated: number; skipped: number }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    const { data: sessions, error } = await supabase
      .from('clientes_sessoes')
      .select('id, categoria, pacote, regras_congeladas')
      .eq('user_id', user.user.id)
      .or('regras_congeladas.is.null,regras_congeladas->pacote.is.null');

    if (error) throw error;

    console.log(`📦 [FASE 4] Verificando ${sessions?.length || 0} sessões SEM dados congelados completos...`);

    let migrated = 0;
    let skipped = 0;

    for (const session of sessions || []) {
      try {
        console.log(`🔄 Recongelando sessão: ${session.id} - pacote: ${session.pacote}`);
        
        const regrasCongeladas = await congelarDadosCompletosFn(
          session.pacote,
          session.categoria
        );
        
        await supabase
          .from('clientes_sessoes')
          .update({ regras_congeladas: regrasCongeladas as any })
          .eq('id', session.id)
          .eq('user_id', user.user.id);
        
        migrated++;
        console.log(`✅ Sessão ${session.id} recongelada com sucesso`);
      } catch (sessionError) {
        console.error('❌ Erro ao migrar sessão:', session.id, sessionError);
        skipped++;
      }
    }
    
    console.log(`✅ [FASE 4] Migração concluída: ${migrated} recongeladas, ${skipped} com erro`);
    return { migrated, skipped };
    
  } catch (error) {
    console.error('❌ Erro na migração de dados congelados:', error);
    throw error;
  }
}

/**
 * Corrige sessões existentes com dados inconsistentes de foto extra
 */
export async function corrigirSessoesInconsistentes(): Promise<{ corrected: number; skipped: number }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    console.log('🔧 Iniciando correção de sessões com dados inconsistentes...');

    const { data: sessions, error } = await supabase
      .from('clientes_sessoes')
      .select('id, categoria, pacote, regras_congeladas')
      .eq('user_id', user.user.id);

    if (error) throw error;

    let corrected = 0;
    let skipped = 0;

    for (const session of sessions || []) {
      try {
        const regras = session.regras_congeladas as RegrasCongeladas;
        
        if (regras?.precificacaoFotoExtra?.modelo === 'fixo' && 
            regras.precificacaoFotoExtra.valorFixo === 35 && 
            regras.pacote?.valorFotoExtra && 
            regras.pacote.valorFotoExtra !== 35) {
          
          console.log('🔧 Corrigindo sessão:', session.id, {
            valorIncorreto: regras.precificacaoFotoExtra.valorFixo,
            valorCorreto: regras.pacote.valorFotoExtra
          });

          const regrasCorrigidas = { ...regras };
          delete (regrasCorrigidas.precificacaoFotoExtra as any).valorFixo;
          regrasCorrigidas.dataCongelamento = new Date().toISOString();

          await supabase
            .from('clientes_sessoes')
            .update({ regras_congeladas: regrasCorrigidas as any })
            .eq('id', session.id)
            .eq('user_id', user.user.id);
          
          corrected++;
        } else {
          skipped++;
        }
      } catch (sessionError) {
        console.error('❌ Erro ao corrigir sessão:', session.id, sessionError);
      }
    }
    
    console.log(`✅ Correção concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
    return { corrected, skipped };
    
  } catch (error) {
    console.error('❌ Erro na correção de sessões:', error);
    throw error;
  }
}

/**
 * Corrige sessões com modelo categoria que podem ter tabelas null
 */
export async function corrigirSessoesComTabelasNull(
  congelarDadosCompletosFn: (pacoteId?: string, categoria?: string) => Promise<RegrasCongeladas>
): Promise<{ corrected: number; skipped: number }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    console.log('🔧 Iniciando correção de sessões com tabelas null...');

    const { data: sessions, error } = await supabase
      .from('clientes_sessoes')
      .select('id, categoria, pacote, regras_congeladas')
      .eq('user_id', user.user.id);

    if (error) throw error;

    let corrected = 0;
    let skipped = 0;

    for (const session of sessions || []) {
      try {
        const regras = session.regras_congeladas as RegrasCongeladas;
        
        if (regras?.precificacaoFotoExtra?.modelo === 'categoria' && 
            !regras.precificacaoFotoExtra.tabelaCategoria) {
          
          console.log('🔧 Recongelando sessão com tabela null:', session.id, 'categoria:', session.categoria);

          const regrasCorrigidas = await congelarDadosCompletosFn(
            session.pacote,
            session.categoria
          );

          await supabase
            .from('clientes_sessoes')
            .update({ regras_congeladas: regrasCorrigidas as any })
            .eq('id', session.id)
            .eq('user_id', user.user.id);
          
          corrected++;
        } else {
          skipped++;
        }
      } catch (sessionError) {
        console.error('❌ Erro ao corrigir sessão:', session.id, sessionError);
      }
    }
    
    console.log(`✅ Correção de tabelas null concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
    return { corrected, skipped };
    
  } catch (error) {
    console.error('❌ Erro na correção de sessões com tabelas null:', error);
    throw error;
  }
}

/**
 * Corrige sessões com modelo categoria que podem ter tabelas incorretas
 */
export async function corrigirModeloCategoria(
  congelarDadosCompletosFn: (pacoteId?: string, categoria?: string) => Promise<RegrasCongeladas>
): Promise<{ corrected: number; skipped: number }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    console.log('🔧 Iniciando correção específica para modelo categoria...');

    const { data: sessions, error } = await supabase
      .from('clientes_sessoes')
      .select('id, categoria, pacote, regras_congeladas')
      .eq('user_id', user.user.id);

    if (error) throw error;

    let corrected = 0;
    let skipped = 0;

    for (const session of sessions || []) {
      try {
        const regras = session.regras_congeladas as RegrasCongeladas;
        
        if (regras?.precificacaoFotoExtra?.modelo === 'categoria' && session.categoria) {
          const tabelaAtual = regras.precificacaoFotoExtra.tabelaCategoria;
          
          if (!tabelaAtual) {
            console.log('🔧 Recongelando sessão sem tabela categoria:', session.id, 'categoria:', session.categoria);

            const regrasCorrigidas = await congelarDadosCompletosFn(
              session.pacote,
              session.categoria
            );

            await supabase
              .from('clientes_sessoes')
              .update({ regras_congeladas: regrasCorrigidas as any })
              .eq('id', session.id)
              .eq('user_id', user.user.id);
            
            corrected++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } catch (sessionError) {
        console.error('❌ Erro ao corrigir sessão categoria:', session.id, sessionError);
      }
    }
    
    console.log(`✅ Correção modelo categoria concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
    return { corrected, skipped };
    
  } catch (error) {
    console.error('❌ Erro na correção modelo categoria:', error);
    throw error;
  }
}

/**
 * Corrige sessões com modelo fixo sem valorFixo definido
 */
export async function corrigirSessoesModeloFixo(): Promise<{ migrated: number; skipped: number }> {
  console.log('🔧 Iniciando correção de sessões com modelo fixo...');
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    const { data: sessoes, error } = await supabase
      .from('clientes_sessoes')
      .select('*')
      .eq('user_id', user.user.id)
      .not('regras_congeladas', 'is', null);

    if (error) {
      console.error('❌ Erro ao buscar sessões:', error);
      return { migrated: 0, skipped: 0 };
    }

    let migrated = 0;
    let skipped = 0;

    for (const sessao of sessoes || []) {
      try {
        const regras = sessao.regras_congeladas as RegrasCongeladas;
        
        if (
          regras?.precificacaoFotoExtra?.modelo === 'fixo' &&
          (regras.precificacaoFotoExtra.valorFixo === undefined ||
           regras.precificacaoFotoExtra.valorFixo === 0)
        ) {
          const valorFotoExtra = regras.pacote?.valorFotoExtra || 0;
          
          if (valorFotoExtra > 0) {
            const regrasAtualizadas = {
              ...regras,
              precificacaoFotoExtra: {
                ...regras.precificacaoFotoExtra,
                valorFixo: valorFotoExtra
              }
            };

            const { error: updateError } = await supabase
              .from('clientes_sessoes')
              .update({ regras_congeladas: regrasAtualizadas as any })
              .eq('id', sessao.id)
              .eq('user_id', user.user.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar sessão ${sessao.id}:`, updateError);
              skipped++;
            } else {
              console.log(`✅ Sessão ${sessao.id} corrigida: R$ ${valorFotoExtra}`);
              migrated++;
            }
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar sessão ${sessao.id}:`, error);
        skipped++;
      }
    }

    console.log(`✅ Correção concluída: ${migrated} sessões atualizadas, ${skipped} ignoradas`);
    return { migrated, skipped };
  } catch (error) {
    console.error('❌ Erro na correção de modelo fixo:', error);
    return { migrated: 0, skipped: 0 };
  }
}

/**
 * Verifica integridade dos dados congelados
 */
export async function verificarIntegridade(): Promise<IntegridadeIssue[]> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();
    
    if (!user?.user) {
      throw new Error('User not authenticated');
    }

    const { data: sessions, error } = await supabase
      .from('clientes_sessoes')
      .select('id, pacote, regras_congeladas')
      .eq('user_id', user.user.id);

    if (error) throw error;

    const issues: IntegridadeIssue[] = [];

    for (const session of sessions || []) {
      if (!session.regras_congeladas) {
        issues.push({
          sessionId: session.id,
          issue: 'Sem dados congelados',
          severity: 'warning'
        });
      } else if (session.regras_congeladas && typeof session.regras_congeladas === 'object' && 
                 session.regras_congeladas !== null && !Array.isArray(session.regras_congeladas) &&
                 (session.regras_congeladas as any).modelo !== 'completo') {
        issues.push({
          sessionId: session.id,
          issue: 'Formato de dados congelados desatualizado',
          severity: 'info'
        });
      }
    }

    return issues;
  } catch (error) {
    console.error('❌ Erro na verificação de integridade:', error);
    throw error;
  }
}
