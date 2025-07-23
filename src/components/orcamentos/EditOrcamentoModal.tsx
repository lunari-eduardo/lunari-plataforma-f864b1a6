
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Pen, X, Package, Plus, Trash2 } from 'lucide-react';
import { Orcamento, Cliente, PacoteProduto } from '@/types/orcamentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useToast } from '@/hooks/use-toast';
import { CategorySelector } from './CategorySelector';
import ClientSearchInput from './ClientSearchInput';
import { PackageSearchCombobox } from './PackageSearchCombobox';
import { ProductSearchCombobox } from './ProductSearchCombobox';
import { formatDateForStorage } from '@/utils/dateUtils';

interface EditOrcamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  orcamento: Orcamento | null;
}

export default function EditOrcamentoModal({ 
  isOpen, 
  onClose, 
  orcamento 
}: EditOrcamentoModalProps) {
  const { 
    atualizarOrcamento, 
    clientes, 
    origens, 
    categorias, 
    pacotes, 
    produtos 
  } = useOrcamentos();
  const { toast } = useToast();

  // Estrutura simplificada para o novo formato
  interface ProdutoSelecionado {
    id: string;
    nome: string;
    preco: number;
    quantidade: number;
    inclusoNoPacote?: boolean;
  }

  // Estado inicial do formulário
  const initialFormState = {
    cliente: null as Cliente | null,
    data: '',
    hora: '',
    categoria: '',
    descricao: '',
    detalhes: '',
    origem: '',
    // Nova estrutura: pacote principal + produtos adicionais
    pacotePrincipal: null as any,
    produtosAdicionais: [] as ProdutoSelecionado[],
    valorManual: undefined as number | undefined,
    isOrcamentoFechado: false
  };

  // Estado único centralizado para o formulário
  const [formData, setFormData] = useState(initialFormState);

  // Função para resolver categoria por ID
  const getCategoriaById = (categoriaId: string | number): string => {
    if (!categoriaId) return '';
    
    // Se categorias é array de strings, usar index
    if (typeof categorias[0] === 'string') {
      const index = parseInt(String(categoriaId)) - 1;
      if (index >= 0 && index < categorias.length) {
        return categorias[index] as string;
      }
    }
    
    // Se categorias é array de objetos
    const categoria = categorias.find((cat: any) => 
      cat.id === categoriaId || cat.id === String(categoriaId)
    );
    
    // Verificar se categoria é um objeto com propriedade nome
    if (categoria && typeof categoria === 'object') {
      const catObj = categoria as any;
      if (catObj.nome) {
        return String(catObj.nome);
      }
    }
    
    return String(categoriaId);
  };

  // Inicialização via useEffect com dependência de [isOpen, orcamento]
  useEffect(() => {
    if (isOpen && orcamento) {
      // Converte dados antigos para nova estrutura
      const [year, month, day] = orcamento.data.split('-');
      
      // Separa pacote principal (primeiro) dos produtos adicionais
      const pacotes = orcamento.pacotes || [];
      const pacotePrincipal = pacotes.length > 0 ? pacotes[0] : null;
      const produtosAdicionais = pacotes.slice(1).map(item => ({
        id: item.id,
        nome: item.nome,
        preco: item.preco,
        quantidade: item.quantidade
      }));

      setFormData({
        cliente: orcamento.cliente,
        data: `${year}-${month}-${day}`,
        hora: orcamento.hora,
        categoria: orcamento.categoria || '',
        descricao: orcamento.descricao || '',
        detalhes: orcamento.detalhes,
        origem: orcamento.origemCliente,
        pacotePrincipal: pacotePrincipal,
        produtosAdicionais: produtosAdicionais,
        valorManual: orcamento.valorManual,
        isOrcamentoFechado: orcamento.status === 'fechado'
      });
    } else if (!isOpen) {
      // Reseta o estado quando o modal é fechado
      setFormData(initialFormState);
    }
  }, [isOpen, orcamento]);

  // Nova lógica para pacote principal com processamento de produtos inclusos
  const handleMainPackageSelect = (pacote: any) => {
    if (!pacote) {
      // Limpar pacote principal e produtos inclusos
      setFormData(prev => ({ 
        ...prev, 
        pacotePrincipal: null,
        produtosAdicionais: prev.produtosAdicionais.filter(p => !(p as any).inclusoNoPacote)
      }));
      return;
    }

    // Resolver categoria do pacote selecionado
    let categoriaResolvida = '';
    if (pacote.categoria) {
      categoriaResolvida = pacote.categoria;
    } else if (pacote.categoria_id) {
      categoriaResolvida = getCategoriaById(pacote.categoria_id);
    }

    // Processar produtos inclusos
    let novosInclusos: ProdutoSelecionado[] = [];
    if (pacote.produtosIncluidos && pacote.produtosIncluidos.length > 0) {
      novosInclusos = pacote.produtosIncluidos.map((produtoIncluso: any) => {
        const produtoCompleto = produtos.find(p => p.id === produtoIncluso.produtoId);
        if (produtoCompleto) {
          return {
            id: produtoCompleto.id,
            nome: produtoCompleto.nome,
            preco: produtoCompleto.valorVenda || produtoCompleto.preco_venda || 0,
            quantidade: produtoIncluso.quantidade || 1,
            inclusoNoPacote: true
          } as ProdutoSelecionado & { inclusoNoPacote: boolean };
        }
        return null;
      }).filter(Boolean);
    }

    setFormData(prev => ({
      ...prev,
      pacotePrincipal: pacote,
      // Atualizar categoria baseado no pacote selecionado
      categoria: categoriaResolvida,
      // Remover produtos inclusos antigos e adicionar os novos
      produtosAdicionais: [
        ...prev.produtosAdicionais.filter(p => !(p as any).inclusoNoPacote),
        ...novosInclusos
      ]
    }));
  };

  const handleClearMainPackage = () => {
    setFormData(prev => ({ 
      ...prev, 
      pacotePrincipal: null,
      // Remover apenas produtos inclusos no pacote
      produtosAdicionais: prev.produtosAdicionais.filter(p => !(p as any).inclusoNoPacote)
    }));
  };

  // Nova lógica para produtos adicionais
  const handleAddProduct = (produto: any) => {
    if (!produto) return;
    
    // Verificar se o produto já existe na lista
    const existeProduto = formData.produtosAdicionais.some(p => p.id === produto.id);
    if (existeProduto) {
      toast({
        title: "Aviso",
        description: "Este produto já foi adicionado!"
      });
      return;
    }
    
    const newProduto: ProdutoSelecionado = {
      id: produto.id,
      nome: produto.nome,
      preco: produto.valorVenda || produto.preco_venda || produto.valor || 0,
      quantidade: 1
    };

    setFormData(prev => ({
      ...prev,
      produtosAdicionais: [...prev.produtosAdicionais, newProduto]
    }));
  };

  const handleRemoveProduct = (index: number) => {
    const produto = formData.produtosAdicionais[index];
    
    // Verificar se é produto incluso no pacote (não pode ser removido individualmente)
    if ((produto as any).inclusoNoPacote) {
      toast({
        title: "Aviso",
        description: "Este produto está incluso no pacote e não pode ser removido individualmente. Remova o pacote principal para removê-lo."
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      produtosAdicionais: prev.produtosAdicionais.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateProductQuantity = (index: number, quantidade: number) => {
    if (quantidade <= 0) return;
    
    setFormData(prev => ({
      ...prev,
      produtosAdicionais: prev.produtosAdicionais.map((produto, i) => 
        i === index ? { ...produto, quantidade } : produto
      )
    }));
  };

  const handleClearCategory = () => {
    setFormData(prev => ({ ...prev, categoria: '' }));
  };

  const handleSave = () => {
    if (!orcamento) return;

    // Calcular valor total com nova estrutura
    const valorPacotePrincipal = formData.pacotePrincipal ? 
      (formData.pacotePrincipal.valorVenda || formData.pacotePrincipal.valor_base || formData.pacotePrincipal.valor || 0) : 0;
    const valorProdutos = formData.produtosAdicionais.reduce((total, p) => total + (p.preco * p.quantidade), 0);
    const valorTotal = valorPacotePrincipal + valorProdutos;

    // Converter nova estrutura para formato antigo
    const pacotesParaSalvar: PacoteProduto[] = [];
    
    if (formData.pacotePrincipal) {
      pacotesParaSalvar.push({
        id: formData.pacotePrincipal.id,
        nome: formData.pacotePrincipal.nome,
        preco: valorPacotePrincipal,
        quantidade: 1
      });
    }
    
    pacotesParaSalvar.push(...formData.produtosAdicionais);

    const updates: Partial<Orcamento> = {
      detalhes: formData.detalhes,
      // Data e hora sempre editáveis (mesmo para orçamentos fechados)
      data: formatDateForStorage(formData.data),
      hora: formData.hora
    };

    // Only update other fields if the budget is not closed
    if (!formData.isOrcamentoFechado) {
      if (formData.cliente) {
        updates.cliente = formData.cliente;
      }
      updates.categoria = formData.categoria;
      updates.descricao = formData.descricao;
      updates.origemCliente = formData.origem;
      updates.pacotes = pacotesParaSalvar;
      updates.valorTotal = valorTotal;
      updates.valorManual = formData.valorManual;
    }

    atualizarOrcamento(orcamento.id, updates);
    
    toast({
      title: "Sucesso",
      description: "Orçamento atualizado com sucesso!"
    });
    
    onClose();
  };

  if (!orcamento) return null;

  // Calculate values with new structure
  const valorPacotePrincipal = formData.pacotePrincipal ? 
    (formData.pacotePrincipal.valorVenda || formData.pacotePrincipal.valor_base || formData.pacotePrincipal.valor || 0) : 0;
  const valorProdutos = formData.produtosAdicionais.reduce((total, p) => total + (p.preco * p.quantidade), 0);
  const valorTotal = valorPacotePrincipal + valorProdutos;
  const valorFinal = formData.valorManual !== undefined ? formData.valorManual : valorTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(event) => {
          // Prevent modal from closing when clicking on select dropdowns
          const target = event.target as Element;
          if (target?.closest('[data-radix-select-content]') || 
              target?.closest('[data-radix-popper-content-wrapper]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            Editar Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente */}
            <div>
              <label className="text-sm font-medium mb-1 block">Cliente</label>
              <ClientSearchInput
                clientes={clientes}
                selectedClient={formData.cliente}
                onSelectClient={(cliente) => setFormData(prev => ({ ...prev, cliente }))}
                placeholder="Selecione um cliente"
                disabled={formData.isOrcamentoFechado}
              />
            </div>

            {/* Data e Hora - SEMPRE EDITÁVEIS */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={formData.data} 
                    onChange={e => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Hora</label>
                <div className="relative">
                  <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="time" 
                    value={formData.hora} 
                    onChange={e => setFormData(prev => ({ ...prev, hora: e.target.value }))}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoria com botão de limpar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Categoria (Opcional)</label>
                {formData.categoria && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearCategory}
                    className="h-6 w-6 p-0"
                    disabled={formData.isOrcamentoFechado}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <CategorySelector
                categorias={categorias}
                value={formData.categoria}
                onValueChange={(categoria) => setFormData(prev => ({ ...prev, categoria }))}
                placeholder="Selecione uma categoria"
                disabled={formData.isOrcamentoFechado}
              />
            </div>

            {/* Origem */}
            <div>
              <label className="text-sm font-medium mb-1 block">Origem</label>
              <Select 
                value={formData.origem} 
                onValueChange={(origem) => setFormData(prev => ({ ...prev, origem }))} 
                disabled={formData.isOrcamentoFechado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {origens.map(origem => (
                    <SelectItem key={origem.id} value={origem.id}>
                      {origem.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-sm font-medium mb-1 block">Descrição</label>
            <Input
              placeholder="Descrição do serviço (será levada para Agenda e Workflow)"
              value={formData.descricao}
              onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              disabled={formData.isOrcamentoFechado}
            />
          </div>

          {/* Detalhes */}
          <div>
            <label className="text-sm font-medium mb-1 block">Detalhes</label>
            <Textarea
              placeholder="Anotações internas do orçamento"
              value={formData.detalhes}
              onChange={e => setFormData(prev => ({ ...prev, detalhes: e.target.value }))}
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Nova estrutura: Pacote Principal + Produtos Adicionais */}
          {!formData.isOrcamentoFechado && (
            <div className="space-y-6">
              {/* Pacote Principal (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Pacote Principal (Opcional)</label>
                  {formData.pacotePrincipal && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearMainPackage}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <PackageSearchCombobox
                  pacotes={pacotes}
                  value={formData.pacotePrincipal}
                  onSelect={handleMainPackageSelect}
                  placeholder="Buscar pacote..."
                  filtrarPorCategoria={formData.categoria}
                />
                {formData.pacotePrincipal && (
                  <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-primary">{formData.pacotePrincipal.nome}</p>
                        <p className="text-xs text-primary/70">Pacote Principal</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">
                          R$ {valorPacotePrincipal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Produtos Adicionais */}
              <div>
                <label className="text-sm font-medium mb-2 block">Produtos Adicionais</label>
                <ProductSearchCombobox
                  products={produtos}
                  onSelect={handleAddProduct}
                  placeholder="Buscar e adicionar produto..."
                />
                
                {/* Lista de Produtos Adicionais */}
                <div className="mt-3 space-y-2">
                  {formData.produtosAdicionais.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg text-center">
                      Nenhum produto adicional
                    </p>
                  ) : (
                    formData.produtosAdicionais.map((produto, index) => {
                      const isIncluded = (produto as any).inclusoNoPacote;
                      return (
                        <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${
                          isIncluded ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'
                        }`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${isIncluded ? 'text-primary' : ''}`}>
                                {produto.nome}
                              </p>
                              {isIncluded && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  Incluso no pacote
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${isIncluded ? 'text-primary/70' : 'text-muted-foreground'}`}>
                              R$ {produto.preco.toFixed(2)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <label className={`text-xs ${isIncluded ? 'text-primary/70' : 'text-muted-foreground'}`}>
                                Qtd:
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={produto.quantidade}
                                onChange={e => handleUpdateProductQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-16 h-7 text-xs"
                                disabled={isIncluded && formData.isOrcamentoFechado}
                              />
                            </div>
                            <div className="text-right min-w-[80px]">
                              <p className={`text-sm font-medium ${isIncluded ? 'text-primary' : ''}`}>
                                R$ {(produto.preco * produto.quantidade).toFixed(2)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveProduct(index)}
                              className={`h-6 w-6 p-0 ${
                                isIncluded 
                                  ? 'text-primary/50 hover:text-primary cursor-not-allowed' 
                                  : 'text-red-500 hover:text-red-700'
                              }`}
                              disabled={isIncluded}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Resumo dos itens selecionados (sempre visível) */}
          {(formData.pacotePrincipal || formData.produtosAdicionais.length > 0) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Resumo do Orçamento</h4>
              <div className="space-y-2">
                {formData.pacotePrincipal && (
                  <div className="flex justify-between items-center text-sm">
                    <span>Pacote Principal: {formData.pacotePrincipal.nome}</span>
                    <span className="font-medium">R$ {valorPacotePrincipal.toFixed(2)}</span>
                  </div>
                )}
                {formData.produtosAdicionais.length > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span>Produtos Adicionais ({formData.produtosAdicionais.length})</span>
                    <span className="font-medium">R$ {valorProdutos.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valor Final */}
          <div className="mt-4">
            <div className="flex justify-between items-center font-medium mb-2">
              <span className="text-sm">Total Calculado:</span>
              <span className="text-sm">R$ {valorTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Valor Final:</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.valorManual !== undefined ? formData.valorManual : ''}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  valorManual: e.target.value ? parseFloat(e.target.value) : undefined 
                }))}
                placeholder={`R$ ${valorTotal.toFixed(2)}`}
                className="max-w-40"
                disabled={formData.isOrcamentoFechado}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
