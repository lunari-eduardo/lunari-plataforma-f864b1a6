
import { Badge } from '@/components/ui/badge';
import { getBudgetStatusConfig } from '@/utils/statusConfig';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = getBudgetStatusConfig(status);
  
  return (
    <Badge className={`${config.bgColor} ${config.textColor} border-none hover:opacity-80 cursor-pointer`}>
      {config.label}
    </Badge>
  );
}
