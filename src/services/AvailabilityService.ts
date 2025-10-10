import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Availability Service - FASE 2
 * Gerencia ocupação e liberação automática de slots de disponibilidade
 */
export class AvailabilityService {
  /**
   * Ocupa (remove) slot de disponibilidade quando agendamento é confirmado
   */
  static async occupyAvailableSlot(date: Date, time: string): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('⚠️ Usuário não autenticado');
        return;
      }

      const dateStr = format(date, 'yyyy-MM-dd');

      // Buscar slot correspondente
      const { data: slots, error: fetchError } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user.data.user.id)
        .eq('date', dateStr)
        .eq('start_time', time);

      if (fetchError) {
        console.error('❌ Erro ao buscar slot:', fetchError);
        return;
      }

      if (!slots || slots.length === 0) {
        console.log('ℹ️ Nenhum slot de disponibilidade encontrado para ocupar');
        return;
      }

      // Deletar todos os slots correspondentes
      const { error: deleteError } = await supabase
        .from('availability_slots')
        .delete()
        .in('id', slots.map(s => s.id));

      if (deleteError) {
        console.error('❌ Erro ao ocupar slot:', deleteError);
        throw deleteError;
      }

      console.log(`✅ ${slots.length} slot(s) ocupado(s) em ${dateStr} às ${time}`);
    } catch (error) {
      console.error('❌ Erro ao ocupar slot:', error);
      throw error;
    }
  }

  /**
   * Libera (recria) slot de disponibilidade quando agendamento é cancelado
   */
  static async releaseSlot(date: Date, time: string, duration: number = 60): Promise<void> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.warn('⚠️ Usuário não autenticado');
        return;
      }

      const dateStr = format(date, 'yyyy-MM-dd');
      const [hour, min] = time.split(':').map(Number);
      const totalMinutes = hour * 60 + min + duration;
      const endHour = Math.floor(totalMinutes / 60);
      const endMin = totalMinutes % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      // Criar novo slot de disponibilidade
      const { error } = await supabase
        .from('availability_slots')
        .insert({
          user_id: user.data.user.id,
          date: dateStr,
          start_time: time,
          end_time: endTime,
          type: 'disponivel',
          description: 'Horário disponível'
        });

      if (error) {
        console.error('❌ Erro ao liberar slot:', error);
        throw error;
      }

      console.log(`✅ Slot liberado em ${dateStr} às ${time}`);
    } catch (error) {
      console.error('❌ Erro ao liberar slot:', error);
      throw error;
    }
  }
}
