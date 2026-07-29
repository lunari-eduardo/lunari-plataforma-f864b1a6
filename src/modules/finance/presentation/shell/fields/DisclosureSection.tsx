/**
 * DisclosureSection — bloco expansível para "Mais opções".
 * Header discreto, animação suave, indica quantidade de campos preenchidos.
 */
import { memo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureSectionProps {
  title: string;
  hint?: string;
  filledCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const DisclosureSection = memo(function DisclosureSection({
  title,
  hint,
  filledCount = 0,
  defaultOpen = false,
  children,
}: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-1.5 text-left group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </span>
          {filledCount > 0 && (
            <span className="rounded-full bg-accent-gold/15 px-1.5 py-[1px] text-[10px] font-medium text-accent-gold">
              {filledCount}
            </span>
          )}
          {hint && !open && (
            <span className="truncate text-[11px] text-muted-foreground/70">{hint}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="pt-1">{children}</div>}
    </div>
  );
});

export default DisclosureSection;
