
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { getBudgetStatusConfig } from '@/utils/statusConfig';
import { useIsMobile } from '@/hooks/use-mobile';

interface UnifiedEventCardProps {
  event: UnifiedEvent;
  onClick: (event: UnifiedEvent) => void;
  compact?: boolean;
  variant?: 'daily' | 'weekly' | 'monthly';
}

export default function UnifiedEventCard({ event, onClick, compact = false, variant = 'daily' }: UnifiedEventCardProps) {
  const isAppointment = event.type === 'appointment';
  const isBudget = event.type === 'budget';
  const isMobile = useIsMobile();

  // Check if appointment is from a closed budget (origem: orcamento)
  const isFromClosedBudget = isAppointment && (event.originalData as any).origem === 'orcamento';

  // Get package info for the event
  const getPackageInfo = () => {
    if (isAppointment) {
      const appointment = event.originalData as any;
      return {
        packageName: appointment.type || '',
        category: appointment.type || '',
        description: appointment.description || ''
      };
    } else {
      const budget = event.originalData as any;
      return {
        packageName: budget.categoria || '',
        category: budget.categoria || '',
        description: budget.descricao || budget.categoria || ''
      };
    }
  };

  const { packageName, category, description } = getPackageInfo();

  // New color system based on specifications
  const getEventStyles = () => {
    if (isAppointment) {
      if (isFromClosedBudget) {
        // Orçamentos Fechados (que viraram agendamentos): Verde sólido
        return 'bg-green-100 text-green-800 border-l-4 border-green-500 hover:bg-green-200';
      } else {
        // Agendamentos Diretos: Azul claro sólido
        return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500 hover:bg-blue-200';
      }
    } else {
      // Outros Orçamentos: Manter borda tracejada e fundo semi-transparente
      const config = getBudgetStatusConfig(event.status);
      const baseStyle = 'border-2 border-dashed hover:bg-opacity-80';
      return `${config.bgColor.replace('100', '50')} ${config.textColor} ${config.borderColor.replace('border-', 'border-').replace('500', '300')} hover:${config.bgColor} ${baseStyle}`;
    }
  };

  // Render content based on variant and screen size
  const renderCardContent = () => {
    if (variant === 'daily') {
      // Daily view: 3 lines of detailed info
      return (
        <div className="space-y-1">
          {/* Line 1: Client Name (bold) */}
          <div className="font-semibold text-sm truncate">
            {event.client}
          </div>
          {/* Line 2: Service Description */}
          <div className="text-xs opacity-80 truncate">
            {description}
          </div>
          {/* Line 3: Category - Package Name */}
          <div className="text-xs opacity-70 truncate">
            {category && packageName ? `${category} - ${packageName}` : packageName || category}
          </div>
        </div>
      );
    } else if (variant === 'weekly') {
      // Weekly view: Compact with essential info
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-xs truncate">
            {event.client}
          </div>
          <div className="text-xs opacity-70">
            {event.time}
          </div>
        </div>
      );
    } else if (variant === 'monthly') {
      // Monthly view: Responsive based on screen size
      if (isMobile) {
        // Mobile: Only client name
        return (
          <div className="text-xs font-medium truncate">
            {event.client}
          </div>
        );
      } else {
        // Desktop: Multiple lines with small font
        return (
          <div className="space-y-0.5">
            <div className="font-medium text-xs truncate">
              {event.client}
            </div>
            <div className="text-xs opacity-80 truncate">
              {description}
            </div>
            <div className="text-xs opacity-70 truncate">
              {category}
            </div>
          </div>
        );
      }
    }
    
    // Fallback for compact prop (backward compatibility)
    if (compact) {
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-xs truncate">
            {event.client}
          </div>
          <div className="text-xs opacity-70">
            {event.time}
          </div>
        </div>
      );
    }

    // Default: Full info
    return (
      <div className="space-y-1">
        <div className="font-semibold text-sm truncate">
          {event.client}
        </div>
        <div className="text-xs opacity-80 truncate">
          {description}
        </div>
        <div className="text-xs opacity-70 truncate">
          {category && packageName ? `${category} - ${packageName}` : packageName || category}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => onClick(event)}
      className={`
        p-2 rounded cursor-pointer transition-all duration-200
        ${getEventStyles()}
      `}
    >
      {renderCardContent()}
    </div>
  );
}
