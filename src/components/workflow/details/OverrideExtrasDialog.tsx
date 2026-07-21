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
}

interface Props {
  pendingExtraEdit: PendingEdit | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação para sobrescrever dado de fotos extras
 * vindo da galeria (Onda 5c).
 */
export function OverrideExtrasDialog({ pendingExtraEdit, onConfirm, onCancel }: Props) {
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
            Sobrescrever dado da galeria?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Ao confirmar, o valor da galeria será <strong>permanentemente ignorado</strong> nesta sessão.
              Os valores digitados manualmente passam a ser a fonte da verdade — não há re-sincronização
              automática.
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
              Para voltar aos valores do Gallery, edite manualmente cada campo de volta ao valor desejado.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Sobrescrever mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
