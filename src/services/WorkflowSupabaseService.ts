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
      
      // ✅ FASE 2: Log de diagnóstico completo
      console.log('🔍 [WorkflowService] Appointment data received:', {
        id: appointmentId,
        package_id: appointmentData.package_id,
        packageId: appointmentData.packageId,
        cliente_id: appointmentData.cliente_id,
        clienteId: appointmentData.clienteId,
        date: appointmentData.date,
        description: appointmentData.description,
        title: appointmentData.title
      });
      
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
      let nomePacote = ''; // ✅ CORREÇÃO: Armazenar nome do pacote
      let valorTotal = 0;

      if (appointmentData.package_id) {
        console.log('📦 Loading package data for:', appointmentData.package_id);
        
        // ✅ FASE 1: Adicionar verificação de erro explícita
        const { data: pacote, error: packageError } = await supabase
          .from('pacotes')
          .select('*, categorias(nome)')
          .eq('id', appointmentData.package_id)
          .eq('user_id', user.user.id)
          .single();

        if (packageError) {
          console.error('❌ Error loading package:', packageError);
          console.error('   package_id:', appointmentData.package_id);
          console.error('   user_id:', user.user.id);
          
          // FASE 1: FALLBACK - Tentar buscar sem JOIN para debug
          console.log('🔄 Tentando buscar pacote sem JOIN...');
          const { data: pacoteSemJoin, error: errorSemJoin } = await supabase
            .from('pacotes')
            .select('*')
            .eq('id', appointmentData.package_id)
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
          valorBasePacote = Number(regrasCongeladas.valorBase) || 0;
          
          // FASE 1: Double fallback if valorBase is 0 in frozen data
          if (valorBasePacote === 0) {
            if (packageData?.valor_base) {
              valorBasePacote = Number(packageData.valor_base);
              regrasCongeladas.valorBase = valorBasePacote;
              console.log('💰 Corrected frozen valorBase from package:', valorBasePacote);
            } else {
              console.warn('⚠️ valorBase é 0 e sem dados do pacote');
            }
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

      // ✅ FASE 4: Validation - categoria must be the category name, not package name
      console.log('🔍 [Validação] Dados da sessão:');
      console.log('  - categoria:', categoria || appointmentData.type || 'Outros');
      console.log('  - pacote (nome):', nomePacote || '(vazio)');
      console.log('  - appointmentData.type:', appointmentData.type);
      console.log('  - appointmentData.package_id:', appointmentData.package_id);
      
      if (nomePacote && (categoria || appointmentData.type) === nomePacote) {
        console.error('❌ ERRO: categoria está igual ao nome do pacote!');
        console.error('   categoria deveria ser a CATEGORIA, não o nome do pacote');
      }

      // ✅ FASE 4: Determinar categoria com fallbacks seguros
      let finalCategoria = categoria; // Da query do pacote

      if (!finalCategoria) {
        // Fallback 1: appointmentData.type (só se não for nome de pacote)
        if (appointmentData.type && appointmentData.type !== nomePacote) {
          finalCategoria = appointmentData.type;
          console.log('📋 Usando appointmentData.type como categoria:', finalCategoria);
        }
      }

      if (!finalCategoria) {
        // Fallback 2: Usar categoria genérica
        finalCategoria = 'Sessão';
        console.log('📋 Usando categoria genérica: Sessão');
      }

      // Create session record with package ID for proper linking
      const sessionData = {
        user_id: user.user.id,
        session_id: sessionId,
        appointment_id: appointmentId,
        cliente_id: clienteId || '',
        data_sessao: formatDateForStorage(appointmentData.date),
        hora_sessao: appointmentData.time,
        categoria: finalCategoria,
        pacote: nomePacote || '', // ✅ CORREÇÃO: Salvar NOME do pacote, não o ID
        descricao: descricao,
        status: '',
        valor_base_pacote: valorBasePacote, // FASE 1: Save base package value
        valor_total: valorTotal, // Frontend calculates and sends correct total
        valor_pago: Number(appointmentData.paid_amount) || 0,
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