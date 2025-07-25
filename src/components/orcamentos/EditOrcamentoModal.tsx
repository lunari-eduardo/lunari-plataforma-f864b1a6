import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Package, Plus, Trash2 } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';

import { Cliente, Orcamento, PacoteProduto } from '@/types/orcamentos';
import { useToast } from '@/hooks/use-toast';
import ClientSearchInput from './ClientSearchInput';
import { ProductSearchCombobox } from './ProductSearchCombobox';
import { CategorySelector } from './CategorySelector';
import { PackageSearchCombobox } from './PackageSearchCombobox';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { formatDateForStorage, parseDateFromStorage } from '@/utils/dateUtils';

// Definimos um estado inicial limpo para o formulário
const initialFormData = {
  cliente: null,
  data: '',
  hora: '12:00',
  categoria: '',
  origem: '',
  descricao: '',
  detalhes: '',
  pacotePrincipal: null,
  produtosAdicionais: [],
  valorFinal: 0,
};

// Interface para o nosso estado de formulário
interface FormData {
  cliente: Cliente | null;
  data: string; // Sempre no formato YYYY-MM-DD
  hora: string;
  categoria: string;
  origem: string;
  descricao: string;
  detalhes: string;
  pacotePrincipal: any | null;
  produtosAdicionais: PacoteProduto[];
  valorFinal: number;
}

interface EditOrcamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  orcamento: Orcamento | null;
}

