import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useTasks } from '@/hooks/useTasks';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAgenda } from '@/hooks/useAgenda';

function diffInDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function useAutomationEngine() {
  const { addTask } = useTasks();
  const { preferences, getPreferencesOrDefault } = useUserPreferences();
  const { orcamentos } = useOrcamentos();
  const { appointments } = useAgenda();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const prefs = preferences ?? getPreferencesOrDefault();
    if (!prefs?.habilitarAutomacoesWorkflow) return;

    const run = () => {
      try {
        const now = new Date();
        const automationFlags: Record<string, boolean> = storage.load(STORAGE_KEYS.AUTOMATION_FLAGS, {} as Record<string, boolean>);
        const followupFlags: Record<string, boolean> = storage.load(STORAGE_KEYS.FOLLOWUP_FLAGS, {} as Record<string, boolean>);

        // Automações por status no Workflow (via appointments) - sempre considera apenas futuros
        appointments.forEach(app => {
          const appDate = app.date instanceof Date ? app.date : new Date(app.date);
          // Ignora sessões passadas para evitar spam
          if (appDate <= now) return;

          // Regra: A confirmar -> Confirmar com cliente (D-2)
          if (app.status === 'a confirmar') {
            const key = `wf_confirmar:${app.id}`;
            if (!automationFlags[key]) {
              const due = new Date(appDate.getTime() - 48 * 60 * 60 * 1000);
              addTask({
                title: `Confirmar sessão – ${app.client}`,
                description: 'Confirme data/horário e briefing com o cliente.',
                status: 'todo',
                priority: 'high',
                type: 'simple',
                relatedSessionId: app.id,
                tags: ['workflow'],
                source: 'automation',
                dueDate: due.toISOString(),
              });
              automationFlags[key] = true;
              storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, automationFlags);
              toast({ title: 'Tarefa criada', description: `Confirmar sessão de ${app.client}.` });
            }
          }

          // Regra: Confirmado -> Checagem final (D-1)
          if (app.status === 'confirmado') {
            const key = `wf_check:${app.id}`;
            if (!automationFlags[key]) {
              const due = new Date(appDate.getTime() - 24 * 60 * 60 * 1000);
              addTask({
                title: `Checagem final – ${app.client}`,
                description: 'Checar equipamentos, briefing e logística.',
                status: 'todo',
                priority: 'medium',
                type: 'simple',
                relatedSessionId: app.id,
                tags: ['workflow'],
                source: 'automation',
                dueDate: due.toISOString(),
              });
              automationFlags[key] = true;
              storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, automationFlags);
              toast({ title: 'Tarefa criada', description: `Checagem final para ${app.client}.` });
            }
          }

          // 3) Alerta de “produtos atrelados ao cliente” (janela de 72h)
          if (prefs.habilitarAlertaProdutosDoCliente) {
            const within72h = diffInDays(appDate, now) <= 3;
            const key = `prod-alert:${app.id}`;
            const hasProducts = Array.isArray(app.produtosIncluidos) && app.produtosIncluidos.length > 0;
            if (within72h && !automationFlags[key] && hasProducts) {
              automationFlags[key] = true;
              storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, automationFlags);
              toast({
                title: 'Produtos vinculados ao cliente',
                description: `A sessão de ${app.client} possui produtos vinculados. Revise antes da data.`,
              });
            }
          }
        });
      } catch (err) {
        console.error('Automation engine error:', err);
      }
    };

    // Run immediately and then on interval (15 minutos)
    run();
    timerRef.current = window.setInterval(run, 15 * 60 * 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [preferences, getPreferencesOrDefault, orcamentos, appointments, addTask]);
}
