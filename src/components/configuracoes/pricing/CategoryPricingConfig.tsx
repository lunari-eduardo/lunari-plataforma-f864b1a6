/**
 * Component for managing category-specific pricing tables
 * Displays list of categories and their pricing configuration status
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TabelaPrecosModal from '../TabelaPrecosModal';
import { Loader2 } from 'lucide-react';
import type { TabelaPrecos } from '@/types/pricing';

interface CategoryPricingConfigProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor?: string | null;
  }>;
}

export function CategoryPricingConfig({ categorias }: CategoryPricingConfigProps) {
  const { data: tabelasPorCategoria = {}, isLoading, refetch } = useQuery({
    queryKey: ['category-pricing-tables'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return {};
      const { data, error } = await supabase
        .from('tabelas_precos')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('tipo', 'categoria');

      if (error) {
        console.error('Erro ao buscar tabelas de categoria:', error);
        return {};
      }

      const map: Record<string, TabelaPrecos> = {};
      data?.forEach(t => {
        if (t.categoria_id) {
          map[t.categoria_id] = {
            id: t.id,
            user_id: t.user_id,
            nome: t.nome,
            faixas: Array.isArray(t.faixas) ? (t.faixas as any[]) : [],
            usar_valor_fixo_pacote: t.usar_valor_fixo_pacote ?? false,
            created_at: t.created_at,
            updated_at: t.updated_at
          };
        }
      });
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuração por Categoria</CardTitle>
        <CardDescription>
          Configure tabelas de preços específicas para cada categoria
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Carregando tabelas de categorias...</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {categorias.map(categoria => {
              const tabela = tabelasPorCategoria[categoria.id];
              const temTabela = !!tabela;
              const isFixo = tabela?.usar_valor_fixo_pacote;

              return (
                <div
                  key={categoria.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
                >
                  <div>
                    <span className="text-[13px] font-medium">{categoria.nome}</span>
                    {temTabela && (
                      <div className="mt-0.5 text-[11px] text-[hsl(var(--accent-gold))]">
                        {isFixo ? 'Usa valor fixo do pacote' : 'Tabela progressiva ativa'}
                      </div>
                    )}
                  </div>

                  <TabelaPrecosModal 
                    categoriaId={categoria.id}
                    categoriaNome={categoria.nome}
                    tabelaInicial={tabela}
                    onSaved={() => refetch()}
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
        )}
      </CardContent>
    </Card>
  );
}