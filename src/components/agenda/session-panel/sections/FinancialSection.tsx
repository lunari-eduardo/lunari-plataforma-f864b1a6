import React from "react";
import {
  DollarSign,
  Plus,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Copy,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PanelSection } from "../PanelSection";
import type { PanelFormState } from "../types";

interface FinancialSectionProps {
  isEdit: boolean;
  form: PanelFormState;
  isConfirmedWithDeposit: boolean;
  handleGerarCobranca: () => void;
  cobranca: any;
  cobrarAoSalvar: boolean;
  paidInput: {
    displayValue: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleFocus: () => void;
  };
  pagoCobrancas: any[];
  totalPagoCobrancas: number;
  pendenteCobrancas: any[];
  cobrancaPendente: any;
  cobrancaPendenteLink: string;
  cobrancaLink: string;
  handleCobrarAoSalvarChange: (checked: boolean) => void;
  handleCancelCharge: (chargeId: string) => Promise<void>;
  valorPacote: number;
}

export const FinancialSection: React.FC<FinancialSectionProps> = ({
  isEdit,
  form,
  isConfirmedWithDeposit,
  handleGerarCobranca,
  cobranca,
  cobrarAoSalvar,
  paidInput,
  pagoCobrancas,
  totalPagoCobrancas,
  pendenteCobrancas,
  cobrancaPendente,
  cobrancaPendenteLink,
  cobrancaLink,
  handleCobrarAoSalvarChange,
  handleCancelCharge,
  valorPacote,
}) => {
  return (
    <PanelSection
      icon={DollarSign}
      title="Financeiro"
      action={
        isEdit && form.clienteId && !isConfirmedWithDeposit ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            onClick={handleGerarCobranca}
          >
            <Plus className="h-3 w-3" />
            {cobranca ? "Nova cobrança" : "Gerar cobrança"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* 1. Registro de entrada manual */}
        <div className="space-y-2">
          <label
            htmlFor="sp-entrada"
            className="block text-xs font-semibold text-foreground"
          >
            Registro de entrada manual
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              R$
            </span>
            <Input
              id="sp-entrada"
              type="number"
              min="0"
              step="0.01"
              value={cobrarAoSalvar ? "" : paidInput.displayValue}
              onChange={paidInput.handleChange}
              onFocus={paidInput.handleFocus}
              placeholder={
                cobrarAoSalvar || isConfirmedWithDeposit
                  ? "Gerenciado pelo Workflow"
                  : "0,00"
              }
              disabled={
                cobrarAoSalvar ||
                pagoCobrancas.length > 0 ||
                isConfirmedWithDeposit
              }
              className={cn(
                "h-10 rounded-lg pl-10 text-base sm:text-sm transition-opacity",
                (cobrarAoSalvar ||
                  pagoCobrancas.length > 0 ||
                  isConfirmedWithDeposit) &&
                  "opacity-50 cursor-not-allowed bg-muted/30",
              )}
            />
          </div>
          {isConfirmedWithDeposit ? (
            <p className="text-[11px] text-muted-foreground">
              Agendamento confirmado. Gerencie pagamentos e cobranças pelo{" "}
              <strong className="font-medium text-foreground">Workflow</strong>.
            </p>
          ) : pagoCobrancas.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Entrada manual desativada pois existem cobranças processadas via link para esta sessão.
            </p>
          ) : cobrarAoSalvar ? (
            <p className="text-[11px] text-muted-foreground">
              Entrada manual desativada pois{" "}
              <strong className="font-medium text-foreground">
                "Cobrança via link"
              </strong>{" "}
              está ativa.
            </p>
          ) : null}
        </div>

        {/* Divisor */}
        <div className="border-t border-border/60 my-1" />

        {/* 2. Cobrança via link */}
        <div>
          {!isEdit ? (
            <div className="space-y-2.5">
              <label
                htmlFor="sp-cobrar-ao-salvar"
                className={cn(
                  "flex items-start justify-between gap-3",
                  form.paidAmount > 0
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer",
                )}
              >
                <div className="min-w-0 space-y-1">
                  <span className="block text-xs font-semibold text-foreground">
                    Cobrança via link
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-relaxed">
                    Ao criar o agendamento pendente, abre link de cobrança e você
                    configura o valor.
                  </span>
                  <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    A sessão é confirmada automaticamente no pagamento.
                  </span>
                </div>
                <Switch
                  id="sp-cobrar-ao-salvar"
                  checked={cobrarAoSalvar}
                  disabled={form.paidAmount > 0}
                  onCheckedChange={handleCobrarAoSalvarChange}
                />
              </label>
              {form.paidAmount > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Cobrança via link desativada pois uma{" "}
                  <strong className="font-medium text-foreground">
                    entrada manual (R$ {form.paidAmount.toFixed(2)})
                  </strong>{" "}
                  já foi informada.
                </p>
              ) : cobrarAoSalvar ? (
                <p className="text-[11px] text-muted-foreground">
                  Valor sugerido:{" "}
                  <span className="text-foreground font-medium">
                    R${" "}
                    {(valorPacote > 0
                      ? valorPacote
                      : form.paidAmount || 0
                    ).toFixed(2)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : isConfirmedWithDeposit ? null : !cobranca ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-foreground">
                    Cobrança via link
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Nenhuma cobrança criada para esta sessão.
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-lg text-xs gap-1.5"
                  onClick={handleGerarCobranca}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Gerar cobrança
                </Button>
              </div>
            </div>
          ) : pagoCobrancas.length > 0 ? (
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-foreground">
                Cobrança via link
              </span>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Pago</span>
                    <span className="text-muted-foreground font-normal">
                      • R$ {totalPagoCobrancas.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    {pagoCobrancas[0].provedor === "pix_manual"
                      ? "PIX Manual"
                      : pagoCobrancas[0].provedor}
                    {pagoCobrancas.length > 1 &&
                      ` (${pagoCobrancas.length} pagamentos)`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-md"
                  onClick={handleGerarCobranca}
                >
                  Histórico
                </Button>
              </div>

              {/* Se houver cobrança pendente adicional (ex: extras ou novo link), exibir alerta e ações */}
              {cobrancaPendente && cobrancaPendenteLink && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-medium text-amber-500">
                        Cobrança adicional pendente
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      R$ {cobrancaPendente.valor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 rounded text-[11px] px-2 gap-1"
                      onClick={() =>
                        window.open(
                          cobrancaPendenteLink,
                          "_blank",
                          "noopener",
                        )
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 rounded text-[11px] px-2 gap-1"
                      onClick={() => {
                        navigator.clipboard?.writeText(cobrancaPendenteLink);
                        toast.success("Link de checkout copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded text-[11px] px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => handleCancelCharge(cobrancaPendente.id)}
                    >
                      <Ban className="h-3 w-3" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : ["cancelado", "expirado", "estornado"].includes(
              cobranca.status,
            ) && pendenteCobrancas.length === 0 ? (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-foreground">
                Cobrança via link
              </span>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-muted-foreground capitalize">
                    Cobrança {cobranca.status} (R${" "}
                    {cobranca.valor.toFixed(2)})
                  </span>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Gere uma nova cobrança para enviar ao cliente.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-lg text-xs gap-1.5 shrink-0"
                  onClick={handleGerarCobranca}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Nova cobrança
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-foreground">
                Cobrança via link
              </span>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Aguardando pagamento
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {(cobrancaPendente || cobranca)?.provedor ===
                      "pix_manual"
                        ? "PIX Manual"
                        : (cobrancaPendente || cobranca)?.provedor}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    R${" "}
                    {(cobrancaPendente || cobranca)?.valor.toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  {(cobrancaPendenteLink || cobrancaLink) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md text-xs gap-1.5"
                      onClick={() =>
                        window.open(
                          cobrancaPendenteLink || cobrancaLink,
                          "_blank",
                          "noopener",
                        )
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir link
                    </Button>
                  )}
                  {(cobrancaPendenteLink || cobrancaLink) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md text-xs gap-1.5"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          cobrancaPendenteLink || cobrancaLink,
                        );
                        toast.success("Link de checkout copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar link
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-md text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={() =>
                      handleCancelCharge((cobrancaPendente || cobranca)!.id)
                    }
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar cobrança
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelSection>
  );
};
