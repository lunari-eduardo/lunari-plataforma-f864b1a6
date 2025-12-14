import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { obterConfiguracaoPrecificacao } from '@/utils/precificacaoUtils';
import { ProductSearchCombobox } from '@/components/ui/product-search-combobox';
import { Badge } from '@/components/ui/badge';
import { X, Plus, ChevronUp } from 'lucide-react';
import { useNumberInput } from '@/hooks/useNumberInput';
import { 
  Categoria, 
  Produto, 
  ProdutoIncluido, 
  PacoteFormData,
  PacoteFormProps
} from '@/types/configuration';

export default function PacoteForm({
  initialData,
  categorias,
  produtos,
  onSubmit,
  onCancel,
  submitLabel = "Criar Pacote",
  isEditing = false
}: PacoteFormProps) {
  const [formData, setFormData] = useState<PacoteFormData>({
    nome: initialData?.nome || '',
    categoria_id: initialData?.categoria_id || '',
    valor_base: initialData?.valor_base || 0,
    valor_foto_extra: initialData?.valor_foto_extra || 0,
    produtosIncluidos: initialData?.produtosIncluidos || []
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [produtosExpanded, setProdutosExpanded] = useState(
    (initialData?.produtosIncluidos?.length || 0) > 0
  );
  
  // Verificar modelo de precificação atual
  const configPrecificacao = obterConfiguracaoPrecificacao();
  const isFixedPricing = configPrecificacao.modelo === 'fixo';

  // Hooks para inputs numéricos com auto-seleção
  const valorBaseInput = useNumberInput({
    value: formData.valor_base,
    onChange: (value) => {
      setFormData(prev => ({ ...prev, valor_base: parseFloat(value) || 0 }));
      if (errors.valor_base) {
        setErrors(prev => ({ ...prev, valor_base: '' }));
      }
    }
  });

  const valorFotoExtraInput = useNumberInput({
    value: formData.valor_foto_extra,
    onChange: (value) => setFormData(prev => ({ ...prev, valor_foto_extra: parseFloat(value) || 0 }))
  });

  const handleSubmit = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.categoria_id) {
      newErrors.categoria_id = 'Categoria é obrigatória';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    
    if (!isEditing) {
      setFormData({
        nome: '',
        categoria_id: '',
        valor_base: 0,
        valor_foto_extra: 0,
        produtosIncluidos: []
      });
      setErrors({});
      setProdutosExpanded(false);
    }
  };

  const adicionarProduto = (produto: Produto | null) => {
    if (!produto) return;
    
    const produtoExistente = formData.produtosIncluidos.find(p => p.produtoId === produto.id);
    if (produtoExistente) return; // Evita duplicatas
    
    const novosProdutos = [...formData.produtosIncluidos, { produtoId: produto.id, quantidade: 1 }];
    setFormData(prev => ({ ...prev, produtosIncluidos: novosProdutos }));
  };

  const removerProdutoIncluido = (produtoId: string) => {
    setFormData(prev => ({
      ...prev,
      produtosIncluidos: prev.produtosIncluidos.filter(p => p.produtoId !== produtoId)
    }));
  };

  const produtosDisponiveis = produtos.filter(
    produto => !formData.produtosIncluidos.some(p => p.produtoId === produto.id)
  );

  const getProdutoNome = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.nome || 'Produto não encontrado';
  };

  const getProdutoPreco = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.preco_venda || 0;
  };

  const hasProdutos = formData.produtosIncluidos.length > 0;

  return (
    <div className="space-y-4">
      {/* Bloco 1 — Identidade do Pacote (Destaque Principal) */}
      <div className="bg-card/50 border-l-4 border-l-primary rounded-lg p-3">
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          {/* Nome do Pacote - Input largo com foco automático */}
          <div className="space-y-1">
            <Label htmlFor="nome" className="text-2xs font-medium text-muted-foreground">
              Nome do Pacote
            </Label>
            <Input
              id="nome"
              autoFocus
              value={formData.nome}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, nome: e.target.value }));
                if (errors.nome) {
                  setErrors(prev => ({ ...prev, nome: '' }));
                }
              }}
              placeholder="Ex: Ensaio Gestante Essencial"
              className={cn(
                "h-10 text-base font-medium transition-colors",
                errors.nome && "border-destructive focus:border-destructive"
              )}
            />
            {errors.nome && (
              <span className="text-2xs text-destructive">{errors.nome}</span>
            )}
          </div>

          {/* Categoria - Dropdown compacto ao lado */}
          <div className="space-y-1">
            <Label className="text-2xs font-medium text-muted-foreground">Categoria</Label>
            <Select 
              value={formData.categoria_id} 
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, categoria_id: value }));
                if (errors.categoria_id) {
                  setErrors(prev => ({ ...prev, categoria_id: '' }));
                }
              }}
            >
              <SelectTrigger className={cn(
                "h-10 text-sm",
                errors.categoria_id && "border-destructive"
              )}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(categoria => (
                  <SelectItem key={categoria.id} value={categoria.id} className="text-sm">
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria_id && (
              <span className="text-2xs text-destructive">{errors.categoria_id}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bloco 2 — Precificação (Compacto, Funcional) */}
      <div className="flex flex-wrap gap-3">
        {/* Valor Base */}
        <div className="flex-1 min-w-[140px] max-w-[180px]">
          <Label htmlFor="valor_base" className="text-2xs font-medium text-muted-foreground mb-1 block">
            Valor Base
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              id="valor_base"
              type="number"
              step="0.01"
              min="0"
              value={valorBaseInput.displayValue}
              onChange={valorBaseInput.handleChange}
              onFocus={valorBaseInput.handleFocus}
              placeholder="0,00"
              className={cn(
                "h-8 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                errors.valor_base && "border-destructive focus:border-destructive"
              )}
            />
          </div>
        </div>

        {/* Valor Foto Extra */}
        <div className="flex-1 min-w-[140px] max-w-[180px]">
          <Label htmlFor="valor_foto_extra" className="text-2xs font-medium text-muted-foreground mb-1 block">
            Foto Extra
          </Label>
          {isFixedPricing ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                R$
              </span>
              <Input
                id="valor_foto_extra"
                type="number"
                step="0.01"
                min="0"
                value={valorFotoExtraInput.displayValue}
                onChange={valorFotoExtraInput.handleChange}
                onFocus={valorFotoExtraInput.handleFocus}
                placeholder="0,00"
                className="h-8 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ) : (
            <div className="h-8 flex items-center text-xs text-muted-foreground px-3 bg-muted/50 rounded-md border">
              {configPrecificacao.modelo === 'global' ? 'Tabela Global' : 'Por Categoria'}
            </div>
          )}
        </div>
      </div>

      {/* Bloco 3 — Produtos Incluídos (Expansível, Colapso Inteligente) */}
      {!hasProdutos && !produtosExpanded ? (
        // Estado vazio: apenas botão
        <button 
          type="button"
          onClick={() => setProdutosExpanded(true)}
          className="w-full h-8 flex items-center justify-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-md hover:border-primary/50 hover:text-foreground transition-colors bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produtos ao pacote
        </button>
      ) : (
        // Expandido ou com produtos: mostra busca + lista
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
          <div className="flex items-center justify-between">
            <Label className="text-2xs font-medium text-muted-foreground">
              Produtos Incluídos {hasProdutos && `(${formData.produtosIncluidos.length})`}
            </Label>
            {!hasProdutos && (
              <button 
                type="button"
                onClick={() => setProdutosExpanded(false)}
                className="h-5 px-2 text-2xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ChevronUp className="h-3 w-3" />
                Fechar
              </button>
            )}
          </div>
          
          <ProductSearchCombobox
            products={produtosDisponiveis}
            onSelect={adicionarProduto}
            placeholder="Buscar e adicionar produto..."
            className="h-8"
          />
          
          {/* Lista de produtos como badges compactos */}
          {hasProdutos && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {formData.produtosIncluidos.map((item) => (
                <Badge 
                  key={item.produtoId} 
                  variant="secondary" 
                  className="text-2xs gap-1 pr-1 py-0.5 font-normal"
                >
                  {getProdutoNome(item.produtoId)}
                  <span className="text-muted-foreground ml-0.5">
                    R$ {getProdutoPreco(item.produtoId).toFixed(0)}
                  </span>
                  <button 
                    type="button"
                    onClick={() => removerProdutoIncluido(item.produtoId)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bloco 4 — Botões de Ação (CTA Claro) */}
      <div className="flex items-center justify-end gap-3 pt-3 mt-1 border-t border-border/50">
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            Cancelar
          </button>
        )}
        <Button 
          type="submit" 
          onClick={handleSubmit}
          size="sm"
          className="px-6 text-xs font-medium"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
