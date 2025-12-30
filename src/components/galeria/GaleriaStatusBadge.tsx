import { Badge } from "@/components/ui/badge";
import { 
  FileEdit, 
  Globe, 
  ImageIcon, 
  CheckCircle2, 
  DollarSign,
  Clock
} from "lucide-react";

interface GaleriaStatusBadgeProps {
  status: 'rascunho' | 'publicada' | 'em_selecao' | 'finalizada';
  statusPagamento?: 'sem_vendas' | 'pendente' | 'pago';
  compact?: boolean;
}

export function GaleriaStatusBadge({ 
  status, 
  statusPagamento,
  compact = false 
}: GaleriaStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'rascunho':
        return {
          label: 'Rascunho',
          icon: FileEdit,
          className: 'bg-muted/50 text-muted-foreground border-muted'
        };
      case 'publicada':
        return {
          label: 'Publicada',
          icon: Globe,
          className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        };
      case 'em_selecao':
        return {
          label: 'Em Seleção',
          icon: ImageIcon,
          className: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        };
      case 'finalizada':
        return {
          label: 'Finalizada',
          icon: CheckCircle2,
          className: 'bg-green-500/20 text-green-400 border-green-500/30'
        };
      default:
        return {
          label: status,
          icon: FileEdit,
          className: 'bg-muted/50 text-muted-foreground border-muted'
        };
    }
  };

  const getPagamentoConfig = () => {
    if (!statusPagamento || statusPagamento === 'sem_vendas') return null;
    
    switch (statusPagamento) {
      case 'pendente':
        return {
          label: 'Pendente',
          icon: Clock,
          className: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
        };
      case 'pago':
        return {
          label: 'Pago',
          icon: DollarSign,
          className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
      default:
        return null;
    }
  };

  const statusConfig = getStatusConfig();
  const pagamentoConfig = getPagamentoConfig();
  const StatusIcon = statusConfig.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${statusConfig.className}`}>
          <StatusIcon className="h-3 w-3" />
        </Badge>
        {pagamentoConfig && (
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${pagamentoConfig.className}`}>
            <pagamentoConfig.icon className="h-3 w-3" />
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
        <StatusIcon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
      {pagamentoConfig && (
        <Badge variant="outline" className={`text-xs ${pagamentoConfig.className}`}>
          <pagamentoConfig.icon className="h-3 w-3 mr-1" />
          {pagamentoConfig.label}
        </Badge>
      )}
    </div>
  );
}
