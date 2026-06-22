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
import { useAppointmentsRangeQuery } from "@/modules/agenda";
import { format, addDays } from "date-fns";
import { useProductionReminders } from "@/hooks/useProductionReminders";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { KPIGroupCard } from "@/components/dashboard/KPIGroupCard";

export default function Index() {
  // SEO basics
  useEffect(() => {
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

  // Próximos 60 dias é suficiente para o card "Próximos Agendamentos"
  const today = useMemo(() => new Date(), []);
  const rangeStart = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const rangeEnd = useMemo(() => format(addDays(today, 60), "yyyy-MM-dd"), [today]);
  const { data: appointments = [] } = useAppointmentsRangeQuery({
    start: rangeStart,
    end: rangeEnd,
  });
  const lembretesProducao = useProductionReminders();
  
  const {
    receitaMes,
    valorPrevisto,
    metaMes,
    progressoMeta,
    topCategoria,
    novosClientes60d,
    isLoading: metricsLoading
  } = useDashboardMetrics();

  const proximosAgendamentos = useMemo(() => {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");

    const items = appointments
      .filter(a => a.status === "confirmado")
      .filter(a => {
        // a.date é ISO yyyy-MM-dd no domínio
        if (a.date > todayKey) return true;
        if (a.date === todayKey) {
          const [hh, mm] = a.time.split(":").map(Number);
          const [yy, mo, dd] = a.date.split("-").map(Number);
          const appointmentDateTime = new Date(yy, mo - 1, dd, hh || 0, mm || 0);
          return appointmentDateTime >= now;
        }
        return false;
      })
      .map(a => {
        const [yy, mo, dd] = a.date.split("-").map(Number);
        return {
          id: a.id,
          cliente: a.client,
          tipo: a.type,
          data: new Date(yy, mo - 1, dd),
          hora: a.time,
        };
      })
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .slice(0, 3);
    
    return items;
  }, [appointments]);

  return (
    <>
      <main className="space-y-6 relative z-10">
        <InstallPWAButton />
        
        <section aria-label="Resumo do dia" className="animate-fade-in">
          <DailyHero />
        </section>

        {/* Próximos Agendamentos + Lembretes de Produção */}
        <section className="grid gap-6 grid-cols-1 lg:grid-cols-5 animate-fade-in">
          <div className="lg:col-span-3">
            <Card className="rounded-2xl h-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between py-[6px]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-gradient">
                    <Calendar className="h-5 w-5 text-primary-foreground" />
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
                    <p className="text-muted-foreground text-xs">Nenhum agendamento confirmado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {proximosAgendamentos.map(ev => (
                      <div key={ev.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-xs">{ev.cliente}</p>
                            <p className="text-muted-foreground mt-0.5 text-2xs">{ev.tipo}</p>
                          </div>
                          <div className="text-right text-2xs text-muted-foreground">
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

        {/* Indicadores principais */}
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
      </main>
    </>
  );
}
