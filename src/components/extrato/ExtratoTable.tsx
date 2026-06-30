/**
 * Tabela do extrato com dados paginados e otimizados
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Info } from 'lucide-react';
import { LinhaExtrato, ExtratoPaginacao } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import ExportDetalhado from '@/components/financas/ExportDetalhado';
import { 
  ORIGEM_COLORS, 
  STATUS_COLORS, 
  TIPO_LABELS,
  TIPO_BADGE_COLORS,
  ORIGEM_LABELS,
  MEIO_PAGAMENTO_LABELS
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
  regime?: 'caixa' | 'competencia';
}

export default function ExtratoTable({ 
  linhas, 
  onAbrirOrigem, 
  dadosExportacao,
  paginacao,
  isLoading,
  regime = 'caixa'
}: ExtratoTableProps) {
  const rangeInicio = paginacao ? ((paginacao.page - 1) * paginacao.pageSize) + 1 : 1;
  const rangeFim = paginacao 
    ? Math.min(paginacao.page * paginacao.pageSize, paginacao.totalCount) 
    : linhas.length;

  // Calcular range de datas da página atual (linhas vêm ordenadas DESC por data)
  const dataMaisRecente = linhas.length > 0 ? linhas[0].data : null;
  const dataMaisAntiga = linhas.length > 0 ? linhas[linhas.length - 1].data : null;
  const temMaisPaginas = paginacao && paginacao.totalPages > 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">Extrato de Movimentações</CardTitle>
            <CardDescription className="text-[11px] mt-0.5">
              {paginacao
                ? `${paginacao.totalCount} movimentações`
                : `${linhas.length} registros`
              }
              {temMaisPaginas && dataMaisAntiga && dataMaisRecente && (
                <>
                  <span className="mx-1">·</span>
                  <span>pág. {paginacao!.page}/{paginacao!.totalPages}</span>
                  <span className="mx-1">·</span>
                  <span>{formatDateForDisplay(dataMaisAntiga)} → {formatDateForDisplay(dataMaisRecente)}</span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs">
              <span className="text-muted-foreground">Visão:</span>
              <span className="font-semibold text-primary">
                {regime === 'competencia' ? 'Competência' : 'Caixa'}
              </span>
            </div>
            <ExportDetalhado dados={dadosExportacao} regime={regime} />
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
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhum registro encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    linhas.map(linha => {
                      const StatusIcon = STATUS_ICONS[linha.status];
                      const dataAlt = regime === 'caixa'
                        ? (linha.dataCompetencia && linha.dataCompetencia !== linha.data ? linha.dataCompetencia : null)
                        : (linha.dataCaixa && linha.dataCaixa !== linha.data ? linha.dataCaixa : null);
                      const dataAltLabel = regime === 'caixa' ? 'ref.' : 'pago';
                      return (
                        <TableRow key={linha.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div>{formatDateForDisplay(linha.data)}</div>
                            {dataAlt && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {dataAltLabel} {formatDateForDisplay(dataAlt)}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={TIPO_BADGE_COLORS[linha.tipo]} variant="outline">
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
                            {linha.meioPagamento && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {MEIO_PAGAMENTO_LABELS[linha.meioPagamento] || linha.meioPagamento}
                              </div>
                            )}
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

            {paginacao && paginacao.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4 flex-wrap gap-3">
                <div className="text-sm text-muted-foreground">
                  Mostrando <strong className="text-foreground">{rangeInicio}</strong> a <strong className="text-foreground">{rangeFim}</strong> de <strong className="text-foreground">{paginacao.totalCount}</strong> registros
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => paginacao.irParaPagina(1)}
                    disabled={paginacao.page === 1}
                    title="Primeira página"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={paginacao.paginaAnterior}
                    disabled={paginacao.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm font-medium px-3 py-1.5 rounded-md bg-muted">
                    Página {paginacao.page} de {paginacao.totalPages}
                  </span>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={paginacao.proximaPagina}
                    disabled={paginacao.page === paginacao.totalPages}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => paginacao.irParaPagina(paginacao.totalPages)}
                    disabled={paginacao.page === paginacao.totalPages}
                    title="Última página"
                  >
                    <ChevronsRight className="h-4 w-4" />
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
