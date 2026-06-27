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
              Este campo é normalmente sincronizado automaticamente com a galeria desta sessão.
              Editar manualmente irá <strong>sobrescrever</strong> o valor recebido do Gallery e
              pode causar divergência financeira.
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
              Recomendado: corrija primeiro no Gallery — a sessão será sincronizada automaticamente.
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
