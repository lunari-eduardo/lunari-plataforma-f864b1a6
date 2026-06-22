import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { useAppointmentMutations } from "@/modules/agenda/presentation";
import { useToast } from "@/hooks/use-toast";
import AppointmentForm from "@/components/agenda/AppointmentForm";
import { useAgendaConflict } from "@/hooks/useAgendaConflict";
import { SlotConflictDialog } from "@/components/agenda/SlotConflictDialog";
import type { Lead } from "@/types/leads";

interface SchedulingConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduled: (appointmentId: string) => void;
  onNotScheduled: () => void;
}

export default function SchedulingConfirmationModal({
  open,
  onOpenChange,
  lead,
  onScheduled,
  onNotScheduled,
}: SchedulingConfirmationModalProps) {
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const { addAppointment } = useAppointmentMutations();
  const { toast } = useToast();
  const { guard, dialogProps } = useAgendaConflict();

  const handleScheduleNow = () => {
    setShowAppointmentForm(true);
  };

  const handleNotNow = () => {
    onNotScheduled();
    onOpenChange(false);
  };

  const handleAppointmentSaved = async (appointmentData: any) => {
    const appointmentToCreate = {
      ...appointmentData,
      client: lead.nome,
      clientId: lead.clienteId,
      leadId: lead.id,
      origin: "lead_conversion",
    };

    await guard({
      date: appointmentToCreate.date,
      time: appointmentToCreate.time,
      status: appointmentToCreate.status,
      silentOnPending: appointmentToCreate.status !== 'confirmado',
      exec: async () => {
        const appointment = await addAppointment(appointmentToCreate);
        onScheduled(appointment.id);
        setShowAppointmentForm(false);
        onOpenChange(false);
      },
    });
  };

  const handleAppointmentFormClose = () => {
    setShowAppointmentForm(false);
  };

  if (showAppointmentForm) {
    return (
      <>
        <Dialog open={true} onOpenChange={(open) => !open && handleAppointmentFormClose()}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-elegant">
            <DialogHeader>
              <DialogTitle>Agendar Cliente</DialogTitle>
            </DialogHeader>
            <AppointmentForm
              onSave={handleAppointmentSaved}
              onCancel={handleAppointmentFormClose}
              initialDate={new Date()}
              initialTime="14:00"
              appointment={{
                id: "",
                title: `Sessão - ${lead.nome}`,
                date: new Date(),
                time: "14:00",
                type: "Sessão",
                client: lead.nome,
                status: "a confirmar",
                description: `Lead convertido: ${lead.nome}`,
              }}
            />
          </DialogContent>
        </Dialog>
        <SlotConflictDialog {...dialogProps} />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-lunar-accent" />
              Agendar Cliente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-lunar-text">
                <strong>{lead.nome}</strong> foi convertido com sucesso!
              </p>
              <p className="text-sm text-lunar-textSecondary">Deseja agendar esse cliente agora?</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleNotNow} className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ainda não
              </Button>

              <Button onClick={handleScheduleNow} className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sim, escolher horário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SlotConflictDialog {...dialogProps} />
    </>
  );
}
