import React, { useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  /** Valor recebido acima do pendente da sessão */
  excedente: number;
  /** Valor unitário da foto extra configurado na sessão */
  valorFotoExtra: number;
  onCancel: () => void;
  /** Registra apenas o pagamento (excedente vira crédito) */
  onScopeSessao: () => void;
  /** Registra o excedente como venda de fotos extras (qtd calculada) */
  onScopeExtras: (qtdFotos: number) => void;
}

const brl = (v: number) => `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;

/**
 * Escopo obrigatório do excedente no pagamento rápido.
 * Evita o "buraco" histórico em que vendas de fotos extras entravam apenas
 * como pagamento solto, sem nunca alimentar as métricas de produção.
 */
export function QuickPaymentScopeDialog({
  open,
  excedente,
  valorFotoExtra,
  onCancel,
  onScopeSessao,
  onScopeExtras,
}: Props) {
  const qtdFotos = useMemo(() => {
    if (!valorFotoExtra || valorFotoExtra <= 0) return 0;
    return Math.round(excedente / valorFotoExtra);
  }, [excedente, valorFotoExtra]);

  const podeExtras = qtdFotos > 0;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>A que se refere o excedente?</AlertDialogTitle>
          <AlertDialogDescription>
            O valor informado ultrapassa o pendente da sessão em{" "}
            <strong className="text-foreground">{brl(excedente)}</strong>. Informe o escopo para
            manter as métricas corretas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            disabled={!podeExtras}
            onClick={() => onScopeExtras(qtdFotos)}
          >
            <span className="text-left">
              <span className="block text-sm font-medium">Venda de fotos extras</span>
              <span className="block text-xs text-muted-foreground">
                {podeExtras
                  ? `${qtdFotos} foto(s) × ${brl(valorFotoExtra)} — entra nas métricas de produção`
                  : "Defina o valor unitário da foto extra na sessão para usar esta opção"}
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={onScopeSessao}
          >
            <span className="text-left">
              <span className="block text-sm font-medium">Somente pagamento da sessão</span>
              <span className="block text-xs text-muted-foreground">
                O excedente permanece como crédito do cliente
              </span>
            </span>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="hidden" />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default QuickPaymentScopeDialog;
