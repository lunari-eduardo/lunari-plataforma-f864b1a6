import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useSlotAvailabilityCheck,
  type SlotCheckResult,
} from './useSlotAvailabilityCheck';
import {
  allowBlockedWrite,
  parseAgendaTriggerError,
  extractAgendaErrorMessage,
} from '@/utils/agendaSlotGuard';
import type { AppointmentStatus } from './useAgenda';

export interface GuardExecOpts {
  /** true quando a chamada está sendo refeita após o usuário aceitar desbloquear. */
  blockedReleased: boolean;
}

export interface GuardArgs {
  date: Date;
  time: string;
  status: AppointmentStatus;
  ignoreAppointmentId?: string;
  /** Quando true, prossegue automaticamente sobre pendentes (sem dialog). */
  silentOnPending?: boolean;
  /** Função que executa a gravação. Deve lançar erro em caso de falha. */
  exec: (opts: GuardExecOpts) => Promise<void>;
  /** Callback após gravação bem-sucedida. */
  onSuccess?: () => void;
}

interface PendingGuard extends GuardArgs {
  /** Snapshot que será refeito caso o usuário aceite desbloquear / continuar. */
  retry: (opts: GuardExecOpts) => Promise<void>;
}

interface ControllerState {
  result: SlotCheckResult | null;
  date: Date;
  time: string;
}

/**
 * Hook centralizado para validar slots e exibir SlotConflictDialog.
 * Use o `guard()` em volta de qualquer gravação de appointment.
 * Renderize `dialogProps` em `<SlotConflictDialog {...dialogProps} />`.
 */
export function useAgendaConflict() {
  const { checkSlot, buildResultFromError } = useSlotAvailabilityCheck();
  const [state, setState] = useState<ControllerState>({
    result: null,
    date: new Date(),
    time: '00:00',
  });
  const pendingRef = useRef<PendingGuard | null>(null);

  const close = useCallback(() => {
    pendingRef.current = null;
    setState((s) => ({ ...s, result: null }));
  }, []);

  const runExec = useCallback(
    async (args: GuardArgs, opts: GuardExecOpts) => {
      try {
        await args.exec(opts);
        args.onSuccess?.();
      } catch (err) {
        const kind = parseAgendaTriggerError(err);
        if (kind === 'busy' || kind === 'blocked') {
          // DB pegou o conflito que o front não detectou -> abre dialog
          const result = buildResultFromError(kind, args.date, args.time);
          pendingRef.current = {
            ...args,
            retry: (o) => runExec(args, o),
          };
          setState({ result, date: args.date, time: args.time });
          return;
        }
        console.error('[useAgendaConflict] erro inesperado:', err);
        toast.error(extractAgendaErrorMessage(err));
      }
    },
    [buildResultFromError],
  );

  const guard = useCallback(
    async (args: GuardArgs) => {
      const pre = checkSlot({
        date: args.date,
        time: args.time,
        ignoreAppointmentId: args.ignoreAppointmentId,
        targetStatus: args.status,
      });

      if (pre.kind === 'busy' || pre.kind === 'blocked') {
        pendingRef.current = {
          ...args,
          retry: (o) => runExec(args, o),
        };
        setState({ result: pre, date: args.date, time: args.time });
        return;
      }

      if (pre.kind === 'pending' && !args.silentOnPending) {
        pendingRef.current = {
          ...args,
          retry: (o) => runExec(args, o),
        };
        setState({ result: pre, date: args.date, time: args.time });
        return;
      }

      await runExec(args, { blockedReleased: false });
    },
    [checkSlot, runExec],
  );

  const onUnblockAndContinue = useCallback(async () => {
    const pending = pendingRef.current;
    const current = state.result;
    if (!pending || !current || current.kind !== 'blocked') return;
    try {
      await allowBlockedWrite({ slotId: current.slot.id });
      setState((s) => ({ ...s, result: null }));
      await pending.retry({ blockedReleased: true });
    } catch (err) {
      console.error('[useAgendaConflict] desbloqueio falhou:', err);
      toast.error('Falha ao desbloquear horário');
    } finally {
      pendingRef.current = null;
    }
  }, [state.result]);

  const onUnblockFullDay = useCallback(async () => {
    const pending = pendingRef.current;
    const current = state.result;
    if (!pending || !current || current.kind !== 'blocked') return;
    try {
      await allowBlockedWrite({ fullDay: true, date: pending.date });
      setState((s) => ({ ...s, result: null }));
      await pending.retry({ blockedReleased: true });
    } catch (err) {
      console.error('[useAgendaConflict] desbloqueio do dia falhou:', err);
      toast.error('Falha ao desbloquear o dia');
    } finally {
      pendingRef.current = null;
    }
  }, [state.result]);

  const onContinueAnyway = useCallback(async () => {
    const pending = pendingRef.current;
    const current = state.result;
    if (!pending || !current || current.kind !== 'pending') return;
    setState((s) => ({ ...s, result: null }));
    await pending.retry({ blockedReleased: false });
    pendingRef.current = null;
  }, [state.result]);

  return {
    guard,
    isOpen: !!state.result,
    dialogProps: {
      result: state.result,
      date: state.date,
      time: state.time,
      onClose: close,
      onUnblockAndContinue,
      onUnblockFullDay,
      onContinueAnyway,
    },
  };
}
