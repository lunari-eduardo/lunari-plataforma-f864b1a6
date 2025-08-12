import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle } from "lucide-react";
import useTodayOverview from "@/hooks/useTodayOverview";

export default function DailyKPIs() {
  const { sessionsToday, tasksToday } = useTodayOverview();

  const Item = ({ icon, title, value, hint }: { icon: React.ReactNode; title: string; value: string; hint: string }) => (
    <Card className="rounded-lg ring-1 ring-lunar-accent/20">
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xs text-lunar-textSecondary">{title}</p>
            <p className="mt-1 text-xl font-semibold text-lunar-text">{value}</p>
            <p className="mt-1 text-2xs text-lunar-textSecondary">{hint}</p>
          </div>
          <div className="h-9 w-9 rounded-md bg-lunar-surface ring-1 ring-lunar-border flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Item
        icon={<Calendar className="h-4 w-4 text-lunar-accent" />}
        title="Sessões Hoje"
        value={`${sessionsToday}`}
        hint={sessionsToday === 1 ? "1 sessão agendada hoje" : `${sessionsToday} sessões agendadas hoje`}
      />
      <Item
        icon={<CheckCircle className="h-4 w-4 text-lunar-accent" />}
        title="Tarefas para Hoje"
        value={`${tasksToday}`}
        hint={tasksToday === 1 ? "1 tarefa vence hoje" : `${tasksToday} tarefas vencem hoje`}
      />
    </div>
  );
}
