import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    title: string;
    date: Date;
    time: string;
  } | null;
  onConfirm: (keepAvailability: boolean) => void;
}

/**
 * Modal de confirmação de agendamento - FASE 4
 * Permite ao usuário escolher se quer manter a disponibilidade do horário
 */
export function AppointmentConfirmModal({
  open,
  onOpenChange,
  appointment,
  onConfirm
}: AppointmentConfirmModalProps) {
  const [keepAvailability, setKeepAvailability] = useState(false);

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar agendamento</DialogTitle>
          <DialogDescription>
            Deseja confirmar o agendamento de <strong>{appointment.title}</strong> para{' '}
            {format(appointment.date, "dd 'de' MMMM", { locale: ptBR })} às {appointment.time}?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox 
            id="keep-availability" 
            checked={keepAvailability}
            onCheckedChange={(checked) => setKeepAvailability(checked as boolean)}
          />
          <Label htmlFor="keep-availability" className="text-sm font-normal">
            Manter disponibilidade do horário (permitir outros agendamentos)
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => {
            onConfirm(keepAvailability);
            onOpenChange(false);
          }}>
            Confirmar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
