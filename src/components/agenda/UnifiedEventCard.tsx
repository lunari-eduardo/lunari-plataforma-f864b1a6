
import { Calendar, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { Badge } from '@/components/ui/badge';
import { getBudgetStatusConfig } from '@/utils/statusConfig';

interface UnifiedEventCardProps {
  event: UnifiedEvent;
  onClick: (event: UnifiedEvent) => void;
  compact?: boolean;
}

export default function UnifiedEventCard({ event, onClick, compact = false }: UnifiedEventCardProps) {
  const isAppointment = event.type === 'appointment';
  const isBudget = event.type === 'budget';

  // Define visual styles based on type and status
  const getEventStyles = () => {
    if (isAppointment) {
      // Solid background for appointments
      if (event.status === 'confirmado') {
        return 'bg-green-100 text-green-800 border-l-4 border-green-500 hover:bg-green-200';
      } else {
        return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500 hover:bg-orange-200';
      }
    } else {
      // Semi-transparent background with dashed border for budgets using centralized config
      const config = getBudgetStatusConfig(event.status);
      const baseStyle = 'border-2 border-dashed hover:bg-opacity-80';
      return `${config.bgColor.replace('100', '50')} ${config.textColor} ${config.borderColor.replace('border-', 'border-').replace('500', '300')} hover:${config.bgColor} ${baseStyle}`;
    }
  };

  const getStatusIcon = () => {
    if (isAppointment) {
      return event.status === 'confirmado' ? 
        <CheckCircle className="h-3 w-3" /> : 
        <Clock className="h-3 w-3" />;
    } else {
      return <DollarSign className="h-3 w-3" />;
    }
  };

  const getStatusText = () => {
    if (isAppointment) {
      return event.status === 'confirmado' ? 'Confirmado' : 'A Confirmar';
    } else {
      const config = getBudgetStatusConfig(event.status);
      return config.label;
    }
  };

  return (
    <div
      onClick={() => onClick(event)}
      className={`
        p-2 rounded cursor-pointer transition-all duration-200
        ${getEventStyles()}
        ${compact ? 'text-xs' : 'text-sm'}
      `}
    >
      <div className="flex items-center gap-1 mb-1">
        {getStatusIcon()}
        <span className="font-medium truncate flex-1">{event.title}</span>
        {!compact && (
          <Badge variant="secondary" className="text-xs">
            {getStatusText()}
          </Badge>
        )}
      </div>
      
      {!compact && event.description && (
        <div className="text-xs truncate opacity-80">
          {event.description}
        </div>
      )}
      
      {compact && (
        <div className="text-xs opacity-70">
          {event.time}
        </div>
      )}
    </div>
  );
}
