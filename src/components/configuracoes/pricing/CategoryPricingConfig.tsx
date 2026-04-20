/**
 * Component for managing category-specific pricing tables
 * Displays list of categories and their pricing configuration status
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingConfigurationService } from '@/services/PricingConfigurationService';
import TabelaPrecosModal from '../TabelaPrecosModal';

interface CategoryPricingConfigProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor?: string | null;
  }>;
}

export function CategoryPricingConfig({ categorias }: CategoryPricingConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuração por Categoria</CardTitle>
        <CardDescription>
          Configure tabelas de preços específicas para cada categoria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {categorias.map(categoria => {
            const temTabela = PricingConfigurationService.loadCategoryTable(categoria.id) !== null;
            
            return (
              <div key={categoria.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{categoria.nome}</span>
                  {temTabela && (
                    <div className="text-xs text-green-600 mt-1">
                      ✓ Tabela configurada
                    </div>
                  )}
                </div>
                <TabelaPrecosModal 
                  categoriaId={categoria.id}
                  categoriaNome={categoria.nome}
                />
              </div>
            );
          })}
          
          {categorias.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma categoria cadastrada. Configure as categorias primeiro.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}