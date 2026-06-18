import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { getBudgetStatusConfig } from '@/utils/statusConfig';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { FileText } from 'lucide-react';
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

  // Style: use semantic tokens via inline style for flexibility
  const getCardStyle = (): React.CSSProperties => {
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

  const budgetClassFallback = !isAppointment
    ? `${getBudgetStatusConfig(event.status).bgColor} ${getBudgetStatusConfig(event.status).textColor} ${getBudgetStatusConfig(event.status).borderColor} border-2 border-dashed hover:bg-opacity-80`
    : '';

  // Render indicators row (origem orçamento apenas — sem indicadores de pagamento)
  const renderIndicators = (size: 'sm' | 'xs' = 'sm') => {
    if (!isFromClosedBudget) return null;
    const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5';
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <FileText className={iconClass} style={{ color: 'hsl(var(--event-budget))' }} />
      </div>
    );
  };

  const tooltipContent = isAppointment ? (
    <div className="space-y-1 text-xs">
      <div className="font-semibold">{event.client}</div>
      <div className="text-muted-foreground">
        {event.time} · {description || packageName || category}
      </div>
    </div>
  ) : (
    <div className="text-xs">
      <div className="font-semibold">{event.client}</div>
      <div className="text-muted-foreground">Orçamento · {event.time}</div>
    </div>
  );

  const renderCardContent = () => {
    if (variant === 'daily') {
      return (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-sm truncate flex-1">{event.client}</div>
            {renderIndicators('sm')}
          </div>
          {description && <div className="text-xs opacity-80 truncate">{description}</div>}
          {(category || packageName) && (
            <div className="text-xs opacity-70 truncate">
              {category && packageName && category !== packageName
                ? `${category} · ${packageName}`
                : packageName || category}
            </div>
          )}
        </div>
      );
    }
    if (variant === 'weekly') {
      return (
        <div className="flex items-center justify-between gap-1">
          <div className="font-medium text-xs truncate flex-1">{event.client}</div>
          {renderIndicators('xs')}
        </div>
      );
    }
    if (variant === 'monthly') {
      if (isMobile) {
        return <div className="text-xs font-medium truncate">{event.client}</div>;
      }
      return (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <div className="font-medium text-xs truncate flex-1">{event.client}</div>
            {renderIndicators('xs')}
          </div>
          {description && <div className="text-xs opacity-80 truncate">{description}</div>}
          {category && <div className="text-xs opacity-70 truncate">{category}</div>}
        </div>
      );
    }
    if (compact) {
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-xs truncate">{event.client}</div>
          <div className="text-xs opacity-70">{event.time}</div>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <div className="font-semibold text-sm truncate">{event.client}</div>
        {description && <div className="text-xs opacity-80 truncate">{description}</div>}
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
