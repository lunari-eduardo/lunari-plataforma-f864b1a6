
import { Badge } from '@/components/ui/badge';
import { getBudgetStatusConfig } from '@/utils/statusConfig';

interface StatusBadgeProps {
  status: string;
  isRascunho?: boolean;
}

export default function StatusBadge({ status, isRascunho }: StatusBadgeProps) {
  const config = getBudgetStatusConfig(status);
  
  if (isRascunho) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-none hover:opacity-80 cursor-pointer">
        Rascunho
      </Badge>
    );
  }
  
  return (
    <Badge className={`${config.bgColor} ${config.textColor} border-none hover:opacity-80 cursor-pointer`}>
      {config.label}
    </Badge>
  );
}
