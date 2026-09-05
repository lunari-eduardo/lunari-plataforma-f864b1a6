import React from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelSection } from "../PanelSection";
import type { PanelFormState } from "../types";
import { STATUS_META } from "../types";
import type { AppointmentStatus } from "@/modules/agenda/presentation";

interface StatusSectionProps {
  form: PanelFormState;
  setForm: React.Dispatch<React.SetStateAction<PanelFormState>>;
  isEdit: boolean;
}

export const StatusSection: React.FC<StatusSectionProps> = ({
  form,
  setForm,
  isEdit,
}) => {
  if (form.status === "confirmado" && isEdit) {
    return null;
  }

  return (
    <PanelSection icon={Tag} title="Status da sessão">
      <div className="grid grid-cols-2 gap-2">
        {(["a confirmar", "confirmado"] as AppointmentStatus[]).map((value) => {
          const meta = STATUS_META[value];
          const active = form.status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, status: value }))}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm transition-colors",
                active
                  ? meta.chip
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? meta.dot : "bg-muted-foreground/40",
                )}
              />
              {meta.label}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
};
