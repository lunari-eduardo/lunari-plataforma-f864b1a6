import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { useLeadLossReasons } from '@/hooks/useLeadLossReasons';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#6b7280', // gray for "sem motivo"
];

export function LeadLossReasonsChart() {
  const { lossReasonStats, totalLostLeads, leadsWithoutReason, hasData } = useLeadLossReasons();

  if (!hasData) {
    return (
      <Card className="border-0 shadow-lg bg-lunar-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Motivos de Leads Perdidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingDown className="h-8 w-8 text-lunar-textSecondary mb-2" />
            <p className="text-sm text-lunar-textSecondary">
              Nenhum lead perdido encontrado
            </p>
            <p className="text-xs text-lunar-textSecondary mt-1">
              Dados aparecerão quando houver leads marcados como perdidos
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = lossReasonStats.filter(stat => stat.count > 0);

  return (
    <Card className="border-0 shadow-lg bg-lunar-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          Motivos de Leads Perdidos
          <Badge variant="outline" className="text-2xs ml-auto">
            {totalLostLeads} perdidos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Warning for missing reasons */}
          {leadsWithoutReason > 0 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {leadsWithoutReason} leads sem motivo informado
              </p>
            </div>
          )}

          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props) => [
                    `${value} leads (${props.payload?.percentage}%)`,
                    props.payload?.label
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--lunar-surface))',
                    border: '1px solid hsl(var(--lunar-border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats List */}
          <div className="space-y-2">
            {chartData.map((stat, index) => (
              <div key={stat.id} className="flex items-center justify-between p-2 bg-lunar-bg rounded-md">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs font-medium text-lunar-text">
                    {stat.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-2xs">
                    {stat.count}
                  </Badge>
                  <span className="text-xs text-lunar-textSecondary">
                    {stat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}