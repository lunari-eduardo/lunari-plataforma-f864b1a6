// Tipos preparados para migração Supabase
// Mantém compatibilidade com estrutura atual mas prepara para tabelas Supabase

export interface SupabaseAppointment {
  id: string;
  session_id?: string;
  title: string;
  date: string; // ISO string para Supabase
  time: string;
  type: string;
  client: string;
  status: 'confirmado' | 'a confirmar';
  description?: string;
  package_id?: string;
  paid_amount?: number;
  email?: string;
  whatsapp?: string;
  orcamento_id?: string;
  origem?: 'agenda' | 'orcamento';
  cliente_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseAvailabilitySlot {
  id: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  type_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseAvailabilityType {
  id: string;
  name: string;
  color: string;
  duration?: number; // em minutos
  created_at?: string;
  updated_at?: string;
}

// Interfaces para configurações de agenda
export interface AgendaSettings {
  preferredView: 'year' | 'month' | 'week' | 'day';
  timeSlots: string[];
  workingDays: number[]; // 0-6 (domingo-sábado)
  workingHours: {
    start: string;
    end: string;
  };
  conflictResolution: 'allow' | 'warn' | 'block';
}

// Mappers para converter entre formatos
export class AgendaTypeMapper {
  static appointmentToSupabase(appointment: any): SupabaseAppointment {
    return {
      id: appointment.id,
      session_id: appointment.sessionId,
      title: appointment.title,
      date: appointment.date instanceof Date 
        ? appointment.date.toISOString().split('T')[0] 
        : appointment.date,
      time: appointment.time,
      type: appointment.type,
      client: appointment.client,
      status: appointment.status,
      description: appointment.description,
      package_id: appointment.packageId,
      paid_amount: appointment.paidAmount,
      email: appointment.email,
      whatsapp: appointment.whatsapp,
      orcamento_id: appointment.orcamentoId,
      origem: appointment.origem,
      cliente_id: appointment.clienteId
    };
  }

  static appointmentFromSupabase(supabaseAppointment: SupabaseAppointment): any {
    return {
      id: supabaseAppointment.id,
      sessionId: supabaseAppointment.session_id,
      title: supabaseAppointment.title,
      date: new Date(supabaseAppointment.date),
      time: supabaseAppointment.time,
      type: supabaseAppointment.type,
      client: supabaseAppointment.client,
      status: supabaseAppointment.status,
      description: supabaseAppointment.description,
      packageId: supabaseAppointment.package_id,
      paidAmount: supabaseAppointment.paid_amount,
      email: supabaseAppointment.email,
      whatsapp: supabaseAppointment.whatsapp,
      orcamentoId: supabaseAppointment.orcamento_id,
      origem: supabaseAppointment.origem,
      clienteId: supabaseAppointment.cliente_id
    };
  }
}