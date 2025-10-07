import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { formatDateForStorage } from '@/utils/dateUtils';

/**
 * IMPORTANTE - SINCRONIZAÇÃO DE DATAS:
 * - appointments.date ↔ clientes_sessoes.data_sessao (sincronizado via trigger)
 * - appointments.time ↔ clientes_sessoes.hora_sessao (sincronizado via trigger)
 * - Trigger: sync_appointment_date_to_session (ativa em UPDATE de date/time)
 * - Sempre usar formatDateForStorage() para evitar bugs de timezone
 * 
 * Service for handling workflow integration with appointments
 * Automatically creates workflow sessions when appointments are confirmed
 */
export class WorkflowSupabaseService {
  
  /**
   * Create workflow session from confirmed appointment
   */
  static async createSessionFromAppointment(appointmentId: string, appointmentData: any) {
    try {
      console.log('🔄 Creating workflow session from appointment:', appointmentId, appointmentData);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Check if session already exists for this appointment
      const { data: existingSession } = await supabase
        .from('clientes_sessoes')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (existingSession) {
        console.log('✅ Session already exists for appointment:', appointmentId);
        return existingSession;
      }

      // Generate universal session ID
      const sessionId = generateUniversalSessionId('workflow');

      // Get package details if package_id exists
      let packageData = null;
      let categoria = '';
      let valorTotal = 0;

      if (appointmentData.package_id) {
        console.log('📦 Loading package data for:', appointmentData.package_id);
        const { data: pacote } = await supabase
          .from('pacotes')
          .select('*, categorias(nome)')
          .eq('id', appointmentData.package_id)
          .eq('user_id', user.user.id)
          .single();

        if (pacote) {
          console.log('✅ Package loaded:', pacote);
          packageData = pacote;
          categoria = (pacote as any).categorias?.nome || '';
          valorTotal = Number(pacote.valor_base) || 0;
        } else {
          console.log('⚠️ Package not found for ID:', appointmentData.package_id);
        }
      }

      // Get client data if available - create if missing
      let clienteId = appointmentData.cliente_id;
      if (!clienteId && appointmentData.title) {
        console.log('👤 Searching for client by name:', appointmentData.title);
        // Try to find client by name
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id')
          .eq('nome', appointmentData.title)
          .eq('user_id', user.user.id)
          .single();
        
        if (cliente) {
          clienteId = cliente.id;
          console.log('✅ Found existing client:', clienteId);
          
          // Update appointment with client_id
          await supabase
            .from('appointments')
            .update({ cliente_id: clienteId })
            .eq('id', appointmentId);
            
          console.log('✅ Linked existing client to appointment:', clienteId);
        } else {
          console.log('👤 Creating new client for:', appointmentData.title);
          // Create new client
          const { data: newClient, error: clientError } = await supabase
            .from('clientes')
            .insert({
              user_id: user.user.id,
              nome: appointmentData.title,
              telefone: 'Não informado',
              origem: 'agenda'
            })
            .select()
            .single();
            
          if (newClient && !clientError) {
            clienteId = newClient.id;
            
            // Update appointment with client_id
            await supabase
              .from('appointments')
              .update({ cliente_id: clienteId })
              .eq('id', appointmentId);
              
            console.log('✅ Created new client and linked to appointment:', clienteId);
          } else {
            console.error('❌ Error creating client:', clientError);
          }
        }
      }

      // Freeze complete package and product data with CURRENT pricing model
      const { pricingFreezingService } = await import('@/services/PricingFreezingService');
      const regrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
        appointmentData.package_id,
        categoria
      );
      
      console.log('❄️ Frozen pricing data for new appointment:', regrasCongeladas);

      // Create session record with package ID for proper linking
      const sessionData = {
        user_id: user.user.id,
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: clienteId || '',
        data_sessao: formatDateForStorage(appointmentData.date),
        hora_sessao: appointmentData.time,
        categoria: categoria || appointmentData.type || 'Outros',
        pacote: appointmentData.package_id || '', // Store package_id for linking
        descricao: appointmentData.description || appointmentData.title || '',
        status: '',
        valor_total: valorTotal,
        valor_pago: Number(appointmentData.paid_amount) || 0,
        produtos_incluidos: packageData?.produtos_incluidos || [],
        // Set default extra photo values from frozen pricing model
        valor_foto_extra: regrasCongeladas.precificacaoFotoExtra?.valorFixo || packageData?.valor_foto_extra || 0,
        qtd_fotos_extra: 0,
        valor_total_foto_extra: 0,
        regras_congeladas: regrasCongeladas as any,
        updated_by: user.user.id
      };

      console.log('📝 Creating session with data:', sessionData);

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting session:', error);
        // Handle unique constraint violation (duplicate)
        if (error.code === '23505') {
          console.log('Session already exists due to unique constraint, fetching existing...');
          const { data: existing } = await supabase
            .from('clientes_sessoes')
            .select('*')
            .eq('user_id', user.user.id)
            .eq('appointment_id', appointmentId)
            .single();
          return existing;
        }
        throw error;
      }

