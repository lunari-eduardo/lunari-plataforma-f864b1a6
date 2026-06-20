import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, PRIORITY_TONE } from "../../utils/labels";
import type { TicketPriority } from "../../types";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        PRIORITY_TONE[priority],
        className
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
