import { supabase } from '@/integrations/supabase/client';
import { formatDateForStorage } from '@/utils/dateUtils';

/**
 * One-time utility to repair date/time mismatches between appointments and sessions
 * This ensures data_sessao and hora_sessao match the appointment's date and time
 */
export async function repairAppointmentSessionDates() {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { repaired: 0, errors: 0, total: 0 };

  let repaired = 0;
  let errors = 0;
  let total = 0;

  try {
    // Fetch all confirmed appointments with session links
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, date, time, session_id')
      .eq('user_id', user.user.id)
      .eq('status', 'confirmado')
      .not('session_id', 'is', null);

    if (!appointments || appointments.length === 0) {
      console.log('✅ No confirmed appointments to check');
      return { repaired, errors, total };
    }

    total = appointments.length;
    console.log(`🔍 Checking ${total} confirmed appointments for date/time mismatches...`);

    for (const appointment of appointments) {
      try {
        // Find the corresponding session
        const { data: session } = await supabase
          .from('clientes_sessoes')
          .select('id, data_sessao, hora_sessao')
          .eq('appointment_id', appointment.id)
          .eq('user_id', user.user.id)
          .maybeSingle();

        if (session) {
          const correctDate = formatDateForStorage(appointment.date);
          const needsDateFix = session.data_sessao !== correctDate;
          const needsTimeFix = session.hora_sessao !== appointment.time;

          if (needsDateFix || needsTimeFix) {
            console.log(`🔧 Repairing session ${session.id}:`, {
              date: needsDateFix ? `${session.data_sessao} → ${correctDate}` : 'OK',
              time: needsTimeFix ? `${session.hora_sessao} → ${appointment.time}` : 'OK'
            });

            await supabase
              .from('clientes_sessoes')
              .update({
                data_sessao: correctDate,
                hora_sessao: appointment.time
              })
              .eq('id', session.id)
              .eq('user_id', user.user.id);

            repaired++;
            console.log(`✅ Repaired session ${session.id}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error repairing appointment ${appointment.id}:`, error);
        errors++;
      }
    }

    console.log(`✅ Repair complete: ${repaired} repaired, ${errors} errors, ${total - repaired - errors} already correct`);
    return { repaired, errors, total };

  } catch (error) {
    console.error('❌ Error during repair process:', error);
    return { repaired, errors, total };
  }
}
