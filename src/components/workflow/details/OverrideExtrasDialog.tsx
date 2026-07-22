import React from "react";
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
import { AlertTriangle } from "lucide-react";

interface PendingEdit {
  field: "valorFotoExtra" | "qtdFotosExtra";
  nextValue: string;
  previousValue: string;
  /**
   * Origem da confirmação:
   *  - 'gallery': sessão vinculada a galeria com vendas reais.
   *  - 'frozen_rules': sessão sem galeria, mas com regra de preço congelada
   *    do pacote (desconto progressivo). Alterar desvincula da regra.
   */
  source?: "gallery" | "frozen_rules";
}

interface Props {
  pendingExtraEdit: PendingEdit | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação para sobrescrever dado de fotos extras.
 * Cobre dois cenários: galeria consolidada e regras congeladas do pacote.
 */
export function OverrideExtrasDialog({ pendingExtraEdit, onConfirm, onCancel }: Props) {
  const source = pendingExtraEdit?.source ?? "gallery";
  const isFrozen = source === "frozen_rules";

  return (
    <AlertDialog
      open={pendingExtraEdit !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {isFrozen
              ? "Desvincular do preço do pacote?"
              : "Sobrescrever dado da galeria?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {isFrozen ? (
                <>
                  Este pacote tem uma <strong>regra de preço congelada</strong> (desconto progressivo).
                  Ao confirmar, os extras desta sessão passam a ser <strong>independentes do pacote</strong> — não
                  há re-sincronização automática.
                </>
              ) : (
                <>
                  Ao confirmar, o valor da galeria será <strong>permanentemente ignorado</strong> nesta sessão.
                  Os valores digitados manualmente passam a ser a fonte da verdade — não há re-sincronização
                  automática.
                </>
              )}
            </span>
            <span className="block">
              Novo valor:{" "}
              <strong className="text-foreground">
                {pendingExtraEdit?.field === "valorFotoExtra"
                  ? pendingExtraEdit?.nextValue
                  : `${pendingExtraEdit?.nextValue} foto(s)`}
              </strong>
            </span>
            <span className="block text-xs text-muted-foreground">
              {isFrozen
                ? 'Você pode restaurar o preço do pacote depois usando "Restaurar preço do pacote" no card.'
                : "Para voltar aos valores do Gallery, edite manualmente cada campo de volta ao valor desejado."}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isFrozen ? "Desvincular e salvar" : "Sobrescrever mesmo assim"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
