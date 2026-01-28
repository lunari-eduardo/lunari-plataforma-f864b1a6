import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

interface FotosExtrasPaymentBadgeProps {
  status: 'sem_vendas' | 'pendente' | 'pago' | undefined;
}

export function FotosExtrasPaymentBadge({ status }: FotosExtrasPaymentBadgeProps) {
  // Não mostrar badge se não há vendas
  if (!status || status === 'sem_vendas') return null;
  
  const config = status === 'pago' 
    ? { 
        icon: CheckCircle2, 
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-500/30', 
        label: 'Pago' 
      }
    : { 
        icon: Clock, 
        className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-500/30', 
        label: 'Pendente' 
      };
  
  const IconComponent = config.icon;
  
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${config.className}`}>
      <IconComponent className="h-2.5 w-2.5 mr-0.5" />
      {config.label}
    </Badge>
  );
}
