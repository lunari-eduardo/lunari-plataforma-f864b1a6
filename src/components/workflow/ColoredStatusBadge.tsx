import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";
import { getContrastColor } from "@/lib/colorUtils";

type ColoredStatusBadgeProps = {
  status: string;
  className?: string;
  showBackground?: boolean;
}

export function ColoredStatusBadge({ 
  status, 
  className = '', 
  showBackground = false 
}: ColoredStatusBadgeProps) {
  const { getStatusColor } = useWorkflowStatus();

  if (!status || status === '') {
    return (
      <span className={`text-xs font-normal text-muted-foreground italic ${className}`}>
        Sem status
      </span>
    );
  }

  const getStatusColorValue = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmado':
        return '#34C759';
      case 'a confirmar':
      case 'pendente':
        return '#F59E0B';
      case 'cancelado':
        return '#EF4444';
      default:
        return getStatusColor(status);
    }
  };

  const statusColor = getStatusColorValue(status);
  const textColor = showBackground ? getContrastColor(statusColor) : statusColor;
  const displayText = status === 'A Confirmar' ? 'Pendente' : status;

  if (showBackground) {
    return (
      <div 
        className={`px-2 py-1 rounded text-xs font-medium w-full text-center ${className}`}
        style={{ 
          backgroundColor: statusColor,
          color: textColor
        }}
      >
        {displayText}
      </div>
    );
  }

  return (
    <span 
      className={`text-xs font-normal ${className}`}
      style={{ color: statusColor }}
    >
      {displayText}
    </span>
  );
}
