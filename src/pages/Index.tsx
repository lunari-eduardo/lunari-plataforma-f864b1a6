import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KPIGroupCard } from "@/components/dashboard/KPIGroupCard";
import { ProductionRemindersCard } from "@/components/dashboard/ProductionRemindersCard";
import { HighPriorityDueSoonCard } from "@/components/tarefas/HighPriorityDueSoonCard";
import { useIsTablet } from "@/hooks/useIsTablet";
import { FinancialRemindersCard } from "@/components/dashboard/FinancialRemindersCard";

import DailyHero from "@/components/dashboard/DailyHero";
import DailyKPIs from "@/components/dashboard/DailyKPIs";
import FollowUpNotificationCard from "@/components/leads/FollowUpNotificationCard";
import { useSalesAnalytics } from "@/hooks/useSalesAnalytics";
import { useAgenda } from "@/hooks/useAgenda";
import { useAvailability } from "@/hooks/useAvailability";
import { useAppContext } from "@/contexts/AppContext";
import { formatDateForStorage, parseDateFromStorage } from "@/utils/dateUtils";
import { normalizeWorkflowItems } from "@/utils/salesDataNormalizer";
import { useWorkflowMetrics } from "@/hooks/useWorkflowMetrics";
export default function Index() {
  const isTablet = useIsTablet();

  // SEO basics
  useEffect(() => {
    const title = "Dashboard de Negócios | Início";
    document.title = title;
    const desc = "Dashboard: receita do mês vs metas, categoria mais rentável, novos clientes, horários livres e próximos agendamentos.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    const linkRel = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkRel) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", window.location.href);
      document.head.appendChild(link);
    }
  }, []);
  const year = new Date().getFullYear();
  const {
    monthlyData,
    categoryData
  } = useSalesAnalytics(year, null, "all");
  const {
    appointments
  } = useAgenda();
  const {
    availability
  } = useAvailability();
  const {
    workflowItemsAll
  } = useAppContext();
  const {
    getMonthlyMetrics
  } = useWorkflowMetrics();
  // Receita do mês atual vs meta (usando mesma lógica do dashboard financeiro)
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Obter receita do mês atual usando métricas cacheadas (mesma fonte do Workflow e Finanças)
  const receitaMes = useMemo(() => {
    const cachedMetrics = getMonthlyMetrics(currentYear, currentMonthIndex + 1);
    return cachedMetrics ? cachedMetrics.receita : 0;
  }, [getMonthlyMetrics, currentYear, currentMonthIndex]);

  // Obter meta mensal usando mesma lógica do dashboard financeiro
  const metaMes = useMemo(() => {
    try {
      const { storage, STORAGE_KEYS } = require('@/utils/localStorage');
      const { GoalsIntegrationService } = require('@/services/GoalsIntegrationService');
      
      // Carregar metas históricas primeiro (mesma lógica do dashboard financeiro)
      const historicalGoals = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
      const metaDoAno = historicalGoals.find((goal: any) => goal.ano === currentYear);
      
      let metaReceita = 0;
      
      if (metaDoAno) {
        // Usar meta histórica se disponível
        metaReceita = metaDoAno.metaFaturamento;
      } else {
        // Usar dados da precificação como fallback
        const goalsData = GoalsIntegrationService.getAnnualGoals();
        metaReceita = goalsData.revenue;
      }
      
      // Meta proporcional do mês
      return metaReceita / 12;
    } catch (error) {
      console.warn('Erro ao carregar meta mensal:', error);
      return 0;
    }
  }, [currentYear]);

  const progressoMeta = metaMes > 0 ? Math.min(100, (receitaMes / metaMes) * 100) : 0;

  // Categoria mais rentável
  const topCategoria = categoryData[0] || null;

  // Total Previsto (movido do ReceitaPrevistaCard)
  const valorPrevisto = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Tentar obter do cache primeiro (mesma fonte do Workflow e Finanças)
    const cachedMetrics = getMonthlyMetrics(currentYear, currentMonth);
    if (cachedMetrics) {
      return cachedMetrics.previsto;
    }

    // Fallback para cálculo manual (primeira execução)
    const itemsDoMes = workflowItemsAll.filter(item => {
      if (!item.data) return false;
      const itemDate = new Date(item.data);
      return itemDate.getMonth() + 1 === currentMonth && itemDate.getFullYear() === currentYear;
    });
    return itemsDoMes.reduce((acc, item) => acc + (item.total || 0), 0);
  }, [workflowItemsAll, getMonthlyMetrics]);

  // Novos clientes nos últimos 60 dias (primeira sessão registrada)
  const novosClientes60d = useMemo(() => {
    const all = normalizeWorkflowItems();
    if (all.length === 0) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const firstSeen = new Map<string, Date>();
    all.forEach(s => {
      const key = s.clienteId || s.email || s.whatsapp || s.nome;
      if (!key) return;
      const d = s.date instanceof Date ? s.date : parseDateFromStorage(s.data);
      if (!firstSeen.has(key) || d < (firstSeen.get(key) as Date)) {
        firstSeen.set(key, d);
      }
    });
    let count = 0;
    firstSeen.forEach(d => {
      if (d >= cutoff) count++;
    });
    return count;
  }, []);

  // Horários livres na semana (próximos 7 dias)
  const {
    livresSemana,
    proximoLivre
  } = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 7);
    const startKey = formatDateForStorage(start);
    const endKey = formatDateForStorage(end);
    const isWithinRange = (iso: string) => iso >= startKey && iso <= endKey;
    const busyMap = new Set<string>();
    appointments.forEach(app => {
      const d = formatDateForStorage(app.date);
      const key = `${d}T${app.time}`;
      busyMap.add(key); // considera qualquer status como ocupado
    });
    const slots = availability.filter(s => isWithinRange(s.date));
    const freeSlots = slots.filter(s => !busyMap.has(`${s.date}T${s.time}`));

    // Encontrar próximo slot livre (>= agora)
    const now = new Date();
    const freeWithDate = freeSlots.map(s => {
      const dt = parseDateFromStorage(s.date);
      const [hh, mm] = s.time.split(":").map(Number);
      dt.setHours(hh, mm, 0, 0);
      return {
        slot: s,
        dt
      };
    }).filter(({
      dt
    }) => dt >= now).sort((a, b) => a.dt.getTime() - b.dt.getTime());
    return {
      livresSemana: freeWithDate.length,
      proximoLivre: freeWithDate.length > 0 ? freeWithDate[0].dt : null
    };
  }, [appointments, availability]);

  // Lembretes de Produção
  const lembretesProducao = useMemo(() => {
    const reminders: Array<{
      id: string;
      cliente: string;
      produto: string;
      tipo: string;
    }> = [];
    workflowItemsAll.forEach(item => {
      (item.produtosList || []).forEach(p => {
        // Inclusos e manuais geram lembrete até serem marcados como produzidos
        if (!p.produzido) {
          reminders.push({
            id: `${item.id}-${p.nome}`,
            cliente: item.nome,
            produto: p.nome,
            tipo: p.tipo
          });
        }
      });
    });
    return reminders;
  }, [workflowItemsAll]);
  // Próximos agendamentos confirmados (top 5)
  const proximosAgendamentos = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const items = appointments
      .filter(a => a.status === "confirmado")
      .filter(a => {
        const appointmentDate = a.date instanceof Date ? a.date : new Date(a.date);
        const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
        
        // If appointment is on a future date, include it
        if (appointmentDay > today) return true;
        
        // If appointment is today, check if time hasn't passed
        if (appointmentDay.getTime() === today.getTime()) {
          const [hh, mm] = a.time.split(":").map(Number);
          const appointmentDateTime = new Date(appointmentDate);
          appointmentDateTime.setHours(hh || 0, mm || 0, 0, 0);
          return appointmentDateTime >= now;
        }
        
        return false;
      })
      .map(a => ({
        id: a.id,
        cliente: a.client,
        tipo: a.type,
        data: a.date,
        hora: a.time
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .slice(0, 5);
    
    return items;
  }, [appointments]);
  return <main className="space-y-6">
    <section aria-label="Resumo do dia" className="animate-fade-in">
      <DailyHero />
    </section>

    {/* Próximos Agendamentos */}
    <section>
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
        <CardHeader className="pb-3 flex flex-row items-center justify-between py-[6px]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-gradient">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="font-semibold text-base">Próximos Agendamentos</CardTitle>
          </div>
          <Link to="/agenda">
            <Button variant="ghost" size="sm">Ver todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {proximosAgendamentos.length === 0 ? <div className="flex items-center justify-center py-[7px]">
              <p className="text-lunar-textSecondary text-xs">Nenhum agendamento confirmado</p>
            </div> : <div className="space-y-3">
              {proximosAgendamentos.map(ev => <div key={ev.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{ev.cliente}</p>
                      <p className="text-2xs text-lunar-textSecondary mt-0.5">{ev.tipo}</p>
                    </div>
                    <div className="text-right text-2xs text-lunar-textSecondary">
                      <div>{ev.data.toLocaleDateString("pt-BR")}</div>
                      <div className="mt-0.5">{ev.hora}</div>
                    </div>
                  </div>
                </div>)}
            </div>}
        </CardContent>
      </Card>
    </section>

    {/* KPIs modernizados (mensal) */}
    <section aria-label="Indicadores principais" className="animate-fade-in">
      <KPIGroupCard receitaMes={receitaMes} metaMes={metaMes} progressoMeta={progressoMeta} topCategoria={topCategoria} novosClientes60d={novosClientes60d} livresSemana={livresSemana} proximoLivre={proximoLivre} valorPrevisto={valorPrevisto} />
    </section>


    {/* Follow-up Notifications */}
    <section aria-label="Follow-up de leads" className="animate-fade-in">
      <FollowUpNotificationCard />
    </section>

      {/* Critical Cards - Empilhados em tablets */}
    <section className="grid gap-6 animate-fade-in auto-rows-auto lg:auto-rows-fr grid-cols-1 lg:grid-cols-3">
      <div className="h-full"><FinancialRemindersCard /></div>
      <div className="h-full"><ProductionRemindersCard lembretes={lembretesProducao} /></div>
      <div className="h-full"><HighPriorityDueSoonCard /></div>
    </section>
    </main>;
}