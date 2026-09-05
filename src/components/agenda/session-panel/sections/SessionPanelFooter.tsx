import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionPanelFooterProps {
  isEdit: boolean;
  hasDeleteHandler: boolean;
  setShowDelete: (v: boolean) => void;
  onClose: () => void;
  handleSave: () => void;
  saving: boolean;
}

export const SessionPanelFooter: React.FC<SessionPanelFooterProps> = ({
  isEdit,
  hasDeleteHandler,
  setShowDelete,
  onClose,
  handleSave,
  saving,
}) => {
  return (
    <footer className="shrink-0 border-t border-border/60 px-4 py-3 pb-safe-plus-2 sm:pb-3 flex items-center justify-between gap-2">
      {isEdit && hasDeleteHandler ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-lg text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Excluir sessão
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg text-xs"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="h-9 rounded-lg text-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {isEdit ? "Salvar alterações" : "Criar sessão"}
        </Button>
      </div>
    </footer>
  );
};
