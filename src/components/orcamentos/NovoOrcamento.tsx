import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { Cliente, PacoteProduto } from '@/types/orcamentos';
import { useToast } from '@/hooks/use-toast';
import TemplateSelector from './TemplateSelector';
import ClientSearchInput from './ClientSearchInput';
import { ProductSearchCombobox } from './ProductSearchCombobox';
import { CategorySelector } from './CategorySelector';
import { PackageSearchCombobox } from './PackageSearchCombobox';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { formatDateForStorage } from '@/utils/dateUtils';
import { calculateTotals } from '@/services/FinancialCalculationEngine';
interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}
interface MappedPackage {
  id: string;
  nome: string;
  valor: number;
  categoria: string;
  categoriaId?: string;
  produtosIncluidos?: ProdutoIncluido[];
  valorFotoExtra?: number;
}
export default function NovoOrcamento() {
  const location = useLocation();
  const {
    clientes,
    origens,
    adicionarOrcamento,
    adicionarCliente
  } = useOrcamentos();
  const {
    pacotes,
    produtos,
    categorias
  } = useOrcamentoData();
  const {
    toast
  } = useToast();
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    email: '',
    whatsapp: ''
  });
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [origemSelecionada, setOrigemSelecionada] = useState('');
  const [pacoteSelecionado, setPacoteSelecionado] = useState<MappedPackage | null>(null);
  const [produtosAdicionais, setProdutosAdicionais] = useState<PacoteProduto[]>([]);
  const [desconto, setDesconto] = useState<number>(0);

  // FIX: Add useEffect to read URL parameters and pre-fill date/time
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const presetDate = searchParams.get('data');
    const presetTime = searchParams.get('hora');
    if (presetDate) {
      setData(presetDate);
    }
    if (presetTime) {
      setHora(presetTime);
    }
  }, [location.search]);

  // NOVA LÓGICA DE PACOTE FECHADO: O valor base do pacote é o preço final
  const valorPacote = pacoteSelecionado?.valor || 0;
  const produtosParaCalculo = produtosAdicionais.map(p => ({
    id: p.id,
    nome: p.nome,
    valorUnitario: p.preco,
    quantidade: p.quantidade,
    tipo: p.id.startsWith('auto-') ? 'incluso' as const : 'manual' as const
  }));
  const totalsCalculados = calculateTotals({
    pacotePrincipal: pacoteSelecionado ? {
      ...pacoteSelecionado,
      valorBase: pacoteSelecionado.valor
    } : null,
    produtos: produtosParaCalculo,
    valorFotosExtra: 0,
    adicional: 0,
    desconto: 0
  });

  // Dados compatíveis com o sistema existente
  const produtosInclusos = produtosAdicionais.filter(p => p.id.startsWith('auto-'));
  const produtosManuais = produtosAdicionais.filter(p => !p.id.startsWith('auto-'));
  const valorProdutosManuais = totalsCalculados.valorProdutosAdicionais;
  const valorTotal = totalsCalculados.totalGeral;
  const valorFinal = valorTotal - desconto;

  // Lógica de preenchimento automático - A Regra de Ouro
  useEffect(() => {
    if (pacoteSelecionado && pacoteSelecionado.categoria) {
      // Quando um pacote é selecionado, automaticamente seleciona sua categoria
      setCategoria(pacoteSelecionado.categoria);
    }
  }, [pacoteSelecionado]);

  // Função para lidar com a seleção de pacote
  const handlePackageSelection = (pacote: MappedPackage | null) => {
    setPacoteSelecionado(pacote);

    // Remove produtos que foram incluídos automaticamente do pacote anterior
    setProdutosAdicionais(prev => prev.filter(p => !p.id.startsWith('auto-')));

    // Se o pacote tem produtos incluídos, adiciona automaticamente
    if (pacote?.produtosIncluidos && pacote.produtosIncluidos.length > 0) {
      const produtosDosPacotes = pacote.produtosIncluidos.map(produtoIncluido => {
        const produto = produtos.find(p => p.id === produtoIncluido.produtoId);
        if (produto) {
          return {
            id: `auto-${produto.id}`,
            nome: `${produto.nome} (incluso no pacote)`,
            preco: 0,
            // NOVA LÓGICA: Produtos inclusos têm preço 0 na exibição
            quantidade: produtoIncluido.quantidade
          };
        }
        return null;
      }).filter(Boolean);
      setProdutosAdicionais(prev => [...prev, ...produtosDosPacotes.filter(Boolean)]);
    }
  };
  const adicionarProduto = () => {
    setProdutosAdicionais([...produtosAdicionais, {
      id: Date.now().toString(),
      nome: '',
      preco: 0,
      quantidade: 1
    }]);
  };
  const adicionarProdutoDoCombobox = (produto: any) => {
    if (produto) {
      setProdutosAdicionais(prev => [...prev, {
        id: Date.now().toString(),
        nome: produto.nome,
        preco: produto.valorVenda,
        quantidade: 1
      }]);
    }
  };
  const atualizarProduto = (id: string, campo: keyof PacoteProduto, valor: any) => {
    setProdutosAdicionais(produtosAdicionais.map(p => p.id === id ? {
      ...p,
      [campo]: valor
    } : p));
  };
  const removerProduto = (id: string) => {
    setProdutosAdicionais(produtosAdicionais.filter(p => p.id !== id));
  };
  const usarTemplate = (template: any) => {
    setDetalhes(template.conteudo);
    if (template.categoria) {
      setCategoria(template.categoria);
    }
  };
  const criarNovoCliente = () => {
    if (!novoCliente.nome.trim() || !novoCliente.email.trim() || !novoCliente.whatsapp.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do cliente",
        variant: "destructive"
      });
      return;
    }
    const cliente = adicionarCliente({
      nome: novoCliente.nome,
      email: novoCliente.email,
      telefone: novoCliente.whatsapp // Map whatsapp input to telefone field
    });
    setClienteSelecionado(cliente);
    setNovoCliente({
      nome: '',
      email: '',
      whatsapp: ''
    });
    toast({
      title: "Sucesso",
      description: "Cliente criado com sucesso!"
    });
  };
  const salvarOrcamento = (status: 'rascunho' | 'enviado') => {
    // Se há um novo cliente preenchido mas não selecionado, criar o cliente automaticamente
    if (!clienteSelecionado && novoCliente.nome.trim() && novoCliente.email.trim() && novoCliente.whatsapp.trim()) {
      const cliente = adicionarCliente({
        nome: novoCliente.nome,
        email: novoCliente.email,
        telefone: novoCliente.whatsapp
      });
      setClienteSelecionado(cliente);
      setNovoCliente({
        nome: '',
        email: '',
        whatsapp: ''
      });
    }
    if (!clienteSelecionado || !data || !hora) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (Cliente, Data e Hora)",
        variant: "destructive"
      });
      return;
    }
    const todosItens = [...(pacoteSelecionado ? [{
      id: `pacote-${pacoteSelecionado.id}`,
      nome: `Pacote: ${pacoteSelecionado.nome}`,
      preco: pacoteSelecionado.valor,
      quantidade: 1
    }] : []), ...produtosAdicionais];

    // Converter para nova estrutura de dados
    const pacotePrincipal = pacoteSelecionado ? {
      pacoteId: pacoteSelecionado.id,
      nome: pacoteSelecionado.nome,
      valorCongelado: pacoteSelecionado.valor,
      produtosIncluidos: (pacoteSelecionado.produtosIncluidos || []).map((produtoIncluso: any) => {
        const produtoCompleto = produtos.find(p => p.id === produtoIncluso.produtoId);
        return {
          produtoId: produtoIncluso.produtoId,
          nome: produtoCompleto?.nome || 'Produto não encontrado',
          quantidade: produtoIncluso.quantidade || 1,
          valorUnitarioCongelado: produtoCompleto?.valorVenda || 0,
          tipo: 'incluso' as const
        };
      })
    } : undefined;
    const produtosAdicionaisNovo = produtosAdicionais.map(p => ({
      produtoId: p.id,
      nome: p.nome,
      quantidade: p.quantidade,
      valorUnitarioCongelado: p.preco,
      tipo: 'manual' as const
    }));
    adicionarOrcamento({
      cliente: clienteSelecionado,
      data: formatDateForStorage(data),
      // Garantir que a data seja salva no formato correto
      hora,
      categoria,
      descricao,
      detalhes,
      // NOVA ARQUITETURA DE DADOS
      pacotePrincipal,
      produtosAdicionais: produtosAdicionaisNovo,
      valorFinal: valorTotal - desconto,
      desconto,
      // Compatibilidade com sistema antigo
      pacotes: todosItens,
      valorTotal,
      status,
      origemCliente: origemSelecionada,
      // Campos de compatibilidade
      packageId: pacoteSelecionado?.id,
      valorFotoExtra: pacoteSelecionado?.valorFotoExtra || 35
    });
    toast({
      title: "Sucesso",
      description: `Orçamento ${status === 'rascunho' ? 'salvo' : 'enviado'} com sucesso!`
    });

    // Limpar formulário
    setClienteSelecionado(null);
    setData('');
    setHora('');
    setCategoria('');
    setDescricao('');
    setDetalhes('');
    setOrigemSelecionada('');
    setPacoteSelecionado(null);
    setProdutosAdicionais([]);
    setDesconto(0);
  };
  return <div className="space-y-4">
      {/* Layout em duas colunas para desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Seleção de Cliente */}
          <Card className="rounded-lg bg-neutral-50">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 rounded-lg bg-neutral-50 pt-3">
              <div>
                <label htmlFor="budget-client-search" className="text-xs font-medium mb-1 block">Cliente Existente</label>
                <div id="budget-client-search" className="text-foreground bg-inherit">
                  <ClientSearchInput clientes={clientes} selectedClient={clienteSelecionado} onSelectClient={setClienteSelecionado} placeholder="Selecione um cliente" />
                </div>
              </div>

              <div className="text-xs bg-card text-foreground -textLight text-center">ou</div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Novo Cliente</label>
                <div className="grid grid-cols-1 gap-2">
                  <Input placeholder="Nome" value={novoCliente.nome} onChange={e => setNovoCliente({
                  ...novoCliente,
                  nome: e.target.value
                })} />
                  <Input placeholder="E-mail" type="email" value={novoCliente.email} onChange={e => setNovoCliente({
                  ...novoCliente,
                  email: e.target.value
                })} />
                  <div className="flex gap-2">
                    <Input placeholder="WhatsApp" value={novoCliente.whatsapp} onChange={e => setNovoCliente({
                    ...novoCliente,
                    whatsapp: e.target.value
                  })} />
                    <Button onClick={criarNovoCliente} size="sm">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados Básicos */}
          <Card className="rounded-lg bg-card text-foreground ">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm">Dados do Orçamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 rounded-lg bg-neutral-50 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Data pretendida</label>
                  <Input type="date" value={data} onChange={e => setData(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Hora</label>
                  <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-xs font-medium mb-1 block">Categoria</label>
                   <CategorySelector categorias={categorias} value={categoria} onValueChange={setCategoria} placeholder="Selecione uma categoria" />
                 </div>
                 <div>
                   <label className="text-xs font-medium mb-1 block">Origem</label>
                   <Select value={origemSelecionada} onValueChange={setOrigemSelecionada}>
                     <SelectTrigger>
                       <SelectValue placeholder="Selecione" />
                     </SelectTrigger>
                      <SelectContent>
                        {ORIGENS_PADRAO.map(origem => <SelectItem key={origem.id} value={origem.id}>
                            {origem.nome}
                          </SelectItem>)}
                      </SelectContent>
                   </Select>
                 </div>
              </div>
              
              <div>
                <label className="text-xs font-medium mb-1 block">Descrição</label>
                <Input placeholder="Descrição do serviço (será levada para Agenda e Workflow)" value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Pacote */}
          <Card className="bg-neutral-50 rounded-lg">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm">Pacote Principal</CardTitle>
            </CardHeader>
             <CardContent className="rounded-lg bg-neutral-50 pt-3">
                <PackageSearchCombobox pacotes={pacotes} value={pacoteSelecionado} onSelect={handlePackageSelection} placeholder="Selecionar pacote..." filtrarPorCategoria={categoria} />
                {pacoteSelecionado && <div className="mt-3 p-3 bg-neumorphic-base rounded-lg shadow-neumorphic-inset">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{pacoteSelecionado.nome}</span>
                      <span className="text-sm font-bold">R$ {pacoteSelecionado.valor.toFixed(2)}</span>
                    </div>
                    <span className="text-xs text-neumorphic-textLight">{pacoteSelecionado.categoria}</span>
                    {pacoteSelecionado.produtosIncluidos && pacoteSelecionado.produtosIncluidos.length > 0 && <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-green-600 mb-1">
                          Produtos incluídos ({pacoteSelecionado.produtosIncluidos.length}):
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {pacoteSelecionado.produtosIncluidos.map(produtoIncluido => {
                    const produto = produtos.find(p => p.id === produtoIncluido.produtoId);
                    return produto ? `${produto.nome} (${produtoIncluido.quantidade}x)` : '';
                  }).filter(Boolean).join(', ')}
                        </div>
                      </div>}
                  </div>}
             </CardContent>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          {/* Detalhes do Orçamento */}
          <Card className="bg-card text-foreground rounded-lg">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm flex justify-between items-center">
                Detalhes do Orçamento
                <TemplateSelector value={detalhes} onChange={setDetalhes} onSelectTemplate={usarTemplate} />
              </CardTitle>
            </CardHeader>
            <CardContent className="rounded-lg bg-neutral-50 pt-3">
              <label htmlFor="budget-details" className="sr-only">Detalhes do Orçamento</label>
              <Textarea id="budget-details" placeholder="Descreva os detalhes do serviço..." value={detalhes} onChange={e => setDetalhes(e.target.value)} rows={8} className="py-2 px-3" />
            </CardContent>
          </Card>

          {/* Produtos Adicionais */}
          <Card className="rounded-lg bg-neutral-50">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm flex justify-between items-center">
                Produtos
                <div className="flex gap-1 bg-card text-foreground border-chart-primary ">
                  <ProductSearchCombobox products={produtos} onSelect={adicionarProdutoDoCombobox} placeholder="Adicionar produto..." />
                  <Button onClick={adicionarProduto} size="sm" variant="outline">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 rounded-lg bg-neutral-50 pt-3">
              {produtosAdicionais.map(produto => <div key={produto.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label htmlFor={`budget-product-name-${produto.id}`} className="text-xs font-medium mb-1 block">Nome</label>
                    <Input id={`budget-product-name-${produto.id}`} placeholder="Nome do produto" value={produto.nome} onChange={e => atualizarProduto(produto.id, 'nome', e.target.value)} disabled={produto.id.startsWith('auto-')} // Produtos inclusos não podem ser editados
                className={produto.id.startsWith('auto-') ? 'bg-green-50 text-green-700' : ''} />
                  </div>
                  <div>
                    <label htmlFor={`budget-product-qty-${produto.id}`} className="text-xs font-medium mb-1 block">Qtd</label>
                    <Input id={`budget-product-qty-${produto.id}`} type="number" min="1" value={produto.quantidade} onChange={e => atualizarProduto(produto.id, 'quantidade', parseInt(e.target.value) || 1)} disabled={produto.id.startsWith('auto-')} // Produtos inclusos não podem ter quantidade alterada
                className={produto.id.startsWith('auto-') ? 'bg-green-50 text-green-700' : ''} />
                  </div>
                  <div>
                    <label htmlFor={`budget-product-price-${produto.id}`} className="text-xs font-medium mb-1 block">Preço</label>
                    <Input id={`budget-product-price-${produto.id}`} type="text" value={produto.id.startsWith('auto-') ? 'Incluso' : produto.preco.toFixed(2)} onChange={e => !produto.id.startsWith('auto-') && atualizarProduto(produto.id, 'preco', parseFloat(e.target.value) || 0)} disabled={produto.id.startsWith('auto-')} // Produtos inclusos mostram "Incluso"
                className={produto.id.startsWith('auto-') ? 'bg-green-50 text-green-700 text-center font-medium' : ''} />
                  </div>
                  <Button onClick={() => removerProduto(produto.id)} variant="outline" size="sm" disabled={produto.id.startsWith('auto-')} // Produtos inclusos não podem ser removidos individualmente
              >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>)}
            </CardContent>
          </Card>

          {/* Resumo Financeiro */}
          <Card className="bg-neutral-50">
            <CardHeader className="rounded-lg bg-lunar-border pb-3">
              <CardTitle className="text-sm">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="rounded-lg bg-neutral-50 pt-3">
              <div className="space-y-2">
                {pacoteSelecionado && <div className="flex justify-between text-sm">
                    <span>Pacote:</span>
                    <span>R$ {valorPacote.toFixed(2)}</span>
                  </div>}
                {produtosManuais.length > 0 && <div className="flex justify-between text-sm">
                    <span>Produtos Manuais:</span>
                    <span>R$ {valorProdutosManuais.toFixed(2)}</span>
                  </div>}
                {produtosInclusos.length > 0 && <div className="flex justify-between text-sm text-green-600">
                    <span>Produtos Inclusos:</span>
                    <span>Incluso no pacote</span>
                  </div>}
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Subtotal:</span>
                    <span className="text-sm">R$ {valorTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Desconto (R$):</label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" value={desconto || ''} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} className="w-32" />
                  </div>
                  {desconto > 0 && <div className="flex justify-between text-sm text-red-600 mb-2">
                      <span>Desconto:</span>
                      <span>-R$ {desconto.toFixed(2)}</span>
                    </div>}
                  <div className="text-lg font-bold text-right border-t pt-2">
                    Total: R$ {valorFinal.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ações - sempre embaixo */}
      <div className="flex gap-3 justify-end">
        <Button onClick={() => salvarOrcamento('rascunho')}>
          Salvar
        </Button>
      </div>
    </div>;
}