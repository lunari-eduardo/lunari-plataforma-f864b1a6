import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { useRunCapability } from "@/shared/capability";
import { isOk } from "@/shared/result";
import { addPayment as addPaymentCapability } from "@/modules/workflow";

/**
 * ManualPaymentModal — entrada manual de pagamento via Capability `workflow.addPayment`.
 *
 * Modal mínimo (valor / data / forma / observação) que substitui o `console.log`
 * do `handleAddPayment` na página Workflow. Toda a escrita passa por
 * `runCapability(addPaymentCapability, ...)` para manter paridade com a
 * superfície do Assistente Lunari (auditoria + idempotência + eventos).
 *
 * Não substitui o `SessionPaymentsManager` (modal completo dentro dos cards
 * expansíveis), que continua responsável por agendamentos, parcelas e estorno.
 */

const FORMAS_PAGAMENTO = [
  "PIX",
  "Dinheiro",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Transferência",
  "Boleto",
  "Outro",
] as const;

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSuccess?: (sessionId: string) => void;
}

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ManualPaymentModal({ isOpen, onClose, sessionId, onSuccess }: ManualPaymentModalProps) {
  const runCapability = useRunCapability();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(getTodayISO());
  const [forma, setForma] = useState<string>("PIX");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currency = useCurrencyInput({ value: valor, onChange: setValor });

  // Reset quando abre/fecha
  useEffect(() => {
    if (isOpen) {
      setValor(0);
      setData(getTodayISO());
      setForma("PIX");
      setObs("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId) return;
    if (valor <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const result = await runCapability(addPaymentCapability, {
      sessionId,
      valor: Math.round(valor * 100), // centavos
      dataTransacao: data,
      formaPagamento: forma,
      descricao: obs.trim() ? obs.trim() : undefined,
    });
    setSubmitting(false);

    if (!isOk(result)) {
      toast({
        title: "Não foi possível registrar o pagamento",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    onSuccess?.(sessionId);
    onClose();
  }, [sessionId, valor, data, forma, obs, runCapability, onSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento manual</DialogTitle>
          <DialogDescription>
            Lança um pagamento à vista vinculado à sessão. O valor pago e o status
            financeiro são recalculados automaticamente pelo sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="manual-pay-valor">Valor (R$)</Label>
            <Input
              id="manual-pay-valor"
              placeholder="0,00"
              autoFocus
              {...currency.inputProps}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-pay-data">Data</Label>
            <Input
              id="manual-pay-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-pay-forma">Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger id="manual-pay-forma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manual-pay-obs">Observação (opcional)</Label>
            <Textarea
              id="manual-pay-obs"
              placeholder="Ex.: entrada do pacote"
              maxLength={200}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || valor <= 0 || !sessionId}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
