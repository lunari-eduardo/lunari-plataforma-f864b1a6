/**
 * Tabela do extrato com dados paginados e otimizados
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { LinhaExtrato, ExtratoPaginacao } from '@/types/extrato';
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
  paginacao?: ExtratoPaginacao & {
    irParaPagina: (p: number) => void;
    proximaPagina: () => void;
    paginaAnterior: () => void;
  };
  isLoading?: boolean;
}

export default function ExtratoTable({ 
  linhas, 
  onAbrirOrigem, 
  dadosExportacao,
  paginacao,
  isLoading
}: ExtratoTableProps) {
  // Calcular range de registros exibidos
  const rangeInicio = paginacao ? ((paginacao.page - 1) * paginacao.pageSize) + 1 : 1;
  const rangeFim = paginacao 
    ? Math.min(paginacao.page * paginacao.pageSize, paginacao.totalCount) 
    : linhas.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              Extrato de Movimentações
            </CardTitle>
            <CardDescription>
              {paginacao 
                ? `${paginacao.totalCount} registros no total`
                : `${linhas.length} registros encontrados`
              }
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <ExportDetalhado dados={dadosExportacao} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[500px] w-full">
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
                  {linhas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum registro encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    linhas.map(linha => {
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
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Controles de Paginação */}
            {paginacao && paginacao.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {rangeInicio} a {rangeFim} de {paginacao.totalCount} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={paginacao.paginaAnterior}
                    disabled={paginacao.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm px-2">
                    Página {paginacao.page} de {paginacao.totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={paginacao.proximaPagina}
                    disabled={paginacao.page === paginacao.totalPages}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
