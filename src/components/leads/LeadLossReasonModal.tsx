import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { getLossReasons } from '@/config/motivosPerda';
import type { Lead } from '@/types/leads';

interface LeadLossReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConfirm: (leadId: string, reason: string) => void;
  onSkip: (leadId: string) => void;
}

export default function LeadLossReasonModal({
  open,
  onOpenChange,
  lead,
  onConfirm,
  onSkip
}: LeadLossReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const lossReasons = getLossReasons();

  const handleConfirm = () => {
    if (lead && selectedReason) {
      onConfirm(lead.id, selectedReason);
      onOpenChange(false);
      setSelectedReason('');
    }
  };

  const handleSkip = () => {
    if (lead) {
      onSkip(lead.id);
      onOpenChange(false);
      setSelectedReason('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedReason('');
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-lunar-text">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Motivo do Lead Perdido
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-lunar-textSecondary">
            O lead <strong>{lead.nome}</strong> foi marcado como perdido. 
            Selecione o motivo para melhorar suas análises de vendas:
          </p>

          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {lossReasons.map((reason) => (
              <div key={reason.id} className="flex items-center space-x-2">
                <RadioGroupItem value={reason.id} id={reason.id} />
                <Label 
                  htmlFor={reason.id} 
                  className="text-sm cursor-pointer text-lunar-text"
                >
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1"
            >
              Decidir depois
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedReason}
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}