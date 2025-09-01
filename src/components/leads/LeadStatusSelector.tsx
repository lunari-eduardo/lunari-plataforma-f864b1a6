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
      <SelectTrigger className="h-8 w-32 text-xs border-lunar-border bg-lunar-surface hover:bg-lunar-bg transition-colors rounded-md shadow-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-lunar-surface border-lunar-border rounded-md shadow-lg">
        <SelectItem value={lead.status} disabled className="text-xs">
          {currentStatus?.name || lead.status}
        </SelectItem>
        {otherStatuses.map(status => (
          <SelectItem key={status.key} value={status.key} className="text-xs">
            {status.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}