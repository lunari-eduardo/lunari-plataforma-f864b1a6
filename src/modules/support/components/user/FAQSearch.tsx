import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function FAQSearch({
  value,
  onChange,
  resultsCount,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  resultsCount?: number;
  loading?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar na central de ajuda…"
          className="h-11 pl-10 text-sm"
          autoComplete="off"
        />
      </div>
      {value.trim() && (
        <p className="text-[11px] text-muted-foreground">
          {loading ? "Buscando…" : `${resultsCount ?? 0} resultado(s)`}
        </p>
      )}
    </div>
  );
}
