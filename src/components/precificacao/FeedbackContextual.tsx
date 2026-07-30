import { AlertTriangle, CheckCircle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackContextualProps {
  precoFinal: number;
  metaMensal: number;
  lucratividade: number;
  custoHora?: number;
}

type Tone = 'neutral' | 'critical' | 'warning' | 'healthy';

const TONE: Record<Tone, { wrap: string; icon: string }> = {
  neutral: {
    wrap: 'bg-muted/30 text-muted-foreground',
    icon: 'text-muted-foreground',
  },
  critical: {
    wrap: 'bg-destructive/10 text-foreground',
    icon: 'text-destructive',
  },
  warning: {
    wrap: 'bg-[hsl(var(--accent-gold))]/10 text-foreground',
    icon: 'text-[hsl(var(--accent-gold))]',
  },
  healthy: {
    wrap: 'bg-muted/30 text-foreground',
    icon: 'text-[hsl(var(--accent-gold))]',
  },
};

export function FeedbackContextual({
  precoFinal,
  metaMensal,
  lucratividade,
}: FeedbackContextualProps) {
  const servicosParaMeta = precoFinal > 0 ? Math.ceil(metaMensal / precoFinal) : 0;

  const isWarning = lucratividade >= 15 && lucratividade < 30;
  const isCritical = lucratividade < 15;
  const isTooManyServices = servicosParaMeta > 15;

  let tone: Tone = 'healthy';
  let Icon = CheckCircle;
  let title = 'Precificação saudável';
  let body = `Com ${lucratividade.toFixed(1)}% de lucro, bastam ${servicosParaMeta} serviços para atingir a meta mensal.`;

  if (precoFinal <= 0) {
    tone = 'neutral';
    Icon = Info;
    title = '';
    body = 'Configure as horas estimadas para calcular o preço do serviço.';
  } else if (isCritical) {
    tone = 'critical';
    Icon = AlertTriangle;
    title = 'Lucratividade muito baixa';
    body = `Com ${lucratividade.toFixed(1)}% de lucratividade você pode estar perdendo dinheiro. Aumente o markup ou reduza custos.`;
  } else if (isTooManyServices) {
    tone = 'warning';
    Icon = AlertTriangle;
    title = 'Atenção com a meta';
    body = `Nesse preço, são necessários ${servicosParaMeta} serviços/mês para atingir a meta. Considere aumentar o valor.`;
  } else if (isWarning) {
    tone = 'warning';
    Icon = TrendingUp;
    title = 'Margem aceitável';
    body = `Lucratividade de ${lucratividade.toFixed(1)}%. Para atingir a meta, faça ${servicosParaMeta} serviços/mês.`;
  }

  const styles = TONE[tone];

  return (
    <div className={cn('flex items-start gap-2 rounded-md px-3 py-2.5', styles.wrap)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} />
      <div className="text-[12px] leading-relaxed">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <p className={cn(title && 'mt-0.5', 'text-muted-foreground')}>{body}</p>
      </div>
    </div>
  );
}
