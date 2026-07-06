import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useClienteCredito,
  useGrantClientCredit,
} from "@/hooks/useClienteCredito";
import { usePendingSessions } from "@/hooks/usePendingSessions";
import { ClientCreditApplyModal } from "@/components/finance/ClientCreditApplyModal";
import { formatCurrency } from "@/utils/currencyUtils";
import { Wallet, Plus, ChevronDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientCreditPanelProps {
  clienteId: string;
}

/**
 * Painel compacto de crédito do cliente: mostra saldo, botão para aplicar
 * numa sessão pendente e botão para adicionar crédito manual. Sem histórico
 * na UI — a trilha de auditoria fica no banco (`cliente_creditos_ledger`).
 */
export function ClientCreditPanel({ clienteId }: ClientCreditPanelProps) {
  const { data, isLoading } = useClienteCredito(clienteId, false);
  const grant = useGrantClientCredit();
  const [grantOpen, setGrantOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<{
    session_id: string;
    pendente: number;
  } | null>(null);
  const [valorStr, setValorStr] = useState("");
  const [motivo, setMotivo] = useState("");

  const saldo = data?.saldo ?? 0;
  const pendings = usePendingSessions(clienteId, saldo > 0);
  const pendingList = pendings.data ?? [];

  const suggestedValor = useMemo(() => {
    if (!applyTarget) return 0;
    return Math.min(saldo, applyTarget.pendente);
  }, [saldo, applyTarget]);

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

  const canApply = saldo > 0 && pendingList.length > 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Wallet className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-muted-foreground">Crédito do cliente</span>
        <span className="text-sm font-semibold tabular-nums">
          {isLoading ? "..." : formatCurrency(saldo)}
        </span>
        {data?.proximaExpiracao && (
          <span className="text-[11px] text-amber-600">
            expira em {format(parseISO(data.proximaExpiracao), "dd/MM/yyyy")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {canApply && (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                Aplicar em sessão
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-3 py-2 border-b text-xs font-medium">
                Sessões pendentes
              </div>
              <div className="max-h-72 overflow-y-auto">
                {pendingList.map((s) => (
                  <button
                    key={s.session_id}
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors border-b last:border-b-0"
                    onClick={() => {
                      setApplyTarget({
                        session_id: s.session_id,
                        pendente: s.pendente,
                      });
                      setPickerOpen(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.pacote || "Sessão"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.data_sessao
                          ? format(parseISO(s.data_sessao), "dd/MM/yy", { locale: ptBR })
                          : "sem data"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 font-semibold tabular-nums shrink-0">
                      {formatCurrency(s.pendente)}
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => setGrantOpen(true)}
          title="Adicionar crédito manual"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {applyTarget && (
        <ClientCreditApplyModal
          isOpen={Boolean(applyTarget)}
          onClose={() => setApplyTarget(null)}
          clienteId={clienteId}
          sessionId={applyTarget.session_id}
          restanteSessao={applyTarget.pendente}
          valorSugerido={suggestedValor}
          onApplied={() => setApplyTarget(null)}
        />
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
