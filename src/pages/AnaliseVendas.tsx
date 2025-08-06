import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Users, Target, BarChart3, Filter, Download } from 'lucide-react';
import { SalesMetricsCards } from '@/components/analise-vendas/SalesMetricsCards';
import { SalesChartsGrid } from '@/components/analise-vendas/SalesChartsGrid';
import { SalesFilterBar } from '@/components/analise-vendas/SalesFilterBar';
export default function AnaliseVendas() {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');
  return <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-lunar-bg p-1 md:p-4 space-y-4 scrollbar-thin scrollbar-thumb-lunar-accent scrollbar-track-lunar-surface">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold text-lunar-text">Análise de Vendas</h1>
          <p className="text-xs text-lunar-textSecondary">
            Acompanhe o desempenho das suas vendas e alcance suas metas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="h-3 w-3 mr-1" />
            Exportar
          </Button>
          
        </div>
      </div>

      {/* Filter Bar */}
      <SalesFilterBar selectedPeriod={selectedPeriod} selectedService={selectedService} selectedClient={selectedClient} onPeriodChange={setSelectedPeriod} onServiceChange={setSelectedService} onClientChange={setSelectedClient} />

      {/* Quick Metrics Cards */}
      <SalesMetricsCards />

      {/* Charts Grid */}
      <SalesChartsGrid />

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-lg bg-lunar-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Top Performances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Melhor Mês</p>
                <p className="text-xs text-lunar-textSecondary">Novembro 2024</p>
              </div>
              <Badge variant="secondary" className="text-2xs">+45%</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Melhor Serviço</p>
                <p className="text-xs text-lunar-textSecondary">Ensaio Casal</p>
              </div>
              <Badge variant="secondary" className="text-2xs">R$ 15.2k</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Cliente Fidelizado</p>
                <p className="text-xs text-lunar-textSecondary">Maria Silva</p>
              </div>
              <Badge variant="secondary" className="text-2xs">5 sessões</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-lunar-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Orçamentos Pendentes</p>
                <p className="text-xs text-lunar-textSecondary">12 em follow-up</p>
              </div>
              <Badge variant="outline" className="text-2xs">R$ 8.5k</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Sazonalidade</p>
                <p className="text-xs text-lunar-textSecondary">Dezembro promissor</p>
              </div>
              <Badge variant="outline" className="text-2xs">+30%</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
              <div>
                <p className="text-xs font-medium text-lunar-text">Upsell Potencial</p>
                <p className="text-xs text-lunar-textSecondary">Produtos extras</p>
              </div>
              <Badge variant="outline" className="text-2xs">R$ 3.2k</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
}