import { Label } from "@/components/ui/label";

interface Totais {
  inclusos: number;
  manuais: number;
  geral: number;
}

interface Props {
  totais: Totais;
  formatCurrency: (v: number | undefined | null) => string;
}

export function ProdutosFinancialSummary({ totais, formatCurrency }: Props) {
  return (
    <div className="border-t pt-4 space-y-3">
      <Label className="text-sm font-medium">Resumo Financeiro</Label>
      <div className="space-y-2 text-sm">
        {totais.inclusos > 0 && (
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Produtos inclusos no pacote:</span>
            <span>{formatCurrency(totais.inclusos)}</span>
          </div>
        )}
        {totais.manuais > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs">Produtos adicionais:</span>
            <span className="font-medium text-green-600">{formatCurrency(totais.manuais)}</span>
          </div>
        )}
        {totais.inclusos > 0 && totais.manuais > 0 && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Total geral dos produtos:</span>
            <span className="text-lg font-bold text-green-600">{formatCurrency(totais.geral)}</span>
          </div>
        )}
        {totais.manuais === 0 && totais.inclusos > 0 && (
          <div className="flex justify-between items-center">
            <span>Valor adicional a pagar:</span>
            <span className="text-lg font-bold text-green-600">R$ 0,00</span>
          </div>
        )}
        {totais.manuais > 0 && totais.inclusos === 0 && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Total a pagar:</span>
            <span className="text-lg font-bold text-green-600">{formatCurrency(totais.manuais)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        *Produtos inclusos no pacote já estão contabilizados no pacote
      </p>
    </div>
  );
}
