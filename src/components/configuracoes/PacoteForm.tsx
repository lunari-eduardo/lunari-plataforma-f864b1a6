import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { obterConfiguracaoPrecificacao } from '@/utils/precificacaoUtils';
import ProdutoSelectorImproved from './ProdutoSelectorImproved';
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
  submitLabel = "Salvar Pacote",
  isEditing = false
}: PacoteFormProps) {
  const [formData, setFormData] = useState<PacoteFormData>({
    nome: initialData?.nome || '',
    categoria_id: initialData?.categoria_id || categorias[0]?.id || '',
    valor_base: initialData?.valor_base || 0,
    valor_foto_extra: initialData?.valor_foto_extra || 0,
    produtosIncluidos: initialData?.produtosIncluidos || []
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Verificar modelo de precificação atual
  const configPrecificacao = obterConfiguracaoPrecificacao();
  const isFixedPricing = configPrecificacao.modelo === 'fixo';
  const handleSubmit = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.categoria_id) {
      newErrors.categoria_id = 'Categoria é obrigatória';
    }

    if (formData.valor_base <= 0) {
      newErrors.valor_base = 'Valor base deve ser maior que zero';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    
    if (!isEditing) {
      setFormData({
        nome: '',
        categoria_id: categorias[0]?.id || '',
        valor_base: 0,
        valor_foto_extra: 0,
        produtosIncluidos: []
      });
      setErrors({});
    }
  };

  const adicionarProdutoIncluido = (produtoId: string) => {
    const produtoExistente = formData.produtosIncluidos.find(p => p.produtoId === produtoId);
    const novosProdutos = produtoExistente
      ? formData.produtosIncluidos.map(p => 
          p.produtoId === produtoId ? { ...p, quantidade: p.quantidade + 1 } : p
        )
      : [...formData.produtosIncluidos, { produtoId, quantidade: 1 }];
    
    setFormData(prev => ({ ...prev, produtosIncluidos: novosProdutos }));
  };

  const removerProdutoIncluido = (produtoId: string) => {
    setFormData(prev => ({
      ...prev,
      produtosIncluidos: prev.produtosIncluidos.filter(p => p.produtoId !== produtoId)
    }));
  };
  return (
    <div className="space-y-4">
      {/* Grid Compacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nome do Pacote */}
        <div className="space-y-1.5">
          <Label htmlFor="nome" className="text-xs font-medium text-muted-foreground">
            Nome do Pacote *
          </Label>
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, nome: e.target.value }));
              if (errors.nome) {
                setErrors(prev => ({ ...prev, nome: '' }));
              }
            }}
            placeholder="Ex: Ensaio Casal Básico"
            className={cn(
              "h-9 text-sm transition-colors",
              errors.nome && "border-destructive focus:border-destructive"
            )}
          />
          {errors.nome && (
            <span className="text-2xs text-destructive">{errors.nome}</span>
          )}
        </div>

        {/* Categoria */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Categoria *</Label>
          <Select 
            value={formData.categoria_id} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(categoria => (
                <SelectItem key={categoria.id} value={categoria.id} className="text-sm">
                  {categoria.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preços */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Valor Base */}
        <div className="space-y-1.5">
          <Label htmlFor="valor_base" className="text-xs font-medium text-muted-foreground">
            Valor Base (R$) *
          </Label>
          <Input
            id="valor_base"
            type="number"
            step="0.01"
            min="0"
            value={formData.valor_base}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, valor_base: parseFloat(e.target.value) || 0 }));
              if (errors.valor_base) {
                setErrors(prev => ({ ...prev, valor_base: '' }));
              }
            }}
            placeholder="0,00"
            className={cn(
              "h-9 text-sm transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              errors.valor_base && "border-destructive focus:border-destructive"
            )}
          />
          {errors.valor_base && (
            <span className="text-2xs text-destructive">{errors.valor_base}</span>
          )}
        </div>

        {/* Valor Foto Extra */}
        <div className="space-y-1.5">
          <Label htmlFor="valor_foto_extra" className="text-xs font-medium text-muted-foreground">
            Valor Foto Extra (R$)
          </Label>
          {isFixedPricing ? (
            <Input
              id="valor_foto_extra"
              type="number"
              step="0.01"
              min="0"
              value={formData.valor_foto_extra}
              onChange={(e) => setFormData(prev => ({ ...prev, valor_foto_extra: parseFloat(e.target.value) || 0 }))}
              placeholder="0,00"
              className="h-9 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <div className="h-9 flex items-center text-sm text-muted-foreground px-3 bg-muted/50 rounded-md border">
              {configPrecificacao.modelo === 'global' ? 'Tabela Global' : 'Por Categoria'}
            </div>
          )}
        </div>
      </div>

      {/* Produtos Incluídos - Componente Aprimorado */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Produtos Incluídos</Label>
        <div className="bg-muted/30 p-3 rounded-lg border border-lunar-border">
          <ProdutoSelectorImproved
            produtos={produtos}
            produtosIncluidos={formData.produtosIncluidos}
            onAdd={adicionarProdutoIncluido}
            onRemove={removerProdutoIncluido}
            onUpdateQuantity={(produtoId, quantidade) => {
              setFormData(prev => ({
                ...prev,
                produtosIncluidos: prev.produtosIncluidos.map(p =>
                  p.produtoId === produtoId ? { ...p, quantidade } : p
                )
              }));
            }}
          />
        </div>
      </div>

      {/* Botões de Ação Compactos */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-lunar-border">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            size="sm"
            className="text-xs"
          >
            Cancelar
          </Button>
        )}
        <Button 
          type="submit" 
          onClick={handleSubmit}
          size="sm"
          className="text-xs sm:ml-auto"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}