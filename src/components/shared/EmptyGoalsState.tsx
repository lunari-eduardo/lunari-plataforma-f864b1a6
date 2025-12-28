import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmptyGoalsStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyGoalsState({ 
  title = "Metas não configuradas",
  description = "Configure suas metas de faturamento e lucro para acompanhar o progresso",
  className = ""
}: EmptyGoalsStateProps) {
  const navigate = useNavigate();

  const handleConfigure = () => {
    navigate('/app/precificacao');
  };

  return (
    <Card className={`rounded-lg ring-1 ring-lunar-border/60 shadow-brand bg-lunar-surface ${className}`}>
      <CardContent className="p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Target className="h-6 w-6 text-blue-500" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-lunar-text">{title}</h3>
            <p className="text-xs text-lunar-textSecondary max-w-sm">
              {description}
            </p>
          </div>
          
          <Button 
            onClick={handleConfigure}
            size="sm"
            className="mt-2"
          >
            <Settings className="h-3 w-3 mr-2" />
            Configurar Metas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}