import { AlertTriangle, CheckCircle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackContextualProps {
  precoFinal: number;
  metaMensal: number;
  lucratividade: number;
  custoHora?: number;
}

export function FeedbackContextual({
  precoFinal,
  metaMensal,
  lucratividade,
  custoHora
}: FeedbackContextualProps) {
  // Calcular quantos serviços são necessários para atingir a meta
  const servicosParaMeta = precoFinal > 0 ? Math.ceil(metaMensal / precoFinal) : 0;
  
  // Determinar status
  const isHealthy = lucratividade >= 30 && servicosParaMeta <= 10;
  const isWarning = lucratividade >= 15 && lucratividade < 30;
  const isCritical = lucratividade < 15;
  const isTooManyServices = servicosParaMeta > 15;

  if (precoFinal <= 0) {
    return (
      <div className="rounded-lg p-3 bg-muted/50 border border-border flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-muted-foreground">
            Configure as horas estimadas para calcular o preço do serviço.
          </p>
        </div>
      </div>
    );
  }

  if (isCritical) {
    return (
      <div className="rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-red-800 dark:text-red-300">
            ⚠️ Lucratividade muito baixa
          </p>
          <p className="text-red-700 dark:text-red-400 mt-1">
            Com {lucratividade.toFixed(1)}% de lucratividade, você pode estar perdendo dinheiro. 
            Considere aumentar o markup ou reduzir custos.
          </p>
        </div>
      </div>
    );
  }

  if (isTooManyServices) {
    return (
      <div className="rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">
            ⚠️ Atenção com a meta
          </p>
          <p className="text-yellow-700 dark:text-yellow-400 mt-1">
            Com esse preço, você precisa de <strong>{servicosParaMeta} serviços/mês</strong> para atingir sua meta. 
            Considere aumentar o valor ou revisar suas metas.
          </p>
        </div>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
        <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            📊 Margem aceitável
          </p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">
            Lucratividade de {lucratividade.toFixed(1)}%. Para atingir sua meta, faça {servicosParaMeta} serviços/mês.
          </p>
        </div>
      </div>
    );
  }

  // isHealthy
  return (
    <div className="rounded-lg p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-green-800 dark:text-green-300">
          ✅ Precificação saudável!
        </p>
        <p className="text-green-700 dark:text-green-400 mt-1">
          Com {lucratividade.toFixed(1)}% de lucro, você precisa de apenas {servicosParaMeta} serviços 
          para atingir sua meta mensal.
        </p>
      </div>
    </div>
  );
}
