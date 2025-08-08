import React from 'react';

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

export default function PriorityLegend() {
  return (
    <nav aria-label="Legenda de prioridade" className="flex flex-wrap items-center gap-4 text-2xs text-lunar-textSecondary">
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-error" />
        Alta prioridade
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-warning" />
        Média prioridade
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-border" />
        Baixa prioridade
      </span>
    </nav>
  );
}
