import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "../../utils/labels";
import type { TicketStatus } from "../../types";

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_TONE[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
