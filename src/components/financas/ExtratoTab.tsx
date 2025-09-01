import { useExtrato } from '@/hooks/useExtrato';
import DemonstrativoSimplificado from './DemonstrativoSimplificado';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, AlertCircle, ExternalLink, TrendingUp, Search } from 'lucide-react';
import ExportDetalhado from './ExportDetalhado';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { ExtratoTipo, ExtratoOrigem, ExtratoStatus } from '@/types/extrato';
const ORIGEM_COLORS = {
  workflow: 'bg-blue-500/10 text-blue-700 border-blue-200',
  financeiro: 'bg-purple-500/10 text-purple-700 border-purple-200',
  cartao: 'bg-orange-500/10 text-orange-700 border-orange-200'
};
const STATUS_ICONS = {
  Pago: CheckCircle,
  Faturado: AlertCircle,
  Agendado: Clock
};
const STATUS_COLORS = {
  Pago: 'bg-green-500/10 text-green-700 border-green-200',
  Faturado: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  Agendado: 'bg-gray-500/10 text-gray-700 border-gray-200'
};
export default function ExtratoTab() {
  const {
    linhas,
    resumo,
    demonstrativo,
    filtros,
    atualizarFiltros,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-muted-foreground">
          Visão unificada de todas as movimentações financeiras
        </p>
      </div>

      {/* Filtros */}
      <ExtratoFilters 
        filtros={filtros}
        onFiltrosChange={atualizarFiltros}
        onLimparFiltros={limparFiltros}
      />

      {/* Cards de Resumo */}
      <ExtratoSummaryCards resumo={resumo} />

      {/* Tabs para alternar entre vista detalhada e demonstrativo */}
      <Tabs defaultValue="detalhado" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detalhado" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Vista Detalhada</span>
          </TabsTrigger>
          <TabsTrigger value="demonstrativo" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Demonstrativo</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="detalhado" className="mt-6">
          <ExtratoTable 
            linhas={linhas}
            onAbrirOrigem={abrirOrigem}
            dadosExportacao={prepararDadosExportacao()}
          />
        </TabsContent>
        
        <TabsContent value="demonstrativo" className="mt-6">
          <DemonstrativoSection 
            demonstrativo={demonstrativo} 
            periodo={{
              inicio: filtros.dataInicio,
              fim: filtros.dataFim
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}