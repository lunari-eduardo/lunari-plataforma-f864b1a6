import React from "react";
import { FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PanelSection, PanelField } from "../PanelSection";
import type { PanelFormState } from "../types";

interface NotesSectionProps {
  form: PanelFormState;
  setForm: React.Dispatch<React.SetStateAction<PanelFormState>>;
  isEdit: boolean;
  setShowBriefing: (v: boolean) => void;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
  form,
  setForm,
  isEdit,
  setShowBriefing,
}) => {
  return (
    <PanelSection icon={FileText} title="Descrição">
      <PanelField label="Descrição" htmlFor="sp-desc">
        <Textarea
          id="sp-desc"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Descrição da sessão..."
          className="min-h-[72px] rounded-lg text-base sm:text-sm resize-none"
        />
      </PanelField>
      {isEdit && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => {
            if (!form.clienteId) {
              toast.error(
                "Vincule um cliente do CRM para enviar o briefing.",
              );
              return;
            }
            setShowBriefing(true);
          }}
        >
          <Paperclip className="h-3.5 w-3.5 mr-1.5" />
          Briefing
        </Button>
      )}
    </PanelSection>
  );
};
