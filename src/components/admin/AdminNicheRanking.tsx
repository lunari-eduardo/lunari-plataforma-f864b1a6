import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tags } from 'lucide-react';
import type { FaturamentoPorNicho } from '@/types/admin-analytics';

interface AdminNicheRankingProps {
  data: FaturamentoPorNicho[];
}

export function AdminNicheRanking({ data }: AdminNicheRankingProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4" />
          Ranking de Nichos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível para o período selecionado
          </p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nicho</TableHead>
                  <TableHead className="text-xs text-right">Faturamento</TableHead>
                  <TableHead className="text-xs text-right">Usuários</TableHead>
                  <TableHead className="text-xs text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={item.nicho}>
                    <TableCell className="text-sm font-medium">
                      <span className="text-muted-foreground mr-2">#{index + 1}</span>
                      {item.nicho}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(item.faturamento_total)}
                    </TableCell>
                    <TableCell className="text-sm text-right">{item.total_usuarios}</TableCell>
                    <TableCell className="text-sm text-right">
                      {formatCurrency(item.ticket_medio)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
