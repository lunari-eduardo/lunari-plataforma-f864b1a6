import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  MoreVertical,
  Droplets,
  Zap,
  FileText,
  Home,
  Wifi,
  Receipt,
  Building2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useFinancialDashboardData } from "@/hooks/useFinancialDashboardData";

/**
 * Card "Contas a Pagar" — visual do mockup.
 * Reutiliza useFinancialDashboardData (contas atrasadas + próximas).
 */
function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("água") || n.includes("agua")) return Droplets;
  if (n.includes("energ") || n.includes("luz")) return Zap;
  if (n.includes("das") || n.includes("imposto") || n.includes("mei")) return FileText;
  if (n.includes("alug") || n.includes("condom") || n.includes("cond.")) return Home;
  if (n.includes("internet") || n.includes("wifi") || n.includes("net")) return Wifi;
  if (n.includes("banco") || n.includes("fatura")) return Building2;
  return Receipt;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function formatVenc(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `Venc. em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

export function ContasAPagarCard() {
  const { upcomingAccounts, overdueAccounts } = useFinancialDashboardData();

  const items = [...overdueAccounts, ...upcomingAccounts].slice(0, 5);
  const totalOpen = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-card-subtle transition-shadow duration-300 hover:shadow-card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            Contas a Pagar
          </CardTitle>
          {items.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhuma conta pendente
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Suas finanças estão em dia
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-end justify-between gap-3 rounded-xl bg-primary/[0.06] p-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">
                  Total em aberto
                </div>
                <div className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
                  {formatBRL(totalOpen)}
                </div>
              </div>
              <Link to="/app/financas">
                <Button size="sm" className="shrink-0">
                  Ver todas
                </Button>
              </Link>
            </div>

            <ul className="space-y-1">
              {items.map((it) => {
                const Icon = iconFor(it.itemName);
                const isOverdue = it.daysUntilDue < 0;
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isOverdue
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {it.itemName}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {formatVenc(it.dueDate)}
                    </div>
                    <div
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        isOverdue ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {formatBRL(it.amount)}
                    </div>
                    <button
                      type="button"
                      aria-label="Mais opções"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
