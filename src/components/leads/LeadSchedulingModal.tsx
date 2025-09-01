import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Check, X } from 'lucide-react';
import { useAgenda } from '@/hooks/useAgenda';
import { useConflictResolution } from '@/hooks/useConflictResolution';
import { useToast } from '@/hooks/use-toast';
import ConflictResolutionModal from '@/components/agenda/ConflictResolutionModal';
import type { Lead } from '@/types/leads';

interface LeadSchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduled: (appointmentId: string) => void;
  onSkip: () => void;
}

export default function LeadSchedulingModal({
  open,
  onOpenChange,
  lead,
  onScheduled,
  onSkip
}: LeadSchedulingModalProps) {
  // Early return if lead is null/undefined
  if (!lead) {
    return null;
  }
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:00');
  const [notes, setNotes] = useState('');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingAppointment, setPendingAppointment] = useState<any>(null);
  const [conflictingAppointments, setConflictingAppointments] = useState<any[]>([]);
  const { addAppointment } = useAgenda();
  const { validateTimeConflict, resolveTimeConflicts } = useConflictResolution();
  const { toast } = useToast();

  const handleSchedule = () => {
    try {
      const appointmentToCreate = {
        title: `${lead.nome} - Sessão`,
        date: new Date(date),
        time: time,
        type: 'Sessão',
        client: lead.nome,
        clienteId: lead.clienteId,
        description: notes || `Agendamento do lead: ${lead.nome}`,
        status: 'confirmado' as const,
        origem: 'agenda' as const
      };

      // Validar conflitos para agendamentos confirmados
      const validation = validateTimeConflict(
        appointmentToCreate.date, 
        appointmentToCreate.time, 
        appointmentToCreate.status
      );

      if (!validation.valid) {
        toast({
          title: 'Conflito de Horário',
          description: validation.reason,
          variant: 'destructive'
        });
        return;
      }

      if (validation.needsResolution && validation.conflictingAppointments) {
        setPendingAppointment(appointmentToCreate);
        setConflictingAppointments(validation.conflictingAppointments);
        setShowConflictModal(true);
        return;
      }

      const appointment = addAppointment(appointmentToCreate);
      onScheduled(appointment.id);
      onOpenChange(false);
      
      toast({
        title: 'Agendamento Criado',
        description: `${lead.nome} foi agendado para ${date} às ${time}`
      });
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o agendamento',
        variant: 'destructive'
      });
    }
  };

  const handleConflictResolved = () => {
    if (pendingAppointment) {
      try {
        const appointment = addAppointment(pendingAppointment);
        resolveTimeConflicts(appointment);
        onScheduled(appointment.id);
        setShowConflictModal(false);
        onOpenChange(false);
        setPendingAppointment(null);
        setConflictingAppointments([]);
        
        toast({
          title: 'Agendamento Criado',
          description: `${lead.nome} foi agendado e conflitos resolvidos`
        });
      } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível criar o agendamento',
          variant: 'destructive'
        });
      }
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  if (showConflictModal && pendingAppointment) {
    return (
      <ConflictResolutionModal
        open={true}
        onOpenChange={setShowConflictModal}
        confirmedAppointment={pendingAppointment}
        conflictingAppointments={conflictingAppointments}
        onResolved={handleConflictResolved}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-lunar-accent" />
            Agendar Cliente
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-lunar-text">
              <strong>{lead.nome}</strong> foi movido para "Fechado"
            </p>
            <p className="text-sm text-lunar-textSecondary">
              Deseja agendar esse cliente?
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Data</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Horário</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Observações (opcional)</label>
              <Textarea
                placeholder="Observações sobre o agendamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Pular agendamento
            </Button>
            
            <Button
              onClick={handleSchedule}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}