import React from 'react';
import { Camera, Video, User, CheckSquare, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgendaLegendProps {
  className?: string;
  compact?: boolean;
}

export function AgendaLegend({ className, compact = false }: AgendaLegendProps) {
  const items = [
    {
      label: 'Sessão',
      icon: Camera,
      dotClass: 'bg-blue-500',
      borderClass: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Reunião',
      icon: Video,
      dotClass: 'bg-cyan-500',
      borderClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    },
    {
      label: 'Evento pessoal',
      icon: User,
      dotClass: 'bg-purple-500',
      borderClass: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    },
    {
      label: 'Tarefa',
      icon: CheckSquare,
      dotClass: 'bg-amber-500',
      borderClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Disponível',
      icon: Clock,
      dotClass: 'bg-emerald-500',
      borderClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Bloqueado',
      icon: Ban,
      dotClass: 'bg-red-500',
      borderClass: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    },
  ];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 text-xs',
        compact ? 'gap-1.5' : 'py-1',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              item.borderClass
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', item.dotClass)} />
            <Icon className="h-3 w-3 shrink-0 opacity-80" />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
