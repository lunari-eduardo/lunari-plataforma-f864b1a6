import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2 } from 'lucide-react';
import { useReconcileExtras, type DestinoSobra, type AuditExtrasSuggestion } from '@/hooks/useReconcileExtras';

interface ReconcileExtrasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  galeriaId?: string;
  clienteNome: string;
  dataSessao: string;
  credito: number;
  qtdAtual: number;
  unitAtual: number;
  onReconciled?: () => void;
}

const formatBRL = (n: any) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;

export function ReconcileExtrasModal({
  open, onOpenChange, sessionId, galeriaId, clienteNome, dataSessao,
  credito, qtdAtual, unitAtual, onReconciled,
}: ReconcileExtrasModalProps) {
  const { loading, suggestionLoading, fetchSuggestion, reconcile } = useReconcileExtras();
  const [suggestion, setSuggestion] = useState<AuditExtrasSuggestion | null>(null);
  const [qtd, setQtd] = useState(qtdAtual);
  const [unit, setUnit] = useState(unitAtual);
  const [destino, setDestino] = useState<DestinoSobra>('manter_credito');

  useEffect(() => {
    if (open) {
      setQtd(qtdAtual);
      setUnit(unitAtual);
      setDestino('manter_credito');
      if (galeriaId) fetchSuggestion(galeriaId).then(setSuggestion);
      else setSuggestion(null);
    }
  }, [open, galeriaId, qtdAtual, unitAtual, fetchSuggestion]);

  const totalExtras = useMemo(() => Math.round(qtd * unit * 100) / 100, [qtd, unit]);
  const sobra = useMemo(() => Math.max(0, Math.round((credito - (totalExtras - qtdAtual * unitAtual)) * 100) / 100), [credito, totalExtras, qtdAtual, unitAtual]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setQtd(suggestion.qtd);
    setUnit(suggestion.valor_unitario);
  };

  const handleConfirm = async () => {
    const ok = await reconcile({
      sessionId,
      qtdExtras: qtd,
      valorUnitario: unit,
      destinoSobra: destino,
      valorSobra: sobra,
    });
    if (ok) {
      onReconciled?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reconciliar crédito de {formatBRL(credito)}</DialogTitle>
          <DialogDescription>
            {clienteNome} · {dataSessao}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {suggestionLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando sugestão do histórico…
            </div>
          )}

          {suggestion && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-200">Sugestão automática (do histórico)</div>
                  <div className="mt-1 text-emerald-800 dark:text-emerald-300">
                    Foram cobradas <strong>{suggestion.qtd} fotos extras</strong> a <strong>{formatBRL(suggestion.valor_unitario)}</strong> cada.
                    Total: <strong>{formatBRL(suggestion.valor_total)}</strong>
                    {suggestion.valor_unitario < 25 && <span className="ml-1">(com desconto progressivo)</span>}
                  </div>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={applySuggestion}>
                    Aplicar sugestão
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtd" className="text-xs">Qtd fotos extras</Label>
              <Input id="qtd" type="number" min={0} value={qtd}
                onChange={(e) => setQtd(parseInt(e.target.value) || 0)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs">Valor unitário (R$)</Label>
              <Input id="unit" type="number" min={0} step="0.01" value={unit}
                onChange={(e) => setUnit(parseFloat(e.target.value) || 0)} className="h-9" />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total cobrado em extras:</span><strong>{formatBRL(totalExtras)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sobra a destinar:</span><strong className={sobra > 0 ? 'text-yellow-600 dark:text-yellow-500' : 'text-emerald-600'}>{formatBRL(sobra)}</strong></div>
          </div>

          {sobra > 0.01 && (
            <div className="space-y-2">
              <Label className="text-xs">Destinar a sobra para:</Label>
              <RadioGroup value={destino} onValueChange={(v) => setDestino(v as DestinoSobra)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="adicional" id="r-adic" />
                  <Label htmlFor="r-adic" className="text-xs font-normal cursor-pointer">Adicional (produto/serviço extra)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="desconto_negativo" id="r-acres" />
                  <Label htmlFor="r-acres" className="text-xs font-normal cursor-pointer">Acréscimo (desconto negativo)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manter_credito" id="r-cred" />
                  <Label htmlFor="r-cred" className="text-xs font-normal cursor-pointer">Manter como crédito futuro</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar reconciliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
