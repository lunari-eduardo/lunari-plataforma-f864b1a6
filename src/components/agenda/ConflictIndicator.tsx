import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users } from 'lucide-react';
import { useConflictResolution } from '@/hooks/useConflictResolution';

interface ConflictIndicatorProps {
  date: Date;
  time: string;
  className?: string;
}

export default function ConflictIndicator({ date, time, className = "" }: ConflictIndicatorProps) {
  const { getPendingConflicts } = useConflictResolution();
  
  const pendingConflicts = getPendingConflicts(date, time);
  
  if (pendingConflicts.length <= 1) {
    return null;
  }
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800 ${className}`}
    >
      <Users className="h-3 w-3 mr-1" />
      {pendingConflicts.length} pendentes
    </Badge>
  );
}