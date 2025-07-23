
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoriaFinanceira, TipoCategoria } from '@/types/financas';
import { Plus, Trash2, X, Check } from 'lucide-react';

interface GerenciarCategoriasProps {
  categoriasPorTipo: Record<TipoCategoria, CategoriaFinanceira[]>;
  onAdicionarCategoria: (categoria: Omit<CategoriaFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  onRemoverCategoria: (categoriaId: string) => void;
}

const tiposCategoria: { valor: TipoCategoria; label: string; cor: string }[] = [
  { valor: 'despesa_fixa', label: 'Despesas Fixas', cor: '#ef4444' },
  { valor: 'despesa_variavel', label: 'Despesas Variáveis', cor: '#f59e0b' },
  { valor: 'investimento', label: 'Investimentos', cor: '#8b5cf6' },
  { valor: 'receita_nao_operacional', label: 'Receitas Não Operacionais', cor: '#10b981' },
  { valor: 'equipamento', label: 'Equipamentos', cor: '#6b7280' },
  { valor: 'marketing', label: 'Marketing', cor: '#ec4899' },
  { valor: 'acervo', label: 'Acervo', cor: '#14b8a6' }
];

export default function GerenciarCategorias({ 
  categoriasPorTipo, 
  onAdicionarCategoria,
  onRemoverCategoria 
}: GerenciarCategoriasProps) {
  const [novaCategoria, setNovaCategoria] = useState({
    nome: '',
    tipo: 'despesa_fixa' as TipoCategoria,
    cor: '#ef4444'
  });
  const [adicionandoSubcategoria, setAdicionandoSubcategoria] = useState<string | null>(null);
  const [nomeSubcategoria, setNomeSubcategoria] = useState('');

  const handleAdicionarCategoria = () => {
    if (!novaCategoria.nome.trim()) return;

    onAdicionarCategoria({
      nome: novaCategoria.nome,
      tipo: novaCategoria.tipo,
      cor: novaCategoria.cor,
      ativo: true,
      subcategorias: []
    });

    setNovaCategoria({
      nome: '',
      tipo: 'despesa_fixa',
      cor: '#ef4444'
    });
  };

  const handleTipoChange = (tipo: TipoCategoria) => {
    const tipoInfo = tiposCategoria.find(t => t.valor === tipo);
    setNovaCategoria({
      ...novaCategoria,
      tipo,
      cor: tipoInfo?.cor || '#ef4444'
    });
  };

  return (
    <div className="space-y-6">
      {/* Formulário para Nova Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
              <Input
                value={novaCategoria.nome}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, nome: e.target.value })}
                placeholder="Nome da categoria"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <Select value={novaCategoria.tipo} onValueChange={handleTipoChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposCategoria.map(tipo => (
                    <SelectItem key={tipo.valor} value={tipo.valor}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdicionarCategoria} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Categorias por Tipo */}
      {tiposCategoria.map(tipoInfo => {
        const categorias = categoriasPorTipo[tipoInfo.valor] || [];
        
        return (
          <Card key={tipoInfo.valor}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: tipoInfo.cor }}
                  />
                  {tipoInfo.label}
                </CardTitle>
                <span className="text-sm text-gray-500">
                  {categorias.reduce((total, cat) => total + (cat.subcategorias?.length || 0), 0)} subcategorias
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {categorias.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma subcategoria cadastrada
                </p>
              ) : (
                <div className="space-y-4">
                  {categorias.map(categoria => (
                    <div key={categoria.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: categoria.cor }}
                          />
                          <h4 className="font-medium text-gray-900">{categoria.nome}</h4>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoverCategoria(categoria.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Subcategorias */}
                      <div className="space-y-2">
                        {categoria.subcategorias?.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                            <span className="text-sm text-gray-700">{sub.nome}</span>
                          </div>
                        ))}
                        
                        {/* Formulário para adicionar subcategoria */}
                        {adicionandoSubcategoria === categoria.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              value={nomeSubcategoria}
                              onChange={(e) => setNomeSubcategoria(e.target.value)}
                              placeholder="Nome da subcategoria"
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (nomeSubcategoria.trim()) {
                                  // Note: This would need to be implemented in the parent component
                                  // onAdicionarSubcategoria(categoria.id, nomeSubcategoria);
                                  setNomeSubcategoria('');
                                  setAdicionandoSubcategoria(null);
                                }
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setNomeSubcategoria('');
                                setAdicionandoSubcategoria(null);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAdicionandoSubcategoria(categoria.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar subcategoria
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
