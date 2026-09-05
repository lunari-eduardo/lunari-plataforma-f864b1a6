import { Check, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComparisonTableSectionProps {
  comparisonRows: any[];
}

export function ComparisonTableSection({ comparisonRows }: ComparisonTableSectionProps) {
  return (
    <>
      {/* Institutional Buttons */}
      <div className="flex justify-center gap-4 pb-20">
        <Button variant="outline" className="px-6" disabled>
          Conheça o Select
        </Button>
        <Button variant="outline" className="px-6" disabled>
          Conheça o Transfer
        </Button>
      </div>

      {/* Comparison Table */}
      <section className="container max-w-5xl pb-20 space-y-8">
        <h2 className="text-2xl font-bold tracking-tight text-center text-foreground">
          Comparação de Planos
        </h2>
        <div className="overflow-x-auto rounded-2xl border shadow-sm bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-6 py-4 font-medium text-muted-foreground w-1/4">
                  Recurso
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Select Avulso</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Studio Pro + Select
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  <div className="flex items-center justify-center gap-2">
                    Studio Pro + Select + Transfer
                    <Badge className="text-[10px]">Completo</Badge>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn('border-b last:border-0', i % 2 === 0 && 'bg-muted/10')}
                >
                  <td className="px-6 py-4 font-medium text-foreground">{row.label}</td>
                  {(['avulso', 'pro', 'full'] as const).map((col) => {
                    const val = row[col];
                    return (
                      <td key={col} className="px-6 py-4 text-center">
                        {val === true ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : val === false ? (
                          <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className="text-foreground">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
