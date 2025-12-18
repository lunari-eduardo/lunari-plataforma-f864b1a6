import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { StatusCobranca } from '@/types/cobranca';
import { cn } from '@/lib/utils';

interface ChargeStatusDisplayProps {
  status: StatusCobranca;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<StatusCobranca, {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  bgClass: string;
}> = {
  pendente: {
    icon: <Clock className="h-5 w-5" />,
    label: 'Aguardando pagamento',
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-100',
  },
  pago: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: 'Pagamento confirmado',
    colorClass: 'text-green-600',
    bgClass: 'bg-green-100',
  },
  cancelado: {
    icon: <XCircle className="h-5 w-5" />,
    label: 'Cobrança cancelada',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  },
  expirado: {
    icon: <AlertTriangle className="h-5 w-5" />,
    label: 'Cobrança expirada',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100',
  },
};

export function ChargeStatusDisplay({ status, className, showLabel = true }: ChargeStatusDisplayProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('p-2 rounded-full', config.bgClass, config.colorClass)}>
        {config.icon}
      </div>
      {showLabel && (
        <span className={cn('font-medium', config.colorClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export function ChargeLoadingStatus() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Processando...</span>
    </div>
  );
}
