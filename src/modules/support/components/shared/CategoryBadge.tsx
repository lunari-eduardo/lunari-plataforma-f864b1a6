import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "../../utils/labels";
import type { TicketCategory } from "../../types";

export function CategoryBadge({
  categoria,
  className,
}: {
  categoria: TicketCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {CATEGORY_LABEL[categoria]}
    </span>
  );
}
