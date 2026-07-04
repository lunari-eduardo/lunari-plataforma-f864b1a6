import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ClientCreditApplyModal } from "@/components/finance/ClientCreditApplyModal";
import { formatCurrency } from "@/utils/currencyUtils";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, ChevronDown, ArrowRight } from "lucide-react";
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

interface PendingSession {
  session_id: string;
  data_sessao: string | null;
  pacote: string | null;
  pendente: number;
}

function usePendingSessions(clienteId: string, enabled: boolean) {
  return useQuery<PendingSession[]>({
    queryKey: ["cliente-sessoes-pendentes", clienteId],
    enabled: enabled && Boolean(clienteId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_sessoes")
        .select("session_id, data_sessao, pacote, valor_total, valor_pago, status_financeiro")
        .eq("cliente_id", clienteId)
        .order("data_sessao", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          session_id: r.session_id,
          data_sessao: r.data_sessao,
          pacote: r.pacote,
          pendente: Math.max(Number(r.valor_total ?? 0) - Number(r.valor_pago ?? 0), 0),
        }))
        .filter((r) => r.pendente > 0);
    },
  });
}

interface ClientCreditPanelProps {
  clienteId: string;
}

export function ClientCreditPanel({ clienteId }: ClientCreditPanelProps) {
  const { data, isLoading } = useClienteCredito(clienteId, true);
  const grant = useGrantClientCredit();
  const [grantOpen, setGrantOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<PendingSession | null>(null);
  const [valorStr, setValorStr] = useState("");
  const [motivo, setMotivo] = useState("");

  const saldo = data?.saldo ?? 0;
  const historico = data?.historico ?? [];
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
    <div className="space-y-3">
      {/* Linha compacta */}
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
                        setApplyTarget(s);
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
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setGrantOpen(true)} title="Adicionar crédito manual">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {historico.length > 0 && (
        <details
          open={historyOpen}
          onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border"
        >
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-muted/40 transition-colors">
            <span>Histórico ({historico.length})</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </summary>
          <div className="max-h-80 overflow-y-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Origem</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-right px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {format(parseISO(row.data), "dd/MM/yy", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {ORIGEM_LABEL[row.origem] ?? row.origem}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.descricao ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums text-xs ${
                        row.valor > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {row.valor > 0 ? "+" : ""}
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

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
