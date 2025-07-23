
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  rascunho: { label: 'Novo', color: 'bg-blue-100 text-blue-800' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  enviado: { label: 'Enviado', color: 'bg-gray-100 text-gray-800' },
  'follow-up': { label: 'Follow-up', color: 'bg-orange-100 text-orange-800' },
  fechado: { label: 'Fechado', color: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
};

interface StatusBadgeProps {
  status: keyof typeof statusConfig;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge className={`${config.color} border-none hover:opacity-80 cursor-pointer`}>
      {config.label}
    </Badge>
  );
}
