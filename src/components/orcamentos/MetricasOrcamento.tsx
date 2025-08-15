import { useState, useMemo } from 'react';
import { Eye, EyeOff, TrendingUp, Send, CheckCircle, XCircle, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrcamentos } from '@/hooks/useOrcamentos';

interface MetricasOrcamentoProps {
  selectedMonth: Date;
}
export default function MetricasOrcamento({
  selectedMonth
}: MetricasOrcamentoProps) {
  const [mostrarMetricas, setMostrarMetricas] = useState(true);
  const { orcamentos } = useOrcamentos();
  
  // Calcular métricas dinamicamente com base no mês selecionado
  const metricas = useMemo(() => {
    const mesSelected = selectedMonth.getMonth() + 1; // getMonth() retorna 0-11
    const anoSelected = selectedMonth.getFullYear();

    // Filtrar orçamentos do mês selecionado
    const orcamentosMes = orcamentos.filter(orc => {
      const [anoOrc, mesOrc] = orc.criadoEm.split('-').map(Number);
      return mesOrc === mesSelected && anoOrc === anoSelected;
    });

    const enviados = orcamentosMes.filter(o => o.status === 'enviado').length;
    const fechados = orcamentosMes.filter(o => o.status === 'fechado').length;
    const cancelados = orcamentosMes.filter(o => o.status === 'cancelado').length;
    const pendentes = orcamentosMes.filter(o => o.status === 'pendente').length;
    
    // Calcular taxa de conversão correta: fechados / (fechados + cancelados)
    const totalDecididos = fechados + cancelados;
    const taxaConversao = totalDecididos > 0 ? (fechados / totalDecididos) * 100 : 0;

    return {
      totalMes: orcamentosMes.length,
      enviados,
      fechados,
      cancelados,
      pendentes,
      taxaConversao
    };
  }, [orcamentos, selectedMonth]);
  if (!mostrarMetricas) {
    return <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => setMostrarMetricas(true)} className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Mostrar métricas
        </Button>
      </div>;
  }
  return <div className="mb-6 py-0">
      <div className="flex justify-between items-center mb-4 py-0 my-[5px]">
        <h2 className="font-medium text-neumorphic-text text-sm">Métricas do Mês</h2>
        <Button variant="ghost" size="sm" onClick={() => setMostrarMetricas(false)} className="flex items-center gap-2">
          <EyeOff className="h-4 w-4" />
          Ocultar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-lunar-text" />
              <span className="text-xs text-lunar-textSecondary">Total:</span>
              <span className="font-semibold text-lunar-text">{metricas.totalMes}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Send className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-lunar-textSecondary">Enviados:</span>
              <span className="font-semibold text-blue-600">{metricas.enviados}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span className="text-xs text-lunar-textSecondary">Fechados:</span>
              <span className="font-semibold text-green-600">{metricas.fechados}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <XCircle className="h-3 w-3 text-red-600" />
              <span className="text-xs text-lunar-textSecondary">Cancelados:</span>
              <span className="font-semibold text-red-600">{metricas.cancelados}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-yellow-600" />
              <span className="text-xs text-lunar-textSecondary">Pendentes:</span>
              <span className="font-semibold text-yellow-600">{metricas.pendentes}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-purple-600" />
              <span className="text-xs text-lunar-textSecondary">Conversão:</span>
              <span className="font-semibold text-purple-600">{metricas.taxaConversao.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
}