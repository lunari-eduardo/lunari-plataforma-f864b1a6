import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ProductSearchCombobox } from '@/components/ui/product-search-combobox';
import { Badge } from '@/components/ui/badge';
import { X, Plus, ChevronUp, AlertTriangle, Info, Tag, Clock } from 'lucide-react';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { useNumberInput } from '@/hooks/useNumberInput';
import { 
  Categoria, 
  Produto, 
  ProdutoIncluido, 
  PacoteFormData,
  PacoteFormProps
} from '@/types/configuration';
import type { TabelaPrecos } from '@/types/pricing';

const formatarTempoResumido = (minutos: number) => {
  if (minutos < 60) return `${minutos}m`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas}h ${resto}m` : `${horas}h`;
};

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
  
  // Buscar modelo de precificação ativo do usuário
  const { data: modeloPreco = 'fixo' } = useQuery({
    queryKey: ['user-pricing-model'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return 'fixo';
      const { data } = await supabase
        .from('modelo_de_preco')
        .select('modelo')
        .eq('user_id', user.user.id)
        .maybeSingle();
      return (data?.modelo as 'fixo' | 'global' | 'categoria') || 'fixo';
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar tabelas de categoria do usuário
  const { data: tabelasPorCategoria = {} } = useQuery({
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

  // Buscar tabela global do usuário
  const { data: tabelaGlobal } = useQuery({
    queryKey: ['global-pricing-table'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return null;
      const { data } = await supabase
        .from('tabelas_precos')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('tipo', 'global')
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const tabelaDaCategoria = formData.categoria_id ? tabelasPorCategoria[formData.categoria_id] : undefined;

  // Análise da obrigatoriedade e feedback do modelo de precificação
  let isFotoExtraObrigatoria = false;
  let statusMensagem = '';
  let statusTipo: 'alerta' | 'info' | 'progressivo' = 'info';

  if (modeloPreco === 'fixo') {
    isFotoExtraObrigatoria = true;
    statusMensagem = 'Modelo fixo ativo: cada foto extra será cobrada por este valor.';
    statusTipo = 'info';
  } else if (modeloPreco === 'categoria') {
    if (!tabelaDaCategoria) {
      isFotoExtraObrigatoria = true;
      statusMensagem = '⚠️ Esta categoria ainda não possui tabela progressiva configurada. O valor definido aqui será usado como valor fixo para a foto extra.';
      statusTipo = 'alerta';
    } else if (tabelaDaCategoria.usar_valor_fixo_pacote) {
      isFotoExtraObrigatoria = true;
      statusMensagem = '💡 Esta categoria está configurada para usar valor fixo por pacote. Este será o valor cobrado na galeria.';
      statusTipo = 'info';
    } else {
      isFotoExtraObrigatoria = false;
      statusMensagem = '📊 Tabela progressiva ativa para esta categoria. O valor aqui serve como referência de segurança.';
      statusTipo = 'progressivo';
    }
  } else if (modeloPreco === 'global') {
    if (!tabelaGlobal || tabelaGlobal.usar_valor_fixo_pacote) {
      isFotoExtraObrigatoria = true;
      statusMensagem = 'Tabela global configurada para usar valor do pacote. Este será o valor cobrado.';
      statusTipo = 'info';
    } else {
      isFotoExtraObrigatoria = false;
      statusMensagem = '📊 Tabela progressiva global ativa. O valor aqui serve como referência de segurança.';
      statusTipo = 'progressivo';
    }
  }

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
    onChange: (value) => {
      setFormData(prev => ({ ...prev, valor_foto_extra: value }));
      if (errors.valor_foto_extra) {
        setErrors(prev => ({ ...prev, valor_foto_extra: '' }));
      }
    }
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

    if (isFotoExtraObrigatoria && (!formData.valor_foto_extra || formData.valor_foto_extra <= 0)) {
      newErrors.valor_foto_extra = 'Valor de foto extra é obrigatório para esta categoria/configuração';
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

      {/* Bloco 2 — Precificação (Grid Responsivo) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Valor Base */}
        <div>
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
                "h-9 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                errors.valor_base && "border-destructive focus:border-destructive"
              )}
            />
          </div>
        </div>

        {/* Valor Foto Extra - SEMPRE editável para sistema híbrido */}
        <div>
          <Label htmlFor="valor_foto_extra" className="text-2xs font-medium text-muted-foreground mb-1 block">
            Foto Extra {isFotoExtraObrigatoria ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(opcional)</span>}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              id="valor_foto_extra"
              {...valorFotoExtraInput.inputProps}
              placeholder="0,00"
              className={cn(
                "h-9 pl-8 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                errors.valor_foto_extra && "border-destructive focus:border-destructive"
              )}
            />
          </div>
          {errors.valor_foto_extra && (
            <span className="text-2xs text-destructive mt-0.5 block">{errors.valor_foto_extra}</span>
          )}
        </div>

        {/* Fotos Incluídas */}
        <div>
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
              "h-9 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              errors.fotos_incluidas && "border-destructive focus:border-destructive"
            )}
          />
          {errors.fotos_incluidas && (
            <span className="text-2xs text-destructive mt-0.5 block">{errors.fotos_incluidas}</span>
          )}
        </div>
      </div>

      {/* Aviso Inteligente Contextual sobre Precificação */}
      {formData.categoria_id && statusMensagem && (
        <div className={cn(
          "p-2.5 rounded-lg text-xs border flex items-start gap-2.5 transition-all",
          statusTipo === 'alerta' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" :
          statusTipo === 'progressivo' ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400" :
          "bg-card/60 border-border/80 text-muted-foreground"
        )}>
          {statusTipo === 'alerta' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />}
          {statusTipo === 'progressivo' && <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />}
          {statusTipo === 'info' && <Tag className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
          <span className="leading-snug">{statusMensagem}</span>
        </div>
      )}

      {/* Bloco 2.5 — Duração / Tempo de Sessão na Agenda */}
      <div className="bg-card/40 border border-border/60 rounded-lg p-3.5 space-y-3">
        {/* Cabeçalho com Título e Badge Informativo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <Label htmlFor="duracao_minutos" className="text-xs font-semibold text-foreground">
              Tempo de sessão na agenda
            </Label>
          </div>

          {(formData.duracao_minutos ?? 0) > 0 ? (
            <Badge variant="outline" className="w-fit text-xs py-0.5 px-2 font-medium text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
              {formData.duracao_minutos} min {formData.duracao_minutos! >= 60 && `(${formatarTempoResumido(formData.duracao_minutos!)})`}
            </Badge>
          ) : (
            <Badge variant="outline" className="w-fit text-xs py-0.5 px-2 font-normal text-muted-foreground border-border bg-muted/20">
              Sem bloqueio (Livre)
            </Badge>
          )}
        </div>

        {/* Presets em Grid fluido com excelente área de toque */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Sem tempo', value: 0 },
            { label: '30 min', value: 30 },
            { label: '45 min', value: 45 },
            { label: '1h', value: 60 },
            { label: '1h 30m', value: 90 },
            { label: '2h', value: 120 },
          ].map((preset) => {
            const isSelected = (formData.duracao_minutos ?? 0) === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, duracao_minutos: preset.value }))}
                className={cn(
                  "h-9 px-2 rounded-md text-xs font-medium border transition-all flex items-center justify-center text-center",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                    : "bg-background/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Input Numérico Personalizado + Texto Informativo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 pt-1 border-t border-border/30">
          <div className="w-full sm:w-36 shrink-0">
            <div className="relative flex items-center">
              <Input
                id="duracao_minutos"
                type="number"
                step="5"
                min="0"
                value={duracaoMinutosInput.displayValue}
                onChange={duracaoMinutosInput.handleChange}
                onFocus={duracaoMinutosInput.handleFocus}
                placeholder="0"
                className="h-9 text-sm pr-12 text-center sm:text-left [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                min
              </span>
            </div>
          </div>
          <p className="text-2xs sm:text-[11px] text-muted-foreground leading-relaxed">
            Duração padrão reservada na agenda para este ensaio. Ao selecionar <strong>"Sem tempo"</strong>, o agendamento ocupará apenas o horário de início sem bloquear a agenda.
          </p>
        </div>
      </div>

      {/* Bloco 3 — Produtos Incluídos (Expansível, Colapso Inteligente) */}
      {!hasProdutos && !produtosExpanded ? (
        // Estado vazio: apenas botão
        <button 
          type="button"
          onClick={() => setProdutosExpanded(true)}
          className="w-full h-9 flex items-center justify-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/30 hover:bg-muted/50 hover:text-foreground transition-colors border border-dashed border-border/60"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar produtos ao pacote
        </button>
      ) : (
        // Expandido ou com produtos: mostra busca + lista
        <div className="space-y-2.5 p-3 bg-muted/20 rounded-lg border border-border/50">
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
            className="h-9"
          />
          
          {/* Lista de produtos como badges compactos */}
          {hasProdutos && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {formData.produtosIncluidos.map((item) => (
                <Badge 
                  key={item.produtoId} 
                  variant="secondary" 
                  className="text-xs gap-1.5 pl-2.5 pr-1.5 py-1 font-normal"
                >
                  <span>{getProdutoNome(item.produtoId)}</span>
                  <span className="text-muted-foreground font-medium">
                    R$ {getProdutoPreco(item.produtoId).toFixed(0)}
                  </span>
                  <button 
                    type="button"
                    onClick={() => removerProdutoIncluido(item.produtoId)}
                    className="ml-1 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label={`Remover ${getProdutoNome(item.produtoId)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bloco 4 — Botões de Ação (CTA Claro e Responsivo) */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 mt-1 border-t border-border/50">
        {onCancel && (
          <Button 
            type="button" 
            variant="ghost"
            onClick={onCancel}
            className="h-9 px-4 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
        )}
        <Button 
          type="submit" 
          onClick={handleSubmit}
          className="h-9 px-6 text-xs font-medium"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
