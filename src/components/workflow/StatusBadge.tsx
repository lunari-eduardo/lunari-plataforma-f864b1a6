
import { Badge } from "@/components/ui/badge";
import { useWorkflowStatus } from "@/hooks/useWorkflowStatus";

type StatusBadgeProps = {
  status: string;
  className?: string;
  showCircle?: boolean;
}

export function StatusBadge({ status, className, showCircle = true }: StatusBadgeProps) {
  const { getStatusColor } = useWorkflowStatus();

  // Define color mappings for default statuses
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
        // Use configured color for workflow statuses
        return getStatusColor(status);
    }
  };

  const statusColor = getStatusColorValue(status);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showCircle && (
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColor }}
        />
      )}
      <span className="text-xs font-medium text-gray-700">
        {status === 'A Confirmar' ? 'Pendente' : status}
      </span>
    </div>
  );
}
