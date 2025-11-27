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
  // FASE 3: Lock para prevenir race conditions na criação de sessões
  private static creationLocks: Map<string, Promise<any>> = new Map();
  
  /**
   * Create workflow session from confirmed appointment
   * Uses lock mechanism to prevent duplicate session creation
   */
  static async createSessionFromAppointment(appointmentId: string, appointmentData: any) {
    // ✅ Verificar se já está sendo criada (lock)
    const existingLock = this.creationLocks.get(appointmentId);
    if (existingLock) {
      console.log('⏳ [WorkflowService] Session creation already in progress for:', appointmentId);
      return existingLock;
    }

    // ✅ Criar lock
    const creationPromise = this._createSessionInternal(appointmentId, appointmentData);
    this.creationLocks.set(appointmentId, creationPromise);

    try {
      const result = await creationPromise;
      return result;
    } finally {
      // ✅ Remover lock após conclusão (com delay para garantir)
      setTimeout(() => {
        this.creationLocks.delete(appointmentId);
      }, 5000);
    }
  }

  /**
   * Internal method for session creation (called by lock mechanism)
   */
  private static async _createSessionInternal(appointmentId: string, appointmentData: any) {
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

      // ✅ HIDRATAÇÃO FORÇADA: SEMPRE buscar dados completos do banco
      console.log('🧴 [Workflow] Hidratando appointment do banco (sempre)...');
      
      const { data: freshAppointment, error: hydrationError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .eq('user_id', user.user.id)
        .single();
      
      if (hydrationError || !freshAppointment) {
        console.error('❌ [Workflow] Falha ao hidratar appointment:', hydrationError);
        throw new Error('Failed to fetch appointment from database');
      }

      // Usar SEMPRE dados hidratados (do banco)
      const hydratedData = {
        ...freshAppointment,
        package_id: freshAppointment.package_id,
        packageId: freshAppointment.package_id,
        cliente_id: freshAppointment.cliente_id,
        clienteId: freshAppointment.cliente_id,
        date: freshAppointment.date,
        time: freshAppointment.time,
        type: freshAppointment.type,
        description: freshAppointment.description,
        title: freshAppointment.title,
        paid_amount: freshAppointment.paid_amount,
        paidAmount: freshAppointment.paid_amount
      };
      
      console.log('🧴 [Workflow] Appointment hidratado com sucesso:', {
        package_id: hydratedData.package_id,
        cliente_id: hydratedData.cliente_id,
        type: hydratedData.type
      });

      // Generate universal session ID
      const sessionId = generateUniversalSessionId('workflow');

      // Get package details if package_id exists
      let packageData = null;
      let categoria = '';
      let nomePacote = ''; // ✅ CORREÇÃO: Armazenar nome do pacote
      let valorTotal = 0;

      // ✅ CRÍTICO: Resolver package_id tolerante a camelCase e snake_case
      const resolvedPackageId = hydratedData.package_id || hydratedData.packageId;
      console.log('📦 [Workflow] resolvedPackageId:', resolvedPackageId);

      if (resolvedPackageId) {
        console.log('📦 Loading package data for:', resolvedPackageId);
        
        // ✅ FASE 1: Adicionar verificação de erro explícita
      const { data: pacote, error: packageError } = await supabase
        .from('pacotes')
        .select('*, categorias(nome)')
        .eq('id', resolvedPackageId)
        .eq('user_id', user.user.id)
        .single();

        if (packageError) {
          console.error('❌ Error loading package:', packageError);
          console.error('   resolvedPackageId:', resolvedPackageId);
          console.error('   user_id:', user.user.id);
          
          // FASE 1: FALLBACK - Tentar buscar sem JOIN para debug
          console.log('🔄 Tentando buscar pacote sem JOIN...');
          const { data: pacoteSemJoin, error: errorSemJoin } = await supabase
            .from('pacotes')
            .select('*')
            .eq('id', resolvedPackageId)
            .eq('user_id', user.user.id)
            .maybeSingle();
          
          if (errorSemJoin) {
            console.error('❌ Erro mesmo sem JOIN:', errorSemJoin);
          } else if (pacoteSemJoin) {
            console.log('✅ Pacote encontrado SEM JOIN, problema no categorias:', pacoteSemJoin);
            // Usar dados do pacote mesmo sem categoria
            packageData = pacoteSemJoin;
            nomePacote = pacoteSemJoin.nome || '';
            valorTotal = Number(pacoteSemJoin.valor_base) || 0;
            
            // Buscar categoria separadamente
            if (pacoteSemJoin.categoria_id) {
              const { data: cat } = await supabase
                .from('categorias')
                .select('nome')
                .eq('id', pacoteSemJoin.categoria_id)
                .maybeSingle();
              
              if (cat) {
                categoria = cat.nome;
                console.log('✅ Categoria carregada separadamente:', categoria);
              }
            }
          } else {
            console.error('❌ Pacote realmente não existe no banco!');
          }
        } else if (pacote) {
          console.log('✅ Package loaded:', pacote);
          packageData = pacote;
          nomePacote = pacote.nome || '';
          categoria = (pacote as any).categorias?.nome || '';
          valorTotal = Number(pacote.valor_base) || 0;
        } else {
          console.log('⚠️ Package not found for ID:', resolvedPackageId);
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
      
      // ✅ FASE 4: Aceitar package_id ou packageId (camelCase/snake_case) com tolerância
      const packageId = appointmentData.package_id || appointmentData.packageId;
      
      // FASE 4: Congelar dados de precificação com tolerância a pacote ausente
      console.log('📦 PackageId being frozen:', packageId, 'Categoria:', categoria);
      
      // FASE 3: Enhanced freezing with fallbacks to ensure valor_base_pacote is always set
      let regrasCongeladas;
      let valorBasePacote = 0;
      
      if (packageId) {
        regrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
          packageId,
          categoria
        );
        
        if (!regrasCongeladas) {
          console.warn('⚠️ Falha ao congelar dados de precificação, usando fallbacks');
          // FASE 1: Try to get package value directly as fallback
          if (packageData?.valor_base) {
            valorBasePacote = Number(packageData.valor_base);
            console.log('💰 Using package valor_base as fallback:', valorBasePacote);
          } else {
            valorBasePacote = 0;
            console.log('⚠️ Sem pacote, valor base será 0');
          }
          
          regrasCongeladas = {
            modelo: 'fixo',
            valorBase: valorBasePacote,
            produtos: packageData?.produtos_incluidos || [],
            categoria: categoria || 'Outros'
          };
        } else {
          console.log('✅ Dados congelados com sucesso:', Object.keys(regrasCongeladas));
          
          // ✅ CORREÇÃO CRÍTICA: Resolver valorBasePacote de múltiplas fontes
          // Prioridade: top-level valorBase > pacote.valorBase > packageData.valor_base
          valorBasePacote = Number(regrasCongeladas.valorBase) 
            || Number(regrasCongeladas.pacote?.valorBase)
            || Number(packageData?.valor_base) 
            || 0;
          
          console.log('💰 Valor base resolvido:', {
            'regrasCongeladas.valorBase': regrasCongeladas.valorBase,
            'regrasCongeladas.pacote?.valorBase': regrasCongeladas.pacote?.valorBase,
            'packageData?.valor_base': packageData?.valor_base,
            'FINAL valorBasePacote': valorBasePacote
          });
          
          // Se mesmo assim for 0, avisar
          if (valorBasePacote === 0) {
            console.warn('⚠️ valorBasePacote é 0 mesmo com regras congeladas');
          }
        }
      } else {
        console.warn('⚠️ Criando sessão sem pacote, usando regras mínimas');
        // FASE 3: Even without package, try to use valorTotal
        if (valorTotal > 0) {
          valorBasePacote = valorTotal;
        }
        
        regrasCongeladas = {
          modelo: 'fixo',
          valorBase: valorBasePacote,
          produtos: [],
          categoria: categoria || 'Outros'
        };
      }
      
      console.log('💰 Valor base do pacote congelado:', valorBasePacote);

      // FASE 4: Calcular valor inicial da foto extra
      const valorFotoExtraInicial = regrasCongeladas ? 
        pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(1, regrasCongeladas).valorUnitario : 0;
      
      // FASE 4: Montar descrição sem fallback para title
      const descricao = appointmentData.description || '';
      console.log('📝 Descrição da sessão:', descricao || '(vazia)');

      // ✅ CORREÇÃO CRÍTICA: finalCategoria NUNCA deve ser nome de pacote
      // Prioridade: categoria do pacote > hydratedData.type (se não for pacote) > 'Sessão'
      let finalCategoria = 'Sessão';
      let categoriaData = null;
      
      if (packageData) {
        // Se tem pacote, buscar categoria via categoria_id
        const { data: cat } = await supabase
          .from('categorias')
          .select('nome')
          .eq('id', packageData.categoria_id)
          .maybeSingle();
        
        if (cat) {
          categoriaData = cat;
          finalCategoria = cat.nome;
          console.log('🏷️ Categoria do pacote usada:', finalCategoria);
        }
      }
      
      // Se não encontrou categoria do pacote, usar hydratedData.type (se não for nome de pacote)
      if (!categoriaData && hydratedData.type && hydratedData.type !== nomePacote) {
        finalCategoria = hydratedData.type;
        console.log('🏷️ Type do appointment usado:', finalCategoria);
      }
      
      // ✅ BLINDAGEM FINAL: Se mesmo assim finalCategoria == nomePacote, forçar correção
      if (finalCategoria === nomePacote) {
        finalCategoria = categoriaData?.nome || 'Sessão';
        console.warn('⚠️ Correção: finalCategoria era nome de pacote, ajustado para:', finalCategoria);
      }

      console.log('🧩 [Workflow] Final categoria/pacote/valorBase:', { 
        finalCategoria, 
        nomePacote, 
        resolvedPackageId,
        valorBasePacote
      });

      // Create session record with package ID for proper linking
      const sessionData = {
        user_id: user.user.id,
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: clienteId || '',
        data_sessao: formatDateForStorage(hydratedData.date),
        hora_sessao: hydratedData.time,
        categoria: finalCategoria,
        pacote: nomePacote || '', // ✅ CORREÇÃO: Salvar NOME do pacote, não o ID
        descricao: descricao,
        valor_base_pacote: valorBasePacote, // ✅ CORREÇÃO: Adicionar valor_base_pacote
        status: '',
        valor_total: valorTotal, // Frontend calculates and sends correct total
        valor_pago: Number(hydratedData.paidAmount || hydratedData.paid_amount || 0),
        produtos_incluidos: packageData?.produtos_incluidos || [],
        // Set default extra photo values from frozen pricing model
        valor_foto_extra: valorFotoExtraInicial,
        qtd_fotos_extra: 0,
        valor_total_foto_extra: 0,
        regras_congeladas: regrasCongeladas as any,
        updated_by: user.user.id
      };

      // FASE 3: Validation - valor_total must include valor_base_pacote
      console.log('🔍 [Validação] Criando sessão com valores:');
      console.log('  - valor_base_pacote:', valorBasePacote);
      console.log('  - valor_total:', valorTotal);
      
      if (valorBasePacote > 0 && valorTotal < valorBasePacote) {
        console.error('❌ ERRO: valor_total menor que valor_base_pacote!');
        console.error('  Corrigindo valor_total...');
        sessionData.valor_total = valorBasePacote;
      }
      
      console.log('📝 Creating session with data:', sessionData);

      // FASE 1: Corrigir SELECT com JOIN para trazer dados do cliente
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .insert(sessionData)
        .select(`
          *,
          clientes (
            nome,
            email,
            telefone,
            whatsapp
          )
        `)
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
        const dataHoje = new Date();
        console.log('💰 Creating initial transaction:', { 
          amount: paidAmount, 
          dateToday: formatDateForStorage(dataHoje),
          sessionDate: formatDateForStorage(appointmentData.date)
        });
        
        await supabase
          .from('clientes_transacoes')
          .insert({
            user_id: user.user.id,
            cliente_id: clienteId,
            session_id: sessionId,
            tipo: 'pagamento',
            valor: paidAmount,
            descricao: 'Entrada do agendamento',
            data_transacao: formatDateForStorage(dataHoje), // ✅ Data de HOJE, não da sessão
            updated_by: user.user.id
          });
        
        console.log('✅ Initial transaction created with today\'s date:', formatDateForStorage(dataHoje));
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
      
      // Disparar evento customizado para invalidação imediata do cache
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('workflow-session-created', {
          detail: { session: data }
        }));
        console.log('📢 Event workflow-session-created dispatched');
      }
      
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

  /**
   * ✅ FASE 3: Reparar divergências entre appointments e clientes_sessoes
   * - Cria sessões faltantes para appointments confirmados
   * - Atualiza datas/horas divergentes (sessão deve seguir appointment)
   */
  static async repairAppointmentsSessionsMismatch() {
    try {
      console.log('🔧 [Repair] Iniciando reparo de divergências...');
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        console.log('⚠️ [Repair] User not authenticated, skipping repair');
        return;
      }

      // 1. Buscar appointments confirmados sem sessão
      const { data: appointmentsWithoutSession } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('status', 'confirmado')
        .is('session_id', null);

      if (appointmentsWithoutSession && appointmentsWithoutSession.length > 0) {
        console.log(`🔧 [Repair] Encontrados ${appointmentsWithoutSession.length} appointments sem sessão`);
        
        for (const appointment of appointmentsWithoutSession) {
          try {
            await this.createSessionFromAppointment(appointment.id, appointment);
            console.log(`✅ [Repair] Sessão criada para appointment ${appointment.id}`);
          } catch (error) {
            console.error(`❌ [Repair] Erro ao criar sessão para ${appointment.id}:`, error);
          }
        }
      }

      // 2. Buscar sessões com appointment_id e verificar divergências de data/hora
      const { data: sessionsWithAppointment } = await supabase
        .from('clientes_sessoes')
        .select('id, appointment_id, data_sessao, hora_sessao')
        .eq('user_id', user.user.id)
        .not('appointment_id', 'is', null);

      if (sessionsWithAppointment && sessionsWithAppointment.length > 0) {
        console.log(`🔧 [Repair] Verificando ${sessionsWithAppointment.length} sessões com appointment_id`);
        
        for (const session of sessionsWithAppointment) {
          // Buscar appointment correspondente
          const { data: appointment } = await supabase
            .from('appointments')
            .select('date, time')
            .eq('id', session.appointment_id)
            .eq('user_id', user.user.id)
            .single();

          if (appointment) {
            const needsDateFix = appointment.date !== session.data_sessao;
            const needsTimeFix = appointment.time !== session.hora_sessao;

            if (needsDateFix || needsTimeFix) {
              console.log(`🔧 [Repair] Divergência detectada na sessão ${session.id}:`, {
                appointment: { date: appointment.date, time: appointment.time },
                session: { date: session.data_sessao, time: session.hora_sessao }
              });

              await supabase
                .from('clientes_sessoes')
                .update({
                  data_sessao: appointment.date,
                  hora_sessao: appointment.time,
                  updated_at: new Date().toISOString()
                })
                .eq('id', session.id)
                .eq('user_id', user.user.id);

              console.log(`✅ [Repair] Sessão ${session.id} atualizada para corresponder ao appointment`);
            }
          }
        }
      }

      console.log('✅ [Repair] Reparo concluído com sucesso');
    } catch (error) {
      console.error('❌ [Repair] Erro durante reparo:', error);
    }
  }
}