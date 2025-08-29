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
import { Clock, CheckCircle, AlertCircle, ExternalLink, FileText, List } from 'lucide-react';
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
    preferencias,
    atualizarFiltros,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  // ============= RENDERIZAÇÃO DE FILTROS SIMPLIFICADOS =============

  const renderFiltros = () => <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-lunar-surface/50 rounded-lg border border-lunar-border/30 py-[2px]">
      <div className="space-y-2">
        
        <Input type="date" value={filtros.dataInicio} onChange={e => atualizarFiltros({
        dataInicio: e.target.value
      })} className="w-40" />
      </div>
      
      <div className="space-y-2">
        
        <Input type="date" value={filtros.dataFim} onChange={e => atualizarFiltros({
        dataFim: e.target.value
      })} className="w-40" />
      </div>

      <div className="space-y-2">
        
        <Select value={filtros.tipo || 'todos'} onValueChange={value => atualizarFiltros({
        tipo: value as ExtratoTipo | 'todos'
      })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" onClick={limparFiltros} className="h-9">
        Limpar Filtros
      </Button>
    </div>;

  // ============= RENDERIZAÇÃO DA TABELA =============

  const renderTabela = () => <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              Extrato de Movimentações
            </CardTitle>
            <CardDescription>
              {linhas.length} registros encontrados
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Exportar */}
            <ExportDetalhado dados={prepararDadosExportacao()} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Categoria/Cliente</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(linha => {
              const StatusIcon = STATUS_ICONS[linha.status];
              return <TableRow key={linha.id} className="hover:bg-muted/50">
                    <TableCell>
                      {formatDateForDisplay(linha.data)}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={linha.tipo === 'entrada' ? 'default' : 'secondary'}>
                        {linha.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="font-medium">
                      {linha.descricao}
                      {linha.observacoes && <div className="text-xs text-muted-foreground mt-1">
                          {linha.observacoes}
                        </div>}
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={ORIGEM_COLORS[linha.origem]}>
                        {linha.origem === 'workflow' ? 'Workflow' : linha.origem === 'financeiro' ? 'Financeiro' : 'Cartão'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {linha.categoria && <div className="text-sm">{linha.categoria}</div>}
                      {linha.cliente && <div className="text-sm font-medium">{linha.cliente}</div>}
                      {linha.projeto && <div className="text-xs text-muted-foreground">{linha.projeto}</div>}
                      {linha.cartao && <div className="text-xs text-orange-600">{linha.cartao}</div>}
                    </TableCell>
                    
                    <TableCell>
                      {linha.parcela && <Badge variant="outline">
                          {linha.parcela.atual}/{linha.parcela.total}
                        </Badge>}
                    </TableCell>
                    
                    <TableCell className={`text-right font-medium ${linha.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {linha.tipo === 'entrada' ? '+' : '-'}{formatCurrency(linha.valor)}
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={STATUS_COLORS[linha.status]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {linha.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-right font-medium">
                      {formatCurrency((linha as any).saldoAcumulado)}
                    </TableCell>
                    
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => abrirOrigem(linha)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>;
            })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>;

  // ============= RENDER PRINCIPAL =============

  return <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        
        <p className="text-muted-foreground py-0 my-0">
          Visão unificada de todas as movimentações financeiras
        </p>
      </div>

      {/* Filtros */}
      {renderFiltros()}

      {/* Tabs para alternar entre vista detalhada e demonstrativo */}
      <Tabs defaultValue="detalhado" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detalhado" className="flex items-center space-x-2">
            <List className="h-4 w-4" />
            <span>Vista Detalhada</span>
          </TabsTrigger>
          <TabsTrigger value="demonstrativo" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Demonstrativo</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="detalhado" className="mt-6">
          {renderTabela()}
        </TabsContent>
        
        <TabsContent value="demonstrativo" className="mt-6">
          <DemonstrativoSimplificado demonstrativo={demonstrativo} periodo={{
          inicio: filtros.dataInicio,
          fim: filtros.dataFim
        }} transactions={[]} />
        </TabsContent>
      </Tabs>
    </div>;
}