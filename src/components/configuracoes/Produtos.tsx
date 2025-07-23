import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Produto {
  id: string;
  nome: string;
  preco_custo: number;
  preco_venda: number;
}

interface ProdutosProps {
  produtos: Produto[];
  setProdutos: React.Dispatch<React.SetStateAction<Produto[]>>;
}

export default function Produtos({ produtos, setProdutos }: ProdutosProps) {
  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    preco_custo: 0,
    preco_venda: 0
  });
  const [editandoProduto, setEditandoProduto] = useState<string | null>(null);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const calcularMargemLucro = (custoProduto: number, vendaProduto: number) => {
    const margem = vendaProduto - custoProduto;
    const porcentagem = margem / vendaProduto * 100;
    let corClasse = '';
    if (porcentagem < 15) corClasse = 'text-red-500';
    else if (porcentagem < 30) corClasse = 'text-yellow-500';
    else corClasse = 'text-green-500';
    return {
      valor: margem,
      porcentagem: porcentagem.toFixed(1) + '%',
      classe: corClasse
    };
  };

  const adicionarProduto = () => {
    if (novoProduto.nome.trim() === '') {
      toast.error('O nome do produto não pode estar vazio');
      return;
    }
    if (novoProduto.preco_venda <= 0) {
      toast.error('O preço de venda deve ser maior que zero');
      return;
    }
    const newId = String(Date.now());
    setProdutos([...produtos, {
      id: newId,
      ...novoProduto
    }]);
    setNovoProduto({
      nome: '',
      preco_custo: 0,
      preco_venda: 0
    });
    toast.success('Produto adicionado com sucesso!');
  };

  const iniciarEdicaoProduto = (id: string) => {
    setEditandoProduto(id);
  };

  const salvarEdicaoProduto = (id: string, dados: Partial<Produto>) => {
    setProdutos(produtos.map(produto => produto.id === id ? {
      ...produto,
      ...dados
    } : produto));
    setEditandoProduto(null);
    toast.success('Produto atualizado com sucesso!');
  };

  const removerProduto = (id: string) => {
    setProdutos(produtos.filter(produto => produto.id !== id));
    toast.success('Produto removido com sucesso!');
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h3 className="text-base font-medium">Novo Produto</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Configure os produtos adicionais disponíveis para venda.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="produto-nome" className="block text-sm font-medium mb-1">
              Nome<span className="text-red-500">*</span>
            </label>
            <Input 
              id="produto-nome" 
              placeholder="Nome do produto" 
              value={novoProduto.nome} 
              onChange={e => setNovoProduto({
                ...novoProduto,
                nome: e.target.value
              })} 
            />
          </div>
          
          <div>
            <label htmlFor="produto-custo" className="block text-sm font-medium mb-1">
              Preço de Custo (R$)
            </label>
            <Input 
              id="produto-custo" 
              type="number" 
              placeholder="0,00" 
              value={novoProduto.preco_custo || ''} 
              onChange={e => setNovoProduto({
                ...novoProduto,
                preco_custo: Number(e.target.value)
              })} 
            />
          </div>
          
          <div>
            <label htmlFor="produto-venda" className="block text-sm font-medium mb-1">
              Preço de Venda (R$)<span className="text-red-500">*</span>
            </label>
            <Input 
              id="produto-venda" 
              type="number" 
              placeholder="0,00" 
              value={novoProduto.preco_venda || ''} 
              onChange={e => setNovoProduto({
                ...novoProduto,
                preco_venda: Number(e.target.value)
              })} 
            />
          </div>
        </div>
        
        <div className="mt-3">
          <Button onClick={adicionarProduto} className="flex items-center gap-1 bg-lunar-accent">
            <Plus className="h-4 w-4" />
            <span>Adicionar Produto</span>
          </Button>
        </div>
      </div>
      
      <div>
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-medium">Produtos Cadastrados</h3>
          <p className="text-sm text-muted-foreground">
            Lista de todos os produtos adicionais disponíveis para venda.
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-gray-50/50 px-4 py-3 border-b border-gray-100 text-sm font-medium">
            <div className="col-span-4 sm:col-span-5 text-gray-700">Produto</div>
            <div className="col-span-2 hidden sm:block text-gray-700">Custo</div>
            <div className="col-span-4 sm:col-span-2 text-gray-700">Venda</div>
            <div className="col-span-2 hidden sm:block text-gray-700">Margem</div>
            <div className="col-span-4 sm:col-span-1 text-right text-gray-700">Ações</div>
          </div>
          
          <div className="divide-y divide-gray-50">
            {produtos.map((produto, index) => {
              const margem = calcularMargemLucro(produto.preco_custo, produto.preco_venda);
              return (
                <div 
                  key={produto.id} 
                  className={`grid grid-cols-12 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25/30'} hover:bg-gray-50/70 transition-colors`}
                >
                  {editandoProduto === produto.id ? (
                    <>
                      <div className="col-span-4 sm:col-span-5 pr-2">
                        <Input 
                          defaultValue={produto.nome} 
                          onChange={e => {
                            const novoNome = e.target.value;
                            setProdutos(prev => prev.map(p => p.id === produto.id ? {
                              ...p,
                              nome: novoNome
                            } : p));
                          }}
                          className="h-8 text-sm" 
                        />
                      </div>
                      <div className="col-span-2 hidden sm:block pr-2">
                        <Input 
                          type="number" 
                          defaultValue={produto.preco_custo} 
                          onChange={e => {
                            const novoPrecoCusto = Number(e.target.value);
                            setProdutos(prev => prev.map(p => p.id === produto.id ? {
                              ...p,
                              preco_custo: novoPrecoCusto
                            } : p));
                          }}
                          className="h-8 text-sm" 
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2 pr-2">
                        <Input 
                          type="number" 
                          defaultValue={produto.preco_venda} 
                          onChange={e => {
                            const novoPrecoVenda = Number(e.target.value);
                            setProdutos(prev => prev.map(p => p.id === produto.id ? {
                              ...p,
                              preco_venda: novoPrecoVenda
                            } : p));
                          }}
                          className="h-8 text-sm" 
                        />
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        {formatarMoeda((produtos.find(p => p.id === produto.id)?.preco_venda || 0) - (produtos.find(p => p.id === produto.id)?.preco_custo || 0))}
                      </div>
                      <div className="flex justify-end items-center gap-2 col-span-4 sm:col-span-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={() => salvarEdicaoProduto(produto.id, produtos.find(p => p.id === produto.id) || {})}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditandoProduto(null)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-4 sm:col-span-5">{produto.nome}</div>
                      <div className="col-span-2 hidden sm:block">
                        {formatarMoeda(produto.preco_custo)}
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        {formatarMoeda(produto.preco_venda)}
                      </div>
                      <div className={`col-span-2 hidden sm:block ${margem.classe}`}>
                        {formatarMoeda(margem.valor)} ({margem.porcentagem})
                      </div>
                      <div className="flex justify-end gap-2 col-span-4 sm:col-span-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={() => iniciarEdicaoProduto(produto.id)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" 
                          onClick={() => removerProduto(produto.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            
            {produtos.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-white">
                Nenhum produto cadastrado. Adicione seu primeiro produto acima.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}