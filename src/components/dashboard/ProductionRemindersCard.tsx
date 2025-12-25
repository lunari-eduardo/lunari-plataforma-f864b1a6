import { Bell, Cog } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface ReminderItem {
  id: string;
  cliente: string;
  produto: string;
  tipo: string;
}
interface ProductionRemindersCardProps {
  lembretes: ReminderItem[];
}
export function ProductionRemindersCard({
  lembretes
}: ProductionRemindersCardProps) {
  return <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-semibold text-base">Lembretes de Produção</CardTitle>
        </div>
        <Link to="/workflow" className="text-2xs text-lunar-textSecondary underline">
          Ir para Workflow
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {lembretes.length === 0 ? (
          <p className="text-2xs text-lunar-textSecondary">Sem pendências de produção.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {lembretes.map(r => (
              <div key={r.id} className="text-xs p-3 rounded-xl bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300">
                <span className="font-semibold">{r.produto}</span> de <span className="font-semibold">{r.cliente}</span> ainda não foi para produção!
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>;
}