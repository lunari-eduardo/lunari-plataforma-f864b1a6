import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';
import { toast } from 'sonner';

export function WorkflowSyncButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    try {
      setIsLoading(true);
      toast.info('Sincronizando agendamentos confirmados...');

      // Get all confirmed appointments without sessions
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'confirmado');

      if (!appointments?.length) {
        toast.success('Nenhum agendamento confirmado encontrado');
        return;
      }

      let syncCount = 0;
      for (const appointment of appointments) {
        const { data: existingSession } = await supabase
          .from('clientes_sessoes')
          .select('id')
          .eq('appointment_id', appointment.id)
          .single();

        if (!existingSession) {
          await WorkflowSupabaseService.createSessionFromAppointment(
            appointment.id,
            appointment
          );
          syncCount++;
        }
      }

      if (syncCount > 0) {
        toast.success(`${syncCount} sessões criadas com sucesso!`);
      } else {
        toast.info('Todos os agendamentos já estão sincronizados');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar agendamentos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleSync}
      disabled={isLoading}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      Sincronizar
    </Button>
  );
}