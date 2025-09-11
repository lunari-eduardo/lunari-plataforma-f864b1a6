import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2, CreditCard } from 'lucide-react';

interface FlexibleDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (includePayments: boolean) => void;
  sessionTitle: string;
  paymentCount: number;
}

export function FlexibleDeleteModal({
  open,
  onClose,
  onConfirm,
  sessionTitle,
  paymentCount
}: FlexibleDeleteModalProps) {
  const [includePayments, setIncludePayments] = useState(false);

  const handleConfirm = () => {
    onConfirm(includePayments);
    onClose();
    setIncludePayments(false); // Reset for next time
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription>
            Você está prestes a excluir a sessão:
            <span className="font-medium text-foreground block mt-1">
              {sessionTitle}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="h-4 w-4" />
              <span className="font-medium">O que será excluído:</span>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Sessão do workflow</li>
              <li>• Vínculo com agendamento (se houver)</li>
            </ul>
          </div>

          {paymentCount > 0 && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Esta sessão possui {paymentCount} pagamento(s)
                  </span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Escolha o que fazer com os pagamentos:
                </p>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="include-payments"
                  checked={includePayments}
                  onCheckedChange={(checked) => setIncludePayments(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="include-payments"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Excluir também os pagamentos
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {includePayments 
                      ? "⚠️ Os pagamentos serão permanentemente excluídos"
                      : "✅ Os pagamentos serão mantidos para auditoria (sem vínculo com sessão)"
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
            {includePayments && paymentCount > 0 && " Tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}