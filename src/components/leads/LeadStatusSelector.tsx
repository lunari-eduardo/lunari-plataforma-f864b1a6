import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import type { Lead } from '@/types/leads';

interface LeadStatusSelectorProps {
  lead: Lead;
  onStatusChange: (status: string) => void;
}

export default function LeadStatusSelector({ lead, onStatusChange }: LeadStatusSelectorProps) {
  const { statuses } = useLeadStatuses();
  
  const currentStatus = statuses.find(s => s.key === lead.status);
  const otherStatuses = statuses.filter(s => s.key !== lead.status);

  return (
    <Select value={lead.status} onValueChange={onStatusChange}>
      <SelectTrigger 
        className="h-7 w-24 text-2xs border-lunar-border/60 bg-lunar-surface" 
        data-no-drag="true"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-50 bg-lunar-surface border-lunar-border">
        <SelectItem value={lead.status} disabled>
          {currentStatus?.name || lead.status}
        </SelectItem>
        {otherStatuses.map(status => (
          <SelectItem key={status.key} value={status.key}>
            {status.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}