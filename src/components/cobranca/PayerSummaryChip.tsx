import { CheckCircle2, Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/validateCpfCnpj";
import type { PayerFieldsValue } from "./PayerFieldsBlock";

interface Props {
  value: PayerFieldsValue;
  onEdit: () => void;
  /** Texto de fallback abaixo do resumo (ex.: "Coletado pelo cliente no checkout"). */
  hint?: string;
}

/**
 * PayerSummaryChip — resumo compacto dos dados do pagador quando o CRM já
 * possui tudo que o provedor exige. Substitui o PayerFieldsBlock quando não
 * há atrito. Botão "Editar" reabre o bloco completo.
 */
export function PayerSummaryChip({ value, onEdit, hint }: Props) {
  const rows: Array<[string, string]> = [];
  if (value.nome) rows.push(["Nome", value.nome]);
  if (value.cpfCnpj) rows.push(["Documento", maskCpfCnpj(value.cpfCnpj)]);
  if (value.telefone) rows.push(["Telefone", maskPhoneBR(value.telefone)]);
  if (value.email) rows.push(["Email", value.email]);

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <User className="h-3 w-3" />
        Dados do pagador
      </Label>

      <div className="rounded-md border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-0.5">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {hint || "Sem dados adicionais necessários."}
                </p>
              ) : (
                rows.map(([k, v]) => (
                  <div key={k} className="text-xs flex gap-2 truncate">
                    <span className="text-muted-foreground shrink-0">{k}:</span>
                    <span className="font-medium truncate">{v}</span>
                  </div>
                ))
              )}
              {hint && rows.length > 0 && (
                <p className="text-[11px] text-muted-foreground pt-1">{hint}</p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
