import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { useFollowUpSystem } from '@/hooks/useFollowUpSystem';

interface FollowUpCounterProps {
  statusTimestamp?: string;
}

export default function FollowUpCounter({ statusTimestamp }: FollowUpCounterProps) {
  const { config } = useFollowUpSystem();
  
  const followUpInfo = useMemo(() => {
    if (!statusTimestamp) return null;
    
    const daysSinceChange = Math.floor(
      (new Date().getTime() - new Date(statusTimestamp).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const remainingDays = config.diasParaFollowUp - daysSinceChange;
    
    let variant: "default" | "secondary" | "destructive" | "outline";
    let text: string;
    
    if (remainingDays > 1) {
      variant = "secondary";
      text = `${remainingDays}d`;
    } else if (remainingDays === 1) {
      variant = "outline";
      text = "1d";
    } else if (remainingDays === 0) {
      variant = "destructive";
      text = "Hoje";
    } else {
      variant = "destructive";
      text = `D+${Math.abs(remainingDays)}`;
    }
    
    return { variant, text, daysSinceChange };
  }, [statusTimestamp, config.diasParaFollowUp]);
  
  if (!followUpInfo) return null;
  
  return (
    <Badge 
      variant={followUpInfo.variant}
      className="text-xs h-5 px-1.5 gap-1"
    >
      <Clock className="h-3 w-3" />
      {followUpInfo.text}
    </Badge>
  );
}