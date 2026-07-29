/**
 * SectionHeader — separador editorial entre blocos do drawer
 * (Essencial · Quando · Origem · Mais opções).
 */
import { memo } from 'react';

interface SectionHeaderProps {
  label: string;
}

export const SectionHeader = memo(function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="pt-2 pb-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </span>
    </div>
  );
});

export default SectionHeader;
