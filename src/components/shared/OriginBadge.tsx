import { Badge } from "@/components/ui/badge";
import { getOriginInfo } from '@/utils/originUtils';

interface OriginBadgeProps {
  originId?: string;
  className?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function OriginBadge({ originId, className, variant = "secondary" }: OriginBadgeProps) {
  const originInfo = getOriginInfo(originId);
  
  if (!originInfo) {
    return null;
  }
  
  return (
    <Badge variant={variant} className={`flex items-center gap-1 ${className}`}>
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: originInfo.cor }}
      />
      {originInfo.nome}
    </Badge>
  );
}