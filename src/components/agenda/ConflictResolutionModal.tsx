import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useConflictResolution, type NextAvailableSlot } from '@/hooks/useConflictResolution';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import type { Appointment } from '@/hooks/useAgenda';

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmedAppointment: Appointment;
  conflictingAppointments: Appointment[];
  onResolved: () => void;
}

interface ResolutionOption {
  appointmentId: string;
  action: 'move' | 'cancel' | 'manual';
  newSlot?: NextAvailableSlot;
}

export default function ConflictResolutionModal({
  open,
  onOpenChange,
  confirmedAppointment,
  conflictingAppointments,
  onResolved
}: ConflictResolutionModalProps) {
  const [resolutions, setResolutions] = useState<ResolutionOption[]>([]);
  const { findNextAvailableSlot } = useConflictResolution();
  const { updateAppointment, deleteAppointment } = useAppContext();
  const { toast } = useToast();

  const handleAutoResolve = () => {
    const autoResolutions: ResolutionOption[] = conflictingAppointments.map(app => {
      const nextSlot = findNextAvailableSlot(app.date, app.time);
      return {
        appointmentId: app.id,
        action: nextSlot ? 'move' : 'cancel',
        newSlot: nextSlot || undefined
      };
    });

    setResolutions(autoResolutions);
  };

  const handleManualResolve = (appointmentId: string, action: 'move' | 'cancel' | 'manual') => {
    setResolutions(prev => {
      const existing = prev.find(r => r.appointmentId === appointmentId);
      if (existing) {
        return prev.map(r => 
          r.appointmentId === appointmentId 
            ? { ...r, action }
            : r
        );
      } else {
        return [...prev, { appointmentId, action }];
      }
    });
  };

  const handleApplyResolutions = () => {
    let movedCount = 0;
    let cancelledCount = 0;

    resolutions.forEach(resolution => {
      const appointment = conflictingAppointments.find(app => app.id === resolution.appointmentId);
      if (!appointment) return;

      switch (resolution.action) {
        case 'move':
          if (resolution.newSlot) {
            updateAppointment(appointment.id, {
              date: resolution.newSlot.date,
              time: resolution.newSlot.time
            });
            movedCount++;
          }
          break;
        case 'cancel':
          deleteAppointment(appointment.id);
          cancelledCount++;
          break;
        case 'manual':
          // Usuário vai reagendar manualmente depois
          break;
      }
    });

    toast({
      title: 'Conflitos Resolvidos',
      description: `${movedCount} agendamentos movidos, ${cancelledCount} cancelados`
    });

    onResolved();
    onOpenChange(false);
  };

  const getResolutionForAppointment = (appointmentId: string) => {
    return resolutions.find(r => r.appointmentId === appointmentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Resolver Conflitos de Horário
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Agendamento Confirmado */}
          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Confirmado
              </Badge>
              <span className="font-medium">{confirmedAppointment.client}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(confirmedAppointment.date, 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {confirmedAppointment.time}
              </div>
            </div>
          </div>

          {/* Agendamentos em Conflito */}
          <div>
            <h3 className="font-medium mb-3">Agendamentos Pendentes no Mesmo Horário:</h3>
            <div className="space-y-3">
              {conflictingAppointments.map(appointment => {
                const resolution = getResolutionForAppointment(appointment.id);
                const nextSlot = findNextAvailableSlot(appointment.date, appointment.time);
                
                return (
                  <div key={appointment.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.client}</span>
                        <Badge variant="outline" className="text-xs">
                          Pendente
                        </Badge>
                      </div>
                    </div>

                    {/* Opções de Resolução */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {nextSlot && (
                        <Button
                          variant={resolution?.action === 'move' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleManualResolve(appointment.id, 'move')}
                          className="flex items-center gap-2 justify-start"
                        >
                          <ArrowRight className="h-3 w-3" />
                          <div className="text-left">
                            <div className="text-xs">Mover para</div>
                            <div className="text-xs font-normal">
                              {format(nextSlot.date, 'dd/MM')} às {nextSlot.time}
                            </div>
                          </div>
                        </Button>
                      )}
                      
                      <Button
                        variant={resolution?.action === 'cancel' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleManualResolve(appointment.id, 'cancel')}
                      >
                        Cancelar
                      </Button>
                      
                      <Button
                        variant={resolution?.action === 'manual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleManualResolve(appointment.id, 'manual')}
                      >
                        Reagendar depois
                      </Button>
                    </div>

                    {!nextSlot && (
                      <div className="text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ Nenhum horário livre encontrado nos próximos 30 dias
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botão de Resolução Automática */}
          {resolutions.length === 0 && (
            <Button
              onClick={handleAutoResolve}
              className="w-full"
              variant="outline"
            >
              Resolver Automaticamente
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApplyResolutions}
            disabled={resolutions.length !== conflictingAppointments.length}
          >
            Aplicar Resoluções ({resolutions.length}/{conflictingAppointments.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}