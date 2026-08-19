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
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
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
    fotos_incluidas: initialData?.fotos_incluidas || 0,
    duracao_minutos: initialData?.duracao_minutos ?? 0,
    produtosIncluidos: initialData?.produtosIncluidos || []
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [produtosExpanded, setProdutosExpanded] = useState(
    (initialData?.produtosIncluidos?.length || 0) > 0
  );
  
  // Verificar modelo de precificação atual
  const configPrecificacao = obterConfiguracaoPrecificacao();
  const isFixedPricing = configPrecificacao.modelo === 'fixo';

  // Hooks para inputs monetários com máscara BRL
  const valorBaseInput = useCurrencyInput({
    value: formData.valor_base,
    onChange: (value) => {
      setFormData(prev => ({ ...prev, valor_base: value }));
      if (errors.valor_base) {
        setErrors(prev => ({ ...prev, valor_base: '' }));
      }
    }
  });

  const valorFotoExtraInput = useCurrencyInput({
    value: formData.valor_foto_extra,
    onChange: (value) => setFormData(prev => ({ ...prev, valor_foto_extra: value }))
  });

  const fotosIncluidasInput = useNumberInput({
    value: formData.fotos_incluidas,
    onChange: (value) => {
      setFormData(prev => ({ ...prev, fotos_incluidas: parseInt(value) || 0 }));
      if (errors.fotos_incluidas) {
        setErrors(prev => ({ ...prev, fotos_incluidas: '' }));
      }
    }
  });

  const duracaoMinutosInput = useNumberInput({
    value: formData.duracao_minutos ?? 0,
    onChange: (value) => {
      setFormData(prev => ({ ...prev, duracao_minutos: Math.max(0, parseInt(value) || 0) }));
    }
  });

  const handleSubmit = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.categoria_id) {
      newErrors.categoria_id = 'Categoria é obrigatória';
    }

    if (!formData.fotos_incluidas || formData.fotos_incluidas < 1) {
      newErrors.fotos_incluidas = 'Número de fotos é obrigatório (mín. 1)';
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
        fotos_incluidas: 0,
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
              {...valorBaseInput.inputProps}
              placeholder="0,00"
              className={cn(
                "h-8 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                errors.valor_base && "border-destructive focus:border-destructive"
              )}
            />
          </div>
        </div>

        {/* Valor Foto Extra - SEMPRE editável para sistema híbrido */}
        <div className="flex-1 min-w-[140px] max-w-[180px]">
          <Label htmlFor="valor_foto_extra" className="text-2xs font-medium text-muted-foreground mb-1 block">
            Foto Extra
            {!isFixedPricing && (
              <span className="ml-1 text-amber-500">(opcional)</span>
            )}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              id="valor_foto_extra"
              {...valorFotoExtraInput.inputProps}
              placeholder="0,00"
              className="h-8 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {!isFixedPricing && (
            <span className="text-2xs text-muted-foreground mt-0.5 block">
              Modelo ativo: {configPrecificacao.modelo === 'global' ? 'Tabela Global' : 'Por Categoria'}
            </span>
          )}
        </div>

        {/* Fotos Incluídas - NOVO CAMPO */}
        <div className="flex-1 min-w-[140px] max-w-[180px]">
          <Label htmlFor="fotos_incluidas" className="text-2xs font-medium text-muted-foreground mb-1 block">
            Fotos Incluídas *
          </Label>
          <Input
            id="fotos_incluidas"
            type="number"
            step="1"
            min="1"
            value={fotosIncluidasInput.displayValue}
            onChange={fotosIncluidasInput.handleChange}
            onFocus={fotosIncluidasInput.handleFocus}
            placeholder="Ex: 50"
            className={cn(
              "h-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              errors.fotos_incluidas && "border-destructive focus:border-destructive"
            )}
          />
          {errors.fotos_incluidas && (
            <span className="text-2xs text-destructive">{errors.fotos_incluidas}</span>
          )}
        </div>
      </div>

      {/* Bloco 2.5 — Duração / Tempo de Sessão na Agenda */}
      <div className="bg-card/40 border border-border/60 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="duracao_minutos" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Tempo de sessão na agenda</span>
              {(formData.duracao_minutos ?? 0) > 0 ? (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-emerald-500 border-emerald-500/30">
                  {formData.duracao_minutos} min
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground border-border">
                  Desativado (0 min)
                </Badge>
              )}
            </Label>
          </div>
          <div className="flex items-center gap-1">
            {[0, 30, 45, 60, 90, 120].map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, duracao_minutos: dur }))}
                className={cn(
                  "px-2 py-0.5 text-2xs rounded border transition-colors",
                  (formData.duracao_minutos ?? 0) === dur
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground border-border/40 hover:bg-muted/60"
                )}
              >
                {dur === 0 ? "Sem tempo" : dur >= 60 && dur % 60 === 0 ? `${dur / 60}h` : `${dur}m`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-32">
            <div className="relative">
              <Input
                id="duracao_minutos"
                type="number"
                step="5"
                min="0"
                value={duracaoMinutosInput.displayValue}
                onChange={duracaoMinutosInput.handleChange}
                onFocus={duracaoMinutosInput.handleFocus}
                placeholder="0"
                className="h-8 text-sm pr-10"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
            Serve apenas para controle de horários na agenda. Se zerado ou desativado, o agendamento ocupará apenas o horário exato registrado na agenda, dando liberdade ao fotógrafo agendar de 10 em 10 min se quiser.
          </p>
        </div>
      </div>

      {/* Bloco 3 — Produtos Incluídos (Expansível, Colapso Inteligente) */}
      {!hasProdutos && !produtosExpanded ? (
        // Estado vazio: apenas botão
        <button 
          type="button"
          onClick={() => setProdutosExpanded(true)}
          className="w-full h-8 flex items-center justify-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/30 hover:bg-muted/50 hover:text-foreground transition-colors bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produtos ao pacote
        </button>
      ) : (
        // Expandido ou com produtos: mostra busca + lista
        <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
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
