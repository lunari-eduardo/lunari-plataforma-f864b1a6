import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface ChecklistPanelProps {
  items: Task[];
  addTask: (input: any) => Task | any;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  doneKey: string;
  defaultOpenKey: string;
  variant?: 'column' | 'section';
}

export default function ChecklistPanel({
  items,
  addTask,
  updateTask,
  deleteTask,
  doneKey,
  defaultOpenKey,
  variant = 'column',
}: ChecklistPanelProps) {
  const [title, setTitle] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  const list = useMemo(() => {
    const arr = hideCompleted ? items.filter(i => !i.checked) : items;
    // Unchecked first, then by createdAt desc
    return [...arr].sort((a, b) => {
      const ac = a.checked ? 1 : 0;
      const bc = b.checked ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, hideCompleted]);

  const handleAdd = () => {
    const t = title.trim();
    if (!t) return;
    addTask({
      title: t,
      status: defaultOpenKey as any,
      priority: 'medium',
      source: 'manual',
      type: 'checklist',
      checked: false,
    });
    setTitle('');
  };

  const handleToggle = (task: Task, nextChecked: boolean) => {
    updateTask(task.id, {
      checked: nextChecked,
      status: (nextChecked ? doneKey : defaultOpenKey) as any,
    });
  };

  return (
    <section className={cn(variant === 'column' ? 'min-w-[260px] w-[260px]' : '')}>
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-lunar-text">Checklist</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-lunar-textSecondary">Ocultar concluídas</span>
          <Switch checked={hideCompleted} onCheckedChange={setHideCompleted} />
        </div>
      </header>
      <Card className="p-2 bg-lunar-surface border-lunar-border/60">
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Adicionar item"
            className="h-8"
          />
          <Button size="icon" className="h-8 w-8" onClick={handleAdd}>+</Button>
        </div>
        <ul className="space-y-1">
          {list.map(item => (
            <li key={item.id} className="flex items-start gap-2 group">
              <Checkbox
                checked={!!item.checked}
                onCheckedChange={(v) => handleToggle(item, Boolean(v))}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm text-lunar-text', item.checked ? 'line-through opacity-60' : '')}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-2xs text-lunar-textSecondary truncate">{item.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteTask(item.id)}
                title="Excluir"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="py-4 text-center text-2xs text-lunar-textSecondary">Nenhum item</li>
          )}
        </ul>
      </Card>
    </section>
  );
}
