import { UnifiedEvent } from '@/modules/agenda/presentation';
import { getBudgetStatusConfig } from '@/utils/statusConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { FileText, Camera, Video, User, CheckSquare, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UnifiedEventCardProps {
  event: UnifiedEvent;
  onClick: (event: UnifiedEvent) => void;
  compact?: boolean;
  variant?: 'daily' | 'weekly' | 'monthly';
}

export default function UnifiedEventCard({
  event,
  onClick,
  compact = false,
  variant = 'daily',
}: UnifiedEventCardProps) {
  const isAppointment = event.type === 'appointment';
  const isMobile = useIsMobile();
  const { pacotes: pacotesData, getCategoriaNameById } = useOrcamentoData();

  const isFromClosedBudget = isAppointment && (event.originalData as any).origem === 'orcamento';
  const agendaType = event.agendaType || (event.originalData as any)?.agendaType || 'session';

  const getPackageInfo = () => {
    if (isAppointment) {
      const appointment = event.originalData as any;
      let category = appointment.category || '';
      let packageName = appointment.type || '';

      if (appointment.packageId && pacotesData.length > 0) {
        const packageData = pacotesData.find((p) => p.id === appointment.packageId);
        if (packageData) {
          packageName = packageData.nome;
          category = packageData.categoria;
        }
      }

      if (!category && appointment.packageId) {
        const packageData = pacotesData.find((p) => p.id === appointment.packageId);
        if (packageData && packageData.categoriaId) {
          category = getCategoriaNameById(packageData.categoriaId);
        }
      }

      return { packageName, category, description: appointment.description || '' };
    } else {
      const budget = event.originalData as any;
      let category = budget.categoria || '';
      let packageName = budget.pacote || '';
      if (budget.packageId && pacotesData.length > 0) {
        const packageData = pacotesData.find((p) => p.id === budget.packageId);
        if (packageData) {
          packageName = packageData.nome;
          category = packageData.categoria;
        }
      }
      if (!packageName && category) packageName = category;
      return { packageName, category, description: budget.descricao || '' };
    }
  };

  const { packageName, category, description } = getPackageInfo();
  const itemDescription = (
    description ||
    event.description ||
    (event.originalData as any)?.description ||
    (event.originalData as any)?.descricao ||
    ''
  ).trim();

  // Style: use semantic tokens via inline style for flexibility
  const getCardStyle = (): React.CSSProperties => {
    if (agendaType === 'personal') {
      return {
        backgroundColor: 'hsl(var(--event-personal-bg))',
        color: 'hsl(var(--event-personal-fg))',
        borderLeft: '3px solid hsl(var(--event-personal))',
      };
    }

    if (agendaType === 'meeting') {
      return {
        backgroundColor: 'hsl(var(--event-meeting-bg))',
        color: 'hsl(var(--event-meeting-fg))',
        borderLeft: '3px solid hsl(var(--event-meeting))',
      };
    }

    if (event.type === 'task' || agendaType === 'task') {
      return {
        backgroundColor: 'hsl(var(--event-task-bg))',
        color: 'hsl(var(--event-task-fg))',
        borderLeft: '3px solid hsl(var(--event-task))',
      };
    }

    if (isAppointment) {
      if (isFromClosedBudget) {
        return {
          backgroundColor: 'hsl(var(--event-budget-bg))',
          color: 'hsl(var(--event-budget-fg))',
          borderLeft: '3px solid hsl(var(--event-budget))',
        };
      }
      const status = event.status;
      if (status === 'a confirmar') {
        return {
          backgroundColor: 'hsl(var(--event-pending-bg))',
          color: 'hsl(var(--event-pending-fg))',
          borderLeft: '3px solid hsl(var(--event-pending))',
        };
      }
      return {
        backgroundColor: 'hsl(var(--event-confirmed-bg))',
        color: 'hsl(var(--event-confirmed-fg))',
        borderLeft: '3px solid hsl(var(--event-confirmed))',
      };
    }
    return {};
  };

  const budgetClassFallback = !isAppointment && event.type !== 'task'
    ? `${getBudgetStatusConfig(event.status).bgColor} ${getBudgetStatusConfig(event.status).textColor} ${getBudgetStatusConfig(event.status).borderColor} border-2 border-dashed hover:bg-opacity-80`
    : '';

  const renderTypeIcon = (size: 'sm' | 'xs' = 'sm') => {
    const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3';
    if (agendaType === 'personal') {
      return <User className={`${iconClass} text-purple-600 dark:text-purple-400 shrink-0`} />;
    }
    if (agendaType === 'meeting') {
      return <Video className={`${iconClass} text-cyan-600 dark:text-cyan-400 shrink-0`} />;
    }
    if (event.type === 'task' || agendaType === 'task') {
      return <CheckSquare className={`${iconClass} text-amber-600 dark:text-amber-400 shrink-0`} />;
    }
    if (isFromClosedBudget) {
      return <FileText className={`${iconClass} text-emerald-600 dark:text-emerald-400 shrink-0`} />;
    }
    return null;
  };

  const duration = event.durationMinutes !== undefined ? event.durationMinutes : ((event.originalData as any)?.durationMinutes ?? 0);
  const hasCustomDuration = duration > 0 && duration !== 60;
  const durationBadge = duration >= 60 
    ? (duration % 60 === 0 ? `${duration / 60}h` : `${Math.floor(duration / 60)}h${duration % 60}m`)
    : `${duration}m`;

  const mainTitle = agendaType === 'personal' ? event.title : (event.client || event.title);
  const subLabel =
    agendaType === 'personal'
      ? (itemDescription || 'Evento pessoal')
      : agendaType === 'meeting'
      ? (event.originalData?.location ? `Reunião • ${event.originalData.location}` : 'Reunião')
      : category && packageName && category !== packageName
      ? `${category} · ${packageName}`
      : packageName || category || (itemDescription ? itemDescription : 'Sessão');

  const showDescription = Boolean(itemDescription && itemDescription !== subLabel);

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-semibold flex items-center gap-1.5">
        {renderTypeIcon('xs')}
        <span>{mainTitle}</span>
        {hasCustomDuration && (
          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-muted-foreground/20 shrink-0">
            {durationBadge}
          </span>
        )}
      </div>
      <div className="text-muted-foreground">
        {event.time} {hasCustomDuration ? `(${durationBadge})` : ''} · {
          agendaType === 'personal' ? 'Evento pessoal' :
          agendaType === 'meeting' ? (event.originalData?.location ? `Reunião (${event.originalData.location})` : 'Reunião') :
          packageName || category || 'Sessão'
        }
      </div>
      {showDescription && (
        <div className="text-muted-foreground/80 italic text-[11px]">
          {itemDescription}
        </div>
      )}
    </div>
  );

  const renderCardContent = () => {
    if (variant === 'daily') {
      return (
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {renderTypeIcon('sm')}
              <span className="font-semibold text-sm truncate">{mainTitle}</span>
              {hasCustomDuration && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/15 shrink-0 leading-none">
                  {durationBadge}
                </span>
              )}
            </div>
            {isFromClosedBudget && (
              <FileText className="h-3 w-3 shrink-0" style={{ color: 'hsl(var(--event-budget))' }} />
            )}
          </div>
          {subLabel && <div className="text-xs opacity-75 truncate">{subLabel}</div>}
          {showDescription && (
            <div className="text-xs opacity-65 truncate">{itemDescription}</div>
          )}
        </div>
      );
    }
    if (variant === 'weekly') {
      return (
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {renderTypeIcon('xs')}
            <span className="font-medium text-xs truncate">{mainTitle}</span>
          </div>
        </div>
      );
    }
    if (variant === 'monthly') {
      if (isMobile) {
        return (
          <div className="flex items-center gap-1 text-xs font-medium truncate">
            {renderTypeIcon('xs')}
            <span className="truncate">{mainTitle}</span>
          </div>
        );
      }
      return (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {renderTypeIcon('xs')}
              <span className="font-medium text-xs truncate">{mainTitle}</span>
            </div>
          </div>
          {subLabel && <div className="text-[10px] opacity-75 truncate pl-4">{subLabel}</div>}
        </div>
      );
    }
    if (compact) {
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            {renderTypeIcon('xs')}
            <span className="font-medium text-xs truncate">{mainTitle}</span>
          </div>
          <div className="text-xs opacity-70">{event.time}</div>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          {renderTypeIcon('sm')}
          <span className="font-semibold text-sm truncate">{mainTitle}</span>
        </div>
        {subLabel && <div className="text-xs opacity-80 truncate">{subLabel}</div>}
        {showDescription && <div className="text-xs opacity-65 truncate">{itemDescription}</div>}
      </div>
    );
  };

  const cardEl = (
    <div
      onClick={() => onClick(event)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(event);
        }
      }}
      aria-label={`${event.client} às ${event.time}`}
      className={`p-2 rounded-md cursor-pointer transition-all duration-150 hover:scale-[1.01] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${budgetClassFallback}`}
      style={isAppointment ? getCardStyle() : undefined}
    >
      {renderCardContent()}
    </div>
  );

  if (variant === 'weekly' || variant === 'monthly') {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{cardEl}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardEl;
}
