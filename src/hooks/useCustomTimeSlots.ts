import { useState, useEffect, useCallback } from 'react';
import { CustomTimeSlotsService } from '@/services/CustomTimeSlotsService';
import { toast } from 'sonner';

const DEFAULT_TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

export const useCustomTimeSlots = (date: Date) => {
  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCustomSlots, setHasCustomSlots] = useState(false);

  // Carregar horários ao montar o componente
  useEffect(() => {
    loadTimeSlots();
  }, [date]);

  const loadTimeSlots = async () => {
    setIsLoading(true);
    try {
      const slots = await CustomTimeSlotsService.getTimeSlotsForDate(date);
      
      if (slots && slots.length > 0) {
        setTimeSlots(slots);
        setHasCustomSlots(true);
      } else {
        setTimeSlots(DEFAULT_TIME_SLOTS);
        setHasCustomSlots(false);
      }
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      setTimeSlots(DEFAULT_TIME_SLOTS);
      setHasCustomSlots(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Salvar horários personalizados
   */
  const saveTimeSlots = useCallback(async (newSlots: string[]) => {
    try {
      const success = await CustomTimeSlotsService.saveTimeSlotsForDate(
        date, 
        newSlots
      );
      
      if (success) {
        setTimeSlots(newSlots.sort());
        setHasCustomSlots(true);
        toast.success('Horários salvos com sucesso');
      } else {
        toast.error('Erro ao salvar horários');
      }
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toast.error('Erro ao salvar horários');
    }
  }, [date]);

  /**
   * Adicionar um novo horário
   */
  const addTimeSlot = useCallback(async (newTime: string) => {
    if (!newTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      toast.error('Formato de horário inválido');
      return false;
    }

    if (timeSlots.includes(newTime)) {
      toast.error('Este horário já existe');
      return false;
    }

    const updatedSlots = [...timeSlots, newTime].sort();
    await saveTimeSlots(updatedSlots);
    return true;
  }, [timeSlots, saveTimeSlots]);

  /**
   * Editar um horário existente
   */
  const editTimeSlot = useCallback(async (
    oldTime: string, 
    newTime: string
  ) => {
    if (!newTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      toast.error('Formato de horário inválido');
      return false;
    }

    if (timeSlots.includes(newTime) && oldTime !== newTime) {
      toast.error('Este horário já existe');
      return false;
    }

    const updatedSlots = timeSlots
      .map(time => time === oldTime ? newTime : time)
      .sort();
    
    await saveTimeSlots(updatedSlots);
    return true;
  }, [timeSlots, saveTimeSlots]);

  /**
   * Resetar para horários padrão
   */
  const resetToDefault = useCallback(async () => {
    try {
      await CustomTimeSlotsService.deleteTimeSlotsForDate(date);
      setTimeSlots(DEFAULT_TIME_SLOTS);
      setHasCustomSlots(false);
      toast.success('Horários resetados para o padrão');
    } catch (error) {
      console.error('Erro ao resetar horários:', error);
      toast.error('Erro ao resetar horários');
    }
  }, [date]);

  /**
   * Remover um horário específico
   */
  const removeTimeSlot = useCallback(async (time: string) => {
    const updatedSlots = timeSlots.filter(t => t !== time);
    
    if (updatedSlots.length === 0) {
      // Se removeu todos, deletar registro customizado
      try {
        await CustomTimeSlotsService.deleteTimeSlotsForDate(date);
        setTimeSlots(DEFAULT_TIME_SLOTS);
        setHasCustomSlots(false);
        toast.success('Horário removido');
      } catch (error) {
        console.error('Erro ao remover horário:', error);
        toast.error('Erro ao remover horário');
      }
      return true;
    }
    
    await saveTimeSlots(updatedSlots);
    toast.success('Horário removido');
    return true;
  }, [timeSlots, saveTimeSlots, date]);

  return {
    timeSlots,
    isLoading,
    hasCustomSlots,
    saveTimeSlots,
    addTimeSlot,
    editTimeSlot,
    removeTimeSlot,
    resetToDefault,
    refresh: loadTimeSlots
  };
};
