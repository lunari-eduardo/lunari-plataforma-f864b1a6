import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Props {
  value?: string | null;
  onChange: (iso: string | null) => void;
}

export function ProdutoPrazoPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12px]",
              "border-border/60 hover:bg-muted/50 transition-colors",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {date ? format(date, "dd/MM/yyyy") : "Definir prazo"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={date}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {date && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
          aria-label="Limpar prazo"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
