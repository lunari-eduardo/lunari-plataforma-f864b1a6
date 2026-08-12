import { cn } from '@/lib/utils';
import { GalleryStatus, SelectionStatus } from '@/types/gallery';
import { 
  Circle, 
  Send, 
  MousePointer, 
  CheckCircle, 
  Clock, 
  XCircle,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: GalleryStatus | SelectionStatus | string;
  type?: 'gallery' | 'selection';
  className?: string;
}

// Mapeamento de status em português (banco) para inglês (código)
// Unificado para respeitar a mesma lógica do helper central
const statusTranslation: Record<string, GalleryStatus | SelectionStatus> = {
  // Português → Inglês (Gallery)
  'rascunho': 'created',
  'criado': 'created',
  'enviado': 'sent',
  'publicada': 'sent',
  'selecao_iniciada': 'selection_started',
  'em_selecao': 'selection_started',
  'selecao_concluida': 'selection_completed',
  'selecao_completa': 'selection_completed',
  'confirmada': 'selection_completed',
  'expirado': 'expired',
  'expirada': 'expired',
  'cancelado': 'cancelled',
  'cancelada': 'cancelled',
  // Inglês → Inglês (já corretos)
  'created': 'created',
  'sent': 'sent',
  'selection_started': 'selection_started',
  'selection_completed': 'selection_completed',
  'expired': 'expired',
  'cancelled': 'cancelled',
  // Selection status
  'in_progress': 'in_progress',
  'confirmed': 'confirmed',
  'blocked': 'blocked',
  'em_andamento': 'in_progress',
  'bloqueado': 'blocked',
  'aguardando_pagamento': 'blocked',
};

const galleryStatusConfig: Record<GalleryStatus, { label: string; className: string; icon: React.ElementType }> = {
  created: { label: 'Criada', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/10', icon: Circle },
  sent: { label: 'Enviada', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/10', icon: Send },
  selection_started: { label: 'Em seleção', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/10', icon: MousePointer },
  selection_completed: { label: 'Concluída', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10', icon: CheckCircle },
  expired: { label: 'Expirada', className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10', icon: Clock },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-border hover:bg-muted', icon: XCircle },
};

const selectionStatusConfig: Record<SelectionStatus, { label: string; className: string; icon: React.ElementType }> = {
  in_progress: { label: 'Em andamento', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/10', icon: Loader2 },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10', icon: CheckCircle },
  blocked: { label: 'Aguardando Pagamento', className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10', icon: Clock },
};

const defaultConfig = { label: 'Desconhecido', className: 'bg-muted text-muted-foreground border-border', icon: HelpCircle };

export function StatusBadge({ status, type = 'gallery', className }: StatusBadgeProps) {
  // Normalizar status usando mapeamento
  const normalizedStatus = statusTranslation[status] || status;
  
  const config = type === 'gallery' 
    ? galleryStatusConfig[normalizedStatus as GalleryStatus] || defaultConfig
    : selectionStatusConfig[normalizedStatus as SelectionStatus] || defaultConfig;

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium whitespace-nowrap', config.className, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
