/**
 * Modal — Saldo do Fluxo de Caixa.
 * Duas abas:
 *  - "Saldo inicial do ano" (override manual, guardado em fin_opening_balances).
 *  - "Ajustar saldo atual" (reconciliação: lança automaticamente uma transação
 *     Receita Não Operacional/Despesa Variável = diferença até a data escolhida).
 */
import { memo, useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { useSetOpeningBalance, useClearOpeningBalance, type OpeningBalanceOrigin } from '@/hooks/useOpeningBalance';
import { useSaldoAte, useAplicarSaldoAjuste } from '@/hooks/useSaldoAjuste';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ano: number;
  currentValor: number;
  currentOrigem: OpeningBalanceOrigin;
  anoBase: number;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const OpeningBalanceModal = memo(function OpeningBalanceModal({
  open, onOpenChange, ano, currentValor, currentOrigem, anoBase,
}: Props) {
  // ---- Aba 1: saldo inicial do ano ----
  const [valor, setValor] = useState<number>(currentValor);
  const [observacoes, setObservacoes] = useState<string>('');
  const setMutation = useSetOpeningBalance();
  const clearMutation = useClearOpeningBalance();
  const { inputProps } = useCurrencyInput({ value: valor, onChange: setValor });

  // ---- Aba 2: ajuste contábil ----
  const [ajusteData, setAjusteData] = useState<string>(todayISO());
  const [saldoDesejado, setSaldoDesejado] = useState<number>(0);
  const [ajusteObs, setAjusteObs] = useState<string>('');
  const { inputProps: desejadoInput } = useCurrencyInput({ value: saldoDesejado, onChange: setSaldoDesejado });
  const { data: saldoAtual, isLoading: saldoLoading } = useSaldoAte(open ? ajusteData : undefined);
  const aplicarMutation = useAplicarSaldoAjuste();

  useEffect(() => {
    if (open) {
      setValor(currentValor);
      setObservacoes('');
      setAjusteData(todayISO());
      setSaldoDesejado(0);
      setAjusteObs('');
    }
  }, [open, currentValor]);

  const delta = useMemo(() => {
    if (saldoAtual == null) return 0;
    return +(saldoDesejado - saldoAtual).toFixed(2);
  }, [saldoAtual, saldoDesejado]);

  const deltaSign: 'noop' | 'entrada' | 'saida' =
    Math.abs(delta) < 0.01 ? 'noop' : delta > 0 ? 'entrada' : 'saida';

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

  const handleAplicarAjuste = async () => {
    try {
      const res = await aplicarMutation.mutateAsync({
        data: ajusteData,
        saldoDesejado,
        observacoes: ajusteObs || undefined,
      });
      if (res.acao === 'noop') {
        toast.error('Saldo já está batido — nenhum ajuste necessário.');
        return;
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível aplicar o ajuste.');
    }
  };

  const isBusy = setMutation.isPending || clearMutation.isPending || aplicarMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Saldo do Fluxo de Caixa</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Ajuste o ponto de partida do ano ou reconcilie com o saldo real da sua conta bancária.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="inicial" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="inicial" className="text-xs">Saldo inicial de {ano}</TabsTrigger>
            <TabsTrigger value="ajuste" className="text-xs">Ajustar saldo atual</TabsTrigger>
          </TabsList>

          {/* ---------- Aba 1: Saldo inicial do ano ---------- */}
          <TabsContent value="inicial" className="space-y-4 py-3">
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

            <DialogFooter className="gap-2 sm:justify-between pt-2">
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
          </TabsContent>

          {/* ---------- Aba 2: Ajustar saldo atual ---------- */}
          <TabsContent value="ajuste" className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ajuste-data" className="text-xs">Data do ajuste</Label>
                <Input
                  id="ajuste-data"
                  type="date"
                  value={ajusteData}
                  onChange={(e) => setAjusteData(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ajuste-saldo" className="text-xs">Saldo real na conta (R$)</Label>
                <Input
                  id="ajuste-saldo"
                  {...desejadoInput}
                  placeholder="0,00"
                  className="tabular-nums text-base"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Saldo calculado até {new Date(ajusteData + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                <span className="tabular-nums font-medium">
                  {saldoLoading ? '…' : formatCurrency(saldoAtual ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Diferença</span>
                <span className={
                  'inline-flex items-center gap-1 tabular-nums font-semibold ' +
                  (deltaSign === 'entrada' ? 'text-[hsl(var(--fin-sage,142_45%_45%))]'
                    : deltaSign === 'saida' ? 'text-[hsl(var(--fin-burnt,15_75%_50%))]'
                    : 'text-foreground')
                }>
                  {deltaSign === 'entrada' && <ArrowUpRight className="h-3 w-3" />}
                  {deltaSign === 'saida' && <ArrowDownRight className="h-3 w-3" />}
                  {formatCurrency(delta)}
                </span>
              </div>
              <div className="pt-1 border-t border-border/40 text-[11px] leading-relaxed text-muted-foreground flex items-start gap-1.5">
                <Scale className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
                <span>
                  {deltaSign === 'noop' && 'O saldo do sistema já bate com o valor informado — nada a lançar.'}
                  {deltaSign === 'entrada' && (
                    <>Vai lançar uma <b>Receita Não Operacional</b> "Ajuste de saldo (entrada)" na data escolhida.</>
                  )}
                  {deltaSign === 'saida' && (
                    <>Vai lançar uma <b>Despesa Variável</b> "Ajuste de saldo (saída)" na data escolhida.</>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ajuste-obs" className="text-xs">Observação (opcional)</Label>
              <Textarea
                id="ajuste-obs"
                value={ajusteObs}
                onChange={(e) => setAjusteObs(e.target.value)}
                placeholder="Ex.: conciliação Nubank 28/07"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isBusy}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAplicarAjuste}
                disabled={isBusy || deltaSign === 'noop' || saldoLoading}
              >
                {aplicarMutation.isPending ? 'Aplicando…' : 'Aplicar ajuste'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
});

export default OpeningBalanceModal;
