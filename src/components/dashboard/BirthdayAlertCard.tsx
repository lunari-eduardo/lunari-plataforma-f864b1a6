import { Cake } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBirthdayAlert } from "@/hooks/useBirthdayAlert";
import { useAppContext } from "@/contexts/AppContext";

export function BirthdayAlertCard() {
  const { clientes } = useAppContext();
  const { totalAniversariantes } = useBirthdayAlert(clientes);

  // Only render if there are birthdays
  if (totalAniversariantes === 0) {
    return null;
  }

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300 animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Cake className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-lunar-text">
              {totalAniversariantes} aniversariante{totalAniversariantes !== 1 ? 's' : ''}
            </span>
          </div>
          <Link to="/app/clientes?openBirthdays=true">
            <Button variant="outline" size="sm" className="text-xs">
              Ver Aniversariantes
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}