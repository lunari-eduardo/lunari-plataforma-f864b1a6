import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, ChevronUp, Save, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { SalvarPacoteModal } from './SalvarPacoteModal';
import { PadraoHorasService, CalculadoraService, IndicadoresService } from '@/services/PricingService';
import type { ProdutoAdicional, CustoExtra, StatusSalvamento } from '@/types/precificacao';
// Tipos movidos para src/types/precificacao.ts
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

  // Campos do projeto atual (AGORA PERSISTENTES)
  const [horasEstimadas, setHorasEstimadas] = useState(0);
  const [markup, setMarkup] = useState(2);

  // Produtos e custos extras (AGORA PERSISTENTES)
  const [produtos, setProdutos] = useState<ProdutoAdicional[]>([]);
  const [custosExtras, setCustosExtras] = useState<CustoExtra[]>([]);

  // Status de salvamento
  const [statusCalculadora, setStatusCalculadora] = useState<StatusSalvamento>('nao_salvo');
  const [temEstadoSalvo, setTemEstadoSalvo] = useState(false);

  // Carregar padrão de horas - NOVO SISTEMA
  useEffect(() => {
    try {
      const dadosSalvos = PadraoHorasService.carregar();
      setHorasDisponiveis(dadosSalvos.horasDisponiveis);
      setDiasTrabalhados(dadosSalvos.diasTrabalhados);
    } catch (error) {
      console.error('Erro ao carregar padrão de horas:', error);
    }
  }, []);

  // Carregar estado da calculadora salvo - NOVO RECURSO
  useEffect(() => {
    try {
      const estadoSalvo = CalculadoraService.carregar();
      if (estadoSalvo) {
        setHorasEstimadas(estadoSalvo.horasEstimadas);
        setMarkup(estadoSalvo.markup);
        setProdutos(estadoSalvo.produtos);
        setCustosExtras(estadoSalvo.custosExtras);
        setStatusCalculadora('salvo');
        setTemEstadoSalvo(true);
        IndicadoresService.atualizarIndicador('calculadora', 'salvo', 'Estado anterior carregado');
        console.log('✅ Estado da calculadora carregado');
      }
    } catch (error) {
      console.error('Erro ao carregar estado da calculadora:', error);
    }
  }, []);

  // Cálculos (movidos para cima para evitar erro de declaração)
  const horasMensais = horasDisponiveis * diasTrabalhados * 4; // 4 semanas por mês
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const custoHorasServico = horasEstimadas * custoHora;
  const valorProdutos = (produtos || []).reduce((total, p) => total + p.valorVenda * p.quantidade, 0);
  const valorCustosExtras = (custosExtras || []).reduce((total, c) => total + c.valorUnitario * c.quantidade, 0);
  const custoTotalServico = custoHorasServico + valorProdutos + valorCustosExtras;
  const precoFinal = custoTotalServico * markup;
  const lucroLiquido = precoFinal - custoTotalServico;
  const lucratividade = custoTotalServico > 0 ? lucroLiquido / precoFinal * 100 : 0;

  // Auto-save do estado da calculadora - NOVO RECURSO
  useEffect(() => {
    // Só salvar se houver algum conteúdo significativo
    const temConteudo = horasEstimadas > 0 || produtos.length > 0 || custosExtras.length > 0;
    
    if (temConteudo) {
      const timeoutId = setTimeout(() => {
        try {
          setStatusCalculadora('salvando');
          
          const estadoAtual = {
            horasEstimadas,
            markup,
            produtos,
            custosExtras,
            custoTotalCalculado: custoTotalServico,
            precoFinalCalculado: precoFinal,
            lucratividade,
            salvo_automaticamente: true
          };
          
          const sucesso = CalculadoraService.salvar(estadoAtual, true);
          
          if (sucesso) {
            setStatusCalculadora('salvo');
            setTemEstadoSalvo(true);
            IndicadoresService.atualizarIndicador('calculadora', 'salvo', 'Auto-salvamento');
          } else {
            setStatusCalculadora('erro');
          }
        } catch (error) {
          console.error('Erro no auto-save da calculadora:', error);
          setStatusCalculadora('erro');
        }
      }, 2000); // Debounce de 2 segundos para calculadora
      
      return () => clearTimeout(timeoutId);
    }
  }, [horasEstimadas, markup, produtos, custosExtras, custoTotalServico, precoFinal, lucratividade]);
  const salvarPadraoHoras = () => {
    try {
      const sucesso = PadraoHorasService.salvar({
        horasDisponiveis,
        diasTrabalhados
      });
      
      if (sucesso) {
        IndicadoresService.atualizarIndicador('padrao_horas', 'salvo', 'Padrão salvo');
        console.log('✅ Padrão de horas salvo');
      }
    } catch (error) {
      console.error('Erro ao salvar padrão de horas:', error);
    }
  };

  // Limpar estado da calculadora - NOVO RECURSO
  const limparCalculadora = () => {
    try {
      setHorasEstimadas(0);
      setMarkup(2);
      setProdutos([]);
      setCustosExtras([]);
      
      CalculadoraService.limpar();
      setStatusCalculadora('nao_salvo');
      setTemEstadoSalvo(false);
      
      IndicadoresService.atualizarIndicador('calculadora', 'nao_salvo', 'Calculadora limpa');
      console.log('✅ Calculadora limpa');
    } catch (error) {
      console.error('Erro ao limpar calculadora:', error);
    }
  };

  // Salvar estado manualmente
  const salvarEstadoManualmente = () => {
    try {
      setStatusCalculadora('salvando');
      
      const estadoAtual = {
        nome: `Cálculo ${new Date().toLocaleString()}`,
        horasEstimadas,
        markup,
        produtos,
        custosExtras,
        custoTotalCalculado: custoTotalServico,
        precoFinalCalculado: precoFinal,
        lucratividade,
        salvo_automaticamente: false
      };
      
      const sucesso = CalculadoraService.salvar(estadoAtual, false);
      
      if (sucesso) {
        setStatusCalculadora('salvo');
        setTemEstadoSalvo(true);
        IndicadoresService.atualizarIndicador('calculadora', 'salvo', 'Salvo manualmente');
        console.log('✅ Estado salvo manualmente');
      } else {
        setStatusCalculadora('erro');
      }
    } catch (error) {
      console.error('Erro no salvamento manual:', error);
      setStatusCalculadora('erro');
    }
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
            <Button variant="default" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg mx-auto">
              <span className="text-sm">📋</span>
              {isOpen ? <>
                  Fechar Calculadora
                  <ChevronUp className="h-4 w-4" />
                </> : <>
                  {temEstadoSalvo ? '[📊] Continuar Cálculo' : '[+] Calcular Novo Preço'}
                  <ChevronDown className="h-4 w-4" />
                </>}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <Card className="mt-6 bg-lunar-surface border-lunar-border/50">
              <CardContent className="p-6">
                {/* Título, descrição e controles no topo */}
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Calculadora de Serviços</h3>
                      <p className="text-sm text-muted-foreground">
                        Calcule o preço de um serviço específico com base nos seus custos e em variáveis do projeto.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                  </div>
                  
                  {temEstadoSalvo && (
                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                      💾 Cálculo anterior carregado automaticamente. Use "Limpar" para começar novo cálculo.
                    </div>
                  )}
                </div>
                
                {/* Layout principal - duas colunas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda - Base de Cálculo */}
                  <div className="space-y-4 lg:order-1">
                    {/* Base de Cálculo - Horas */}
                    <Card className="bg-card border border-border shadow-sm">
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
                    <Card className="bg-card border border-border shadow-sm">
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
                                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={produto.quantidade} onChange={e => {
                                  const value = parseInt(e.target.value) || 1;
                                  if (value >= 1) {
                                    atualizarProduto(produto.id, 'quantidade', value);
                                  }
                                }} className="h-8" />
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
                    <Card className="bg-card border border-border shadow-sm">
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
                                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={custo.quantidade} onChange={e => {
                                  const value = parseInt(e.target.value) || 1;
                                  if (value >= 1) {
                                    atualizarCustoExtra(custo.id, 'quantidade', value);
                                  }
                                }} className="h-8" />
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
                    <Card className="bg-card border border-border shadow-sm">
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
                            <Button onClick={() => setSalvarPacoteModalOpen(true)} variant="default" className="w-full" disabled={precoFinal <= 0}>
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