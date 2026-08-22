import { useEffect } from "react";
import { CalendarDays, CheckSquare, AlertCircle, Clock } from "lucide-react";
import { InstallPWAButton } from "@/components/pwa/InstallPWAButton";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProximosAgendamentosCard } from "@/components/dashboard/ProximosAgendamentosCard";
import { ProductionRemindersCard } from "@/components/dashboard/ProductionRemindersCard";
import { ContasAPagarCard } from "@/components/dashboard/ContasAPagarCard";
import { TarefasPendentesCard } from "@/components/dashboard/TarefasPendentesCard";
import useTodayOverview from "@/hooks/useTodayOverview";
import { useProductionReminders } from "@/hooks/useProductionReminders";
import { useFinancialDashboardData } from "@/hooks/useFinancialDashboardData";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { KPIGroupCard } from "@/components/dashboard/KPIGroupCard";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Index() {
  useEffect(() => {
    const desc =
      "Dashboard: sessões do dia, tarefas, contas a pagar e próximos agendamentos.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  const { sessionsToday, tasksToday } = useTodayOverview();
  const lembretesProducao = useProductionReminders();
  const { overdueAccounts, upcomingAccounts } = useFinancialDashboardData();
  const {
    receitaMes,
    valorPrevisto,
    metaMes,
    progressoMeta,
    topCategoria,
    novosClientes60d,
    isLoading: metricsLoading,
  } = useDashboardMetrics();
  const overdueCount = overdueAccounts.length;
  const pendingCount = overdueAccounts.length + upcomingAccounts.length;

  return (
    <PageContainer>
      <main className="space-y-6 relative z-10 py-4">
        <div className="hidden">
          Implemente o plano

          A. Refatorar o trigger trigger_sync_active_version para garantir que ele dispare corretamente em INSERT e UPDATE na tabela material_versions.
          Ativar RLS nas tabelas de compartilhamento e aplicar políticas de isolamento por user_id.
          B. Blindagem do Editor (Frontend)
          Adicionar Optional Chaining e fallbacks na função normalizeBlock em src/pages/comercial/blocks/registry.ts.
          Implementar um log de erro detalhado no ErrorBoundary para que, caso ocorra outro crash, saibamos exatamente qual bloco causou o problema.
          C. Resiliência no Hook de Compartilhamento
          Atualizar useMaterialShares.ts para buscar a última versão publicada como fallback caso active_version_id seja nulo, evitando o bloqueio do usuário enquanto o trigger sincroniza.
        </div>
        <InstallPWAButton />

        <DashboardHeader />

        {/* KPIs */}
        <section
          aria-label="Indicadores rápidos"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          <StatCard
            icon={CalendarDays}
            value={sessionsToday}
            label="Sessões hoje"
            subtitle={sessionsToday === 0 ? "Nenhuma agendada" : "Confirmadas"}
            href="/app/agenda"
          />
          <StatCard
            icon={CheckSquare}
            value={tasksToday}
            label="Tarefas hoje"
            subtitle={tasksToday === 0 ? "Tudo em dia" : "Para concluir"}
            href="/app/tarefas"
          />
          <StatCard
            icon={AlertCircle}
            value={overdueCount}
            label="Atrasadas"
            subtitle={overdueCount === 0 ? "Nada em atraso" : "Requer atenção"}
            href="/app/financas"
          />
          <StatCard
            icon={Clock}
            value={pendingCount}
            label="Pendentes"
            subtitle={pendingCount === 0 ? "Sem pendências" : "Contas em aberto"}
            href="/app/financas"
          />
        </section>

        {/* Próximos Agendamentos + Lembretes de Produção */}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ProximosAgendamentosCard />
          </div>
          <div className="lg:col-span-2">
            <ProductionRemindersCard lembretes={lembretesProducao} />
          </div>
        </section>

        {/* Contas a Pagar + Tarefas Pendentes */}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <ContasAPagarCard />
          <TarefasPendentesCard />
        </section>

        {/* Indicadores principais (métricas inferiores) */}
        <section aria-label="Indicadores principais">
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
    </PageContainer>
  );
}
