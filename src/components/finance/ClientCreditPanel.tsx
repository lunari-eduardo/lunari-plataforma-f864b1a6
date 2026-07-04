import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useClienteCredito,
  useGrantClientCredit,
} from "@/hooks/useClienteCredito";
import { formatCurrency } from "@/utils/currencyUtils";
import { Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ORIGEM_LABEL: Record<string, string> = {
  overpay: "Pagamento a maior",
  reducao_escopo: "Redução de escopo",
  reconcile_sobra: "Sobra de reconciliação",
  estorno_para_credito: "Estorno → crédito",
  ajuste_manual: "Ajuste manual",
  consumo_desconto: "Aplicado em sessão",
  expiracao: "Expirado",
  reversao_consumo: "Reversão de consumo",
  reversao_grant: "Reversão de crédito",
};

interface ClientCreditPanelProps {
  clienteId: string;
}

export function ClientCreditPanel({ clienteId }: ClientCreditPanelProps) {
  const { data, isLoading } = useClienteCredito(clienteId, true);
  const grant = useGrantClientCredit();
  const revoke = useRevokeClientCredit();
  const [grantOpen, setGrantOpen] = useState(false);
  const [valorStr, setValorStr] = useState("");
  const [motivo, setMotivo] = useState("");

  const saldo = data?.saldo ?? 0;
  const historico = data?.historico ?? [];

  const handleGrant = async () => {
    const v = Number(valorStr.replace(",", ".")) || 0;
    if (v <= 0) {
      toast.error("Informe um valor positivo");
      return;
    }
    try {
      await grant.mutateAsync({
        clienteId,
        valor: v,
        origem: "ajuste_manual",
        descricao: motivo.trim() || undefined,
      });
      setGrantOpen(false);
      setValorStr("");
      setMotivo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar crédito");
    }
  };

  const handleRevoke = async (row: ClienteCreditoLedgerRow) => {
    if (!confirm(`Reverter lançamento de ${formatCurrency(row.valor)}?`)) return;
    try {
      await revoke.mutateAsync({ ledgerId: row.id, clienteId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reverter");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-emerald-500" />
          <div>
            <div className="text-xs text-muted-foreground">Crédito do cliente</div>
            <div className="text-2xl font-semibold">
              {isLoading ? "..." : formatCurrency(saldo)}
            </div>
            {data?.proximaExpiracao && (
              <div className="text-xs text-amber-600">
                Expira em {format(parseISO(data.proximaExpiracao), "dd/MM/yyyy")}
              </div>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => setGrantOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {historico.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-4 py-2 text-sm font-medium">Histórico</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Origem</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {format(parseISO(row.data), "dd/MM/yy", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {ORIGEM_LABEL[row.origem] ?? row.origem}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.descricao ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        row.valor > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {row.valor > 0 ? "+" : ""}
                      {formatCurrency(row.valor)}
                    </td>
                    <td className="px-3 py-2">
                      {!row.origem.startsWith("reversao_") && (
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          title="Reverter"
                          onClick={() => handleRevoke(row)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar crédito manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="grant-valor">Valor</Label>
              <Input
                id="grant-valor"
                type="number"
                step="0.01"
                min={0}
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-motivo">Motivo (opcional)</Label>
              <Textarea
                id="grant-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Ex.: cortesia por indicação"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGrant} disabled={grant.isPending}>
              {grant.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
