import { supabase } from '@/integrations/supabase/client';

/**
 * Sincroniza um agendamento com o Google Calendar
 * Deve ser chamado após criar, atualizar ou deletar um appointment confirmado
 */
export async function syncAppointmentToGoogleCalendar(
  appointmentId: string,
  action: 'create' | 'update' | 'delete'
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[GoogleCalendarSync] User not authenticated');
      return false;
    }

    // Check if user has Google Calendar integration
    const { data: integration } = await supabase
      .from('usuarios_integracoes')
      .select('status, dados_extras')
      .eq('user_id', user.id)
      .eq('provedor', 'google_calendar')
      .maybeSingle();

    if (!integration || integration.status !== 'ativo') {
      console.log('[GoogleCalendarSync] No active integration');
      return false;
    }

    // Check if sync is enabled
    const syncEnabled = (integration.dados_extras as any)?.sync_enabled !== false;
    if (!syncEnabled) {
      console.log('[GoogleCalendarSync] Sync disabled');
      return false;
    }

    // Call edge function
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: {
        appointmentId,
        action,
        userId: user.id,
      },
    });

    if (error) {
      console.error('[GoogleCalendarSync] Error:', error);
      return false;
    }

    console.log('[GoogleCalendarSync] Result:', data);
    return data?.synced === true;
  } catch (error) {
    console.error('[GoogleCalendarSync] Exception:', error);
    return false;
  }
}
