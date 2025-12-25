/**
 * Hook para importação de sessões do Workflow a partir de planilha
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  parseWorkflowSpreadsheet, 
  generateTemplateSpreadsheet 
} from '@/utils/spreadsheetParser';
import {
  SpreadsheetSession,
  ParsedSpreadsheet,
  ImportResult,
  ImportError,
  ImportProgress
} from '@/types/spreadsheetImport';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';

interface UseWorkflowImportOptions {
  year: number;
  month: number;
}

export function useWorkflowImport({ year, month }: UseWorkflowImportOptions) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null);
  const { invalidateMonth } = useWorkflowCache();

  /**
   * Faz o parse da planilha (sem importar ainda)
   */
  const parseFile = useCallback(async (file: File): Promise<ParsedSpreadsheet> => {
    setProgress({ current: 0, total: 1, phase: 'parsing', message: 'Lendo planilha...' });
    
    const result = await parseWorkflowSpreadsheet(file);
    setParsedData(result);
    
    setProgress({ current: 1, total: 1, phase: 'validating', message: 'Validação concluída' });
    
    return result;
  }, []);

  /**
   * Gera session_id único baseado na data
   */
  const generateSessionId = useCallback((date: string, index: number): string => {
    const timestamp = new Date(date).getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `import_${timestamp}_${index}_${random}`;
  }, []);

  /**
   * Busca ou cria cliente
   */
  const findOrCreateClient = useCallback(async (
    session: SpreadsheetSession,
    userId: string
  ): Promise<string> => {
    // Buscar cliente existente por nome (case insensitive) + email
    let query = supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .ilike('nome', session.cliente_nome);
    
    if (session.cliente_email) {
      query = query.eq('email', session.cliente_email);
    }
    
    const { data: existing } = await query.limit(1).maybeSingle();
    
    if (existing) {
      return existing.id;
    }
    
    // Buscar apenas por nome se não encontrou com email
    if (session.cliente_email) {
      const { data: byNameOnly } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', userId)
        .ilike('nome', session.cliente_nome)
        .limit(1)
        .maybeSingle();
      
      if (byNameOnly) {
        // Atualizar email do cliente existente
        await supabase
          .from('clientes')
          .update({ email: session.cliente_email })
          .eq('id', byNameOnly.id);
        return byNameOnly.id;
      }
    }
    
    // Criar novo cliente
    const { data: newClient, error } = await supabase
      .from('clientes')
      .insert({
        user_id: userId,
        nome: session.cliente_nome,
        email: session.cliente_email || null,
        whatsapp: session.cliente_whatsapp || null,
        origem: 'importacao'
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }
    
    return newClient.id;
  }, []);

  /**
   * Importa as sessões para o Supabase
   */
  const importSessions = useCallback(async (): Promise<ImportResult> => {
    if (!parsedData || parsedData.sessions.length === 0) {
      return {
        success: false,
        imported: { clients: 0, sessions: 0, payments: 0 },
        errors: [{ row: 0, message: 'Nenhuma sessão para importar' }],
        skipped: 0
      };
    }

    setIsImporting(true);
    const errors: ImportError[] = [];
    let clientsCreated = 0;
    let sessionsImported = 0;
    let paymentsImported = 0;
    let skipped = 0;

    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const total = parsedData.sessions.length;
      const clientCache: Record<string, string> = {};
      const sessionRefMap: Record<string, string> = {}; // Mapeia linha -> session_id

      // Fase 1: Criar/buscar clientes
      setProgress({ 
        current: 0, 
        total, 
        phase: 'importing_clients', 
        message: 'Processando clientes...' 
      });

      for (let i = 0; i < parsedData.sessions.length; i++) {
        const session = parsedData.sessions[i];
        const cacheKey = `${session.cliente_nome.toLowerCase()}_${session.cliente_email || ''}`;
        
        if (!clientCache[cacheKey]) {
          try {
            const existingCount = Object.keys(clientCache).length;
            const clientId = await findOrCreateClient(session, user.id);
            clientCache[cacheKey] = clientId;
            
            if (Object.keys(clientCache).length > existingCount) {
              clientsCreated++;
            }
          } catch (err) {
            errors.push({
              row: i + 2, // +2 porque linha 1 é header
              message: `Erro ao processar cliente: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
              data: { nome: session.cliente_nome }
            });
          }
        }
        
        setProgress({ 
          current: i + 1, 
          total, 
          phase: 'importing_clients', 
          message: `Processando cliente ${i + 1} de ${total}...` 
        });
      }

      // Fase 2: Inserir sessões
      setProgress({ 
        current: 0, 
        total, 
        phase: 'importing_sessions', 
        message: 'Importando sessões...' 
      });

      for (let i = 0; i < parsedData.sessions.length; i++) {
        const session = parsedData.sessions[i];
        const rowNumber = i + 2;
        
        // Filtrar por mês/ano se especificado
        const sessionDate = new Date(session.data_sessao);
        const sessionMonth = sessionDate.getMonth() + 1;
        const sessionYear = sessionDate.getFullYear();
        
        if (sessionYear !== year || sessionMonth !== month) {
          skipped++;
          setProgress({ 
            current: i + 1, 
            total, 
            phase: 'importing_sessions', 
            message: `Pulando sessão ${i + 1} (mês diferente)...` 
          });
          continue;
        }
        
        const cacheKey = `${session.cliente_nome.toLowerCase()}_${session.cliente_email || ''}`;
        const clientId = clientCache[cacheKey];
        
        if (!clientId) {
          errors.push({
            row: rowNumber,
            message: 'Cliente não encontrado',
            data: session
          });
          continue;
        }
        
        try {
          const sessionId = generateSessionId(session.data_sessao, i);
          sessionRefMap[String(i + 1)] = sessionId; // Mapear linha para session_id
          
          // Calcular valor total se não informado
          let valorTotal = session.valor_total;
          if (!valorTotal && session.valor_base_pacote) {
            valorTotal = (session.valor_base_pacote || 0) +
                        (session.valor_total_foto_extra || 0) +
                        (session.valor_adicional || 0) -
                        (session.desconto || 0);
          }
          
          const { error: insertError } = await supabase
            .from('clientes_sessoes')
            .insert({
              user_id: user.id,
              cliente_id: clientId,
              session_id: sessionId,
              data_sessao: session.data_sessao,
              hora_sessao: session.hora_sessao,
              categoria: session.categoria,
              pacote: session.pacote || null,
              status: session.status || 'agendado',
              descricao: session.descricao || null,
              observacoes: session.observacoes || null,
              detalhes: session.detalhes || null,
              valor_base_pacote: session.valor_base_pacote || 0,
              valor_foto_extra: session.valor_foto_extra || 0,
              qtd_fotos_extra: session.qtd_fotos_extra || 0,
              valor_total_foto_extra: session.valor_total_foto_extra || 0,
              valor_adicional: session.valor_adicional || 0,
              desconto: session.desconto || 0,
              valor_total: valorTotal || 0,
              valor_pago: session.valor_pago || 0,
              produtos_incluidos: [],
              regras_congeladas: {
                modelo: 'importado',
                fonte: 'planilha',
                dataImportacao: new Date().toISOString()
              }
            });
          
          if (insertError) {
            throw insertError;
          }
          
          sessionsImported++;
          
          // Se tem valor_pago, criar transação
          if (session.valor_pago && session.valor_pago > 0) {
            const { error: transactionError } = await supabase
              .from('clientes_transacoes')
              .insert({
                user_id: user.id,
                cliente_id: clientId,
                session_id: sessionId,
                tipo: 'pagamento',
                valor: session.valor_pago,
                data_transacao: session.data_sessao,
                descricao: 'Pagamento importado da planilha'
              });
            
            if (!transactionError) {
              paymentsImported++;
            }
          }
          
        } catch (err) {
          errors.push({
            row: rowNumber,
            message: `Erro ao importar sessão: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
            data: session
          });
        }
        
        setProgress({ 
          current: i + 1, 
          total, 
          phase: 'importing_sessions', 
          message: `Importando sessão ${i + 1} de ${total}...` 
        });
      }

      // Fase 3: Importar pagamentos adicionais (da aba PAGAMENTOS)
      if (parsedData.payments.length > 0) {
        setProgress({ 
          current: 0, 
          total: parsedData.payments.length, 
          phase: 'importing_payments', 
          message: 'Importando pagamentos...' 
        });
        
        for (let i = 0; i < parsedData.payments.length; i++) {
          const payment = parsedData.payments[i];
          const sessionId = sessionRefMap[payment.session_ref];
          
          if (!sessionId) {
            continue; // Sessão não foi importada
          }
          
          // Buscar cliente_id da sessão
          const { data: sessionData } = await supabase
            .from('clientes_sessoes')
            .select('cliente_id')
            .eq('session_id', sessionId)
            .single();
          
          if (sessionData) {
            const { error: paymentError } = await supabase
              .from('clientes_transacoes')
              .insert({
                user_id: user.id,
                cliente_id: sessionData.cliente_id,
                session_id: sessionId,
                tipo: 'pagamento',
                valor: payment.valor,
                data_transacao: payment.data_transacao,
                descricao: payment.descricao || 'Pagamento importado'
              });
            
            if (!paymentError) {
              paymentsImported++;
            }
          }
          
          setProgress({ 
            current: i + 1, 
            total: parsedData.payments.length, 
            phase: 'importing_payments', 
            message: `Importando pagamento ${i + 1}...` 
          });
        }
      }

      // Invalidar cache do mês
      await invalidateMonth(year, month);

      setProgress({ 
        current: total, 
        total, 
        phase: 'done', 
        message: 'Importação concluída!' 
      });

      return {
        success: errors.length === 0,
        imported: {
          clients: clientsCreated,
          sessions: sessionsImported,
          payments: paymentsImported
        },
        errors,
        skipped
      };

    } catch (err) {
      console.error('Erro na importação:', err);
      errors.push({
        row: 0,
        message: err instanceof Error ? err.message : 'Erro desconhecido na importação'
      });
      
      return {
        success: false,
        imported: { clients: 0, sessions: sessionsImported, payments: paymentsImported },
        errors,
        skipped
      };
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, year, month, findOrCreateClient, generateSessionId, invalidateMonth]);

  /**
   * Download do template
   */
  const downloadTemplate = useCallback(() => {
    const blob = generateTemplateSpreadsheet();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_importacao_workflow.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Limpar dados parseados
   */
  const clearParsedData = useCallback(() => {
    setParsedData(null);
    setProgress(null);
  }, []);

  return {
    parseFile,
    importSessions,
    downloadTemplate,
    clearParsedData,
    parsedData,
    isImporting,
    progress
  };
}
