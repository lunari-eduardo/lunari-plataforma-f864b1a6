import React from 'react';

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

export default function PriorityLegend() {
  return (
    <nav aria-label="Legenda de prioridade" className="flex flex-wrap items-center gap-2 md:gap-4 text-2xs text-lunar-textSecondary px-1">
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-error" />
        <span className="hidden sm:inline">Alta prioridade</span>
        <span className="sm:hidden">Alta</span>
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-warning" />
        <span className="hidden sm:inline">Média prioridade</span>
        <span className="sm:hidden">Média</span>
      </span>
      <span className="flex items-center gap-1">
        <Dot className="bg-lunar-border" />
        <span className="hidden sm:inline">Baixa prioridade</span>
        <span className="sm:hidden">Baixa</span>
      </span>
    </nav>
  );
}
