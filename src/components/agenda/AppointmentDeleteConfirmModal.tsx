import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface AppointmentDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (preservePayments: boolean) => void;
  appointmentData: {
    id: string;
    sessionId?: string;
    title: string;
    clientName?: string;
    date: string;
  } | null;
}

export function AppointmentDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  appointmentData
}: AppointmentDeleteConfirmModalProps) {
  const [preservePayments, setPreservePayments] = useState<'preserve' | 'remove'>('preserve');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!appointmentData) return;
    
    setLoading(true);
    try {
      const shouldPreserve = preservePayments === 'preserve';
      onConfirm(shouldPreserve);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!appointmentData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-lunar-surface border border-lunar-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-lunar-text flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-lunar-text">
                {appointmentData.title}
              </p>
              {appointmentData.clientName && (
                <p className="text-sm text-lunar-textSecondary">
                  Cliente: <span className="font-medium">{appointmentData.clientName}</span>
                </p>
              )}
              <p className="text-sm text-lunar-textSecondary">
                Data: <span className="font-medium">{appointmentData.date}</span>
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-lunar-textSecondary">
              Esta ação removerá o agendamento permanentemente. 
              Os dados do workflow relacionados serão preservados.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              'Excluindo...'
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Confirmar Exclusão
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}