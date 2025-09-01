/**
 * Tabela do extrato com dados paginados e otimizados
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { LinhaExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import ExportDetalhado from '@/components/financas/ExportDetalhado';
import { 
  ORIGEM_COLORS, 
  STATUS_COLORS, 
  TIPO_LABELS,
  ORIGEM_LABELS
} from '@/constants/extratoConstants';

const STATUS_ICONS = {
  Pago: CheckCircle,
  Faturado: AlertCircle,
  Agendado: Clock
};

interface ExtratoTableProps {
  linhas: LinhaExtrato[];
  onAbrirOrigem: (linha: LinhaExtrato) => void;
  dadosExportacao: any;
}

export default function ExtratoTable({ 
  linhas, 
  onAbrirOrigem, 
  dadosExportacao 
}: ExtratoTableProps) {
  return (
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
            <ExportDetalhado dados={dadosExportacao} />
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
                return (
                  <TableRow key={linha.id} className="hover:bg-muted/50">
                    <TableCell>
                      {formatDateForDisplay(linha.data)}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={linha.tipo === 'entrada' ? 'default' : 'secondary'}>
                        {TIPO_LABELS[linha.tipo]}
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
                        {ORIGEM_LABELS[linha.origem]}
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
                      <Button variant="ghost" size="sm" onClick={() => onAbrirOrigem(linha)}>
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
}