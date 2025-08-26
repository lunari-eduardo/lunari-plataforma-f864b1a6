import { useState } from 'react';
import { useExtrato } from '@/hooks/useExtrato';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Download, 
  Filter, 
  Search, 
  ToggleLeft, 
  ToggleRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
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
    filtros,
    preferencias,
    atualizarFiltros,
    alternarModoData,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);

  // ============= RENDERIZAÇÃO DE CARDS RESUMO =============

  const renderResumoCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Entradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(resumo.totalEntradas)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <TrendingDown className="h-4 w-4 mr-2" />
            Saídas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(resumo.totalSaidas)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <DollarSign className="h-4 w-4 mr-2" />
            Saldo do Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${resumo.saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(resumo.saldoPeriodo)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            % Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {resumo.percentualPago.toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============= RENDERIZAÇÃO DE FILTROS =============

  const renderFiltros = () => (
    <Card className={`mb-6 transition-all duration-300 ${filtrosVisiveis ? 'visible' : 'hidden'}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => atualizarFiltros({ dataInicio: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => atualizarFiltros({ dataFim: e.target.value })}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={filtros.tipo || 'todos'} onValueChange={(value) => atualizarFiltros({ tipo: value as ExtratoTipo | 'todos' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Origem */}
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={filtros.origem || 'todos'} onValueChange={(value) => atualizarFiltros({ origem: value as ExtratoOrigem | 'todos' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filtros.status || 'todos'} onValueChange={(value) => atualizarFiltros({ status: value as ExtratoStatus | 'todos' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Faturado">Faturado</SelectItem>
                <SelectItem value="Agendado">Agendado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              placeholder="Filtrar por cliente..."
              value={filtros.cliente || ''}
              onChange={(e) => atualizarFiltros({ cliente: e.target.value })}
            />
          </div>

          {/* Busca Geral */}
          <div className="space-y-2">
            <Label>Busca Geral</Label>
            <Input
              placeholder="Buscar..."
              value={filtros.busca || ''}
              onChange={(e) => atualizarFiltros({ busca: e.target.value })}
            />
          </div>

          {/* Botão Limpar */}
          <div className="flex items-end">
            <Button variant="outline" onClick={limparFiltros} className="w-full">
              Limpar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ============= RENDERIZAÇÃO DA TABELA =============

  const renderTabela = () => (
    <Card>
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
            {/* Toggle Modo Data */}
            <Button
              variant="outline"
              size="sm"
              onClick={alternarModoData}
              className="flex items-center space-x-2"
            >
              {preferencias.modoData === 'caixa' ? (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  <span>Caixa</span>
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4" />
                  <span>Competência</span>
                </>
              )}
            </Button>

            {/* Exportar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const dados = prepararDadosExportacao();
                console.log('Dados para exportação:', dados);
                // TODO: Implementar exportação CSV/PDF
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
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
              {linhas.map((linha) => {
                const StatusIcon = STATUS_ICONS[linha.status];
                
                return (
                  <TableRow key={linha.id} className="hover:bg-muted/50">
                    <TableCell>
                      {new Date(linha.data).toLocaleDateString('pt-BR')}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={linha.tipo === 'entrada' ? 'default' : 'secondary'}>
                        {linha.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="font-medium">
                      {linha.descricao}
                      {linha.observacoes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {linha.observacoes}
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={ORIGEM_COLORS[linha.origem]}>
                        {linha.origem === 'workflow' ? 'Workflow' : 
                         linha.origem === 'financeiro' ? 'Financeiro' : 'Cartão'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {linha.categoria && (
                        <div className="text-sm">{linha.categoria}</div>
                      )}
                      {linha.cliente && (
                        <div className="text-sm font-medium">{linha.cliente}</div>
                      )}
                      {linha.projeto && (
                        <div className="text-xs text-muted-foreground">{linha.projeto}</div>
                      )}
                      {linha.cartao && (
                        <div className="text-xs text-orange-600">{linha.cartao}</div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {linha.parcela && (
                        <Badge variant="outline">
                          {linha.parcela.atual}/{linha.parcela.total}
                        </Badge>
                      )}
                    </TableCell>
                    
                    <TableCell className={`text-right font-medium ${
                      linha.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                    }`}>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirOrigem(linha)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // ============= RENDER PRINCIPAL =============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extrato Financeiro</h2>
          <p className="text-muted-foreground">
            Visão unificada de todas as movimentações financeiras
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setFiltrosVisiveis(!filtrosVisiveis)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Resumo */}
      {renderResumoCards()}

      {/* Filtros */}
      {renderFiltros()}

      {/* Tabela */}
      {renderTabela()}
    </div>
  );
}