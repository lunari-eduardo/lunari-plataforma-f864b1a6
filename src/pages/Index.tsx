
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, Camera, DollarSign, Users, Clock, BarChart3, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HighPriorityDueSoonCard } from "@/components/tarefas/HighPriorityDueSoonCard";

import { useSalesAnalytics } from "@/hooks/useSalesAnalytics";

import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useAgenda } from "@/hooks/useAgenda";
import { useAvailability } from "@/hooks/useAvailability";
import { useAppContext } from "@/contexts/AppContext";

import { formatCurrency } from "@/utils/financialUtils";
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
      <header>
        <h1 className="text-xl font-semibold text-lunar-text">Dashboard de Negócios</h1>
        <p className="text-2xs text-lunar-textSecondary">Visão geral: receita, metas, clientes, horários, orçamentos e agenda.</p>
      </header>

      {/* KPIs */}
      <section aria-label="Indicadores principais" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Receita do mês vs Meta</CardTitle>
            <DollarSign className="h-5 w-5 text-lunar-accent" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-semibold">{formatCurrency(receitaMes)}</p>
              <span className="text-2xs text-lunar-textSecondary">Meta: {formatCurrency(metaMes)}</span>
            </div>
            <div className="mt-2">
              <Progress value={progressoMeta} />
              <span className="text-2xs text-lunar-textSecondary">{progressoMeta.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Categoria mais rentável</CardTitle>
            <BarChart3 className="h-5 w-5 text-lunar-accent" />
          </CardHeader>
          <CardContent>
            {topCategoria ? (
              <div>
                <p className="text-lg font-semibold">{topCategoria.name}</p>
                <p className="text-2xs text-lunar-textSecondary mt-1">Receita: {formatCurrency(topCategoria.revenue)} • {topCategoria.sessions} sessões</p>
              </div>
            ) : (
              <p className="text-2xs text-lunar-textSecondary">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Novos clientes (60 dias)</CardTitle>
            <Users className="h-5 w-5 text-lunar-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{novosClientes60d}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">Primeira sessão registrada nos últimos 60 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Horários livres (7 dias)</CardTitle>
            <Clock className="h-5 w-5 text-lunar-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{livresSemana}</p>
            <p className="text-2xs text-lunar-textSecondary mt-1">
              {proximoLivre ? (
                <>Próximo: {proximoLivre.toLocaleDateString("pt-BR")} • {proximoLivre.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
              ) : (
                <>
                  Sem horários livres. <Link to="/agenda" className="underline">Configurar disponibilidade</Link>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Lembretes de Produção */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-lunar-accent" />
              <CardTitle className="text-base">Lembretes de Produção</CardTitle>
            </div>
            <Link to="/workflow">
              <Button variant="ghost" size="sm">Ir para Workflow</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {lembretesProducao.length === 0 ? (
              <p className="text-2xs text-lunar-textSecondary">Sem pendências de produção.</p>
            ) : (
              <div className="space-y-2">
                {lembretesProducao.slice(0, 8).map((r) => (
                  <div key={r.id} className="text-sm">
                    O <span className="font-medium">{r.produto}</span> de <span className="font-medium">{r.cliente}</span> ainda não foi para produção!
                  </div>
                ))}
                {lembretesProducao.length > 8 && (
                  <p className="text-2xs text-lunar-textSecondary mt-1">+{lembretesProducao.length - 8} lembretes adicionais</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tarefas de alta prioridade (até 5 dias) */}
      <section>
        <HighPriorityDueSoonCard />
      </section>

      {/* Orçamentos e Agenda */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-lunar-accent" />
              <CardTitle className="text-base">Resumo de Orçamentos (mês)</CardTitle>
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

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-lunar-accent" />
              <CardTitle className="text-base">Próximos Agendamentos</CardTitle>
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

