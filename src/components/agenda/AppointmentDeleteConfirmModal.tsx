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
    hasWorkflowSession?: boolean;
    hasPayments?: boolean;
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
              {appointmentData.hasWorkflowSession && (
                <div className="mt-2 p-2 bg-lunar-warning/10 border border-lunar-warning/20 rounded">
                  <p className="text-xs text-lunar-warning">
                    ⚠️ Este agendamento possui uma sessão no workflow
                    {appointmentData.hasPayments && ' com histórico de pagamentos'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {appointmentData.hasWorkflowSession ? (
              <p className="text-sm font-medium text-lunar-text">
                O que deseja fazer com os dados do workflow?
              </p>
            ) : (
              <p className="text-sm font-medium text-lunar-text">
                Confirmar exclusão do agendamento?
              </p>
            )}
            
            {appointmentData.hasWorkflowSession ? (
              <RadioGroup value={preservePayments} onValueChange={(value) => setPreservePayments(value as 'preserve' | 'remove')}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-lunar-border bg-lunar-surface/50">
                  <RadioGroupItem value="preserve" id="preserve" />
                  <Label htmlFor="preserve" className="flex-1 cursor-pointer">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-lunar-text">Cancelar agendamento (preservar histórico)</p>
                      <p className="text-xs text-lunar-textSecondary">
                        Remove o agendamento e a sessão do workflow. Os pagamentos já realizados são preservados no histórico do cliente (sem valores pendentes)
                      </p>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <RadioGroupItem value="remove" id="remove" />
                  <Label htmlFor="remove" className="flex-1 cursor-pointer">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-lunar-text">Excluir tudo permanentemente</p>
                      <p className="text-xs text-lunar-textSecondary">
                        Remove agendamento, sessão do workflow e todos os pagamentos relacionados
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            ) : (
              <div className="p-3 rounded-lg border border-lunar-border bg-lunar-surface/50">
                <p className="text-sm text-lunar-text">
                  Este agendamento será excluído permanentemente.
                </p>
              </div>
            )}
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
              'Processando...'
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {appointmentData.hasWorkflowSession 
                  ? (preservePayments === 'preserve' ? 'Cancelar Agendamento' : 'Excluir Tudo')
                  : 'Confirmar Exclusão'
                }
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}