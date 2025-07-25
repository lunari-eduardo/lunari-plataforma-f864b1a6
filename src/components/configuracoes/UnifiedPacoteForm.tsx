import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/utils/localStorage';

interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}

interface UnifiedPacoteFormProps {
  initialData?: {
    id?: string;
    nome: string;
    categoria_id: string;
    valor_base: number;
    valor_foto_extra: number;
    produtosIncluidos?: ProdutoIncluido[];
  };
  onSave?: (pacote: any) => void;
  onCancel?: () => void;
  title?: string;
  submitText?: string;
}

export function UnifiedPacoteForm({
  initialData,
  onSave,
  onCancel,
  title = "Novo Pacote",
  submitText = "Salvar"
}: UnifiedPacoteFormProps) {
  const { categorias, produtos } = useAppContext();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    categoria_id: initialData?.categoria_id || '1',
    valor_base: initialData?.valor_base || 0,
    valor_foto_extra: initialData?.valor_foto_extra || 35,
    produtosIncluidos: initialData?.produtosIncluidos || []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (formData.valor_base <= 0) {
      newErrors.valor_base = 'Valor base deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const pacoteData = {
      id: initialData?.id || Date.now().toString(),
      nome: formData.nome.trim(),
      categoria_id: formData.categoria_id,
      valor_base: formData.valor_base,
      valor_foto_extra: formData.valor_foto_extra,
      produtosIncluidos: formData.produtosIncluidos
    };

    if (onSave) {
      onSave(pacoteData);
    } else {
      // Salvar diretamente no localStorage (comportamento padrão)
      const pacotesExistentes = storage.load('configuracoes_pacotes', []);
      
      if (initialData?.id) {
        // Editar pacote existente
        const novosPackets = pacotesExistentes.map((p: any) => 
          p.id === initialData.id ? pacoteData : p
        );
        storage.save('configuracoes_pacotes', novosPackets);
        toast({
          title: "Pacote atualizado",
          description: `Pacote "${formData.nome}" foi atualizado com sucesso!`
        });
      } else {
        // Criar novo pacote
        const novosPacotes = [...pacotesExistentes, pacoteData];
        storage.save('configuracoes_pacotes', novosPacotes);
        toast({
          title: "Pacote criado",
          description: `Pacote "${formData.nome}" foi criado com sucesso!`
        });
      }
    }

    // Reset form
    setFormData({
      nome: '',
      categoria_id: '1',
      valor_base: 0,
      valor_foto_extra: 35,
      produtosIncluidos: []
    });
    setErrors({});

    if (onCancel) {
      onCancel();
    }
  };

  const adicionarProdutoIncluido = () => {
    setFormData(prev => ({
      ...prev,
      produtosIncluidos: [...prev.produtosIncluidos, { produtoId: '', quantidade: 1 }]
    }));
  };

  const atualizarProdutoIncluido = (index: number, campo: keyof ProdutoIncluido, valor: any) => {
    setFormData(prev => ({
      ...prev,
      produtosIncluidos: prev.produtosIncluidos.map((p, i) => 
        i === index ? { ...p, [campo]: valor } : p
      )
    }));
  };

  const removerProdutoIncluido = (index: number) => {
    setFormData(prev => ({
      ...prev,
      produtosIncluidos: prev.produtosIncluidos.filter((_, i) => i !== index)
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nome do Pacote */}
        <div>
          <Label htmlFor="nome">Nome do Pacote *</Label>
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex: Pacote Completo Gestante"
            className={errors.nome ? 'border-red-500' : ''}
          />
          {errors.nome && <p className="text-red-500 text-sm mt-1">{errors.nome}</p>}
        </div>

        {/* Categoria */}
        <div>
          <Label htmlFor="categoria">Categoria</Label>
          <Select 
            value={formData.categoria_id} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((categoria, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  {categoria}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Valor Base */}
        <div>
          <Label htmlFor="valor_base">Valor Base do Pacote (R$) *</Label>
          <Input
            id="valor_base"
            type="number"
            min="0"
            step="0.01"
            value={formData.valor_base}
            onChange={(e) => setFormData(prev => ({ ...prev, valor_base: parseFloat(e.target.value) || 0 }))}
            className={errors.valor_base ? 'border-red-500' : ''}
          />
          {errors.valor_base && <p className="text-red-500 text-sm mt-1">{errors.valor_base}</p>}
          <p className="text-sm text-muted-foreground mt-1">
            Este é o preço final do pacote (já inclui o valor dos produtos)
          </p>
        </div>

        {/* Valor Foto Extra */}
        <div>
          <Label htmlFor="valor_foto_extra">Valor Foto Extra (R$)</Label>
          <Input
            id="valor_foto_extra"
            type="number"
            min="0"
            step="0.01"
            value={formData.valor_foto_extra}
            onChange={(e) => setFormData(prev => ({ ...prev, valor_foto_extra: parseFloat(e.target.value) || 0 }))}
          />
        </div>

        {/* Produtos Incluídos */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Produtos Incluídos no Pacote</Label>
            <Button 
              type="button" 
              onClick={adicionarProdutoIncluido} 
              size="sm" 
              variant="outline"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar Produto
            </Button>
          </div>
          
          <div className="space-y-2">
            {formData.produtosIncluidos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded">
                Nenhum produto incluído no pacote
              </p>
            )}
            
            {formData.produtosIncluidos.map((produtoIncluido, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end bg-muted/50 p-3 rounded">
                <div>
                  <Label className="text-xs">Produto</Label>
                  <Select 
                    value={produtoIncluido.produtoId} 
                    onValueChange={(value) => atualizarProdutoIncluido(index, 'produtoId', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map(produto => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={produtoIncluido.quantidade} 
                    onChange={(e) => atualizarProdutoIncluido(index, 'quantidade', parseInt(e.target.value) || 1)} 
                    className="h-8" 
                  />
                </div>
                
                <Button 
                  type="button"
                  onClick={() => removerProdutoIncluido(index)} 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button onClick={handleSave}>
            {submitText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}