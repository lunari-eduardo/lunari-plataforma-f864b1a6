import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PanelField } from "../PanelSection";

interface SessionPanelHeaderProps {
  isEdit: boolean;
  statusMeta: { label: string; dot: string; chip: string };
  showSchedule?: boolean;
  setShowSchedule?: React.Dispatch<React.SetStateAction<boolean>>;
  contextLine: string[];
  dateInput: string;
  setDateInput: (v: string) => void;
  commitDate: () => void;
  timeInput: string;
  setTimeInput: (v: string) => void;
  commitTime: () => void;
}

export const SessionPanelHeader: React.FC<SessionPanelHeaderProps> = ({
  isEdit,
  statusMeta,
  contextLine,
  dateInput,
  setDateInput,
  commitDate,
  timeInput,
  setTimeInput,
  commitTime,
}) => {
  return (
    <header className="shrink-0 border-b border-border/60 px-4 pt-4 pb-3 pr-12">
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {isEdit ? "Sessão" : "Nova sessão"}
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            statusMeta.chip,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
          {statusMeta.label}
        </span>
      </div>

      {contextLine.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {contextLine.map((part, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-border">•</span>}
              {part}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PanelField label="Data" htmlFor="sp-date">
          <Input
            id="sp-date"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            onBlur={commitDate}
            className="h-10 rounded-lg text-base sm:text-sm"
          />
        </PanelField>
        <PanelField label="Horário" htmlFor="sp-time">
          <Input
            id="sp-time"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onBlur={commitTime}
            className="h-10 rounded-lg text-base sm:text-sm"
          />
        </PanelField>
      </div>
    </header>
  );
};
