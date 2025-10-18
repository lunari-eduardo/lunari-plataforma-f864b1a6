import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface CustomTimeSlots {
  date: string; // yyyy-MM-dd
  timeSlots: string[]; // ["08:00", "09:00", ...]
}

export class CustomTimeSlotsService {
  /**
   * Buscar horários personalizados para uma data específica
   */
  static async getTimeSlotsForDate(date: Date): Promise<string[] | null> {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('custom_time_slots')
      .select('time_slots')
      .eq('date', dateKey)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar horários personalizados:', error);
      return null;
    }

    return data?.time_slots || null;
  }

  /**
   * Buscar horários personalizados para múltiplas datas (range)
   */
  static async getTimeSlotsForDateRange(
    startDate: Date, 
    endDate: Date
  ): Promise<Map<string, string[]>> {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('custom_time_slots')
      .select('date, time_slots')
      .gte('date', start)
      .lte('date', end);

    if (error) {
      console.error('Erro ao buscar horários personalizados:', error);
      return new Map();
    }

    const map = new Map<string, string[]>();
    data?.forEach(item => {
      map.set(item.date, item.time_slots);
    });

    return map;
  }

  /**
   * Salvar/atualizar horários personalizados para uma data (UPSERT)
   */
  static async saveTimeSlotsForDate(
    date: Date, 
    timeSlots: string[]
  ): Promise<boolean> {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Obter user_id do usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Usuário não autenticado');
      return false;
    }
    
    // Validar horários
    const validSlots = timeSlots
      .filter(time => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time))
      .sort();

    if (validSlots.length === 0) {
      console.error('Nenhum horário válido para salvar');
      return false;
    }

    const { error } = await supabase
      .from('custom_time_slots')
      .upsert({
        user_id: user.id,
        date: dateKey,
        time_slots: validSlots
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error('Erro ao salvar horários personalizados:', error);
      return false;
    }

    return true;
  }

  /**
   * Remover horários personalizados para uma data (volta aos padrões)
   */
  static async deleteTimeSlotsForDate(date: Date): Promise<boolean> {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    const { error } = await supabase
      .from('custom_time_slots')
      .delete()
      .eq('date', dateKey);

    if (error) {
      console.error('Erro ao deletar horários personalizados:', error);
      return false;
    }

    return true;
  }

  /**
   * Migrar dados do localStorage para Supabase (executar uma vez)
   */
  static async migrateFromLocalStorage(): Promise<void> {
    try {
      const localData = localStorage.getItem('customTimeSlots');
      if (!localData) return;

      const parsed = JSON.parse(localData);
      const entries = Object.entries(parsed) as [string, string[]][];

      for (const [dateKey, timeSlots] of entries) {
        // Converter dateKey para Date
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);

        await this.saveTimeSlotsForDate(date, timeSlots);
      }

      console.log('✅ Migração de horários personalizados concluída');
      
      // Remover do localStorage após migração bem-sucedida
      localStorage.removeItem('customTimeSlots');
    } catch (error) {
      console.error('Erro na migração de horários:', error);
    }
  }
}