export default function EditOrcamentoModal({ isOpen, onClose, orcamento }: EditOrcamentoModalProps) {
  const { clientes, origens, atualizarOrcamento } = useOrcamentos();
  const { pacotes, produtos, categorias } = useOrcamentoData();
  const { toast } = useToast();
  

  // 1. ESTADO ÚNICO E CENTRALIZADO PARA O FORMULÁRIO
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // 2. useEffect INTELIGENTE: Roda UMA VEZ ao abrir para carregar os dados.
  // Ele não será acionado novamente enquanto você edita, resolvendo o bug de "apagar ao digitar".
  useEffect(() => {
    if (isOpen && orcamento) {
      // Lógica de "hidratação" que busca os dados completos
      const pacoteDoOrcamento = orcamento.pacotes.find(p => p.id.startsWith('pacote-'));
      let pacotePrincipalCompleto = null;
      if (pacoteDoOrcamento) {
        const pacoteId = pacoteDoOrcamento.id.replace('pacote-', '');
        // Busca o pacote completo na lista mestra para obter o VALOR correto
        pacotePrincipalCompleto = pacotes.find(p => p.id === pacoteId) || null;
        if (pacotePrincipalCompleto) {
          // Usar valores congelados para orçamentos fechados, valores atuais para rascunhos
          const valor = orcamento.status === 'fechado' 
            ? pacoteDoOrcamento.preco 
            : (pacotePrincipalCompleto.valor || pacotePrincipalCompleto.valor_base || 0);
          pacotePrincipalCompleto = { ...pacotePrincipalCompleto, valor };
        }
      }

      // Separa os produtos manuais dos produtos do pacote
      const produtosManuais = orcamento.pacotes.filter(p => !p.id.startsWith('pacote-'));

      setFormData({
        cliente: orcamento.cliente,
        data: orcamento.data, // Assumindo que já está em YYYY-MM-DD
        hora: orcamento.hora,
        categoria: orcamento.categoria,
        origem: orcamento.origemCliente || '',
        descricao: orcamento.descricao || '',
        detalhes: orcamento.detalhes || '',
        pacotePrincipal: pacotePrincipalCompleto,
        produtosAdicionais: produtosManuais,
        valorFinal: orcamento.valorTotal || 0,
      });
    } else {
      // Limpa o formulário quando o modal é fechado ou não há orçamento
      setFormData(initialFormData);
    }
  }, [isOpen, orcamento, pacotes]);
  
  // 3. Lógica de Cálculo Reativa
  const totalCalculado = useMemo(() => {
    const valorPacote = formData.pacotePrincipal?.valor || 0;
    const valorProdutos = formData.produtosAdicionais.reduce((total, p) => total + (p.preco * p.quantidade), 0);
    return valorPacote + valorProdutos;
  }, [formData.pacotePrincipal, formData.produtosAdicionais]);

  // 4. FUNÇÕES DE CALLBACK: O modal controla as alterações de estado.
  const handleFormChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePackageSelect = (pacote: any | null) => {
    setFormData(prev => ({
      ...prev,
      pacotePrincipal: pacote,
      // A categoria é automaticamente definida pelo pacote
      categoria: pacote ? pacote.categoria : prev.categoria,
    }));
  };

  const handleAddProduct = (produto: any) => {
    if (!produto) return;
    
    const existeProduto = formData.produtosAdicionais.some(p => p.id === produto.id);
    if (existeProduto) {
      toast({ title: "Aviso", description: "Este produto já foi adicionado!" });
      return;
    }

    const novoProduto: PacoteProduto = {
      id: produto.id,
      nome: produto.nome,
      preco: produto.valorVenda || produto.preco_venda || produto.valor || 0,
      quantidade: 1,
    };
    setFormData(prev => ({
      ...prev,
      produtosAdicionais: [...prev.produtosAdicionais, novoProduto],
    }));
  };
  
  const handleRemoveProduct = (productId: string) => {
    setFormData(prev => ({
        ...prev,
        produtosAdicionais: prev.produtosAdicionais.filter(p => p.id !== productId)
    }));
  };
  
  const handleUpdateProduct = (productId: string, field: keyof PacoteProduto, value: any) => {
     setFormData(prev => ({
        ...prev,
        produtosAdicionais: prev.produtosAdicionais.map(p => 
            p.id === productId ? { ...p, [field]: value } : p
        )
    }));
  };

  // 5. LÓGICA DE SALVAMENTO CORRETA
  const handleSave = () => {
    if (!formData.cliente || !formData.data) {
      toast({ title: "Erro", description: "Cliente e Data são obrigatórios.", variant: "destructive" });
      return;
    }

    const orcamentoAtualizado: Orcamento = {
      ...(orcamento as Orcamento),
      cliente: formData.cliente,
      data: formData.data, // Já está no formato correto
      hora: formData.hora,
      categoria: formData.categoria,
      origemCliente: formData.origem,
      descricao: formData.descricao,
      detalhes: formData.detalhes,
      pacotes: [
        ...(formData.pacotePrincipal ? [{ 
          id: `pacote-${formData.pacotePrincipal.id}`, 
          nome: formData.pacotePrincipal.nome, 
          preco: formData.pacotePrincipal.valor, 
          quantidade: 1 
        }] : []),
        ...formData.produtosAdicionais,
      ],
      valorTotal: formData.valorFinal || totalCalculado,
      valorManual: formData.valorFinal !== totalCalculado ? formData.valorFinal : undefined,
    };
    
    atualizarOrcamento(orcamento!.id, orcamentoAtualizado);

    toast({ title: "Sucesso", description: "Orçamento atualizado com sucesso!" });
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (!orcamento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orçamento</DialogTitle>
        </DialogHeader>
        
        {/* Formulário com estado controlado */}
        <div className="space-y-4 p-1">
          {/* Cliente */}
          <div>
            <label className="text-sm font-medium mb-1 block">Cliente</label>
            <ClientSearchInput
              clientes={clientes}
              selectedClient={formData.cliente}
              onSelectClient={(client) => handleFormChange('cliente', client)}
              placeholder="Selecione um cliente"
              disabled={orcamento.status === 'fechado'}
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Data</label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => handleFormChange('data', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hora</label>
              <Input
                type="time"
                value={formData.hora}
                onChange={(e) => handleFormChange('hora', e.target.value)}
              />
            </div>
          </div>

          {/* Categoria e Origem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => handleFormChange('categoria', value)}
                disabled={orcamento.status === 'fechado'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(categoria => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Origem</label>
              <Select
                value={formData.origem}
                onValueChange={(value) => handleFormChange('origem', value)}
                disabled={orcamento.status === 'fechado'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma origem" />
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
              placeholder="Descrição do serviço"
              value={formData.descricao}
              onChange={(e) => handleFormChange('descricao', e.target.value)}
              disabled={orcamento.status === 'fechado'}
            />
          </div>

          {/* Pacote Principal */}
          <div>
            <label className="text-sm font-medium mb-1 block">Pacote Principal (Opcional)</label>
            {orcamento.status === 'fechado' ? (
              <div className="p-2 border rounded bg-muted text-muted-foreground">
                Pacote não pode ser alterado em orçamento fechado
              </div>
            ) : (
              <PackageSearchCombobox
                pacotes={pacotes}
                value={formData.pacotePrincipal}
                onSelect={handlePackageSelect}
                filtrarPorCategoria={formData.categoria}
                placeholder="Selecionar pacote..."
              />
            )}
            {formData.pacotePrincipal && (
              <div className="mt-2 p-3 bg-muted rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{formData.pacotePrincipal.nome}</span>
                  <span className="font-bold text-primary">{formatCurrency(formData.pacotePrincipal.valor)}</span>
                </div>
                {formData.pacotePrincipal.categoria && (
                  <span className="text-sm text-muted-foreground">{formData.pacotePrincipal.categoria}</span>
                )}
              </div>
            )}
          </div>

          {/* Produtos Adicionais */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Produtos Adicionais</label>
              {orcamento.status !== 'fechado' && (
                <ProductSearchCombobox
                  products={produtos}
                  onSelect={handleAddProduct}
                  placeholder="Adicionar produto..."
                />
              )}
            </div>
            
            {formData.produtosAdicionais.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {formData.produtosAdicionais.map((produto, index) => (
                  <div key={produto.id} className="flex items-center gap-2 p-2 bg-muted rounded border">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{produto.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={produto.quantidade}
                        onChange={(e) => handleUpdateProduct(produto.id, 'quantidade', parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-xs"
                        disabled={orcamento.status === 'fechado'}
                      />
                      <span className="text-sm font-medium min-w-[80px]">
                        {formatCurrency(produto.preco * produto.quantidade)}
                      </span>
                      {orcamento.status !== 'fechado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProduct(produto.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Valor Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Calculado:</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(totalCalculado)}</span>
            </div>
            
            {orcamento.status !== 'fechado' && (
              <div className="mt-2">
                <label className="text-sm font-medium mb-1 block">Valor Final (opcional - sobrescreve cálculo)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Deixe vazio para usar ${formatCurrency(totalCalculado)}`}
                  value={formData.valorFinal || ''}
                  onChange={(e) => handleFormChange('valorFinal', parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div>
            <label className="text-sm font-medium mb-1 block">Detalhes</label>
            <Textarea
              placeholder="Observações internas sobre o orçamento..."
              value={formData.detalhes}
              onChange={(e) => handleFormChange('detalhes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}