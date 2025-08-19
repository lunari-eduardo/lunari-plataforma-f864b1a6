import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, DollarSign, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { ReceivablesServiceV2 } from '@/services/ReceivablesServiceV2';

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

  // Verificar se há pagamentos relacionados
  const hasPayments = appointmentData?.sessionId ? 
    ReceivablesServiceV2.getTotalPaidForSession(appointmentData.sessionId) > 0 : false;
  
  const totalPaid = appointmentData?.sessionId ? 
    ReceivablesServiceV2.getTotalPaidForSession(appointmentData.sessionId) : 0;

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

          {hasPayments && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-lunar-text">
                  Pagamentos Identificados
                </span>
              </div>
              
              <p className="text-sm text-lunar-textSecondary">
                Este agendamento possui <span className="font-medium text-green-600">
                  {formatCurrency(totalPaid)}
                </span> em pagamentos registrados.
              </p>
              
              <div className="space-y-3">
                <Label className="text-sm font-medium text-lunar-text">
                  O que fazer com os pagamentos?
                </Label>
                
                <RadioGroup 
                  value={preservePayments} 
                  onValueChange={(value: 'preserve' | 'remove') => setPreservePayments(value)}
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-background/50">
                    <RadioGroupItem value="preserve" id="preserve" className="mt-1" />
                    <div className="space-y-1">
                      <Label htmlFor="preserve" className="text-sm font-medium text-lunar-text cursor-pointer">
                        Preservar pagamentos realizados
                      </Label>
                      <p className="text-xs text-lunar-textSecondary">
                        Recomendado. Mantém o histórico financeiro do cliente intacto.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <RadioGroupItem value="remove" id="remove" className="mt-1" />
                    <div className="space-y-1">
                      <Label htmlFor="remove" className="text-sm font-medium text-lunar-text cursor-pointer">
                        Remover todos os lançamentos
                      </Label>
                      <p className="text-xs text-destructive">
                        ⚠️ Esta ação é irreversível e afetará o histórico financeiro.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {!hasPayments && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-lunar-textSecondary">
                Este agendamento não possui pagamentos registrados. 
                A exclusão será realizada normalmente.
              </p>
            </div>
          )}
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