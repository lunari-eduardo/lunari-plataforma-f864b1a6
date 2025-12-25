import { Bell, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReminderItem {
  id: string;
  cliente: string;
  produto: string;
  tipo: string;
  quantidade?: number;
  dataSessao?: string;
  mesAno?: string;
}

interface ProductionRemindersCardProps {
  lembretes: ReminderItem[];
}

export function ProductionRemindersCard({
  lembretes
}: ProductionRemindersCardProps) {
  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-semibold text-base">
            Lembretes de Produção
            {lembretes.length > 0 && (
              <span className="ml-2 text-xs font-normal text-lunar-textSecondary">
                ({lembretes.length})
              </span>
            )}
          </CardTitle>
        </div>
        <Link to="/workflow" className="text-2xs text-lunar-textSecondary underline">
          Ir para Workflow
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {lembretes.length === 0 ? (
          <p className="text-2xs text-lunar-textSecondary">Sem pendências de produção.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
            <TooltipProvider>
              {lembretes.map(r => (
                <Tooltip key={r.id}>
                  <TooltipTrigger asChild>
                    <div className="text-2xs p-2.5 rounded-xl bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300 cursor-help flex items-center justify-between gap-2">
                      <span className="truncate">
                        {r.quantidade && r.quantidade > 1 ? `${r.quantidade}x ` : ''}
                        <span className="font-semibold">{r.produto}</span> de{' '}
                        <span className="font-semibold">{r.cliente}</span>
                      </span>
                      <Info className="h-3 w-3 text-lunar-textSecondary flex-shrink-0" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <p><strong>Produto:</strong> {r.produto}</p>
                      <p><strong>Cliente:</strong> {r.cliente}</p>
                      {r.quantidade && <p><strong>Quantidade:</strong> {r.quantidade}</p>}
                      {r.mesAno && <p><strong>Sessão:</strong> {r.mesAno}</p>}
                      <p><strong>Tipo:</strong> {r.tipo === 'incluso' ? 'Incluso no pacote' : 'Adicionado manualmente'}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}