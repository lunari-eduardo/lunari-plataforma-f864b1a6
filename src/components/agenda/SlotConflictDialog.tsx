import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Lock, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SlotCheckResult } from '@/hooks/useSlotAvailabilityCheck';

interface SlotConflictDialogProps {
  result: SlotCheckResult | null;
  date: Date;
  time: string;
  onClose: () => void;
  /** Chamado quando o usuário confirma desbloqueio (apenas kind='blocked'). */
  onUnblockAndContinue?: () => void;
  /** Chamado quando o usuário decide prosseguir mesmo com pendente (kind='pending'). */
  onContinueAnyway?: () => void;
}

export function SlotConflictDialog({
  result,
  date,
  time,
  onClose,
  onUnblockAndContinue,
  onContinueAnyway,
}: SlotConflictDialogProps) {
  if (!result || result.kind === 'free') return null;

  const dateLabel = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-md">
        {result.kind === 'busy' && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-destructive/10 p-2">
                  <Users className="h-4 w-4 text-destructive" />
                </div>
                <AlertDialogTitle>Horário ocupado</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="pt-2 leading-relaxed">
                Já existe um agendamento confirmado para{' '}
                <span className="font-medium text-foreground">
                  {result.appointment.client || result.appointment.title}
                </span>{' '}
                em <span className="font-medium text-foreground">{dateLabel}</span> às{' '}
                <span className="font-medium text-foreground">{time}</span>.
                <br />
                <br />
                Escolha outro horário para evitar conflito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={onClose}>Fechar</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {result.kind === 'blocked' && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <AlertDialogTitle>Horário bloqueado</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="pt-2 leading-relaxed">
                {result.slot.isFullDay
                  ? `O dia ${dateLabel} está marcado como bloqueado`
                  : `O horário ${time} de ${dateLabel} está bloqueado`}
                {result.slot.fullDayDescription && (
                  <>
                    : <span className="italic">"{result.slot.fullDayDescription}"</span>
                  </>
                )}
                .
                <br />
                <br />
                Deseja desbloqueá-lo e continuar com o agendamento?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onUnblockAndContinue}>
                Desbloquear e continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {result.kind === 'pending' && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <AlertDialogTitle>Conflito com agendamento pendente</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="pt-2 leading-relaxed">
                Já existe{' '}
                {result.appointments.length === 1
                  ? 'um agendamento pendente'
                  : `${result.appointments.length} agendamentos pendentes`}{' '}
                neste horário:
                <ul className="mt-2 list-disc pl-5 text-foreground">
                  {result.appointments.map((a) => (
                    <li key={a.id}>{a.client || a.title}</li>
                  ))}
                </ul>
                <br />
                Deseja continuar mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onClose}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={onContinueAnyway}>
                Continuar mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SlotConflictDialog;
