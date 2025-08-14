import { AlertTriangle } from "lucide-react";
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

export function ProductionRemindersCard({ lembretes }: ProductionRemindersCardProps) {
  return (
    <Card className="lg:col-span-3 rounded-2xl border-0 shadow-brand hover:shadow-brand-hover transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient shadow-brand">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-lg font-semibold">Lembretes de Produção</CardTitle>
        </div>
        <Link to="/workflow" className="text-2xs text-lunar-textSecondary underline">
          Ir para Workflow
        </Link>
      </CardHeader>
      <CardContent>
        {lembretes.length === 0 ? (
          <p className="text-2xs text-lunar-textSecondary">Sem pendências de produção.</p>
        ) : (
          <div className="space-y-2">
            {lembretes.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-sm p-3 rounded-xl bg-card-gradient shadow-card hover:shadow-card-hover transition-shadow duration-300">
                <div className="p-1.5 rounded-lg bg-brand-gradient shadow-brand">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-semibold">{r.produto}</span> de <span className="font-semibold">{r.cliente}</span> ainda não foi para produção!
                </div>
              </div>
            ))}
            {lembretes.length > 8 && (
              <p className="text-2xs text-lunar-textSecondary mt-1">+{lembretes.length - 8} lembretes adicionais</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
