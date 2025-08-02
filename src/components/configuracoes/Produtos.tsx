import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
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
export default function Produtos({
  produtos,
  setProdutos
}: ProdutosProps) {
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
    if (porcentagem < 15) corClasse = 'text-red-500';else if (porcentagem < 30) corClasse = 'text-yellow-500';else corClasse = 'text-green-500';
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
  const isMobile = useIsMobile();
  return <div className="mt-4 space-y-6">
      <div>
        <h3 className="font-medium text-sm">Novo Produto</h3>
        <p className="text-muted-foreground mt-1 mb-3 text-xs">
          Configure os produtos adicionais disponíveis para venda.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="produto-nome" className="block text-sm font-medium mb-1">
              Nome<span className="text-red-500">*</span>
            </label>
            <Input id="produto-nome" placeholder="Nome do produto" value={novoProduto.nome} onChange={e => setNovoProduto({
            ...novoProduto,
            nome: e.target.value
          })} className="bg-lunar-surface" />
          </div>
          
          <div>
            <label htmlFor="produto-custo" className="block text-sm font-medium mb-1">
              Preço de Custo (R$)
            </label>
            <Input id="produto-custo" type="number" placeholder="0,00" value={novoProduto.preco_custo || ''} onChange={e => setNovoProduto({
            ...novoProduto,
            preco_custo: Number(e.target.value)
          })} className="bg-lunar-surface" />
          </div>
          
          <div>
            <label htmlFor="produto-venda" className="block text-sm font-medium mb-1">
              Preço de Venda (R$)<span className="text-red-500">*</span>
            </label>
            <Input id="produto-venda" type="number" placeholder="0,00" value={novoProduto.preco_venda || ''} onChange={e => setNovoProduto({
            ...novoProduto,
            preco_venda: Number(e.target.value)
          })} className="bg-lunar-surface" />
          </div>
        </div>
        
        <div className="mt-3">
          <Button onClick={adicionarProduto} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Adicionar Produto</span>
          </Button>
        </div>
      </div>
      
      <div>
        <div className="space-y-1 mb-4">
          <h3 className="font-medium text-sm">Produtos Cadastrados</h3>
          <p className="text-muted-foreground text-xs">
            Lista de todos os produtos adicionais disponíveis para venda.
          </p>
        </div>
        
        {produtos.length === 0 ? <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado. Adicione seu primeiro produto acima.
              </p>
            </CardContent>
          </Card> : isMobile ?
      // Layout em cards para mobile
      <div className="space-y-3 py-0">
            {produtos.map(produto => {
          const margem = calcularMargemLucro(produto.preco_custo, produto.preco_venda);
          return <Card key={produto.id} className="overflow-hidden">
                  <CardContent className="p-4 py-[7px] px-[10px]">
                    {editandoProduto === produto.id ? <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nome</label>
                          <Input defaultValue={produto.nome} onChange={e => {
                    const novoNome = e.target.value;
                    setProdutos(prev => prev.map(p => p.id === produto.id ? {
                      ...p,
                      nome: novoNome
                    } : p));
                  }} className="text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Custo (R$)</label>
                            <Input type="number" defaultValue={produto.preco_custo} onChange={e => {
                      const novoPrecoCusto = Number(e.target.value);
                      setProdutos(prev => prev.map(p => p.id === produto.id ? {
                        ...p,
                        preco_custo: novoPrecoCusto
                      } : p));
                    }} className="text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Venda (R$)</label>
                            <Input type="number" defaultValue={produto.preco_venda} onChange={e => {
                      const novoPrecoVenda = Number(e.target.value);
                      setProdutos(prev => prev.map(p => p.id === produto.id ? {
                        ...p,
                        preco_venda: novoPrecoVenda
                      } : p));
                    }} className="text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => salvarEdicaoProduto(produto.id, produtos.find(p => p.id === produto.id) || {})}>
                            <Save className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditandoProduto(null)}>
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div> : <div className="space-y-3">
                        <div className="flex items-center justify-between py-0">
                          <h4 className="text-sm font-semibold">{produto.nome}</h4>
                          <div className="flex gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => iniciarEdicaoProduto(produto.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:border-red-200" onClick={() => removerProduto(produto.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block text-xs">Custo</span>
                            <span className="font-medium">{formatarMoeda(produto.preco_custo)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs">Venda</span>
                            <span className="font-medium">{formatarMoeda(produto.preco_venda)}</span>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground text-xs">Margem de Lucro</span>
                            <span className={`font-medium ${margem.classe}`}>
                              {formatarMoeda(margem.valor)} ({margem.porcentagem})
                            </span>
                          </div>
                        </div>
                      </div>}
                  </CardContent>
                </Card>;
        })}
          </div> :
      // Layout em tabela para desktop
      <div className="bg-white rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 px-4 py-3 border-b text-sm font-medium bg-lunar-surface">
              <div className="col-span-5 text-foreground">Produto</div>
              <div className="col-span-2 text-foreground">Custo</div>
              <div className="col-span-2 text-foreground">Venda</div>
              <div className="col-span-2 text-foreground">Margem</div>
              <div className="col-span-1 text-right text-foreground">Ações</div>
            </div>
            
            <div className="divide-y divide-border">
              {produtos.map((produto, index) => {
            const margem = calcularMargemLucro(produto.preco_custo, produto.preco_venda);
            return <div key={produto.id} className={`grid grid-cols-12 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}>
                    {editandoProduto === produto.id ? <>
                        <div className="col-span-5 pr-2">
                          <Input defaultValue={produto.nome} onChange={e => {
                    const novoNome = e.target.value;
                    setProdutos(prev => prev.map(p => p.id === produto.id ? {
                      ...p,
                      nome: novoNome
                    } : p));
                  }} className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 pr-2">
                          <Input type="number" defaultValue={produto.preco_custo} onChange={e => {
                    const novoPrecoCusto = Number(e.target.value);
                    setProdutos(prev => prev.map(p => p.id === produto.id ? {
                      ...p,
                      preco_custo: novoPrecoCusto
                    } : p));
                  }} className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 pr-2">
                          <Input type="number" defaultValue={produto.preco_venda} onChange={e => {
                    const novoPrecoVenda = Number(e.target.value);
                    setProdutos(prev => prev.map(p => p.id === produto.id ? {
                      ...p,
                      preco_venda: novoPrecoVenda
                    } : p));
                  }} className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 flex items-center">
                          {formatarMoeda((produtos.find(p => p.id === produto.id)?.preco_venda || 0) - (produtos.find(p => p.id === produto.id)?.preco_custo || 0))}
                        </div>
                        <div className="flex justify-end items-center gap-1 col-span-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => salvarEdicaoProduto(produto.id, produtos.find(p => p.id === produto.id) || {})}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditandoProduto(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </> : <>
                        <div className="col-span-5 font-medium">{produto.nome}</div>
                        <div className="col-span-2">{formatarMoeda(produto.preco_custo)}</div>
                        <div className="col-span-2">{formatarMoeda(produto.preco_venda)}</div>
                        <div className={`col-span-2 ${margem.classe} font-medium`}>
                          {formatarMoeda(margem.valor)} ({margem.porcentagem})
                        </div>
                        <div className="flex justify-end gap-1 col-span-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => iniciarEdicaoProduto(produto.id)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" onClick={() => removerProduto(produto.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>}
                  </div>;
          })}
            </div>
          </div>}
      </div>
    </div>;
}