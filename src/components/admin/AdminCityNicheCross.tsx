import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Grid3X3 } from 'lucide-react';
import type { FaturamentoPorCidadeNicho } from '@/types/admin-analytics';

interface AdminCityNicheCrossProps {
  data: FaturamentoPorCidadeNicho[];
}

export function AdminCityNicheCross({ data }: AdminCityNicheCrossProps) {
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
          <Grid3X3 className="h-4 w-4" />
          Concentração Regional por Nicho
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível para o período selecionado
          </p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cidade</TableHead>
                  <TableHead className="text-xs">UF</TableHead>
                  <TableHead className="text-xs">Nicho</TableHead>
                  <TableHead className="text-xs text-right">Faturamento</TableHead>
                  <TableHead className="text-xs text-right">Usuários</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 20).map((item, index) => (
                  <TableRow key={`${item.cidade}-${item.nicho}-${index}`}>
                    <TableCell className="text-sm font-medium">{item.cidade}</TableCell>
                    <TableCell className="text-sm">{item.estado}</TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted">
                        {item.nicho}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(item.faturamento_total)}
                    </TableCell>
                    <TableCell className="text-sm text-right">{item.total_usuarios}</TableCell>
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
