
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, Camera } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { KPIGroupCard } from "@/components/dashboard/KPIGroupCard";
import { ProductionRemindersCard } from "@/components/dashboard/ProductionRemindersCard";
import { HighPriorityDueSoonCard } from "@/components/tarefas/HighPriorityDueSoonCard";
import { ReceitaPrevistaCard } from "@/components/dashboard/ReceitaPrevistaCard";
import { FinancialRemindersCard } from "@/components/dashboard/FinancialRemindersCard";
import DailyHero from "@/components/dashboard/DailyHero";
import DailyKPIs from "@/components/dashboard/DailyKPIs";
import FollowUpNotificationCard from "@/components/leads/FollowUpNotificationCard";

import { useSalesAnalytics } from "@/hooks/useSalesAnalytics";

import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useAgenda } from "@/hooks/useAgenda";
import { useAvailability } from "@/hooks/useAvailability";
import { useAppContext } from "@/contexts/AppContext";


import { formatDateForStorage, parseDateFromStorage } from "@/utils/dateUtils";
import { normalizeWorkflowItems } from "@/utils/salesDataNormalizer";


export default function Index() {
  // SEO basics
  useEffect(() => {
    const title = "Dashboard de Negócios | Início";
    document.title = title;
    const desc = "Dashboard: receita do mês vs metas, categoria mais rentável, novos clientes, horários livres, orçamentos e próximos agendamentos.";
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
  const { monthlyData, categoryData } = useSalesAnalytics(year, "all");
  const { appointments } = useAgenda();
  const { orcamentos } = useOrcamentos();
  const { availability } = useAvailability();
  const { workflowItemsAll } = useAppContext();
  // Receita do mês atual vs meta
  const currentMonthIndex = new Date().getMonth();
  const currentMonthData = monthlyData.find((m) => m.monthIndex === currentMonthIndex);
  const receitaMes = currentMonthData?.revenue || 0;
  const metaMes = currentMonthData?.goal || 0;
  const progressoMeta = metaMes > 0 ? Math.min(100, (receitaMes / metaMes) * 100) : 0;

  // Categoria mais rentável
  const topCategoria = categoryData[0] || null;

  // Novos clientes nos últimos 60 dias (primeira sessão registrada)
  const novosClientes60d = useMemo(() => {
    const all = normalizeWorkflowItems();
    if (all.length === 0) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    const firstSeen = new Map<string, Date>();
    all.forEach((s) => {
      const key = s.clienteId || s.email || s.whatsapp || s.nome;
      if (!key) return;
      const d = s.date instanceof Date ? s.date : parseDateFromStorage(s.data);
      if (!firstSeen.has(key) || d < (firstSeen.get(key) as Date)) {
        firstSeen.set(key, d);
      }
    });
    let count = 0;
    firstSeen.forEach((d) => {
      if (d >= cutoff) count++;
    });
    return count;
  }, []);

  // Horários livres na semana (próximos 7 dias)
  const { livresSemana, proximoLivre } = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 7);

    const startKey = formatDateForStorage(start);
    const endKey = formatDateForStorage(end);

    const isWithinRange = (iso: string) => iso >= startKey && iso <= endKey;

    const busyMap = new Set<string>();
    appointments.forEach((app) => {
      const d = formatDateForStorage(app.date);
      const key = `${d}T${app.time}`;
      busyMap.add(key); // considera qualquer status como ocupado
    });

    const slots = availability.filter((s) => isWithinRange(s.date));

    const freeSlots = slots.filter((s) => !busyMap.has(`${s.date}T${s.time}`));

    // Encontrar próximo slot livre (>= agora)
    const now = new Date();
    const freeWithDate = freeSlots
      .map((s) => {
        const dt = parseDateFromStorage(s.date);
        const [hh, mm] = s.time.split(":").map(Number);
        dt.setHours(hh, mm, 0, 0);
        return { slot: s, dt };
      })
      .filter(({ dt }) => dt >= now)
      .sort((a, b) => a.dt.getTime() - b.dt.getTime());

    return {
      livresSemana: freeSlots.length,
      proximoLivre: freeWithDate.length > 0 ? freeWithDate[0].dt : null,
    };
  }, [appointments, availability]);

  // Resumo de orçamentos do mês atual
  const resumoOrcamentos = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const desteMes = orcamentos.filter((o) => (o.criadoEm || o.data || "").startsWith(ym));
    const contagem = {
      enviado: 0,
      pendente: 0,
      followup: 0,
      fechado: 0,
      cancelado: 0,
    } as Record<string, number>;

    desteMes.forEach((o) => {
      const st = (o.status || "").toLowerCase();
      if (st === "enviado") contagem.enviado++;
      else if (st === "pendente") contagem.pendente++;
      else if (st === "follow-up" || st === "followup") contagem.followup++;
      else if (st === "fechado") contagem.fechado++;
      else if (st === "cancelado") contagem.cancelado++;
    });

    const base = contagem.enviado + contagem.pendente + contagem.followup;
    const conversao = base > 0 ? (contagem.fechado / base) * 100 : 0;

    return { contagem, conversao };
  }, [orcamentos]);

  // Lembretes de Produção
  const lembretesProducao = useMemo(() => {
    const reminders: Array<{ id: string; cliente: string; produto: string; tipo: string }> = [];
    workflowItemsAll.forEach((item) => {
      (item.produtosList || []).forEach((p) => {
        // Inclusos e manuais geram lembrete até serem marcados como produzidos
        if (!p.produzido) {
          reminders.push({ id: `${item.id}-${p.nome}` , cliente: item.nome, produto: p.nome, tipo: p.tipo });
        }
      });
    });
    return reminders;
  }, [workflowItemsAll]);
  // Próximos agendamentos confirmados (top 5)
  const proximosAgendamentos = useMemo(() => {
    const now = new Date();
    const items = appointments
      .filter((a) => a.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .filter((a) => a.status === "confirmado")
      .map((a) => ({
        id: a.id,
        cliente: a.client,
        tipo: a.type,
        data: a.date,
        hora: a.time,
      }))
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .slice(0, 5);
    return items;
  }, [appointments]);


  return (
    <main className="space-y-6">
    <section aria-label="Resumo do dia" className="animate-fade-in">
      <DailyHero />
    </section>


    {/* KPIs modernizados (mensal) */}
    <section aria-label="Indicadores principais" className="animate-fade-in">
      <KPIGroupCard
        receitaMes={receitaMes}
        metaMes={metaMes}
        progressoMeta={progressoMeta}
        topCategoria={topCategoria}
        novosClientes60d={novosClientes60d}
        livresSemana={livresSemana}
        proximoLivre={proximoLivre}
      />
    </section>

    {/* Receita Prevista do Mês */}
    <section aria-label="Receita prevista" className="animate-fade-in">
      <ReceitaPrevistaCard />
    </section>

    {/* Follow-up Notifications */}
    <section aria-label="Follow-up de leads" className="animate-fade-in">
      <FollowUpNotificationCard />
    </section>

    {/* Financial Critical Reminders */}
    <section aria-label="Contas críticas" className="animate-fade-in">
      <FinancialRemindersCard />
    </section>

      {/* Lembretes de Produção */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProductionRemindersCard lembretes={lembretesProducao} />
      </section>

      {/* Tarefas de alta prioridade (até 5 dias) */}
      <section>
        <HighPriorityDueSoonCard />
      </section>

      {/* Orçamentos e Agenda */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-2 rounded-xl bg-brand-gradient">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg font-semibold">Resumo de Orçamentos (mês)</CardTitle>
            </div>
            <Link to="/orcamentos">
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Enviados: {resumoOrcamentos.contagem.enviado}</Badge>
              <Badge variant="secondary">Pendentes: {resumoOrcamentos.contagem.pendente}</Badge>
              <Badge variant="secondary">Follow-up: {resumoOrcamentos.contagem.followup}</Badge>
              <Badge variant="secondary">Fechados: {resumoOrcamentos.contagem.fechado}</Badge>
              <Badge variant="secondary">Cancelados: {resumoOrcamentos.contagem.cancelado}</Badge>
            </div>
            <p className="text-2xs text-lunar-textSecondary mt-3">Taxa de conversão do mês: {resumoOrcamentos.conversao.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-gradient">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg font-semibold">Próximos Agendamentos</CardTitle>
            </div>
            <Link to="/agenda">
              <Button variant="ghost" size="sm">Ver todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {proximosAgendamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 border border-dashed rounded-md">
                <Calendar className="h-6 w-6 text-lunar-textSecondary mb-2" />
                <p className="text-2xs text-lunar-textSecondary">Nenhum agendamento confirmado futuro</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proximosAgendamentos.map((ev) => (
                  <div key={ev.id} className="border-b pb-3 last:border-b-0 last:pb-0">
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