      // Create initial transaction if paid_amount > 0
      const paidAmount = Number(appointmentData.paid_amount) || 0;
      if (paidAmount > 0 && clienteId) {
        console.log('💰 Creating initial transaction for amount:', paidAmount);
        await supabase
          .from('clientes_transacoes')
          .insert({
            user_id: user.user.id,
            cliente_id: clienteId,
            session_id: sessionId,
            tipo: 'pagamento',
            valor: paidAmount,
            descricao: 'Entrada do agendamento',
            data_transacao: formatDateForStorage(appointmentData.date),
            updated_by: user.user.id
          });
        
        console.log('✅ Initial transaction created for paid amount:', paidAmount);
      }

      // Update appointment with session_id for bidirectional linking
      if (data) {
        await supabase
          .from('appointments')
          .update({ session_id: data.session_id })
          .eq('id', appointmentId)
          .eq('user_id', user.user.id);
        
        console.log('✅ Appointment updated with session_id:', data.session_id);
      }

      console.log('✅ Workflow session created from appointment:', data);
      return data;

    } catch (error) {
      console.error('❌ Error creating workflow session from appointment:', error);
      throw error;
    }
  }

  /**
   * Update appointment link in existing session
   */
  static async linkAppointmentToSession(sessionId: string, appointmentId: string) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('clientes_sessoes')
        .update({ 
          appointment_id: appointmentId,
          updated_by: user.user.id
        })
        .eq('session_id', sessionId)
        .eq('user_id', user.user.id);

      if (error) throw error;

      console.log('✅ Session linked to appointment:', { sessionId, appointmentId });
    } catch (error) {
      console.error('❌ Error linking session to appointment:', error);
      throw error;
    }
  }

  /**
   * Get sessions for a specific month with package information
   */
  static async getSessionsForMonth(month: number, year: number) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select(`
          *,
          clientes (nome, email, telefone),
          appointments (status, package_id, 
            pacotes (nome, valor_base, valor_foto_extra, produtos_incluidos, 
              categorias (nome)
            )
          )
        `)
        .eq('user_id', user.user.id)
        .gte('data_sessao', startDate)
        .lt('data_sessao', endDate)
        .order('data_sessao', { ascending: false })
        .order('hora_sessao', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error getting sessions for month:', error);
      throw error;
    }
  }

  /**
   * Migrate localStorage data to Supabase
   */
  static async migrateLocalStorageData() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const savedSessions = localStorage.getItem('workflow_sessions');
      if (!savedSessions) return { migrated: 0, skipped: 0 };

      const sessions = JSON.parse(savedSessions);
      let migrated = 0;
      let skipped = 0;

      for (const session of sessions) {
        try {
          // Check if session already exists in Supabase
          const { data: existing } = await supabase
            .from('clientes_sessoes')
            .select('id')
            .eq('session_id', session.id)
            .eq('user_id', user.user.id)
            .single();

          if (existing) {
            skipped++;
            continue;
          }

          // Find client by name
          let clienteId = session.clienteId;
          if (!clienteId && session.nome) {
            const { data: cliente } = await supabase
              .from('clientes')
              .select('id')
              .eq('nome', session.nome)
              .eq('user_id', user.user.id)
              .single();
            
            if (cliente) {
              clienteId = cliente.id;
            }
          }

          // Parse financial values
          const parseValue = (value: string | number) => {
            if (typeof value === 'number') return value;
            return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          };

          const sessionData = {
            user_id: user.user.id,
            session_id: session.id,
            cliente_id: clienteId || '',
            data_sessao: session.data,
            hora_sessao: session.hora,
            categoria: session.categoria || 'Outros',
            pacote: session.pacote || '',
            descricao: session.descricao || '',
            status: session.status || 'agendado',
            valor_total: parseValue(session.total || session.valorPacote || 0),
            valor_pago: parseValue(session.valorPago || 0),
            produtos_incluidos: session.produtosList || [],
            updated_by: user.user.id
          };

          const { error } = await supabase
            .from('clientes_sessoes')
            .insert(sessionData);

          if (!error) {
            migrated++;
          } else {
            console.error('Error migrating session:', session.id, error);
          }

        } catch (sessionError) {
          console.error('Error processing session:', session.id, sessionError);
        }
      }

      console.log(`✅ Migration complete: ${migrated} migrated, ${skipped} skipped`);
      return { migrated, skipped };

    } catch (error) {
      console.error('❌ Error migrating localStorage data:', error);
      throw error;
    }
  }
}