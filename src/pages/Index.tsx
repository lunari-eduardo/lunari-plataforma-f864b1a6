import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductionRemindersCard } from "@/components/dashboard/ProductionRemindersCard";
import { HighPriorityDueSoonCard } from "@/components/tarefas/HighPriorityDueSoonCard";
import { FinancialRemindersCard } from "@/components/dashboard/FinancialRemindersCard";
import { InstallPWAButton } from "@/components/pwa/InstallPWAButton";
import DailyHero from "@/components/dashboard/DailyHero";
import { useAgenda } from "@/hooks/useAgenda";
import { useProductionReminders } from "@/hooks/useProductionReminders";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { KPIGroupCard } from "@/components/dashboard/KPIGroupCard";

export default function Index() {
  // SEO basics
  useEffect(() => {
    const title = "Dashboard de Negócios | Início";
    document.title = title;
    const desc = "Dashboard: receita do mês vs metas, categoria mais rentável, novos clientes e próximos agendamentos.";
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

  const { appointments } = useAgenda();
  const lembretesProducao = useProductionReminders();
  
  // Métricas do dashboard via Supabase
  const {
    receitaMes,
    valorPrevisto,
    metaMes,
    progressoMeta,
    topCategoria,
    novosClientes60d,
    isLoading: metricsLoading
  } = useDashboardMetrics();

  // Próximos agendamentos confirmados (top 3)
  const proximosAgendamentos = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const items = appointments
      .filter(a => a.status === "confirmado")
      .filter(a => {
        const appointmentDate = a.date instanceof Date ? a.date : new Date(a.date);
        const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());

        if (appointmentDay > today) return true;

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
      .slice(0, 3);
    
    return items;
  }, [appointments]);

  return (
    <main className="space-y-6">
      <InstallPWAButton />
      
      <section aria-label="Resumo do dia" className="animate-fade-in">
        <DailyHero />
      </section>

      {/* Indicadores principais - KPIs do Supabase */}
      <section aria-label="Indicadores principais" className="animate-fade-in">
        <KPIGroupCard
          receitaMes={receitaMes}
          metaMes={metaMes}
          progressoMeta={progressoMeta}
          topCategoria={topCategoria}
          novosClientes60d={novosClientes60d}
          valorPrevisto={valorPrevisto}
          isLoading={metricsLoading}
        />
      </section>

      {/* Próximos Agendamentos + Lembretes de Produção */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-5 animate-fade-in">
        <div className="lg:col-span-3">
          <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between py-[6px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-gradient">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="font-semibold text-base">Próximos Agendamentos</CardTitle>
              </div>
              <Link to="/app/agenda">
                <Button variant="ghost" size="sm">Ver todos</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {proximosAgendamentos.length === 0 ? (
                <div className="flex items-center justify-center py-[7px]">
                  <p className="text-lunar-textSecondary text-xs">Nenhum agendamento confirmado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proximosAgendamentos.map(ev => (
                    <div key={ev.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-xs">{ev.cliente}</p>
                          <p className="text-lunar-textSecondary mt-0.5 text-2xs">{ev.tipo}</p>
                        </div>
                        <div className="text-right text-2xs text-lunar-textSecondary">
                          <div>{ev.data.toLocaleDateString("pt-BR")}</div>
                          <div className="mt-0.5">{ev.hora}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
          <ProductionRemindersCard lembretes={lembretesProducao} />
        </div>
      </section>

      {/* Critical Cards */}
      <section className="grid gap-6 animate-fade-in auto-rows-auto lg:auto-rows-fr grid-cols-1 lg:grid-cols-2">
        <div className="h-full"><FinancialRemindersCard /></div>
        <div className="h-full"><HighPriorityDueSoonCard /></div>
      </section>
    </main>
  );
}
