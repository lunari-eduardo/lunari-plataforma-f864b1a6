
import { Calendar, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import { Badge } from '@/components/ui/badge';

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
      // Semi-transparent background with dashed border for budgets
      const baseStyle = 'border-2 border-dashed hover:bg-opacity-80';
      switch (event.status) {
        case 'pendente':
          return `bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 ${baseStyle}`;
        case 'enviado':
          return `bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 ${baseStyle}`;
        case 'follow-up':
          return `bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100 ${baseStyle}`;
        default:
          return `bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100 ${baseStyle}`;
      }
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
      switch (event.status) {
        case 'pendente': return 'Pendente';
        case 'enviado': return 'Enviado';
        case 'follow-up': return 'Follow-up';
        case 'rascunho': return 'Rascunho';
        default: return event.status;
      }
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
