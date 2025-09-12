import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { SessionData } from '@/types/workflow';
import { toast } from '@/hooks/use-toast';
import { useWorkflowPackageData } from '@/hooks/useWorkflowPackageData';

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
  valor_pago: number;
  produtos_incluidos: any;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
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
        .order('data_sessao', { ascending: false })
        .order('hora_sessao', { ascending: true });

      if (fetchError) {
        console.error('❌ Error fetching sessions:', fetchError);
        throw fetchError;
      }

      console.log('✅ Successfully loaded sessions:', data?.length || 0, 'sessions found');
      console.log('📊 Sessions data:', data);

      setSessions(data || []);
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

  // Create new session
  const createSession = useCallback(async (sessionData: Omit<WorkflowSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert({
          ...sessionData,
          user_id: user.user.id,
          updated_by: user.user.id,
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
  const updateSession = useCallback(async (id: string, updates: any) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Create sanitized update map
      const sanitizedUpdates: Partial<WorkflowSession> = {};

      // Import services for package lookup
      const { configurationService } = await import('@/services/ConfigurationService');

      for (const [field, value] of Object.entries(updates)) {
        switch (field) {
          case 'pacote':
            // Handle both package name and ID
            if (typeof value === 'string' && value) {
            const packages = configurationService.loadPacotes();
            const pkg = packages.find((p: any) => p.id === value || p.nome === value);
            if (pkg) {
              sanitizedUpdates.pacote = pkg.id; // Always store ID in database
              // Also update valor_total if package found
              if (pkg.valor_base) {
                sanitizedUpdates.valor_total = Number(pkg.valor_base);
              }
            } else {
              sanitizedUpdates.pacote = value; // Store as-is if not found
            }
            }
            break;
          case 'valorPacote':
            // Parse currency string to number for valor_total
            if (typeof value === 'string') {
              const numValue = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
              sanitizedUpdates.valor_total = numValue;
            } else if (typeof value === 'number') {
              sanitizedUpdates.valor_total = value;
            }
            break;
          case 'produtosList':
            sanitizedUpdates.produtos_incluidos = value;
            break;
          case 'descricao':
          case 'status':
          case 'categoria':
            (sanitizedUpdates as any)[field] = value;
            break;
          // Ignore fields that don't exist in the database schema
          case 'valorFotoExtra':
          case 'qtdFotosExtra':
          case 'valorTotalFotoExtra':
          case 'produto':
          case 'qtdProduto':
          case 'valorTotalProduto':
          case 'valorAdicional':
          case 'detalhes':
          case 'observacoes':
          case 'valor':
          case 'total':
          case 'valorPago':
          case 'restante':
          case 'desconto':
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

      sanitizedUpdates.updated_by = user.user.id;

      const { error } = await supabase
        .from('clientes_sessoes')
        .update(sanitizedUpdates)
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) throw error;

      setSessions(prev => prev.map(session => 
        session.id === id ? { ...session, ...sanitizedUpdates } : session
      ));

      toast({
        title: "Sessão atualizada",
        description: "Sessão atualizada com sucesso.",
      });
    } catch (err) {
      console.error('Error updating session:', err);
      toast({
        title: "Erro ao atualizar sessão",
        description: err instanceof Error ? err.message : 'Failed to update session',
        variant: "destructive",
      });
      throw err;
    }
  }, []);

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
      
      const sessionData = {
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: appointmentData.clienteId || '',
        data_sessao: appointmentData.date,
        hora_sessao: appointmentData.time,
        categoria: appointmentData.categoria || '',
        pacote: appointmentData.pacote || '',
        descricao: appointmentData.description || '',
        status: 'agendado',
        valor_total: appointmentData.valorPacote || 0,
        valor_pago: appointmentData.paidAmount || 0,
        produtos_incluidos: appointmentData.produtosIncluidos || []
      };

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
          console.log('🔄 Real-time workflow session change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('➕ Adding new session via realtime:', payload.new);
            setSessions(prev => [payload.new as WorkflowSession, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            console.log('✏️ Updating session via realtime:', payload.new.id);
            setSessions(prev => prev.map(session => 
              session.id === payload.new.id ? payload.new as WorkflowSession : session
            ));
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ Deleting session via realtime:', payload.old.id);
            setSessions(prev => prev.filter(session => session.id !== payload.old.id));
          }
        }
      )
      .subscribe();

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
      valorFotoExtra: `R$ ${packageFotoExtraValue.toFixed(2).replace('.', ',')}`,
      qtdFotosExtra: 0,
      valorTotalFotoExtra: 'R$ 0,00',
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 'R$ 0,00',
      valorAdicional: 'R$ 0,00',
      detalhes: session.descricao || '',
      observacoes: '',
      valor: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      total: `R$ ${session.valor_total.toFixed(2).replace('.', ',')}`,
      valorPago: `R$ ${session.valor_pago.toFixed(2).replace('.', ',')}`,
      restante: `R$ ${(session.valor_total - session.valor_pago).toFixed(2).replace('.', ',')}`,
      desconto: 0,
      pagamentos: [],
      produtosList: session.produtos_incluidos || [],
      clienteId: session.cliente_id
    };
  }, []);

  // Get sessions formatted as SessionData
  const getSessionsData = useCallback(async () => {
    return Promise.all(sessions.map(convertToSessionData));
  }, [sessions, convertToSessionData]);

  // Compute sessionsData using the package data hook for proper resolution
  const sessionsData = useMemo(() => {
    if (isLoadingPacotes || isLoadingCategorias) {
      console.log('⏳ Still loading package/category data, returning empty sessions');
      return [];
    }
    
    console.log('🔄 Converting sessions to SessionData format:', sessions.length, 'sessions');
    const converted = sessions.map(session => convertSessionToData(session));
    console.log('✅ Converted sessions data:', converted.length, 'sessions converted');
    return converted;
  }, [sessions, convertSessionToData, isLoadingPacotes, isLoadingCategorias]);

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