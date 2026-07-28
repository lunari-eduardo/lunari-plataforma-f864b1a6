/**
 * Modal — Saldo inicial do Fluxo de Caixa.
 * Permite definir manualmente o saldo de abertura do ano ou restaurar o
 * cálculo automático (rollover do ano anterior).
 */
import { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { useSetOpeningBalance, useClearOpeningBalance, type OpeningBalanceOrigin } from '@/hooks/useOpeningBalance';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ano: number;
  currentValor: number;
  currentOrigem: OpeningBalanceOrigin;
  anoBase: number;
}

export const OpeningBalanceModal = memo(function OpeningBalanceModal({
  open, onOpenChange, ano, currentValor, currentOrigem, anoBase,
}: Props) {
  const [valor, setValor] = useState<number>(currentValor);
  const [observacoes, setObservacoes] = useState<string>('');
  const setMutation = useSetOpeningBalance();
  const clearMutation = useClearOpeningBalance();
  const { inputProps } = useCurrencyInput({ value: valor, onChange: setValor });

  useEffect(() => {
    if (open) {
      setValor(currentValor);
      setObservacoes('');
    }
  }, [open, currentValor]);

  const handleSave = async () => {
    try {
      await setMutation.mutateAsync({ ano, valor, observacoes: observacoes || undefined });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível salvar o saldo inicial.');
    }
  };

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync(ano);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível restaurar o cálculo automático.');
    }
  };

  const isBusy = setMutation.isPending || clearMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Saldo inicial de {ano}</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Valor de caixa no primeiro dia do ano. Serve como ponto de partida para a curva de
            saldo acumulado do fluxo de caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="opening-balance-input" className="text-xs">Valor (R$)</Label>
            <Input
              id="opening-balance-input"
              {...inputProps}
              placeholder="0,00"
              className="tabular-nums text-base"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opening-balance-obs" className="text-xs">Observação (opcional)</Label>
            <Textarea
              id="opening-balance-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: saldo confirmado em extrato bancário de 01/01"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {currentOrigem === 'manual' && (
              <>Atual: <span className="font-medium text-foreground tabular-nums">{formatCurrency(currentValor)}</span> · definido manualmente.</>
            )}
            {currentOrigem === 'auto_rollover' && (
              <>Atual: <span className="font-medium text-foreground tabular-nums">{formatCurrency(currentValor)}</span> · calculado automaticamente a partir do fechamento de {anoBase}.</>
            )}
            {currentOrigem === 'zero' && (
              <>Ainda não há histórico anterior — o valor inicial padrão é zero.</>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy || currentOrigem !== 'manual'}
            onClick={handleClear}
            className="text-xs"
          >
            Restaurar automático
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isBusy}>
              {setMutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default OpeningBalanceModal;
