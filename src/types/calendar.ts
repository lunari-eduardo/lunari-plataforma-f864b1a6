
import { Appointment } from '@/hooks/useAgenda';
import { Orcamento } from './orcamentos';

export interface CalendarEvent {
  id: string;
  type: 'appointment' | 'budget';
  title: string;
  date: Date;
  time: string;
  client: string;
  status: string;
  description?: string;
  originalData: Appointment | Orcamento;
}

export interface CalendarSlot {
  date: Date;
  time: string;
  isEmpty: boolean;
  events: CalendarEvent[];
}
