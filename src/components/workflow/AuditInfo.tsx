import { User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditInfoProps {
  updatedAt?: string;
  updatedBy?: string;
  createdAt?: string;
  compact?: boolean;
}

export function AuditInfo({ 
  updatedAt, 
  updatedBy, 
  createdAt, 
  compact = false 
}: AuditInfoProps) {
  if (!updatedAt && !createdAt) return null;

  const lastUpdate = updatedAt || createdAt;
  const timeAgo = lastUpdate 
    ? formatDistance(new Date(lastUpdate), new Date(), { 
        addSuffix: true, 
        locale: ptBR 
      })
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {timeAgo}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {updatedAt && updatedAt !== createdAt ? 'Atualizado' : 'Criado'}: {timeAgo}
        </span>
      </div>
      
      {updatedBy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <Badge variant="outline" className="text-xs px-2 py-0">
            {updatedBy}
          </Badge>
        </div>
      )}
    </div>
  );
}