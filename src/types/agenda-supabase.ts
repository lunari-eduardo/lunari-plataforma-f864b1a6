// Types for Supabase integration - maintaining compatibility with existing code

export interface AppointmentSupabase {
  id: string;
  session_id?: string;
  title: string;
  date: string;
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

export interface ProdutoIncluidoSupabase {
  id: string;
  appointment_id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  tipo: 'incluso' | 'manual';
  created_at?: string;
}

export interface AvailabilitySlotSupabase {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityTypeSupabase {
  id: string;
  name: string;
  duration: number;
  color: string;
  created_at?: string;
  updated_at?: string;
}

// Local storage compatibility types
export interface AgendaSettings {
  defaultView: 'daily' | 'weekly' | 'monthly' | 'annual';
  workingHours: {
    start: string;
    end: string;
  };
  autoConfirmAppointments: boolean;
}