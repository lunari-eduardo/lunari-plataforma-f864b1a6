import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit, MessageCircle } from 'lucide-react';
import type { Lead } from '@/types/leads';

interface LeadActionsPopoverProps {
  lead: Lead;
  onEdit: () => void;
  onStartConversation: () => void;
  children: React.ReactNode;
}

export default function LeadActionsPopover({
  lead,
  onEdit,
  onStartConversation,
  children
}: LeadActionsPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => handleAction(onEdit)}
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => handleAction(onStartConversation)}
          >
            <MessageCircle className="h-4 w-4" />
            Iniciar Conversa
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}