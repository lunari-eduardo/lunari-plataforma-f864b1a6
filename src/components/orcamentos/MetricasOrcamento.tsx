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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-neumorphic-text text-base">{metricas.totalMes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Send className="h-3 w-3" />
              Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-blue-600">{metricas.enviados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <CheckCircle className="h-3 w-3" />
              Fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{metricas.fechados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <XCircle className="h-3 w-3" />
              Cancelados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{metricas.cancelados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-yellow-600">{metricas.pendentes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Target className="h-3 w-3" />
              Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-purple-600">{metricas.taxaConversao.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>
    </div>;
}