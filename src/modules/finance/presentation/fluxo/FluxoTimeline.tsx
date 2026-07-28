import { memo, useEffect, useRef } from 'react';
import type { LinhaExtrato } from '@/types/extrato';
import { groupByTimeline } from './utils/groupByTimeline';
import FluxoTimelineRow from './FluxoTimelineRow';

interface FluxoTimelineProps {
  linhas: LinhaExtrato[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (linha: LinhaExtrato) => void;
  highlightId?: string | null;
}

const FluxoTimeline = memo(function FluxoTimeline({
  linhas,
  isLoading,
  selectedIds,
  onToggleSelect,
  onOpen,
  highlightId,
}: FluxoTimelineProps) {
  const groups = groupByTimeline(linhas);
  const anySelected = selectedIds.size > 0;
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightId]);

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center text-sm text-muted-foreground">
        Carregando lançamentos…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-muted-foreground">Nenhum lançamento neste período.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Ajuste os filtros ou crie um novo lançamento no botão acima.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <header className="flex items-baseline gap-2 pb-2 mb-1 border-b border-border/50">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{group.label}</h3>
            {group.sublabel && (
              <span className="text-xs text-muted-foreground normal-case tracking-normal">· {group.sublabel}</span>
            )}
          </header>
          <div className="space-y-0.5">
            {group.linhas.map((linha) => {
              const isHighlighted = highlightId === linha.id;
              return (
                <div
                  key={linha.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={
                    isHighlighted
                      ? 'rounded-md ring-1 ring-[hsl(var(--accent-gold))]/50 bg-[hsl(var(--accent-gold)/0.08)] transition-all duration-500'
                      : 'transition-all duration-500'
                  }
                >
                  <FluxoTimelineRow
                    linha={linha}
                    selected={selectedIds.has(linha.id)}
                    onToggleSelect={onToggleSelect}
                    onOpen={onOpen}
                    anySelected={anySelected}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
});

export default FluxoTimeline;
