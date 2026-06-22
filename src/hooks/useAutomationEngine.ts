import { useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAppointmentsRangeQuery } from '@/modules/agenda/presentation';
import { format } from 'date-fns';

function diffInDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function useAutomationEngine() {
  const { addTask } = useSupabaseTasks();
  const { preferences, getPreferencesOrDefault } = useUserPreferences();
  const { orcamentos } = useOrcamentos();
  // Janela: hoje até +120 dias (cobre regras D-2, D-1 e alerta de 72h sobre sessões futuras).
  const range = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    return { start: format(now, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
  }, []);
  const { data: appointmentsData } = useAppointmentsRangeQuery(range);
  const appointments = appointmentsData ?? [];
  const timerRef = useRef<number | null>(null);


  // Wrapper para addTask que trata a Promise
  const createTask = useCallback(async (taskData: Parameters<typeof addTask>[0]) => {
    try {
      await addTask(taskData);
      return true;
    } catch (error) {
      console.error('Erro ao criar tarefa automatizada:', error);
      return false;
    }
  }, [addTask]);

  useEffect(() => {
    const prefs = preferences ?? getPreferencesOrDefault();
    
    console.log('🤖 [AutomationEngine] Executando verificação:', {
      automationsEnabled: prefs?.habilitarAutomacoesWorkflow,
      productAlertsEnabled: prefs?.habilitarAlertaProdutosDoCliente,
      appointmentsCount: appointments.length,
      preferences: prefs
    });
    
    if (!prefs?.habilitarAutomacoesWorkflow) {
      console.log('🚫 [AutomationEngine] Automações desabilitadas nas preferências');
      return;
    }

    const run = () => {
      try {
        const now = new Date();
        const automationFlags: Record<string, boolean> = storage.load(STORAGE_KEYS.AUTOMATION_FLAGS, {} as Record<string, boolean>);
        const followupFlags: Record<string, boolean> = storage.load(STORAGE_KEYS.FOLLOWUP_FLAGS, {} as Record<string, boolean>);

        console.log('🔍 [AutomationEngine] Estado atual:', {
          now: now.toISOString(),
          totalAppointments: appointments.length,
          activeFlags: Object.keys(automationFlags).length,
          followupFlags: Object.keys(followupFlags).length
        });

        let futureAppointments = 0;
        let processedAppointments = 0;
        let tasksCreated = 0;
        let alertsShown = 0;

        // Automações por status no Workflow (via appointments) - sempre considera apenas futuros
        appointments.forEach(app => {
          const appDate = app.date instanceof Date ? app.date : new Date(app.date);
          const daysDiff = diffInDays(appDate, now);
          
          console.log('📅 [AutomationEngine] Analisando appointment:', {
            id: app.id,
            client: app.client,
            date: appDate.toISOString(),
            status: app.status,
            daysDiff: daysDiff.toFixed(1),
            hasProducts: Array.isArray(app.produtosIncluidos) && app.produtosIncluidos.length > 0,
            isInFuture: appDate > now
          });
          
          // Ignora sessões passadas para evitar spam
          if (appDate <= now) {
            console.log('⏰ [AutomationEngine] Ignorando appointment no passado:', app.id);
            return;
          }
          
          futureAppointments++;
          processedAppointments++;

          // Regra: A confirmar -> Confirmar com cliente (D-2)
          if (app.status === 'a confirmar') {
            const key = `wf_confirmar:${app.id}`;
            const shouldCreateTask = daysDiff <= 2 && daysDiff > 0;
            
            console.log('🔔 [AutomationEngine] Regra "A confirmar":', {
              key,
              shouldCreateTask,
              daysDiff,
              alreadyTriggered: !!automationFlags[key]
            });
            
            if (shouldCreateTask && !automationFlags[key]) {
              const due = new Date(appDate.getTime() - 48 * 60 * 60 * 1000);
              console.log('✅ [AutomationEngine] Criando tarefa de confirmação para:', app.client);
              
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
              tasksCreated++;
            }
          }

          // Regra: Confirmado -> Checagem final (D-1)
          if (app.status === 'confirmado') {
            const key = `wf_check:${app.id}`;
            const shouldCreateTask = daysDiff <= 1 && daysDiff > 0;
            
            console.log('🔔 [AutomationEngine] Regra "Confirmado":', {
              key,
              shouldCreateTask,
              daysDiff,
              alreadyTriggered: !!automationFlags[key]
            });
            
            if (shouldCreateTask && !automationFlags[key]) {
              const due = new Date(appDate.getTime() - 24 * 60 * 60 * 1000);
              console.log('✅ [AutomationEngine] Criando tarefa de checagem para:', app.client);
              
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
              tasksCreated++;
            }
          }

          // 3) Alerta de "produtos atrelados ao cliente" (janela de 72h)
          if (prefs.habilitarAlertaProdutosDoCliente) {
            const within72h = daysDiff <= 3 && daysDiff > 0;
            const key = `prod-alert:${app.id}`;
            const hasProducts = Array.isArray(app.produtosIncluidos) && app.produtosIncluidos.length > 0;
            
            console.log('🛍️ [AutomationEngine] Regra "Produtos do cliente":', {
              key,
              within72h,
              hasProducts,
              daysDiff,
              alreadyTriggered: !!automationFlags[key],
              productsCount: app.produtosIncluidos?.length || 0
            });
            
            if (within72h && !automationFlags[key] && hasProducts) {
              console.log('✅ [AutomationEngine] Mostrando alerta de produtos para:', app.client);
              
              automationFlags[key] = true;
              storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, automationFlags);
              toast({
                title: 'Produtos vinculados ao cliente',
                description: `A sessão de ${app.client} possui produtos vinculados. Revise antes da data.`,
              });
              alertsShown++;
            }
          }
        });

        console.log('📊 [AutomationEngine] Resumo da execução:', {
          futureAppointments,
          processedAppointments,
          tasksCreated,
          alertsShown,
          totalFlags: Object.keys(automationFlags).length
        });
      } catch (err) {
        console.error('Automation engine error:', err);
      }
    };

    // Run immediately and then on interval (15 minutos)
    run();
    timerRef.current = window.setInterval(run, 15 * 60 * 1000);

    // Listen for manual trigger events
    const handleForceCheck = () => {
      console.log('🚀 [AutomationEngine] Verificação manual forçada');
      run();
    };
    
    window.addEventListener('force-automation-check', handleForceCheck);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.removeEventListener('force-automation-check', handleForceCheck);
    };
  }, [preferences, getPreferencesOrDefault, orcamentos, appointments, addTask]);
}