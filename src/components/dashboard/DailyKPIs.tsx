import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle } from "lucide-react";
import useTodayOverview from "@/hooks/useTodayOverview";

export default function DailyKPIs() {
  const { sessionsToday, tasksToday } = useTodayOverview();

  const Item = ({ icon, title, value, hint }: { icon: React.ReactNode; title: string; value: string; hint: string }) => (
    <Card className="rounded-2xl border-0 shadow-brand hover:shadow-brand-hover transition-all duration-300">
      <CardContent className="py-5 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-lunar-textSecondary font-medium">{title}</p>
            <p className="mt-2 text-2xl font-bold text-lunar-text">{value}</p>
            <p className="mt-2 text-xs text-lunar-textSecondary">{hint}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-brand-gradient shadow-brand flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Item
        icon={<Calendar className="h-5 w-5 text-white" />}
        title="Sessões Hoje"
        value={`${sessionsToday}`}
        hint={sessionsToday === 1 ? "1 sessão agendada hoje" : `${sessionsToday} sessões agendadas hoje`}
      />
      <Item
        icon={<CheckCircle className="h-5 w-5 text-white" />}
        title="Tarefas para Hoje"
        value={`${tasksToday}`}
        hint={tasksToday === 1 ? "1 tarefa vence hoje" : `${tasksToday} tarefas vencem hoje`}
      />
    </div>
  );
}
