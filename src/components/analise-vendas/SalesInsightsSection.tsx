import { TrendingUp, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function SalesInsightsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Performances */}
      <div className="bg-lunar-surface/50 rounded-xl p-4 border border-lunar-border/30">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-lunar-text">Top Performances</h3>
        </div>
        
        <div className="space-y-0.5">
          <InsightItem 
            title="Melhor Mês" 
            subtitle="Novembro 2024" 
            value="+45%" 
            variant="secondary"
          />
          <InsightItem 
            title="Melhor Serviço" 
            subtitle="Ensaio Casal" 
            value="R$ 15.2k" 
            variant="secondary"
          />
          <InsightItem 
            title="Cliente Fidelizado" 
            subtitle="Maria Silva" 
            value="5 sessões" 
            variant="secondary"
          />
        </div>
      </div>

      {/* Oportunidades */}
      <div className="bg-lunar-surface/50 rounded-xl p-4 border border-lunar-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-lunar-text">Oportunidades</h3>
        </div>
        
        <div className="space-y-0.5">
          <InsightItem 
            title="Orçamentos Pendentes" 
            subtitle="12 em follow-up" 
            value="R$ 8.5k" 
            variant="outline"
          />
          <InsightItem 
            title="Sazonalidade" 
            subtitle="Dezembro promissor" 
            value="+30%" 
            variant="outline"
          />
          <InsightItem 
            title="Upsell Potencial" 
            subtitle="Produtos extras" 
            value="R$ 3.2k" 
            variant="outline"
          />
        </div>
      </div>
    </div>
  );
}

interface InsightItemProps {
  title: string;
  subtitle: string;
  value: string;
  variant: 'secondary' | 'outline';
}

function InsightItem({ title, subtitle, value, variant }: InsightItemProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-lunar-border/20 last:border-0">
      <div>
        <p className="text-xs font-medium text-lunar-text">{title}</p>
        <p className="text-2xs text-lunar-textSecondary">{subtitle}</p>
      </div>
      <Badge variant={variant} className="text-2xs">
        {value}
      </Badge>
    </div>
  );
}
