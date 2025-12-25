import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { SessionData } from '@/types/workflow';
import { toast } from '@/hooks/use-toast';
import { useWorkflowPackageData } from '@/hooks/useWorkflowPackageData';
import { calculateSessionTotal, calculateManualProductsTotal } from '@/utils/sessionCalculations';

export interface WorkflowSession {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string;
  appointment_id?: string;
  orcamento_id?: string;
  data_sessao: string;
  hora_sessao: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valor_total: number;
  valor_base_pacote?: number; // FASE 1: Valor base do pacote congelado
  valor_pago: number;
  produtos_incluidos: any;
  qtd_fotos_extra?: number;
  valor_foto_extra?: number;
  valor_total_foto_extra?: number;
  regras_congeladas?: any;
  desconto?: number;
  valor_adicional?: number;
  observacoes?: string | null;
  detalhes?: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  // ✅ FASE 1: Adicionar dados do cliente do JOIN Supabase
  clientes?: {
    nome: string;
    email?: string;
    telefone?: string;
    whatsapp?: string;
  };
}

export const useWorkflowRealtime = () => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use package data resolution hook
  const { convertSessionToData, isLoadingPacotes, isLoadingCategorias } = useWorkflowPackageData();

  // Load sessions from Supabase
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading workflow sessions from Supabase...');
      
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        console.error('❌ User not authenticated');
        setError('User not authenticated');
        return;
      }

      console.log('👤 User authenticated:', user.user.id);

      const { data, error: fetchError } = await supabase
        .from('clientes_sessoes')
        .select(`
          *,
          clientes (
            nome,
            email,
            telefone,
            whatsapp
          )
        `)
        .eq('user_id', user.user.id)
        .neq('status', 'historico') // Excluir sessões históricas do workflow
        .order('data_sessao', { ascending: false })
        .order('hora_sessao', { ascending: true });

      if (fetchError) {
        console.error('❌ Error fetching sessions:', fetchError);
        throw fetchError;
      }

      console.log('✅ Successfully loaded sessions:', data?.length || 0, 'sessions found');
      console.log('📊 Sessions data:', data);

      // FASE 1: Load payments for each session (same logic as CRM)
      const sessionsWithPayments = await Promise.all(
        (data || []).map(async (session) => {
          // Fetch transactions/payments for this session
          const { data: transacoesData } = await supabase
            .from('clientes_transacoes')
            .select('*')
            .eq('session_id', session.session_id)
            .eq('user_id', user.user.id)
            .in('tipo', ['pagamento', 'ajuste'])
            .order('data_transacao', { ascending: false });

          // Convert to payment format (same as CRM)
          const pagamentos = (transacoesData || []).map(t => {
            const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
            const paymentId = match ? match[1] : t.id;
            
            const isPaid = t.tipo === 'pagamento';
            const isPending = t.tipo === 'ajuste';
            
            const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
            const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
            const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;
            
            let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
            if (isPending) {
              tipo = totalParcelas ? 'parcelado' : 'agendado';
            }
            
            let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
            if (isPending) {
              statusPagamento = 'pendente';
              if (t.data_vencimento && new Date(t.data_vencimento) < new Date()) {
                statusPagamento = 'atrasado';
              }
            }
            
            return {
              id: paymentId,
              valor: Number(t.valor) || 0,
              data: isPaid ? t.data_transacao : '',
              dataVencimento: t.data_vencimento || undefined,
              observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
              tipo,
              statusPagamento,
              numeroParcela,
              totalParcelas,
              origem: 'manual' as const,
              editavel: true
            };
          });
          
          return {
            ...session,
            pagamentos // Attach payments to session
          };
        })
      );

      // FASE 1: Validar integridade dos dados congelados
      const { pricingFreezingService } = await import('@/services/PricingFreezingService');

      for (const session of sessionsWithPayments) {
        const regrasCongeladas = session.regras_congeladas as any;
        if (!regrasCongeladas?.pacote) {
          console.warn('⚠️ Sessão sem dados congelados, recongelando:', session.id);
          
          const novasRegrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
            session.pacote,
            session.categoria
          );
          
          await supabase
            .from('clientes_sessoes')
            .update({ regras_congeladas: novasRegrasCongeladas as any })
            .eq('id', session.id)
            .eq('user_id', user.user.id);
          
          session.regras_congeladas = novasRegrasCongeladas as any;
        }
      }

      console.log('💰 Loaded payments for sessions');
      setSessions(sessionsWithPayments);
      setError(null);
    } catch (err) {
      console.error('Error loading workflow sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      toast({
        title: "Erro ao carregar sessões",
        description: "Não foi possível carregar as sessões do workflow.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session with frozen pricing rules
  const createSession = useCallback(async (sessionData: Omit<WorkflowSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Import pricing freezing service
      const { pricingFreezingService } = await import('@/services/PricingFreezingService');
      
      // Freeze complete data including package and products
      const regrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
        sessionData.pacote,
        sessionData.categoria
      );

      // Initialize extra photo values with frozen rules
      const valorFotoExtraInicial = regrasCongeladas ? 
        pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(1, regrasCongeladas).valorUnitario : 0;

      // FASE 2: Extract valor_base_pacote from frozen rules
      const valorBasePacote = regrasCongeladas?.valorBase ? Number(regrasCongeladas.valorBase) : 0;

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert({
          ...sessionData,
          user_id: user.user.id,
          updated_by: user.user.id,
          regras_congeladas: regrasCongeladas as any,
          valor_base_pacote: valorBasePacote,
          valor_foto_extra: valorFotoExtraInicial,
          valor_total_foto_extra: 0,
          qtd_fotos_extra: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => [data, ...prev]);
      toast({
        title: "Sessão criada",
        description: "Sessão criada com sucesso.",
      });

      return data;
    } catch (err) {
      console.error('Error creating session:', err);
      toast({
        title: "Erro ao criar sessão", 
        description: err instanceof Error ? err.message : 'Failed to create session',
        variant: "destructive",
      });
      throw err;
    }
  }, []);

  // Update session with field mapping and sanitization
  const updateSession = useCallback(async (id: string, updates: any, silent: boolean = false) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Find current session to perform diff check
      const currentSession = sessions.find(s => s.id === id);
      if (!currentSession) {
        console.warn('⚠️ Session not found for diff check:', id);
      }

      // FASE 3: PROTEÇÃO - NUNCA permitir que regras_congeladas seja sobrescrito com NULL
      if ('regrasDePrecoFotoExtraCongeladas' in updates && 
          (updates.regrasDePrecoFotoExtraCongeladas === null || updates.regrasDePrecoFotoExtraCongeladas === undefined)) {
        console.warn('⚠️ Tentativa de sobrescrever regras_congeladas com NULL bloqueada');
        delete updates.regrasDePrecoFotoExtraCongeladas;
      }

      // Create sanitized update map
      const sanitizedUpdates: Partial<WorkflowSession> = {};

      // Import services for package lookup
      const { configurationService } = await import('@/services/ConfigurationService');

      for (const [field, value] of Object.entries(updates)) {
        switch (field) {
            case 'pacote':
            // Handle both package name and ID
            if (typeof value === 'string' && value) {
              console.log('🔄 Processing package change:', value);
              
              // CRITICAL: Use async loading to ensure data is available
              const packages = await configurationService.loadPacotesAsync();
              const categorias = await configurationService.loadCategoriasAsync();
              
              const pkg = packages.find((p: any) => p.id === value || p.nome === value);
              if (pkg) {
                console.log('📦 Package found:', pkg.nome, 'ID:', pkg.id);
                sanitizedUpdates.pacote = pkg.nome; // ✅ FASE 3: Always store NAME in database
                console.log('📦 Salvando NOME do pacote no banco:', pkg.nome);
                
                // FASE 2: Save valor_base_pacote separately
                if (pkg.valor_base) {
                  sanitizedUpdates.valor_base_pacote = Number(pkg.valor_base);
                  console.log('💰 Set base package value:', sanitizedUpdates.valor_base_pacote);
                }
                
                // CRITICAL: Smart re-freezing when package changes
                let novaCategoria = currentSession?.categoria;
                
                if (pkg.categoria_id) {
                  const cat = categorias.find((c: any) => c.id === pkg.categoria_id);
                  if (cat) {
                    novaCategoria = cat.nome;
                    sanitizedUpdates.categoria = cat.nome; // Also update session category
                    console.log('📂 Updated categoria:', novaCategoria);
                  }
                }
                
                const { pricingFreezingService } = await import('@/services/PricingFreezingService');
                
                // Always do complete re-freezing when package changes
                console.log('❄️ Complete re-freezing for new package:', pkg.nome, 'categoria:', novaCategoria);
                const novasRegrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
                  pkg.id,
                  novaCategoria
                );
                sanitizedUpdates.regras_congeladas = novasRegrasCongeladas as any;
                
                // ✅ FASE 8: Preservar produtos MANUAIS existentes ao trocar pacote
                const produtosAtuais = currentSession?.produtos_incluidos || [];
                const produtosManuais = Array.isArray(produtosAtuais) 
                  ? produtosAtuais.filter((p: any) => p.tipo === 'manual')
                  : [];

                // Combinar: produtos do novo pacote + produtos manuais preservados
                const produtosNovoPacote = novasRegrasCongeladas.produtos || [];
                sanitizedUpdates.produtos_incluidos = [...produtosNovoPacote, ...produtosManuais];
                
                console.log('❄️ Frozen rules applied:', Object.keys(novasRegrasCongeladas));
                console.log('📦 Products synced:', sanitizedUpdates.produtos_incluidos.length, 
                            '(incluindo', produtosManuais.length, 'manuais preservados)');
                
                // Initialize extra photo values from frozen rules
                const valorFotoExtraInicial = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(1, novasRegrasCongeladas).valorUnitario;
                sanitizedUpdates.valor_foto_extra = valorFotoExtraInicial;
                console.log('📸 Initial photo extra value:', valorFotoExtraInicial);
                
                // Recalculate photo extra values if needed
                if (currentSession?.qtd_fotos_extra && currentSession.qtd_fotos_extra > 0) {
                  const { valorUnitario, valorTotal } = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
                    currentSession.qtd_fotos_extra,
                    novasRegrasCongeladas
                  );
                  sanitizedUpdates.valor_foto_extra = valorUnitario;
                  sanitizedUpdates.valor_total_foto_extra = valorTotal;
                  console.log('📸 Recalculated photo extra - unit:', valorUnitario, 'total:', valorTotal);
                }
                
                console.log('✅ Package change processed successfully with frozen rules');
              } else {
                console.warn('⚠️ Package not found:', value);
                sanitizedUpdates.pacote = value; // Store as-is if not found
              }
            }
            break;
          case 'valorTotal':  // Handle direct valor_total updates (ONLY base package value)
            // FASE 2: Only accept base package value - trigger adds extras
            sanitizedUpdates.valor_total = Number(value) || 0;
            console.log('💰 Set base package value directly (trigger will add extras):', sanitizedUpdates.valor_total);
            break;
          case 'valorPacote':
            // FASE 2: Parse currency string to number for ONLY base package value
            // The SQL trigger will automatically add extras, discount, etc.
            if (typeof value === 'string') {
              const numValue = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
              sanitizedUpdates.valor_total = numValue;
              console.log('💰 Set base package value from valorPacote (trigger will add extras):', numValue);
            } else if (typeof value === 'number') {
              sanitizedUpdates.valor_total = value;
              console.log('💰 Set base package value from valorPacote (trigger will add extras):', value);
            }
            break;
          case 'produtosList':
            // BLOCO C: Completar case produtosList
            if (Array.isArray(value)) {
              // Converter para formato do banco
              const produtosConvertidos = value.map((p: any) => ({
                id: p.id,
                nome: p.nome,
                quantidade: Number(p.quantidade) || 0,
                valorUnitario: Number(p.valorUnitario) || 0,
                tipo: p.tipo || 'manual',
                produzido: p.produzido || false,
                entregue: p.entregue || false
              }));
              
              sanitizedUpdates.produtos_incluidos = produtosConvertidos;
              
              // Recalcular total de produtos manuais
              const totalProdutosManuais = calculateManualProductsTotal(produtosConvertidos);
              console.log('📦 Total produtos manuais recalculado:', totalProdutosManuais);
              
              // Buscar sessão atual para recalcular total geral
              const { data: freshSession } = await supabase
                .from('clientes_sessoes')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.user.id)
                .single();
              
              if (freshSession) {
                // Re-congelar dados dos produtos
                const { pricingFreezingService } = await import('@/services/PricingFreezingService');
                const regrasAtualizadas = await pricingFreezingService.recongelarProdutos(
                  freshSession.regras_congeladas as any,
                  produtosConvertidos
                );
                sanitizedUpdates.regras_congeladas = regrasAtualizadas as any;
                
                // Recalcular valor total da sessão usando função correta
                const { calculateSessionTotalFromRow } = await import('@/utils/sessionCalculations');
                const updatedSession = { ...freshSession, produtos_incluidos: produtosConvertidos };
                const novoValorTotal = calculateSessionTotalFromRow(updatedSession);
                sanitizedUpdates.valor_total = novoValorTotal;
                
                console.log('📦 Produtos atualizados - recongelados e total recalculado:', novoValorTotal);
              }
            }
            break;
          case 'descricao':
          case 'status':
          case 'categoria':
            (sanitizedUpdates as any)[field] = value;
            break;
          // Map extra photo fields to database columns
          case 'valorFotoExtra':
            sanitizedUpdates.valor_foto_extra = typeof value === 'string' 
              ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
              : Number(value) || 0;
            break;
          case 'qtdFotosExtra':
            // FASE 3: Cálculo atômico de fotos extras
            const qtd = Number(value) || 0;
            sanitizedUpdates.qtd_fotos_extra = qtd;
            
            // Calcular valores imediatamente usando regras congeladas
            if (currentSession?.regras_congeladas) {
              const { pricingFreezingService } = await import('@/services/PricingFreezingService');
              const { valorUnitario, valorTotal } = pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(
                qtd,
                currentSession.regras_congeladas
              );
              sanitizedUpdates.valor_foto_extra = valorUnitario;
              sanitizedUpdates.valor_total_foto_extra = valorTotal;
              console.log('📸 [Atomic] Fotos extras calculadas: qtd=', qtd, 'unit=', valorUnitario, 'total=', valorTotal);
            }
            break;
          case 'valorTotalFotoExtra':
            sanitizedUpdates.valor_total_foto_extra = typeof value === 'string' 
              ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
              : Number(value) || 0;
            break;
          case 'regrasDePrecoFotoExtraCongeladas':
            sanitizedUpdates.regras_congeladas = value;
            break;
          // Map desconto, valor_adicional, observacoes, detalhes to database columns
          case 'desconto':
            sanitizedUpdates.desconto = typeof value === 'string'
              ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
              : Number(value) || 0;
            break;
          case 'valorAdicional':
            sanitizedUpdates.valor_adicional = typeof value === 'string'
              ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
              : Number(value) || 0;
            break;
          case 'observacoes':
            sanitizedUpdates.observacoes = value as string;
            break;
          case 'detalhes':
            sanitizedUpdates.detalhes = value as string;
            break;
          
          // FASE 3: Save frontend-calculated total directly (Single Source of Truth)
          case 'total':
            // Frontend already calculated correctly using calculateTotal()
            // Simply save it directly to Supabase without any recalculation
            const numericTotal = typeof value === 'string' 
              ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
              : Number(value);
            sanitizedUpdates.valor_total = numericTotal || 0;
            console.log('💰 [FASE 3] Saving frontend-calculated total directly:', sanitizedUpdates.valor_total);
            break;
          
          // Ignore fields that don't exist in the database schema  
          case 'produto':
          case 'qtdProduto':
          case 'valorTotalProduto':
          case 'valor':
          case 'valorPago':
          case 'restante':
          case 'pagamentos':
            // Skip these fields - they don't exist in clientes_sessoes schema
            break;
          default:
            // For any other field, check if it exists in WorkflowSession
            const validFields = {
              id: '', user_id: '', cliente_id: '', session_id: '', 
              appointment_id: '', orcamento_id: '', data_sessao: '', 
              hora_sessao: '', categoria: '', pacote: '', descricao: '', 
              status: '', valor_total: 0, valor_pago: 0, produtos_incluidos: null
            };
            if (field in validFields) {
              (sanitizedUpdates as any)[field] = value;
            }
            break;
        }
      }

      // Only proceed if we have valid updates
      if (Object.keys(sanitizedUpdates).length === 0) {
        console.log('No valid updates to apply');
        return;
      }

      // FASE 2: ATOMIC TOTAL CALCULATION - SEMPRE recalcular se campos afetarem o total
      // CRÍTICO: Ignorar valor_total explícito do frontend quando houver mudanças nos componentes
      const totalAffectingFields = ['valor_base_pacote', 'qtd_fotos_extra', 'valor_foto_extra', 'valor_total_foto_extra', 
                                     'desconto', 'valor_adicional', 'produtos_incluidos'];
      const hasTotalAffectingChanges = totalAffectingFields.some(field => field in sanitizedUpdates);

      if (hasTotalAffectingChanges && currentSession) {
        // Build snapshot by merging current session with sanitized updates
        const snapshot = {
          valor_base_pacote: sanitizedUpdates.valor_base_pacote ?? currentSession.valor_base_pacote ?? 0,
          valor_total_foto_extra: sanitizedUpdates.valor_total_foto_extra ?? currentSession.valor_total_foto_extra ?? 0,
          valor_adicional: sanitizedUpdates.valor_adicional ?? currentSession.valor_adicional ?? 0,
          desconto: sanitizedUpdates.desconto ?? currentSession.desconto ?? 0,
          produtos_incluidos: sanitizedUpdates.produtos_incluidos ?? currentSession.produtos_incluidos ?? []
        };

        // Calculate manual products total
        const valorProdutos = calculateManualProductsTotal(snapshot.produtos_incluidos as any);

        // Calculate new total atomically
        const novoTotal = calculateSessionTotal({
          valorBase: Number(snapshot.valor_base_pacote) || 0,
          valorFotoExtra: Number(snapshot.valor_total_foto_extra) || 0,
          valorProdutos,
          valorAdicional: Number(snapshot.valor_adicional) || 0,
          desconto: Number(snapshot.desconto) || 0
        });

        sanitizedUpdates.valor_total = novoTotal;
        console.info('🧮 [FASE 5] Recalculated valor_total atomically:', {
          valorBase: snapshot.valor_base_pacote,
          valorFotoExtra: snapshot.valor_total_foto_extra,
          valorProdutos,
          valorAdicional: snapshot.valor_adicional,
          desconto: snapshot.desconto,
          novoTotal
        });
      }

      // Perform diff check to avoid unnecessary updates
      if (currentSession) {
        let hasChanges = false;
        const fieldsToCheck = ['pacote', 'valor_total', 'valor_pago', 'qtd_fotos_extra', 'valor_foto_extra', 'valor_total_foto_extra', 'produtos_incluidos', 'categoria', 'descricao', 'status', 'regras_congeladas', 'desconto', 'valor_adicional', 'observacoes', 'detalhes'];
        
        for (const field of fieldsToCheck) {
          const newValue = sanitizedUpdates[field as keyof WorkflowSession];
          const currentValue = currentSession[field as keyof WorkflowSession];
          
          if (newValue !== undefined && JSON.stringify(newValue) !== JSON.stringify(currentValue)) {
            hasChanges = true;
            break;
          }
        }
        
        if (!hasChanges) {
          console.log('📝 No changes detected, skipping update for session:', id);
          return;
        }
      }

      console.log('🔄 Updating session:', id, 'with sanitized updates:', sanitizedUpdates, 'silent:', silent);

      sanitizedUpdates.updated_by = user.user.id;

      const { error } = await supabase
        .from('clientes_sessoes')
        .update(sanitizedUpdates)
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) throw error;

      // FASE 4: Read-back para garantir consistência (correção automática se necessário)
      if (hasTotalAffectingChanges && currentSession) {
        const { data: updatedSession } = await supabase
          .from('clientes_sessoes')
          .select('id, valor_total, valor_base_pacote, qtd_fotos_extra, valor_total_foto_extra, valor_adicional, desconto, produtos_incluidos')
          .eq('id', id)
          .eq('user_id', user.user.id)
          .single();
        
        if (updatedSession) {
          // Recalcular o total esperado baseado nos valores reais do banco
          const valorProdutos = calculateManualProductsTotal(updatedSession.produtos_incluidos as any);
          const expectedTotal = calculateSessionTotal({
            valorBase: Number(updatedSession.valor_base_pacote) || 0,
            valorFotoExtra: Number(updatedSession.valor_total_foto_extra) || 0,
            valorProdutos,
            valorAdicional: Number(updatedSession.valor_adicional) || 0,
            desconto: Number(updatedSession.desconto) || 0
          });
          
          const actualTotal = Number(updatedSession.valor_total);
          
          // Se houver divergência > 0.01, corrigir automaticamente
          if (Math.abs(expectedTotal - actualTotal) > 0.01) {
            console.warn('⚠️ [FASE 4] Divergência detectada no total após update, corrigindo:', {
              expected: expectedTotal,
              actual: actualTotal,
              components: {
                valorBase: updatedSession.valor_base_pacote,
                valorFotoExtra: updatedSession.valor_total_foto_extra,
                valorProdutos,
                valorAdicional: updatedSession.valor_adicional,
                desconto: updatedSession.desconto
              }
            });
            
            // Corrigir divergência atomicamente
            await supabase
              .from('clientes_sessoes')
              .update({ valor_total: expectedTotal, updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('user_id', user.user.id);
              
            // Atualizar sanitizedUpdates para refletir o valor correto
            sanitizedUpdates.valor_total = expectedTotal;
          } else {
            console.log('✅ [FASE 4] Valor total validado e consistente:', actualTotal);
          }
        }
      }

      // ✅ FASE 7: CRÍTICO - Buscar sessão COMPLETA com dados do cliente após update
      const { data: fullUpdatedSession } = await supabase
        .from('clientes_sessoes')
        .select(`*, clientes(nome, email, telefone, whatsapp)`)
        .eq('id', id)
        .single();

      if (fullUpdatedSession) {
        // Atualizar estado local com dados completos
        setSessions(prev => prev.map(session => 
          session.id === id ? fullUpdatedSession : session
        ));
        
        // ✅ CRÍTICO: Atualizar cache central diretamente (não depender do realtime)
        const { workflowCacheManager } = await import('@/services/WorkflowCacheManager');
        workflowCacheManager.updateSession(id, fullUpdatedSession);
        
        console.log('✅ [FASE 8] Sessão atualizada no cache central:', id);
        
        // ✅ FASE 8: CRÍTICO - Notificar WorkflowCacheContext via evento customizado
        // O WorkflowCacheContext já tem listener para 'workflow-cache-merge'
        window.dispatchEvent(new CustomEvent('workflow-cache-merge', {
          detail: { session: fullUpdatedSession }
        }));
        console.log('✅ [FASE 8] Evento workflow-cache-merge emitido');
        
        // Emitir evento COM dados completos para outros listeners
        window.dispatchEvent(new CustomEvent('workflow-session-updated', {
          detail: { 
            sessionId: id, 
            updates: sanitizedUpdates, 
            fullSession: fullUpdatedSession, 
            timestamp: new Date().toISOString() 
          }
        }));
      } else {
        // Fallback: usar sanitizedUpdates se falhar busca
        setSessions(prev => prev.map(session => 
          session.id === id ? { ...session, ...sanitizedUpdates } : session
        ));
        
        window.dispatchEvent(new CustomEvent('workflow-session-updated', {
          detail: { sessionId: id, updates: sanitizedUpdates, timestamp: new Date().toISOString() }
        }));
      }

      // Only show toast if not silent (user-initiated action)
      if (!silent) {
        toast({
          title: "Sessão atualizada",
          description: "Sessão atualizada com sucesso.",
        });
      }
    } catch (err) {
      console.error('Error updating session:', err);
      if (!silent) {
        toast({
          title: "Erro ao atualizar sessão",
          description: err instanceof Error ? err.message : 'Failed to update session',
          variant: "destructive",
        });
      }
      throw err;
    }
  }, [sessions]);

  // Delete session with flexible options
  const deleteSession = useCallback(async (id: string, includePayments: boolean = false) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Find session data for session_id
      const session = sessions.find(s => s.id === id);
      if (!session) throw new Error('Session not found');

      // Use flexible deletion utility
      const { deleteSessionWithOptions } = await import('@/utils/sessionDeletionUtils');
      
      await deleteSessionWithOptions(session.session_id, {
        includePayments,
        userId: user.user.id
      });

      setSessions(prev => prev.filter(session => session.id !== id));
      
      toast({
        title: "Sessão excluída",
        description: includePayments ? 
          "Sessão e pagamentos excluídos com sucesso." :
          "Sessão excluída. Pagamentos mantidos para auditoria.",
      });
    } catch (err) {
      console.error('Error deleting session:', err);
      toast({
        title: "Erro ao excluir sessão",
        description: err instanceof Error ? err.message : 'Failed to delete session',
        variant: "destructive",
      });
      throw err;
    }
  }, [sessions]);

  // Convert confirmed appointment to session
  const createSessionFromAppointment = useCallback(async (appointmentId: string, appointmentData: any) => {
    try {
      const sessionId = generateUniversalSessionId('workflow');
      
      // FASE 2: Set ONLY base package value - SQL trigger will add extras automatically
      const sessionData = {
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: appointmentData.clienteId || '',
        data_sessao: typeof appointmentData.date === 'string' ? appointmentData.date : `${appointmentData.date.getFullYear()}-${String(appointmentData.date.getMonth() + 1).padStart(2, '0')}-${String(appointmentData.date.getDate()).padStart(2, '0')}`,
        hora_sessao: appointmentData.time,
        categoria: appointmentData.categoria || '',
        pacote: appointmentData.pacote || '',
        descricao: appointmentData.description || '',
        status: '',
        valor_total: appointmentData.valorPacote || 0, // ONLY base package value - trigger adds extras
        valor_pago: appointmentData.paidAmount || 0,
        produtos_incluidos: appointmentData.produtosIncluidos || []
      };

      console.log('💰 Creating session with base package value (trigger will add extras):', sessionData.valor_total);
      return await createSession(sessionData);
    } catch (err) {
      console.error('Error creating session from appointment:', err);
      throw err;
    }
  }, [createSession]);

  // Real-time subscription
  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel('workflow-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes_sessoes'
        },
        async (payload) => {
          console.log('🔄 [WorkflowRealtime] Real-time workflow session change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('➕ [WorkflowRealtime] Adding new session via realtime:', payload.new);
            
            // FASE 3: Enriquecer INSERT com dados do cliente (JOIN)
            const { data: enrichedSession } = await supabase
              .from('clientes_sessoes')
              .select(`
                *,
                clientes (
                  nome,
                  email,
                  telefone,
                  whatsapp
                )
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (enrichedSession) {
              console.log('✅ [WorkflowRealtime] Sessão enriquecida com cliente:', enrichedSession.clientes?.nome);
              setSessions(prev => [enrichedSession as WorkflowSession, ...prev]);
            } else {
              // Fallback para payload.new se não conseguir enriquecer
              setSessions(prev => [payload.new as WorkflowSession, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            console.log('✏️ [WorkflowRealtime] Updating session via realtime:', payload.new.id);
            
            // FASE 2: Fetch payments selectively for the updated session only
            const sessionId = (payload.new as any).session_id;
            if (sessionId) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: transacoesData } = await supabase
                  .from('clientes_transacoes')
                  .select('*')
                  .eq('session_id', sessionId)
                  .eq('user_id', user.id)
                  .in('tipo', ['pagamento', 'ajuste'])
                  .order('data_transacao', { ascending: false });

                // Convert to payment format
                const pagamentos = (transacoesData || []).map(t => {
                  const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
                  const paymentId = match ? match[1] : t.id;
                  const isPaid = t.tipo === 'pagamento';
                  const isPending = t.tipo === 'ajuste';
                  const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
                  const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
                  const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;
                  
                  let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
                  if (isPending) {
                    tipo = totalParcelas ? 'parcelado' : 'agendado';
                  }
                  
                  let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
                  if (isPending) {
                    statusPagamento = 'pendente';
                    if (t.data_vencimento && new Date(t.data_vencimento) < new Date()) {
                      statusPagamento = 'atrasado';
                    }
                  }
                  
                  return {
                    id: paymentId,
                    valor: Number(t.valor) || 0,
                    data: isPaid ? t.data_transacao : '',
                    dataVencimento: t.data_vencimento || undefined,
                    observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
                    tipo,
                    statusPagamento,
                    numeroParcela,
                    totalParcelas,
                    origem: 'manual' as const,
                    editavel: true
                  };
                });

                // Update session with new payments
                setSessions(prev => prev.map((session: any) => {
                  if (session.id !== payload.new.id) return session;
                  const incoming = payload.new as any;
                  const preservedCliente = session?.clientes && !('clientes' in incoming) ? session.clientes : incoming?.clientes;
                  return {
                    ...session,
                    ...incoming,
                    pagamentos, // Update with fresh payments
                    ...(preservedCliente ? { clientes: preservedCliente } : {})
                  } as WorkflowSession;
                }));
                
                console.log('💰 [WorkflowRealtime] Session updated with fresh payments:', pagamentos.length);
                return;
              }
            }
            
            // Fallback: update without payments if sessionId is missing
            setSessions(prev => prev.map((session: any) => {
              if (session.id !== payload.new.id) return session;
              const incoming = payload.new as any;
              const preservedCliente = session?.clientes && !('clientes' in incoming) ? session.clientes : incoming?.clientes;
              return {
                ...session,
                ...incoming,
                ...(preservedCliente ? { clientes: preservedCliente } : {})
              } as WorkflowSession;
            }));
            // No toast here - realtime updates should be silent
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ [WorkflowRealtime] Deleting session via realtime:', payload.old.id);
            setSessions(prev => prev.filter(session => session.id !== payload.old.id));
          }
        }
      )
      .subscribe(); // FASE 1: Removed redundant clientes_transacoes listener

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSessions]);


  // Convert to SessionData format for compatibility (async version for detailed mapping)
  const convertToSessionData = useCallback(async (session: WorkflowSession): Promise<SessionData> => {
    // Map package ID to name for display
    let packageName = session.pacote || '';
    let packageValue = session.valor_total;
    let packageFotoExtraValue = 35;

    if (session.pacote) {
      try {
        const { configurationService } = await import('@/services/ConfigurationService');
        const packages = configurationService.loadPacotes();
        const pkg = packages.find((p: any) => p.id === session.pacote || p.nome === session.pacote);
        if (pkg) {
          packageName = pkg.nome;
          packageValue = Number(pkg.valor_base) || session.valor_total;
          packageFotoExtraValue = Number(pkg.valor_foto_extra) || 35;
        } else {
          packageName = session.pacote; // Keep original if not found in packages
        }
      } catch (error) {
        console.warn('Error loading package data:', error);
        packageName = session.pacote; // Fallback to original value
      }
    }

    return {
      id: session.id,
      data: session.data_sessao,
      hora: session.hora_sessao,
      nome: (session as any).clientes?.nome || '',
      email: (session as any).clientes?.email || '',
      descricao: session.descricao || '',
      status: session.status,
      whatsapp: (session as any).clientes?.telefone || '',
      categoria: session.categoria,
      pacote: packageName,
      valorPacote: `R$ ${packageValue.toFixed(2).replace('.', ',')}`,
      valorFotoExtra: `R$ ${(session.valor_foto_extra || packageFotoExtraValue).toFixed(2).replace('.', ',')}`,
      qtdFotosExtra: session.qtd_fotos_extra || 0,
      valorTotalFotoExtra: `R$ ${(session.valor_total_foto_extra || 0).toFixed(2).replace('.', ',')}`,
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 'R$ 0,00',
      valorAdicional: `R$ ${(session.valor_adicional || 0).toFixed(2).replace('.', ',')}`,
      detalhes: session.detalhes || '',
      observacoes: session.observacoes || '',
      valor: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      total: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      valorPago: `R$ ${session.valor_pago.toFixed(2).replace('.', ',')}`,
      restante: `R$ ${(session.valor_total - session.valor_pago).toFixed(2).replace('.', ',')}`,
      desconto: `R$ ${(session.desconto || 0).toFixed(2).replace('.', ',')}`,
      pagamentos: [],
      produtosList: session.produtos_incluidos || [],
      regrasDePrecoFotoExtraCongeladas: session.regras_congeladas,
      clienteId: session.cliente_id
    };
  }, []);

  // Get sessions formatted as SessionData
  const getSessionsData = useCallback(async () => {
    return Promise.all(sessions.map(convertToSessionData));
  }, [sessions, convertToSessionData]);

  // Compute sessionsData using the package data hook for proper resolution
  // CORREÇÃO: Remover gating por isLoading pois convertSessionToData prioriza dados congelados
  const sessionsData = useMemo(() => {
    console.log('🔄 Converting sessions to SessionData format:', sessions.length, 'sessions');
    const converted = sessions.map(session => convertSessionToData(session));
    console.log('✅ Converted sessions data:', converted.length, 'sessions converted');
    return converted;
  }, [sessions, convertSessionToData]);

  return {
    sessions,
    sessionsData,
    loading,
    error,
    createSession,
    updateSession,
    deleteSession,
    createSessionFromAppointment,
    refetch: loadSessions
  };
};