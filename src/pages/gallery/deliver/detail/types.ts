import { isPast } from 'date-fns';

export interface DeliverStatusInfo {
  label: 'Expirada' | 'Publicada' | 'Rascunho';
  variant: 'destructive' | 'default' | 'secondary';
  color: string;
}

export function getDeliverStatusInfo(status: string, prazoSelecao: Date | null): DeliverStatusInfo {
  const isExpired =
    status === 'expirado' ||
    status === 'expirada' ||
    status === 'expired' ||
    (prazoSelecao &&
      isPast(prazoSelecao) &&
      ['enviado', 'publicada', 'sent', 'selecao_iniciada', 'selection_started'].includes(status));

  if (isExpired) {
    return { label: 'Expirada', variant: 'destructive', color: 'text-destructive' };
  }
  if (['enviado', 'publicada', 'sent', 'selecao_iniciada', 'selection_started'].includes(status)) {
    return { label: 'Publicada', variant: 'default', color: 'text-primary' };
  }
  return { label: 'Rascunho', variant: 'secondary', color: 'text-muted-foreground' };
}
