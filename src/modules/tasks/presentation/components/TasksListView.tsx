import { Card } from '@/components/ui/card';
import CleanTaskCard from '@/components/tarefas/CleanTaskCard';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
import type { Task } from '@/types/tasks';

interface TasksListViewProps {
  filtered: Task[];
  checklistItems: Task[];
  doneKey: string;
  defaultOpenKey: string;
  addTask: (t: any) => Promise<any> | any;
  updateTask: (id: string, patch: any) => Promise<any> | any;
  deleteTask: (id: string) => Promise<any> | any;
  onView: (task: Task) => void;
  onComplete: (id: string) => void;
}

export default function TasksListView({
  filtered, checklistItems, doneKey, defaultOpenKey,
  addTask, updateTask, deleteTask, onView, onComplete,
}: TasksListViewProps) {
  return (
    <div className="space-y-2">
      <ChecklistPanel
        items={checklistItems}
        addTask={addTask}
        updateTask={updateTask}
        deleteTask={deleteTask}
        doneKey={doneKey}
        defaultOpenKey={defaultOpenKey}
        variant="section"
      />
      <Card className="p-2 bg-card/30 dark:bg-card/[0.04] backdrop-blur-xl border-white/35 dark:border-white/[0.08]">
        <div className="grid gap-2">
          {filtered.map(t => (
            <CleanTaskCard
              key={t.id}
              task={t}
              onComplete={() => onComplete(t.id)}
              onView={() => onView(t)}
              isDone={t.status === doneKey as any}
            />
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-lunar-textSecondary">Nenhuma tarefa encontrada.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
