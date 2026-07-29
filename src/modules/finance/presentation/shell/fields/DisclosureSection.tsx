/**
 * DisclosureSection — bloco expansível para "Mais opções".
 * Header discreto, animação suave (framer-motion), indica quantidade de campos preenchidos.
 */
import { memo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
          <AnimatePresence>
            {filledCount > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="rounded-full bg-accent-gold/15 px-1.5 py-[1px] text-[10px] font-medium text-accent-gold"
              >
                {filledCount}
              </motion.span>
            )}
          </AnimatePresence>
          {hint && !open && (
            <span className="truncate text-[11px] text-muted-foreground/70">{hint}</span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="text-muted-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default DisclosureSection;
