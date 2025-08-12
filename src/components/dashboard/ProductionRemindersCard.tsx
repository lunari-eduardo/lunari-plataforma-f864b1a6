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
    <Card className="lg:col-span-3 rounded-lg animate-fade-in">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lunar-warning/20 ring-1 ring-lunar-warning/30">
            <AlertTriangle className="h-4 w-4 text-lunar-warning" />
          </span>
          <CardTitle className="text-base">Lembretes de Produção</CardTitle>
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
              <div key={r.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-lunar-error/15 ring-1 ring-lunar-error/30">
                  <AlertTriangle className="h-4 w-4 text-lunar-error" />
                </span>
                <div>
                  <span className="font-medium">{r.produto}</span> de <span className="font-medium">{r.cliente}</span> ainda não foi para produção!
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
