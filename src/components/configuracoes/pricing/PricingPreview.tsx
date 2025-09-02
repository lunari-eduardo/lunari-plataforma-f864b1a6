/**
 * Component for pricing calculation preview
 * Shows how pricing will be calculated with current settings
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { PricingCalculationService } from '@/services/PricingCalculationService';
import { PricingConfigurationService } from '@/services/PricingConfigurationService';
import { formatarMoeda } from '@/utils/currencyUtils';
import type { TabelaPrecos } from '@/types/pricing';

interface PricingPreviewProps {
  model: 'fixo' | 'global' | 'categoria';
  globalTable: TabelaPrecos | null;
  categorias: Array<{
    id: string;
    nome: string;
    cor: string;
  }>;
}

export function PricingPreview({ model, globalTable, categorias }: PricingPreviewProps) {
  const [previewQuantidade, setPreviewQuantidade] = useState(10);

  const calcularPreview = () => {
    if (model === 'fixo') {
      return 'Depende do valor configurado em cada pacote';
    }

    if (model === 'global' && globalTable) {
      const valorUnitario = PricingCalculationService.calcularValorPorFoto(previewQuantidade, globalTable);
      const total = previewQuantidade * valorUnitario;
      return `${formatarMoeda(valorUnitario)} por foto = ${formatarMoeda(total)} total`;
    }

    if (model === 'categoria') {
      // Show examples for each category that has a table
      const exemplos = categorias
        .map(categoria => {
          const tabela = PricingConfigurationService.loadCategoryTable(categoria.id);
          if (!tabela) return null;
          
          const valorUnitario = PricingCalculationService.calcularValorPorFoto(previewQuantidade, tabela);
          const total = previewQuantidade * valorUnitario;
          
          return `${categoria.nome}: ${formatarMoeda(valorUnitario)} por foto = ${formatarMoeda(total)} total`;
        })
        .filter(Boolean);

      if (exemplos.length === 0) {
        return 'Configure pelo menos uma categoria para ver o preview';
      }

      return exemplos.join('\n');
    }

    return 'Configure o modelo para ver o preview';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4" />
          Preview de Cálculo
        </CardTitle>
        <CardDescription>
          Veja como o preço será calculado com o modelo atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label>Quantidade de fotos para teste:</Label>
          <Input
            type="number"
            value={previewQuantidade}
            onChange={(e) => setPreviewQuantidade(parseInt(e.target.value) || 0)}
            className="w-24"
            min="1"
          />
        </div>
        
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm whitespace-pre-line">
            <strong>Resultado:</strong> {calcularPreview()}
          </p>
        </div>

        {/* Important Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600 text-sm">
              Informações Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• A mudança de modelo afeta todos os cálculos FUTUROS no sistema</li>
              <li>• Dados existentes no Workflow mantêm seus valores até serem recalculados</li>
              <li>• Tabelas progressivas permitem descontos por volume</li>
            </ul>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}