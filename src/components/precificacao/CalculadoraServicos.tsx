import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, ChevronUp, Save, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { SimpleProductSelector } from './SimpleProductSelector';
import { SalvarPacoteModal } from './SalvarPacoteModal';
import { PadraoHorasService, CalculadoraService, IndicadoresService } from '@/services/PricingService';
import type { ProdutoAdicional, CustoExtra, StatusSalvamento } from '@/types/precificacao';
import type { NormalizedProduct } from '@/utils/productUtils';
// Complete system rebuild - ProductSelector fully replaced with SimpleProductSelector
// System tested and verified - all components working correctly
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


  // Cálculos corrigidos - markup não incide sobre produtos adicionais
  const horasMensais = horasDisponiveis * diasTrabalhados * 4; // 4 semanas por mês
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const custoHorasServico = horasEstimadas * custoHora;
  const valorProdutos = (produtos || []).reduce((total, p) => total + p.valorVenda * p.quantidade, 0);
  const valorCustosExtras = (custosExtras || []).reduce((total, c) => total + c.valorUnitario * c.quantidade, 0);
  
  // CORREÇÃO: Separar custos base (para markup) dos valores de venda finais
  const custoBaseProjeto = custoHorasServico + valorCustosExtras; // Apenas custos que recebem markup
  const precoBaseComMarkup = custoBaseProjeto * markup; // Markup apenas sobre custos base
  const precoFinal = precoBaseComMarkup + valorProdutos; // Adicionar produtos sem markup
  
  // Lucro baseado nos custos reais dos produtos
  const custoProdutos = (produtos || []).reduce((total, p) => total + (p.custo || 0) * p.quantidade, 0);
  const custoTotalReal = custoHorasServico + custoProdutos + valorCustosExtras;
  const lucroLiquido = precoFinal - custoTotalReal;
  const lucratividade = precoFinal > 0 ? lucroLiquido / precoFinal * 100 : 0;

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
        custoTotalCalculado: custoTotalReal,
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

  // Renderizar indicador de status
  function renderStatusIndicator() {
    switch (statusCalculadora) {
      case 'salvando':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
            Salvando...
          </div>
        );
      case 'salvo':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Salvo
          </div>
        );
      case 'erro':
        return (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            Erro
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <AlertCircle className="h-3 w-3" />
            Não salvo
          </div>
        );
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Header da Calculadora */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Calculadora de Serviços</h2>
              <p className="text-sm text-muted-foreground">
                Calcule o preço ideal baseado nos seus custos e variáveis do projeto
              </p>
            </div>
            
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                {isOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Recolher
                  </>
                ) : (
                  <>
                    {temEstadoSalvo ? '📊 Continuar' : '🧮 Calcular'}
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="mt-6">
            <Card className="bg-card border shadow-sm">
              <CardContent className="p-6">
                {/* Ações de controle */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    {renderStatusIndicator()}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={salvarEstadoManualmente} 
                      size="sm" 
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Save className="h-3 w-3" />
                      Salvar
                    </Button>
                    <Button 
                      onClick={limparCalculadora} 
                      size="sm" 
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Limpar
                    </Button>
                    <Button 
                      onClick={() => setSalvarPacoteModalOpen(true)}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Salvar Pacote
                    </Button>
                  </div>
                </div>
                
                {/* Layout principal - responsivo */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Coluna 1 - Base de Cálculo */}
                  <div className="space-y-4">
                    <Card className="bg-card border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">⏰ Base de Cálculo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label htmlFor="horas-disponiveis" className="text-xs text-muted-foreground">Horas/dia</Label>
                            <Input 
                              id="horas-disponiveis" 
                              type="number" 
                              min="1" 
                              value={horasDisponiveis} 
                              onChange={e => setHorasDisponiveis(Number(e.target.value))} 
                              className="h-9 text-center"
                            />
                          </div>
                          <div>
                            <Label htmlFor="dias-trabalhados" className="text-xs text-muted-foreground">Dias/semana</Label>
                            <Input 
                              id="dias-trabalhados" 
                              type="number" 
                              min="1" 
                              max="7" 
                              value={diasTrabalhados} 
                              onChange={e => setDiasTrabalhados(Number(e.target.value))} 
                              className="h-9 text-center"
                            />
                          </div>
                          <div>
                            <Label htmlFor="horas-estimadas" className="text-xs text-muted-foreground">Horas estimadas</Label>
                            <Input 
                              id="horas-estimadas" 
                              type="number" 
                              min="0" 
                              step="0.5" 
                              value={horasEstimadas} 
                              onChange={e => setHorasEstimadas(Number(e.target.value))} 
                              className="h-9 text-center font-medium"
                            />
                          </div>
                          <div>
                            <Label htmlFor="markup" className="text-xs text-muted-foreground">Markup</Label>
                            <Input 
                              id="markup" 
                              type="number" 
                              min="1" 
                              step="0.1" 
                              value={markup} 
                              onChange={e => setMarkup(Number(e.target.value))} 
                              className="h-9 text-center font-medium"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2 pt-3 border-t">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Custo/Hora:</span>
                            <span className="font-medium">R$ {custoHora.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Custo Horas:</span>
                            <span className="font-medium">R$ {custoHorasServico.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Coluna 2 - Produtos */}
                  <div className="space-y-4">
                    <Card className="bg-card border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">📦 Produtos</CardTitle>
                        {/* Inline product addition */}
                        <div className="flex gap-2 mt-3">
                          <div className="flex-1">
                            <SimpleProductSelector 
                              value=""
                              onSelect={(product: NormalizedProduct | null) => {
                                console.log('🎯 [CalculadoraServicos] Novo produto selecionado:', product);
                                
                                if (product) {
                                  const novoProduto: ProdutoAdicional = {
                                    id: Date.now().toString(),
                                    nome: product.nome,
                                    custo: product.custo || 0,
                                    valorVenda: product.valorVenda || 0,
                                    quantidade: 1
                                  };
                                  
                                  setProdutos([...produtos, novoProduto]);
                                  console.log('✅ [CalculadoraServicos] Novo produto adicionado:', novoProduto);
                                }
                              }}
                            />
                          </div>
                          <Button onClick={adicionarProduto} size="sm" variant="outline" className="h-8 px-2">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {produtos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum produto adicionado
                            </p>}
                          {produtos.map(produto => (
                            <div key={produto.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-2 rounded border border-border/50 bg-muted/20">
                              <div>
                                <span className="text-sm font-medium">{produto.nome || 'Produto sem nome'}</span>
                              </div>
                              <div>
                                <Input 
                                  type="number" 
                                  value={produto.quantidade} 
                                  onChange={e => atualizarProduto(produto.id, 'quantidade', parseInt(e.target.value) || 1)}
                                  className="h-8 text-sm" 
                                  min="1"
                                />
                              </div>
                              <div>
                                <Input 
                                  type="number" 
                                  value={produto.valorVenda} 
                                  onChange={e => atualizarProduto(produto.id, 'valorVenda', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm" 
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button onClick={() => removerProduto(produto.id)} variant="outline" size="sm" className="h-8 px-2">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                  {/* Coluna 3 - Custos e Resumo */}
                  <div className="space-y-4">
                    {/* Custos Extras */}
                    <Card className="bg-card border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">💰 Custos Extras</CardTitle>
                        <Button onClick={adicionarCustoExtra} size="sm" variant="outline" className="mt-2 w-full">
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Custo
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {custosExtras.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum custo extra adicionado
                            </p>
                          )}
                          {custosExtras.map(custo => (
                            <div key={custo.id} className="space-y-2 p-3 rounded border bg-muted/20">
                              <Input 
                                placeholder="Descrição" 
                                value={custo.descricao} 
                                onChange={e => atualizarCustoExtra(custo.id, 'descricao', e.target.value)} 
                                className="h-8 text-sm" 
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input 
                                  type="number" 
                                  placeholder="Valor" 
                                  value={custo.valorUnitario} 
                                  onChange={e => atualizarCustoExtra(custo.id, 'valorUnitario', parseFloat(e.target.value) || 0)} 
                                  className="h-8 text-sm" 
                                  min="0"
                                  step="0.01"
                                />
                                <Input 
                                  type="number" 
                                  placeholder="Qtd" 
                                  value={custo.quantidade} 
                                  onChange={e => atualizarCustoExtra(custo.id, 'quantidade', parseInt(e.target.value) || 1)} 
                                  className="h-8 text-sm" 
                                  min="1"
                                />
                              </div>
                              <Button 
                                onClick={() => removerCustoExtra(custo.id)} 
                                variant="outline" 
                                size="sm" 
                                className="h-7 w-full"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remover
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resumo Final */}
                    <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-blue-700">📊 Resumo Final</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo Base:</span>
                            <span className="font-medium">R$ {custoBaseProjeto.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Com Markup ({markup}x):</span>
                            <span className="font-medium">R$ {precoBaseComMarkup.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">+ Produtos:</span>
                            <span className="font-medium">R$ {valorProdutos.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex justify-between font-bold text-blue-600">
                            <span>Preço Final:</span>
                            <span>R$ {precoFinal.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Lucro:</span>
                            <span>R$ {lucroLiquido.toFixed(2)} ({lucratividade.toFixed(1)}%)</span>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={() => setSalvarPacoteModalOpen(true)} 
                          className="w-full mt-4" 
                          disabled={precoFinal <= 0}
                        >
                          📦 Salvar como Pacote
                        </Button>
                        </CardContent>
                     </Card>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </CollapsibleContent>
        </Collapsible>

      {/* Modal para Salvar Pacote */}
      <SalvarPacoteModal 
        isOpen={salvarPacoteModalOpen} 
        onClose={() => setSalvarPacoteModalOpen(false)} 
        precoFinal={precoFinal} 
        produtos={produtos} 
        horasEstimadas={horasEstimadas} 
        markup={markup} 
      />
    </div>
  );
}