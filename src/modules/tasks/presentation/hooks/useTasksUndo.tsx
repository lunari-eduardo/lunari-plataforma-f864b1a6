import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import { useRunCapability } from '@/shared/capability/react';
import { isOk } from '@/shared/result';
import {
  moveTask as moveTaskCap,
  completeTask as completeTaskCap,
  reopenTask as reopenTaskCap,
  createTask as createTaskCap,
} from '@/modules/tasks';
import type { Task } from '@/types/tasks';
import { undoStack, UNDO_TTL_MS, type UndoEntry } from '../store/undoStack';

interface UseTasksUndoArgs {
  applyOptimisticPatch: (id: string, patch: Partial<Task>) => void;
  refetch: () => void;
  statusNameOf: (key: string) => string;
}

export function useTasksUndo({ applyOptimisticPatch, refetch, statusNameOf }: UseTasksUndoArgs) {
  const { toast } = useToast();
  const run = useRunCapability();
  const isUndoingRef = useRef(false);

  // re-render quando stack mudar
  useSyncExternalStore(undoStack.subscribe, undoStack.getSnapshot, undoStack.getSnapshot);

  const performUndo = useCallback(async () => {
    if (isUndoingRef.current) return;
    const entry = undoStack.pop();
    if (!entry) return;
    if (Date.now() - entry.at > UNDO_TTL_MS) {
      toast({ title: 'Ação expirada', description: 'Não é mais possível desfazer.', variant: 'destructive' });
      return;
    }

    isUndoingRef.current = true;
    try {
      switch (entry.kind) {
        case 'move': {
          applyOptimisticPatch(entry.id, { status: entry.fromStatus } as Partial<Task>);
          const res = await run(moveTaskCap, { id: entry.id, toStatus: entry.fromStatus });
          if (!isOk(res)) {
            refetch();
            toast({ title: 'Erro ao desfazer', description: res.error.message, variant: 'destructive' });
          }
          break;
        }
        case 'complete': {
          applyOptimisticPatch(entry.id, { status: entry.fromStatus, completedAt: undefined } as Partial<Task>);
          const res = await run(reopenTaskCap, { id: entry.id, toStatus: entry.fromStatus });
          if (!isOk(res)) {
            refetch();
            toast({ title: 'Erro ao desfazer', description: res.error.message, variant: 'destructive' });
          }
          break;
        }
        case 'reopen': {
          const res = await run(completeTaskCap, { id: entry.id });
          if (!isOk(res)) {
            refetch();
            toast({ title: 'Erro ao desfazer', description: res.error.message, variant: 'destructive' });
          }
          break;
        }
        case 'delete': {
          const t = entry.snapshot;
          const res = await run(createTaskCap, {
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            type: t.type,
            dueDate: t.dueDate,
            assigneeName: t.assigneeName,
            tags: t.tags,
            source: 'user',
            activeSections: t.activeSections as never,
            checklistItems: t.checklistItems as never,
            callToAction: t.callToAction,
            socialPlatforms: t.socialPlatforms,
            attachments: t.attachments as never,
            captions: t.captions as never,
            notes: t.notes,
            estimatedHours: t.estimatedHours,
          });
          if (!isOk(res)) {
            toast({ title: 'Erro ao restaurar', description: res.error.message, variant: 'destructive' });
          }
          break;
        }
      }
      refetch();
    } finally {
      isUndoingRef.current = false;
    }
  }, [run, refetch, applyOptimisticPatch, toast]);

  const showUndoToast = useCallback(
    (label: string) => {
      toast({
        title: label,
        description: 'Clique em Desfazer para reverter.',
        duration: 6000,
        action: (
          <ToastAction altText="Desfazer" onClick={() => { void performUndo(); }}>
            Desfazer
          </ToastAction>
        ),
      });
    },
    [toast, performUndo],
  );

  const pushMove = useCallback(
    (id: string, fromStatus: string, toStatus: string) => {
      const label = `Movida para "${statusNameOf(toStatus)}"`;
      undoStack.push({ kind: 'move', id, fromStatus, toStatus, at: Date.now(), label });
      showUndoToast(label);
    },
    [showUndoToast, statusNameOf],
  );

  const pushComplete = useCallback(
    (id: string, fromStatus: string) => {
      const label = 'Tarefa concluída';
      undoStack.push({ kind: 'complete', id, fromStatus, at: Date.now(), label });
      showUndoToast(label);
    },
    [showUndoToast],
  );

  const pushReopen = useCallback(
    (id: string, fromStatus: string) => {
      const label = 'Tarefa reaberta';
      undoStack.push({ kind: 'reopen', id, fromStatus, at: Date.now(), label });
      showUndoToast(label);
    },
    [showUndoToast],
  );

  const pushDelete = useCallback(
    (snapshot: Task) => {
      const label = `"${snapshot.title}" excluída`;
      undoStack.push({ kind: 'delete', snapshot, at: Date.now(), label });
      showUndoToast(label);
    },
    [showUndoToast],
  );

  // Atalho Cmd/Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isUndoCombo = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z');
      if (!isUndoCombo) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      // se há dialog aberto, ignorar
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (undoStack.size() === 0) return;
      e.preventDefault();
      void performUndo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performUndo]);

  // Limpa ao desmontar (sair de /tarefas)
  useEffect(() => {
    return () => {
      undoStack.clear();
    };
  }, []);

  return {
    performUndo,
    pushMove,
    pushComplete,
    pushReopen,
    pushDelete,
    entries: undoStack.list() as UndoEntry[],
    size: undoStack.size(),
  };
}
