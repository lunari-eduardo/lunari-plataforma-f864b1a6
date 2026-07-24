import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { isErr } from "@/shared/result";
import { useRunCapability } from "@/shared/capability/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SessionData } from "@/types/workflow";

type Meio = "pix" | "dinheiro" | "transferencia" | "cartao_externo" | "outro";
type Escopo = "sessao" | "fotos_extras" | "sessao_e_extras";

const MEIO_OPTS: { value: Meio; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao_externo", label: "Cartão externo" },
  { value: "outro", label: "Outro" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: SessionData;
  sessaoPendente: number;
  extrasPendente: number;
  hasGaleria: boolean;
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const todayISO = () => format(new Date(), "yyyy-MM-dd");

export function ManualPaymentModal({
  isOpen,
  onClose,
  session,
  sessaoPendente,
  extrasPendente,
  hasGaleria,
}: Props) {
  const runCapability = useRunCapability();
  // Extras podem existir sem galeria vinculada (fluxo de extras manuais).
  // O gate depende APENAS de haver pendente, nunca de `hasGaleria`.
  const canSessao = sessaoPendente > 0.001;
  const canExtras = extrasPendente > 0.001;
  const canTudo = canSessao && canExtras;
  const nadaPendente = !canSessao && !canExtras;

  const pickInitial = (): Escopo =>
    canTudo ? "sessao_e_extras" : canSessao ? "sessao" : canExtras ? "fotos_extras" : "sessao";

  const [escopo, setEscopo] = useState<Escopo>(pickInitial());
  const [meio, setMeio] = useState<Meio>("pix");
  const [valor, setValor] = useState<number>(0);
  const [data, setData] = useState<string>(todayISO());
  const [observacao, setObservacao] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const valorDirtyRef = useRef(false);

  const pendenteEscopo = useMemo(() => {
    if (escopo === "sessao") return sessaoPendente;
    if (escopo === "fotos_extras") return extrasPendente;
    return sessaoPendente + extrasPendente;
  }, [escopo, sessaoPendente, extrasPendente]);

  // Reset ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const inicial = pickInitial();
    setEscopo(inicial);
    setMeio("pix");
    setData(todayISO());
    setObservacao("");
    setSubmitting(false);
    valorDirtyRef.current = false;
    const sug = inicial === "sessao"
      ? sessaoPendente
      : inicial === "fotos_extras"
        ? extrasPendente
        : sessaoPendente + extrasPendente;
    setValor(Number(sug.toFixed(2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Ao trocar escopo, sugere pendente se usuário ainda não editou valor
  useEffect(() => {
    if (!isOpen) return;
    if (valorDirtyRef.current) return;
    setValor(Number(pendenteEscopo.toFixed(2)));
  }, [escopo, pendenteEscopo, isOpen]);

  const currency = useCurrencyInput({
    value: valor,
    onChange: (v) => {
      valorDirtyRef.current = true;
      setValor(v);
    },
  });

  const excedePendente = valor > pendenteEscopo + 0.001;
  const dataInvalida = !data || data > todayISO();
  const valorInvalido = !(valor > 0);
  const podeSubmeter = !submitting && !excedePendente && !dataInvalida && !valorInvalido && !nadaPendente;

  const titulo =
    escopo === "fotos_extras"
      ? "Registrar pagamento — Fotos extras"
      : escopo === "sessao_e_extras"
        ? "Registrar pagamento — Sessão + extras"
        : "Registrar pagamento — Sessão";

  const handleSubmit = async () => {
    if (!podeSubmeter) return;
    setSubmitting(true);
    try {
      const { registerManualPayment } = await import("@/modules/billing");
      const result = await runCapability(registerManualPayment, {
        sessionId: session.id,
        valor: Number(valor.toFixed(2)),
        dataPagamento: data,
        meio,
        escopo,
        observacao: observacao.trim() || undefined,
      });

      if (isErr(result)) {
        const code = result.error.code;
        const msg =
          code === "UNAUTHENTICATED"
            ? "Sessão expirada. Faça login novamente."
            : code === "NOT_FOUND"
              ? "Sessão não encontrada."
              : code === "VALIDATION"
                ? result.error.message
                : "Não foi possível registrar o pagamento. Tente novamente.";
        toast.error(msg);
        setSubmitting(false);
        return;
      }

      // Toasts informativos do contrato v2 (Gallery↔Studio)
      const outcome = result.value as {
        alreadyPaid?: boolean;
        cancelledPendingIds?: string[];
        syncedGallery?: boolean;
      };
      if (outcome?.alreadyPaid) {
        toast.info("Pagamento já estava registrado — nada foi duplicado.");
      } else if (outcome?.cancelledPendingIds?.length) {
        toast.info(
          `Cobrança${outcome.cancelledPendingIds.length > 1 ? "s" : ""} pendente${
            outcome.cancelledPendingIds.length > 1 ? "s" : ""
          } cancelada${outcome.cancelledPendingIds.length > 1 ? "s" : ""} automaticamente.`,
        );
      }

      onClose();
      // Notifica bridges que já ouvem esse evento (extrato, badges, etc.)
      window.dispatchEvent(
        new CustomEvent("payment-created", {
          detail: { sessionId: session.sessionId || session.id },
        }),
      );
    } catch (e) {
      console.error("❌ ManualPaymentModal.submit:", e);
      toast.error("Falha inesperada ao registrar pagamento.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            {titulo}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {session.nome}
            {session.pacote ? ` · ${session.pacote}` : ""}
            {!hasGaleria && canExtras ? " · extras manuais" : ""}
          </DialogDescription>
        </DialogHeader>

        {nadaPendente ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Não há valores pendentes nessa sessão.
          </div>
        ) : (
        <div className="space-y-3 py-1">
          {/* Escopo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Do quê?</Label>
            <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sessao" disabled={!canSessao}>
                  Sessão · {formatBRL(sessaoPendente)} pendente
                </SelectItem>
                <SelectItem value="fotos_extras" disabled={!canExtras}>
                  Fotos extras · {formatBRL(extrasPendente)} pendente
                </SelectItem>
                <SelectItem value="sessao_e_extras" disabled={!canTudo}>
                  Sessão + extras · {formatBRL(sessaoPendente + extrasPendente)} pendente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* Meio */}
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={meio} onValueChange={(v) => setMeio(v as Meio)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEIO_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input
                {...currency.inputProps}
                placeholder="0,00"
                className={`h-9 text-sm ${excedePendente ? "border-destructive" : ""}`}
              />
              {excedePendente && (
                <p className="text-[10px] text-destructive">
                  Excede o pendente ({formatBRL(pendenteEscopo)}).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={data}
                max={todayISO()}
                onChange={(e) => setData(e.target.value)}
                className={`h-9 text-sm ${dataInvalida ? "border-destructive" : ""}`}
              />
              {dataInvalida && (
                <p className="text-[10px] text-destructive">Data inválida.</p>
              )}
            </div>
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, 240))}
              placeholder="Ex.: recebido em espécie no estúdio"
              className="min-h-[60px] text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {observacao.length}/240
            </p>
          </div>
        </div>
        )}


        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!podeSubmeter}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Registrar {formatBRL(valor)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
