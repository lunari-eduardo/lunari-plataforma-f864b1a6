import { memo, useEffect, useMemo, useRef } from 'react';
import type { LinhaExtrato } from '@/types/extrato';
import { groupByTimeline } from './utils/groupByTimeline';
import FluxoTimelineRow, { FLUXO_GRID } from './FluxoTimelineRow';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

interface FluxoTimelineProps {
  linhas: LinhaExtrato[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleGroup?: (ids: string[], selecionarTodos: boolean) => void;
  onOpen: (linha: LinhaExtrato) => void;
  onMarkPaid?: (linha: LinhaExtrato) => Promise<void> | void;
  highlightId?: string | null;
}

const FluxoTimeline = memo(function FluxoTimeline({
  linhas,
  isLoading,
  selectedIds,
  onToggleSelect,
  onToggleGroup,
  onOpen,
  onMarkPaid,
  highlightId,
}: FluxoTimelineProps) {
  const groups = useMemo(() => groupByTimeline(linhas), [linhas]);
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
      {/* Cabeçalho de colunas — mesmo grid das linhas, tudo alinhado à esquerda */}
      <div
        className={cn(
          FLUXO_GRID,
          'hidden lg:grid px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70',
        )}
      >
        <span />
        <span />
        <span className="text-left">Descrição</span>
        <span className="text-left">Categoria</span>
        <span className="text-left">Origem</span>
        <span className="text-left">Status</span>
        <span className="text-left">Data</span>
        <span className="text-left">Valor</span>
        <span />
      </div>

      {groups.map((group) => {
        const ids = group.linhas.map((l) => l.id);
        const todosSelecionados = ids.length > 0 && ids.every((id) => selectedIds.has(id));
        const entradas = group.linhas
          .filter((l) => l.tipo === 'entrada')
          .reduce((s, l) => s + Math.abs(l.valor), 0);
        const saidas = group.linhas
          .filter((l) => l.tipo === 'saida')
          .reduce((s, l) => s + Math.abs(l.valor), 0);
        const saldo = entradas - saidas;

        return (
          <section key={group.key}>
            <header className="flex items-center gap-2 pb-2 mb-1 border-b border-border/50">
              {onToggleGroup && (
                <Checkbox
                  checked={todosSelecionados}
                  aria-label={`Selecionar todos os lançamentos de ${group.label}`}
                  onCheckedChange={() => onToggleGroup(ids, !todosSelecionados)}
                />
              )}
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{group.label}</h3>
              {group.sublabel && (
                <span className="text-xs text-muted-foreground normal-case tracking-normal">· {group.sublabel}</span>
              )}
              <span className="ml-auto flex items-center gap-3 text-[11px] tabular-nums">
                <span className="text-lunar-success">+ {formatCurrency(entradas)}</span>
                <span className="text-destructive">- {formatCurrency(saidas)}</span>
                <span className={cn('font-medium', saldo >= 0 ? 'text-foreground' : 'text-destructive')}>
                  {formatCurrency(saldo)}
                </span>
              </span>
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
                      onMarkPaid={onMarkPaid}
                      anySelected={anySelected}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
});

export default FluxoTimeline;
