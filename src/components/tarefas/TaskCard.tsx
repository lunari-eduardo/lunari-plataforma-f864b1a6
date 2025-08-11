import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Task, TaskPriority } from '@/types/tasks';
import { Link } from 'react-router-dom';
import { GripVertical, MoreVertical } from 'lucide-react';

function daysUntil(dateIso?: string) {
  if (!dateIso) return undefined;
  const now = new Date();
  const due = new Date(dateIso);
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export default function TaskCard({
  task: t,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onRequestMove,
  isDone,
  statusOptions,
}: {
  task: Task;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  onRequestMove?: (status: string) => void;
  isDone: boolean;
  statusOptions: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const dueInfo = useMemo(() => {
    const d = daysUntil(t.dueDate);
    if (d === undefined) return null;
    if (d < 0) return <span className="text-lunar-error">Vencida há {Math.abs(d)} dia(s)</span>;
    if (d <= 2) return <span className="text-lunar-accent">Faltam {d} dia(s)</span>;
    return null;
  }, [t.dueDate]);

  const priorityUI = useMemo(() => {
    switch (t.priority) {
      case 'high':
        return {
          bar: 'bg-lunar-error',
          tint: 'bg-lunar-error/5',
          badge: 'text-lunar-error border-lunar-error/40 bg-lunar-error/10',
        };
      case 'medium':
        return {
          bar: 'bg-lunar-warning',
          tint: 'bg-lunar-warning/5',
          badge: 'text-lunar-warning border-lunar-warning/40 bg-lunar-warning/10',
        };
      default:
        return {
          bar: 'bg-lunar-border',
          tint: '',
          badge: 'text-lunar-textSecondary border-lunar-border/60 bg-transparent',
        };
    }
  }, [t.priority]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', t.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(t.id);
  };
  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <li
      className={`relative overflow-hidden rounded-md border border-lunar-border/60 bg-lunar-surface p-2 transition-none ${isDragging ? 'opacity-70 border-dashed ring-1 ring-lunar-accent/40' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      aria-grabbed={isDragging ? true : undefined}
    >
      {/* Priority visual accents */}
      <span aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${priorityUI.bar}`} />
      {priorityUI.tint && (
        <span aria-hidden className={`pointer-events-none absolute inset-0 ${priorityUI.tint}`} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-lunar-text truncate">{t.title}</h3>
          {t.description && (
            <p className="text-2xs text-lunar-textSecondary truncate">{t.description}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={`text-[10px] ${priorityUI.badge}`}>{priorityLabel[t.priority]}</Badge>
            {t.assigneeName && (
              <Badge variant="secondary" className="text-[10px]">{t.assigneeName}</Badge>
            )}
            {(t.tags || []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
            {(t.tags?.length || 0) > 3 && (
              <Badge variant="secondary" className="text-[10px]">+{(t.tags!.length - 3)}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div
            className="h-7 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing rounded"
            role="button"
            aria-label="Arrastar"
            title="Arrastar"
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <GripVertical size={16} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Mover para...">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              {statusOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => onRequestMove?.(opt.value)}
                  disabled={opt.value === t.status}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!isDone ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-2xs"
              onClick={onComplete}
            >
              Concluir
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={onReopen}>
              Reabrir
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={onEdit} title="Editar">
            Editar
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} title="Excluir">
            ×
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-lunar-textSecondary">
        <span>Criada: {new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
        {t.dueDate && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>Prazo: {new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>
            {dueInfo}
          </>
        )}
        {t.completedAt && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>Concluída: {new Date(t.completedAt).toLocaleDateString('pt-BR')}</span>
          </>
        )}
      </div>

      {(t.description || t.tags?.length || t.relatedClienteId || t.relatedBudgetId || t.relatedSessionId) && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-2xs">
              {open ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="text-2xs text-lunar-textSecondary">
            {t.description && (
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{t.description}</p>
            )}
            {(t.tags?.length || 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="font-medium text-lunar-text">Etiquetas:</span>
                {t.tags!.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {t.relatedClienteId && (
                <Link to={`/clientes/${t.relatedClienteId}`} className="text-lunar-accent underline">
                  Ver cliente
                </Link>
              )}
              {t.relatedBudgetId && (
                <Link to={`/orcamentos`} className="text-lunar-accent underline">
                  Ver orçamento
                </Link>
              )}
              {t.relatedSessionId && (
                <Link to={`/workflow`} className="text-lunar-accent underline">
                  Ver sessão
                </Link>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </li>
  );
}
