/**
 * Utilitário para corrigir sessões workflow existentes sem clienteId
 * Relaciona sessões com clientes por nome, telefone ou email
 */

import { Cliente } from '@/types/cliente';

interface SessionWorkflow {
  id: string;
  sessionId?: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  clienteId?: string;
}

export const corrigirClienteIdSessoes = (): number => {
  try {
    // Carregar dados
    const sessions: SessionWorkflow[] = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const clientes: Cliente[] = JSON.parse(localStorage.getItem('clients') || '[]');
    
    console.log('🔧 Iniciando correção de clienteId nas sessões...');
    console.log(`📊 Sessões: ${sessions.length}, Clientes: ${clientes.length}`);
    
    let corrigidos = 0;
    
    // Processar cada sessão
    const sessionsCorrigidas = sessions.map(session => {
      // Se já tem clienteId, não mexer
      if (session.clienteId) {
        return session;
      }
      
      // Tentar encontrar cliente correspondente
      const cliente = clientes.find(c => {
        // Buscar por nome (mais provável)
        if (session.nome && c.nome && 
            session.nome.toLowerCase().trim() === c.nome.toLowerCase().trim()) {
          return true;
        }
        
        // Buscar por telefone (limpar formatação)
        if (session.whatsapp && c.telefone) {
          const whatsappLimpo = session.whatsapp.replace(/\D/g, '');
          const telefoneLimpo = c.telefone.replace(/\D/g, '');
          if (whatsappLimpo === telefoneLimpo && whatsappLimpo.length >= 10) {
            return true;
          }
        }
        
        // Buscar por email
        if (session.email && c.email && 
            session.email.toLowerCase().trim() === c.email.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });
      
      if (cliente) {
        console.log(`✅ Relacionando sessão "${session.nome}" com cliente ID: ${cliente.id}`);
        corrigidos++;
        return { ...session, clienteId: cliente.id };
      }
      
      console.log(`⚠️ Não foi possível relacionar sessão: ${session.nome}`);
      return session;
    });
    
    // Salvar apenas se houve mudanças
    if (corrigidos > 0) {
      localStorage.setItem('workflow_sessions', JSON.stringify(sessionsCorrigidas));
      console.log(`🎉 Correção concluída: ${corrigidos} sessões relacionadas com clientes`);
    } else {
      console.log('ℹ️ Nenhuma sessão precisou de correção');
    }
    
    return corrigidos;
    
  } catch (error) {
    console.error('❌ Erro ao corrigir clienteId das sessões:', error);
    return 0;
  }
};

// Função para corrigir agendamentos existentes sem clienteId
export const corrigirClienteIdAgendamentos = (): number => {
  try {
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const clientes: Cliente[] = JSON.parse(localStorage.getItem('clients') || '[]');
    
    console.log('🔧 Iniciando correção de clienteId nos agendamentos...');
    console.log(`📊 Agendamentos: ${appointments.length}, Clientes: ${clientes.length}`);
    
    let corrigidos = 0;
    
    const appointmentsCorrigidos = appointments.map((appointment: any) => {
      if (appointment.clienteId) {
        return appointment;
      }
      
      const cliente = clientes.find(c => {
        // Buscar por nome
        if (appointment.client && c.nome && 
            appointment.client.toLowerCase().trim() === c.nome.toLowerCase().trim()) {
          return true;
        }
        
        // Buscar por telefone
        if (appointment.whatsapp && c.telefone) {
          const whatsappLimpo = appointment.whatsapp.replace(/\D/g, '');
          const telefoneLimpo = c.telefone.replace(/\D/g, '');
          if (whatsappLimpo === telefoneLimpo && whatsappLimpo.length >= 10) {
            return true;
          }
        }
        
        // Buscar por email
        if (appointment.email && c.email && 
            appointment.email.toLowerCase().trim() === c.email.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });
      
      if (cliente) {
        console.log(`✅ Relacionando agendamento "${appointment.client}" com cliente ID: ${cliente.id}`);
        corrigidos++;
        return { ...appointment, clienteId: cliente.id };
      }
      
      console.log(`⚠️ Não foi possível relacionar agendamento: ${appointment.client}`);
      return appointment;
    });
    
    if (corrigidos > 0) {
      localStorage.setItem('appointments', JSON.stringify(appointmentsCorrigidos));
      console.log(`🎉 Correção de agendamentos concluída: ${corrigidos} agendamentos relacionados com clientes`);
    } else {
      console.log('ℹ️ Nenhum agendamento precisou de correção');
    }
    
    return corrigidos;
    
  } catch (error) {
    console.error('❌ Erro ao corrigir clienteId dos agendamentos:', error);
    return 0;
  }
};

// Auto-executar se importado diretamente
if (typeof window !== 'undefined') {
  // Executar apenas uma vez por sessão
  const chaveExecucao = 'correcao_cliente_id_executada';
  if (!sessionStorage.getItem(chaveExecucao)) {
    setTimeout(() => {
      corrigirClienteIdSessoes();
      corrigirClienteIdAgendamentos();
      sessionStorage.setItem(chaveExecucao, 'true');
    }, 1000);
  }
}