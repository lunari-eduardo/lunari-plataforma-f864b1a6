import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useSupportHost } from "../../SupportHostProvider";
import { SUPPORT_ROUTES } from "../../config";
import { STATUS_LABEL } from "../../utils/labels";
import { useAdminTickets } from "../../hooks/useAdminTickets";
import type { TicketStatus, TicketCategory } from "../../types";

interface KpiResult {
  label: string;
  value: number;
  href: string;
}

const KPI_DEFS: Array<{ label: string; status?: TicketStatus[]; categoria?: TicketCategory[]; query?: string }> = [
  { label: "Novos", status: ["novo"] },
  { label: "Em análise", status: ["em_analise"] },
  { label: "Aguardando cliente", status: ["aguardando_cliente"] },
  { label: "Problemas técnicos", status: ["novo", "recebido", "em_analise"], categoria: ["problema_tecnico"] },
  { label: "Sugestões", categoria: ["sugestao"] },
  { label: "Resolvidos", status: ["resolvido", "resolvido_whatsapp"] },
  { label: "Fechados", status: ["fechado"] },
];

export default function AdminDashboardPage() {
  const host = useSupportHost();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KpiResult[]>([]);

  useEffect(() => {
    if (!host.isAdmin) return;
    let cancelled = false;
    (async () => {
      const results: KpiResult[] = [];
      for (const def of KPI_DEFS) {
        let q = host.supabase.from("support_tickets").select("id", { count: "exact", head: true });
        if (def.status?.length) q = q.in("status", def.status as any);
        if (def.categoria?.length) q = q.in("categoria", def.categoria as any);
        const { count } = await q;
        const params = new URLSearchParams();
        if (def.status?.length) params.set("status", def.status.join(","));
        if (def.categoria?.length) params.set("categoria", def.categoria.join(","));
        results.push({
          label: def.label,
          value: count ?? 0,
          href: `${SUPPORT_ROUTES.admin.tickets}?${params.toString()}`,
        });
      }
      if (!cancelled) setKpis(results);
    })();
    return () => { cancelled = true; };
  }, [host]);

  const { rows: latest } = useAdminTickets({ limit: 5 });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold text-foreground">Central de Suporte — Admin</h1>
        <p className="text-xs text-muted-foreground">Painel de chamados e base de conhecimento.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="cursor-pointer transition hover:border-primary/50"
            onClick={() => navigate(k.href)}
          >
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Últimos chamados</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Assunto</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(SUPPORT_ROUTES.admin.ticket(t.id))}
                  className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-mono text-xs">#{String(t.numero).padStart(4, "0")}</td>
                  <td className="px-3 py-2">{t.assunto}</td>
                  <td className="px-3 py-2 text-xs">{STATUS_LABEL[t.status]}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(t.last_message_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
