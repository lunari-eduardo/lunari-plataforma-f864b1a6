import { Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type GoogleSyncStatus = 'synced' | 'pending' | 'error' | null | undefined;

interface GoogleSyncBadgeProps {
  status: GoogleSyncStatus;
  hasEventId?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Mostra status de sincronização do appointment com Google Calendar.
 * - synced: ícone verde
 * - pending: ícone amarelo pulsante
 * - error: ícone vermelho
 * - null + hasEventId: synced (compatibilidade com itens criados antes do status existir)
 * - null sem eventId: não exibe nada
 */
export function GoogleSyncBadge({ status, hasEventId, className, size = 'sm' }: GoogleSyncBadgeProps) {
  // Inferência: tem event_id mas status null → considerar synced
  const effective: GoogleSyncStatus = status || (hasEventId ? 'synced' : null);
  if (!effective) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const config = {
    synced: {
      Icon: CheckCircle2,
      color: 'text-emerald-500',
      label: 'Sincronizado com Google Calendar',
    },
    pending: {
      Icon: Loader2,
      color: 'text-amber-500 animate-spin',
      label: 'Sincronizando com Google Calendar...',
    },
    error: {
      Icon: AlertCircle,
      color: 'text-destructive',
      label: 'Falha ao sincronizar com Google Calendar. Será tentado novamente automaticamente.',
    },
  } as const;

  const cfg = config[effective as keyof typeof config];
  if (!cfg) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-muted-foreground',
              className,
            )}
            aria-label={cfg.label}
          >
            <Calendar className={cn(iconSize, 'text-muted-foreground/70')} />
            <cfg.Icon className={cn(iconSize, cfg.color)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs max-w-[220px]">{cfg.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
