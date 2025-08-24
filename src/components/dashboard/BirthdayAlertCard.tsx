import { Cake } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBirthdayAlert } from "@/hooks/useBirthdayAlert";
import { useAppContext } from "@/contexts/AppContext";

export function BirthdayAlertCard() {
  const { clientes } = useAppContext();
  const { totalAniversariantes, mesAtual, nomesMeses } = useBirthdayAlert(clientes);

  // Only render if there are birthdays
  if (totalAniversariantes === 0) {
    return null;
  }

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Cake className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-semibold text-base">Aniversariantes</CardTitle>
        </div>
        <Badge variant="outline" className="text-2xs">
          {totalAniversariantes} {totalAniversariantes === 1 ? 'pessoa' : 'pessoas'}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Cake className="h-8 w-8 text-amber-500 mb-3" />
          <p className="text-sm font-medium text-lunar-text">
            {totalAniversariantes} aniversariante{totalAniversariantes !== 1 ? 's' : ''} este mês
          </p>
          <p className="text-2xs text-lunar-textSecondary mt-1">
            {nomesMeses[mesAtual - 1]} - Entre em contato e parabenize!
          </p>
        </div>
        
        <Link to="/clientes?openBirthdays=true" className="block">
          <Button variant="outline" className="w-full text-sm">
            Ver Aniversariantes
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}