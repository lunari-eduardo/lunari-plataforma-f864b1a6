import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { SalvarPacoteModal } from './SalvarPacoteModal';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
interface ProdutoAdicional {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
  quantidade: number;
}
interface CustoExtra {
  id: string;
  descricao: string;
  valorUnitario: number;
  quantidade: number;
}
interface CalculadoraServicosProps {
  custosFixosTotal: number;
}
export function CalculadoraServicos({
  custosFixosTotal
}: CalculadoraServicosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [salvarPacoteModalOpen, setSalvarPacoteModalOpen] = useState(false);

  // Base de cálculo - Horas (persistente)
  const [horasDisponiveis, setHorasDisponiveis] = useState(8);
  const [diasTrabalhados, setDiasTrabalhados] = useState(5);

  // Campos do projeto atual
  const [horasEstimadas, setHorasEstimadas] = useState(0);
  const [markup, setMarkup] = useState(2);

  // Produtos e custos extras
  const [produtos, setProdutos] = useState<ProdutoAdicional[]>([]);
  const [custosExtras, setCustosExtras] = useState<CustoExtra[]>([]);

  // Carregar dados salvos
  useEffect(() => {
    const dadosSalvos = storage.load('precificacao_padrao_horas', {
      horasDisponiveis: 8,
      diasTrabalhados: 5
    });
    setHorasDisponiveis(dadosSalvos.horasDisponiveis);
    setDiasTrabalhados(dadosSalvos.diasTrabalhados);
  }, []);

  // Cálculos
  const horasMensais = horasDisponiveis * diasTrabalhados * 4; // 4 semanas por mês
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const custoHorasServico = horasEstimadas * custoHora;
  const valorProdutos = produtos.reduce((total, p) => total + p.valorVenda * p.quantidade, 0);
  const valorCustosExtras = custosExtras.reduce((total, c) => total + c.valorUnitario * c.quantidade, 0);
  const custoTotalServico = custoHorasServico + valorProdutos + valorCustosExtras;
  const precoFinal = custoTotalServico * markup;
  const lucroLiquido = precoFinal - custoTotalServico;
  const lucratividade = custoTotalServico > 0 ? lucroLiquido / precoFinal * 100 : 0;
  const salvarPadraoHoras = () => {
    storage.save('precificacao_padrao_horas', {
      horasDisponiveis,
      diasTrabalhados
    });
  };
  const adicionarProduto = () => {
    setProdutos([...produtos, {
      id: Date.now().toString(),
      nome: '',
      custo: 0,
      valorVenda: 0,
      quantidade: 1
    }]);
  };
  const atualizarProduto = (id: string, campo: keyof ProdutoAdicional, valor: any) => {
    setProdutos(produtos.map(p => p.id === id ? {
      ...p,
      [campo]: valor
    } : p));
  };
  const removerProduto = (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
  };
  const adicionarCustoExtra = () => {
    setCustosExtras([...custosExtras, {
      id: Date.now().toString(),
      descricao: '',
      valorUnitario: 0,
      quantidade: 1
    }]);
  };
  const atualizarCustoExtra = (id: string, campo: keyof CustoExtra, valor: any) => {
    setCustosExtras(custosExtras.map(c => c.id === id ? {
      ...c,
      [campo]: valor
    } : c));
  };
  const removerCustoExtra = (id: string) => {
    setCustosExtras(custosExtras.filter(c => c.id !== id));
  };
  return <div className="w-full">
      <div className="flex justify-center mb-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
          <CollapsibleTrigger asChild>
            <Button className="border border-amber-500/30 flex items-center justify-center gap-2 px-4 py-2 rounded-lg mx-auto text-stone-800 bg-chart-primary">
              
              {isOpen ? <>
                  Fechar Calculadora
                  <ChevronUp className="h-4 w-4" />
                </> : <>
                  [+] Calcular Novo Preço
                  <ChevronDown className="h-4 w-4" />
                </>}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <Card className="mt-6 bg-lunar-surface border-lunar-border/50">
              <CardContent className="p-6">
                {/* Título e descrição no topo */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lunar-text mb-2">Calculadora de Serviços</h3>
                  <p className="text-sm text-lunar-textSecondary">
                    Calcule o preço de um serviço específico com base nos seus custos e em variáveis do projeto.
                  </p>
                </div>
                
                {/* Layout principal - duas colunas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda - Base de Cálculo */}
                  <div className="space-y-4 lg:order-1">
                    {/* Base de Cálculo - Horas */}
                    <Card className="bg-lunar-bg/50">
                      <CardHeader>
                        <CardTitle>Base de Cálculo - Horas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="horas-disponiveis" className="text-sm">Horas disponíveis/dia</Label>
                            <Input id="horas-disponiveis" type="number" min="1" value={horasDisponiveis} onChange={e => setHorasDisponiveis(Number(e.target.value))} className="h-8" />
                          </div>
                          <div>
                            <Label htmlFor="dias-trabalhados" className="text-sm">Dias trabalhados/semana</Label>
                            <Input id="dias-trabalhados" type="number" min="1" max="7" value={diasTrabalhados} onChange={e => setDiasTrabalhados(Number(e.target.value))} className="h-8" />
                          </div>
                        </div>
                        
                        <Button onClick={salvarPadraoHoras} variant="outline" size="sm" className="w-full">
                          ⚙️ Salvar Padrão de Horas
                        </Button>
                        
                        <div>
                          <Label htmlFor="horas-estimadas" className="text-sm">Horas estimadas para o serviço</Label>
                          <Input id="horas-estimadas" type="number" min="0" step="0.5" value={horasEstimadas} onChange={e => setHorasEstimadas(Number(e.target.value))} className="h-8" />
                        </div>
                        
                        <div className="space-y-2 pt-3 border-t border-lunar-border/30">
                          <div className="flex justify-between text-sm">
                            <span className="text-lunar-textSecondary">Custo da Hora (R$):</span>
                            <span className="font-medium text-lunar-text">R$ {custoHora.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-lunar-textSecondary">Custo das Horas do Serviço (R$):</span>
                            <span className="font-medium text-lunar-text">R$ {custoHorasServico.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Coluna Direita - Produtos e Custos Extras */}
                  <div className="space-y-4 lg:order-2">
                    {/* Produtos Adicionais */}
                    <Card className="bg-lunar-bg/50">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Produtos Adicionais</CardTitle>
                          <Button onClick={adicionarProduto} size="sm" variant="outline">
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar Produto
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {produtos.length === 0 && <p className="text-sm text-lunar-textSecondary text-center py-4">
                              Nenhum produto adicionado
                            </p>}
                          {produtos.map(produto => <div key={produto.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-lunar-surface/50 p-3 rounded border border-lunar-border/20">
                              <div>
                                <Label className="text-xs">Produto</Label>
                                <ProductSelector value={produto.nome} onSelect={product => {
                              if (product) {
                                atualizarProduto(produto.id, 'nome', product.nome);
                                atualizarProduto(produto.id, 'custo', product.custo);
                                atualizarProduto(produto.id, 'valorVenda', product.valorVenda);
                              }
                            }} />
                              </div>
                              <div>
                                <Label className="text-xs">Quantidade</Label>
                                <Input type="number" min="1" value={produto.quantidade} onChange={e => atualizarProduto(produto.id, 'quantidade', parseInt(e.target.value) || 1)} className="h-8" />
                              </div>
                              <div>
                                <Label className="text-xs">Valor Venda</Label>
                                <Input type="number" min="0" step="0.01" value={produto.valorVenda} onChange={e => atualizarProduto(produto.id, 'valorVenda', parseFloat(e.target.value) || 0)} className="h-8" />
                              </div>
                              <Button onClick={() => removerProduto(produto.id)} variant="outline" size="sm" className="h-8">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>)}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Custos Adicionais do Projeto */}
                    <Card className="bg-lunar-bg/50">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Custos Adicionais do Projeto</CardTitle>
                          <Button onClick={adicionarCustoExtra} size="sm" variant="outline">
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar Custo Extra
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {custosExtras.length === 0 && <p className="text-sm text-lunar-textSecondary text-center py-4">
                              Nenhum custo extra adicionado
                            </p>}
                          {custosExtras.map(custo => <div key={custo.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-lunar-surface/50 p-3 rounded border border-lunar-border/20">
                              <div>
                                <Label className="text-xs">Descrição</Label>
                                <Input placeholder="Descrição do custo" value={custo.descricao} onChange={e => atualizarCustoExtra(custo.id, 'descricao', e.target.value)} className="h-8" />
                              </div>
                              <div>
                                <Label className="text-xs">Valor Unitário</Label>
                                <Input type="number" min="0" step="0.01" value={custo.valorUnitario} onChange={e => atualizarCustoExtra(custo.id, 'valorUnitario', parseFloat(e.target.value) || 0)} className="h-8" />
                              </div>
                              <div>
                                <Label className="text-xs">Quantidade</Label>
                                <Input type="number" min="1" value={custo.quantidade} onChange={e => atualizarCustoExtra(custo.id, 'quantidade', parseInt(e.target.value) || 1)} className="h-8" />
                              </div>
                              <Button onClick={() => removerCustoExtra(custo.id)} variant="outline" size="sm" className="h-8">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Resumo e Precificação Final - Aparece por último em mobile */}
                  <div className="lg:col-span-2 lg:order-3 order-last">
                    <Card className="bg-lunar-bg/50">
                      <CardHeader>
                        <CardTitle>Resumo e Precificação Final</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="markup" className="text-sm">Markup (Multiplicador):</Label>
                          <Input id="markup" type="number" min="1" step="0.1" value={markup} onChange={e => setMarkup(Number(e.target.value) || 1)} className="w-20 h-8 text-right" />
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-lunar-textSecondary">Custo Total do Serviço:</span>
                          <span className="font-medium text-lunar-text">R$ {custoTotalServico.toFixed(2)}</span>
                        </div>
                        
                        <div className="border-t border-lunar-border/30 pt-3 space-y-2">
                          <div className="flex justify-between text-lg font-bold text-blue-600">
                            <span>Preço Final do Serviço:</span>
                            <span>R$ {precoFinal.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Lucro Líquido (R$):</span>
                            <span>R$ {lucroLiquido.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Lucratividade (%):</span>
                            <span>{lucratividade.toFixed(1)}%</span>
                          </div>
                          
                          {/* BOTÃO PARA SALVAR COMO PACOTE */}
                          <div className="border-t border-lunar-border/30 pt-4 mt-4">
                            <Button onClick={() => setSalvarPacoteModalOpen(true)} className="w-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 hover:bg-emerald-500/30" disabled={precoFinal <= 0}>
                              📦 [+] Salvar como Pacote
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      {/* Modal para Salvar Pacote */}
      <SalvarPacoteModal isOpen={salvarPacoteModalOpen} onClose={() => setSalvarPacoteModalOpen(false)} precoFinal={precoFinal} produtos={produtos} horasEstimadas={horasEstimadas} markup={markup} />
    </div>;
}