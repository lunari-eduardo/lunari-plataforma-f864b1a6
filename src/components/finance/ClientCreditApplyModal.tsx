import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/utils/currencyUtils";
import { useApplyClientCredit, useClienteCredito } from "@/hooks/useClienteCredito";
import { toast } from "sonner";

interface ClientCreditApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  /** session_id em texto (workflow-*) */
  sessionId: string;
  restanteSessao: number;
  /** Valor pré-sugerido (opcional). Default = min(saldo, restante). */
  valorSugerido?: number;
  onApplied?: () => void;
}

export function ClientCreditApplyModal({
  isOpen,
  onClose,
  clienteId,
  sessionId,
  restanteSessao,
  valorSugerido,
  onApplied,
}: ClientCreditApplyModalProps) {
  const { data } = useClienteCredito(clienteId, false);
  const apply = useApplyClientCredit();
  const saldo = data?.saldo ?? 0;
  const teto = Math.min(saldo, Math.max(restanteSessao, 0));
  const [valorStr, setValorStr] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const initial = valorSugerido != null ? Math.min(valorSugerido, teto) : teto;
      setValorStr(initial > 0 ? initial.toFixed(2) : "");
    }
  }, [isOpen, valorSugerido, teto]);

  const valor = Number(valorStr.replace(",", ".")) || 0;
  const invalido = valor <= 0 || valor > teto;

  const handleApply = async () => {
    try {
      await apply.mutateAsync({ clienteId, sessionId, valor });
      onApplied?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao aplicar crédito";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar crédito do cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Saldo disponível</div>
              <div className="font-semibold">{formatCurrency(saldo)}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground text-xs">Restante da sessão</div>
              <div className="font-semibold">{formatCurrency(restanteSessao)}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-valor">Valor a aplicar</Label>
            <Input
              id="credit-valor"
              type="number"
              step="0.01"
              min={0}
              max={teto}
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {formatCurrency(teto)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={apply.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={invalido || apply.isPending}>
            {apply.isPending ? "Aplicando..." : `Aplicar ${formatCurrency(valor || 0)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
