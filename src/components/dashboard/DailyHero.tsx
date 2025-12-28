import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Sunset, Moon, Calendar, CheckCircle, Cake } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import useTodayOverview from "@/hooks/useTodayOverview";
import { useIsTablet } from "@/hooks/useIsTablet";
import { useBirthdayAlert } from "@/hooks/useBirthdayAlert";
import { useAppContext } from "@/contexts/AppContext";
import { AniversariantesModal } from "@/components/crm/AniversariantesModal";

function getGreeting(): { label: string; Icon: React.ComponentType<any> } {
  const h = new Date().getHours();
  if (h < 12) return { label: "Bom dia", Icon: Sun };
  if (h < 18) return { label: "Boa tarde", Icon: Sunset };
  return { label: "Boa noite", Icon: Moon };
}

export default function DailyHero() {
  const { profile } = useUserProfile();
  const name = profile?.nome?.split(" ")[0] || "";
  const { sessionsToday, tasksToday, nextAppointment } = useTodayOverview();
  const { label, Icon } = getGreeting();
  const isTablet = useIsTablet();
  const { clientes } = useAppContext();
  const { totalAniversariantes } = useBirthdayAlert(clientes);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
  const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });
  const now = new Date();
  const weekday = weekdayFmt.format(now);
  const dayMonth = dayFmt.format(now);

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 overflow-hidden">
      <div className="relative">
        {/* decorative accents */}
        <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.12]" />
        <CardContent className={`relative ${isTablet ? 'py-4 px-6' : 'py-6 px-6 md:px-8'}`}>
          {isTablet ? (
            // Layout compacto para tablets
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-brand-gradient">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-lunar-text">
                    {label}{name ? `, ${name}` : ''}
                  </h1>
                  <p className="text-2xs text-lunar-textSecondary">
                    {weekday}, {dayMonth}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle px-2 py-1 text-2xs">
                    <Calendar className="mr-1 h-3 w-3 text-lunar-accent" />
                    {sessionsToday}
                  </Badge>
                  <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle px-2 py-1 text-2xs">
                    <CheckCircle className="mr-1 h-3 w-3 text-lunar-success" />
                    {tasksToday}
                  </Badge>
                  {totalAniversariantes > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle px-2 py-1 text-2xs cursor-pointer hover:shadow-theme transition-shadow duration-300"
                      onClick={() => setShowBirthdayModal(true)}
                    >
                      <Cake className="mr-1 h-3 w-3 text-lunar-warning" />
                      {totalAniversariantes}
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Link to="/app/agenda"><Button size="sm" variant="secondary" className="text-2xs px-3">Agenda</Button></Link>
                  <Link to="/app/tarefas"><Button size="sm" variant="ghost" className="text-2xs px-3">Tarefas</Button></Link>
                </div>
                
                <div className="text-right">
                  <span className="text-2xs text-lunar-textSecondary">Próximo</span>
                  <div className="text-sm font-medium text-lunar-text">
                    {nextAppointment ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(nextAppointment) : '--:--'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Layout original para mobile e desktop
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-gradient">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-lunar-text">
                    {label}
                    {name ? `, ${name}` : ''}
                  </h1>
                </div>
                <p className="mt-1 text-2xs text-lunar-textSecondary">
                  Hoje é {weekday}, {dayMonth}. Vamos fazer um dia incrível!
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300">
                    <Calendar className="mr-2 h-4 w-4 text-lunar-accent" />
                    {sessionsToday} sessão{sessionsToday === 1 ? '' : 's'} hoje
                  </Badge>
                  <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300">
                    <CheckCircle className="mr-2 h-4 w-4 text-lunar-success" />
                    {tasksToday} tarefa{tasksToday === 1 ? '' : 's'} para hoje
                  </Badge>
                  {totalAniversariantes > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme px-3 py-1.5 transition-shadow duration-300 cursor-pointer"
                      onClick={() => setShowBirthdayModal(true)}
                    >
                      <Cake className="mr-2 h-4 w-4 text-lunar-warning" />
                      {totalAniversariantes} aniversariante{totalAniversariantes === 1 ? '' : 's'} próximo{totalAniversariantes === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <Link to="/app/agenda"><Button size="sm" variant="secondary">Abrir Agenda</Button></Link>
                  <Link to="/app/tarefas"><Button size="sm" variant="ghost">Ver Tarefas</Button></Link>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-end gap-1 text-right">
                <span className="text-2xs text-lunar-textSecondary">Próximo compromisso</span>
                <span className="text-sm font-medium text-lunar-text">
                  {nextAppointment ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(nextAppointment) : 'Nenhum hoje'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </div>
      
      <AniversariantesModal 
        open={showBirthdayModal}
        onOpenChange={setShowBirthdayModal}
        clientes={clientes}
      />
    </Card>
  );
}
