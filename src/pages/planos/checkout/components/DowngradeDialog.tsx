import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatStorageSize } from '@/lib/transferPlans';

interface DowngradeDialogProps {
  downgradeDialog: {
    planType: string;
    planName: string;
    billingCycle: string;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
  isDowngrading: boolean;
  isOverLimitOnDowngrade: boolean;
  newDowngradeLimitBytes: number;
  storageUsedBytes: number;
  downgradeConfirmed: boolean;
  setDowngradeConfirmed: (confirmed: boolean) => void;
  planDisplayName: string;
}

export function DowngradeDialog({
  downgradeDialog,
  onClose,
  onConfirm,
  isDowngrading,
  isOverLimitOnDowngrade,
  newDowngradeLimitBytes,
  storageUsedBytes,
  downgradeConfirmed,
  setDowngradeConfirmed,
  planDisplayName,
}: DowngradeDialogProps) {
  return (
    <Dialog
      open={!!downgradeDialog}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Agendar downgrade
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Seu plano será alterado para{' '}
              <span className="font-semibold text-foreground">{planDisplayName}</span> no próximo
              ciclo de cobrança.
            </p>
            {isOverLimitOnDowngrade && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Seu novo plano permite {formatStorageSize(newDowngradeLimitBytes)}.
                </p>
                <p className="text-sm text-destructive/90">
                  Você possui {formatStorageSize(storageUsedBytes)} armazenados.
                </p>
                <p className="text-sm text-muted-foreground">
                  As galerias excedentes serão expiradas. Se não forem excluídas manualmente, serão
                  removidas permanentemente em 30 dias.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {isOverLimitOnDowngrade && (
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="downgrade-confirm"
              checked={downgradeConfirmed}
              onCheckedChange={(checked) => setDowngradeConfirmed(checked === true)}
            />
            <label
              htmlFor="downgrade-confirm"
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              Entendo que galerias acima do limite poderão ser excluídas após 30 dias.
            </label>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isDowngrading || (isOverLimitOnDowngrade && !downgradeConfirmed)}
            onClick={onConfirm}
          >
            {isDowngrading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              'Confirmar downgrade'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
