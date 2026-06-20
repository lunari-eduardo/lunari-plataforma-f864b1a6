import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CreditCard,
  TrendingUp,
  LifeBuoy,
  HardDrive,
  Sparkles,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Metrics {
  totalUsers: number;
  newUsers30d: number;
  activeSubs: number;
  overdueSubs: number;
  canceledSubs: number;
  mrrCents: number;
  openTickets: number;
  galleriesTotal: number;
  creditRevenueMonthCents: number;
}

interface RecentUser {
  user_id: string;
  email: string | null;
  nome: string | null;
  created_at: string;
}

interface RecentTicket {
  id: string;
  assunto: string;
  status: string;
  priority: string;
  created_at: string;
}

interface OverdueCharge {
  id: string;
  descricao: string | null;
  valor: number;
  created_at: string | null;
}

function formatCentsBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-blue-400",
  };
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}
          </div>
          <Icon className={`h-4 w-4 mt-1 ${tones[tone]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [overdueCharges, setOverdueCharges] = useState<OverdueCharge[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        usersCount,
        newUsers,
        subsActive,
        subsOverdue,
        subsCanceled,
        subsActiveFull,
        openTicketsRes,
        storageRes,
        creditRevenueRes,
        recentUsersRes,
        recentTicketsRes,
        overdueRes,
        plansRes,
      ] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("subscriptions_asaas").select("user_id", { count: "exact", head: true }).eq("status", "ACTIVE"),
        supabase.from("subscriptions_asaas").select("user_id", { count: "exact", head: true }).eq("status", "OVERDUE"),
        supabase.from("subscriptions_asaas").select("user_id", { count: "exact", head: true }).eq("status", "CANCELED"),
        supabase.from("subscriptions_asaas").select("plan_type, billing_cycle").eq("status", "ACTIVE"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["novo", "recebido", "em_analise", "aguardando_cliente"]),
        supabase.from("photographer_accounts").select("galleries_published_total"),
        supabase.from("credit_purchases").select("price_cents").not("paid_at", "is", null).gte("paid_at", monthStart),
        supabase
          .from("profiles")
          .select("user_id, email, nome, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("support_tickets")
          .select("id, assunto, status, priority, created_at")
          .in("status", ["novo", "recebido", "em_analise", "aguardando_cliente"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("cobrancas")
          .select("id, descricao, valor, created_at")
          .eq("status", "OVERDUE")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("unified_plans").select("code, monthly_price_cents, yearly_price_cents"),
      ]);

      // MRR estimado: soma do preço mensal dos planos ativos.
      // Para assinaturas anuais, divide o preço anual por 12.
      const planMap = new Map(
        ((plansRes.data as any[]) || []).map((p) => [p.code, p])
      );
      const mrrCents = ((subsActiveFull.data as any[]) || []).reduce((sum: number, s: any) => {
        const plan: any = planMap.get(s.plan_type);
        if (!plan) return sum;
        if (s.billing_cycle === "YEARLY") {
          return sum + Math.round((plan.yearly_price_cents || 0) / 12);
        }
        return sum + (plan.monthly_price_cents || 0);
      }, 0);

      const galleriesTotal = ((storageRes.data as any[]) || []).reduce(
        (sum: number, a: any) => sum + Number((a as any).galleries_published_total || 0),
        0
      );

      const creditRevenue = ((creditRevenueRes.data as any[]) || []).reduce(
        (sum: number, c: any) => sum + Number((c as any).price_cents || 0),
        0
      );

      setMetrics({
        totalUsers: usersCount.count || 0,
        newUsers30d: newUsers.count || 0,
        activeSubs: subsActive.count || 0,
        overdueSubs: subsOverdue.count || 0,
        canceledSubs: subsCanceled.count || 0,
        mrrCents,
        openTickets: openTicketsRes.count || 0,
        galleriesTotal,
        creditRevenueMonthCents: creditRevenue,
      });

      setRecentUsers((recentUsersRes.data as any[]) || []);
      setRecentTickets((recentTicketsRes.data as any[]) || []);
      setOverdueCharges((overdueRes.data as any[]) || []);
    } catch (err) {
      console.error("Erro ao carregar dashboard admin:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !metrics) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da plataforma</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label="Usuários"
          value={metrics.totalUsers}
          hint={`+${metrics.newUsers30d} nos últimos 30 dias`}
        />
        <KpiCard
          icon={TrendingUp}
          label="MRR estimado"
          value={formatCentsBRL(metrics.mrrCents)}
          hint="Receita recorrente mensal"
          tone="success"
        />
        <KpiCard
          icon={CreditCard}
          label="Assinaturas ativas"
          value={metrics.activeSubs}
          hint={`${metrics.overdueSubs} vencidas · ${metrics.canceledSubs} canceladas`}
          tone="info"
        />
        <KpiCard
          icon={LifeBuoy}
          label="Chamados abertos"
          value={metrics.openTickets}
          hint="Aberto + Em andamento"
          tone={metrics.openTickets > 0 ? "warning" : "default"}
        />
        <KpiCard
          icon={HardDrive}
          label="Storage usado"
          value={formatBytes(metrics.storageBytes)}
          hint="Total de todos os fotógrafos"
        />
        <KpiCard
          icon={Sparkles}
          label="Créditos vendidos (mês)"
          value={formatCentsBRL(metrics.creditRevenueMonthCents)}
          hint="Compras avulsas de créditos Select"
          tone="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Assinaturas vencidas"
          value={metrics.overdueSubs}
          tone={metrics.overdueSubs > 0 ? "danger" : "default"}
        />
        <KpiCard
          icon={UserPlus}
          label="Novos cadastros 30d"
          value={metrics.newUsers30d}
          tone="info"
        />
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Últimos cadastros</h2>
              <Link to="/usuarios" className="text-xs text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="space-y-2">
              {recentUsers.length === 0 && (
                <li className="text-xs text-muted-foreground">Nenhum cadastro recente</li>
              )}
              {recentUsers.map((u) => (
                <li key={u.user_id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.nome || u.email || "Sem nome"}</p>
                    <p className="text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(u.created_at), "dd/MM", { locale: ptBR })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Chamados abertos</h2>
              <Link to="/suporte/chamados" className="text-xs text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="space-y-2">
              {recentTickets.length === 0 && (
                <li className="text-xs text-muted-foreground">Nenhum chamado aberto</li>
              )}
              {recentTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <Link to={`/suporte/chamados/${t.id}`} className="min-w-0 hover:underline">
                    <p className="font-medium truncate">{t.assunto}</p>
                    <p className="text-muted-foreground truncate capitalize">
                      {t.status.replace("_", " ")} · {t.priority}
                    </p>
                  </Link>
                  <Badge variant="outline" className="text-[10px]">
                    {format(new Date(t.created_at), "dd/MM", { locale: ptBR })}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Cobranças vencidas</h2>
            </div>
            <ul className="space-y-2">
              {overdueCharges.length === 0 && (
                <li className="text-xs text-muted-foreground">Nenhuma cobrança vencida</li>
              )}
              {overdueCharges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.descricao || "Cobrança"}</p>
                    <p className="text-muted-foreground">
                      {c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </p>
                  </div>
                  <span className="text-red-400 font-medium whitespace-nowrap">
                    {formatCentsBRL(Math.round(Number(c.valor) * 100))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
