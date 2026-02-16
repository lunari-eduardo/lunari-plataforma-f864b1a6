import { useMemo } from "react";
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
  const { getStatusColor, workflowStatuses } = useWorkflowStatus();

  // Recalcula quando workflowStatuses carregam (evita cor cinza no cold start)
  const statusColor = useMemo(() => {
    if (!status || status === '') return '#6B7280';
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
  }, [status, workflowStatuses, getStatusColor]);

  if (!status || status === '') {
    return (
      <span className={`text-xs font-normal text-muted-foreground italic ${className}`}>
        Sem status
      </span>
    );
  }

  const textColor = showBackground ? getContrastColor(statusColor) : statusColor;
  const displayText = status === 'A Confirmar' ? 'Pendente' : status;

  if (showBackground) {
    return (
      <div 
        className={`px-3 py-1 rounded-full text-xs font-medium text-center inline-flex items-center justify-center ${className}`}
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
