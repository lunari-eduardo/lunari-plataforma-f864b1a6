import { useAgendaContext } from '@/contexts/AgendaContext';
import { AgendaSettings } from '@/types/agenda-supabase';

/**
 * Hook for agenda settings management
 * Provides settings state and update operations
 */
export const useAgendaSettings = () => {
  const context = useAgendaContext();

  return {
    // Current settings
    settings: context.settings,
    
    // Update settings
    updateSettings: context.updateSettings,
    
    // Convenience getters
    defaultView: context.settings.defaultView,
    workingHours: context.settings.workingHours,
    autoConfirmAppointments: context.settings.autoConfirmAppointments,
    
    // Convenience setters
    setDefaultView: async (view: AgendaSettings['defaultView']) => {
      await context.updateSettings({
        ...context.settings,
        defaultView: view
      });
    },
    
    setWorkingHours: async (workingHours: { start: string; end: string }) => {
      await context.updateSettings({
        ...context.settings,
        workingHours
      });
    },
    
    setAutoConfirmAppointments: async (autoConfirm: boolean) => {
      await context.updateSettings({
        ...context.settings,
        autoConfirmAppointments: autoConfirm
      });
    }
  };
};