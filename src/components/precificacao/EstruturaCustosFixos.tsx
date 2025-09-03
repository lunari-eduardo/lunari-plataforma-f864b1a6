import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, CheckCircle, AlertCircle, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { EstruturaCustosService, ValidacaoService, IndicadoresService } from '@/services/PricingService';
import type { GastoItem, Equipamento, StatusSalvamento } from '@/types/precificacao';
import { pricingFinancialIntegrationService, type SyncPreview } from '@/services/PricingFinancialIntegrationService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
// Tipos movidos para src/types/precificacao.ts
interface EstruturaCustosFixosProps {
  onTotalChange: (total: number) => void;
}
export function EstruturaCustosFixos({
  onTotalChange
}: EstruturaCustosFixosProps) {
  const {
    toast
  } = useToast();
  const [gastosPessoais, setGastosPessoais] = useState<GastoItem[]>([]);
  const [percentualProLabore, setPercentualProLabore] = useState(30);
  const [custosEstudio, setCustosEstudio] = useState<GastoItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');

  // Estados para sincronização com finanças
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreview[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoadingSync, setIsLoadingSync] = useState(false);

  // Estados para linhas de adição rápida
  const [novoGastoPessoal, setNovoGastoPessoal] = useState({
    descricao: '',
    valor: ''
  });
  const [novoCustoEstudio, setNovoCustoEstudio] = useState({
    descricao: '',
    valor: ''
  });
  const [novoEquipamento, setNovoEquipamento] = useState({
    nome: '',
    valorPago: '',
    dataCompra: '',
    vidaUtil: '5'
  });

  // Carregar dados salvos - NOVO SISTEMA
  useEffect(() => {
    try {
      setStatusSalvamento('salvando');
      const dados = EstruturaCustosService.carregar();
      setGastosPessoais(dados.gastosPessoais);
      setPercentualProLabore(dados.percentualProLabore);
      setCustosEstudio(dados.custosEstudio);
      setEquipamentos(dados.equipamentos);
      setStatusSalvamento('salvo');
      IndicadoresService.atualizarIndicador('estrutura_custos', 'salvo', 'Dados carregados');
    } catch (error) {
      console.error('Erro ao carregar estrutura de custos:', error);
      setStatusSalvamento('erro');
      IndicadoresService.atualizarIndicador('estrutura_custos', 'erro', 'Erro no carregamento');
    }
  }, []);

  // Cálculos (definidos antes dos useEffects)
  const totalGastosPessoais = (gastosPessoais || []).reduce((total, item) => total + item.valor, 0);
  const proLaboreCalculado = totalGastosPessoais * (1 + percentualProLabore / 100);
  const totalCustosEstudio = (custosEstudio || []).reduce((total, item) => total + item.valor, 0);
  const totalDepreciacaoMensal = (equipamentos || []).reduce((total, eq) => {
    const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
    return total + depreciacaoMensal;
  }, 0);

  // Total principal (não inclui gastos pessoais para evitar contagem dupla)
  const totalPrincipal = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;

  // Salvar dados automaticamente - NOVO SISTEMA  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        setStatusSalvamento('salvando');
        const dadosParaSalvar = {
          gastosPessoais,
          percentualProLabore,
          custosEstudio,
          equipamentos,
          totalCalculado: totalPrincipal
        };
        const sucesso = EstruturaCustosService.salvar(dadosParaSalvar);
        if (sucesso) {
          setStatusSalvamento('salvo');
          IndicadoresService.atualizarIndicador('estrutura_custos', 'salvo', 'Salvo automaticamente');
        } else {
          setStatusSalvamento('erro');
          IndicadoresService.atualizarIndicador('estrutura_custos', 'erro', 'Falha no salvamento');
        }
      } catch (error) {
        console.error('Erro no auto-save:', error);
        setStatusSalvamento('erro');
        IndicadoresService.atualizarIndicador('estrutura_custos', 'erro', 'Erro no salvamento automático');
      }
    }, 1000); // Debounce de 1 segundo

    return () => clearTimeout(timeoutId);
  }, [gastosPessoais, percentualProLabore, custosEstudio, equipamentos, totalPrincipal]);

  // Notificar mudança no total
  useEffect(() => {
    onTotalChange(totalPrincipal);
  }, [totalPrincipal, onTotalChange]);

  // Funções para Gastos Pessoais
  const adicionarGastoPessoal = () => {
    setGastosPessoais([...gastosPessoais, {
      id: Date.now().toString(),
      descricao: '',
      valor: 0
    }]);
  };
  const atualizarGastoPessoal = (id: string, campo: keyof GastoItem, valor: any) => {
    setGastosPessoais(gastosPessoais.map(item => item.id === id ? {
      ...item,
      [campo]: valor
    } : item));
  };
  const removerGastoPessoal = (id: string) => {
    setGastosPessoais(gastosPessoais.filter(item => item.id !== id));
  };

  // Funções para Custos do Estúdio
  const adicionarCustoEstudio = () => {
    setCustosEstudio([...custosEstudio, {
      id: Date.now().toString(),
      descricao: '',
      valor: 0
    }]);
  };
  const atualizarCustoEstudio = (id: string, campo: keyof GastoItem, valor: any) => {
    setCustosEstudio(custosEstudio.map(item => item.id === id ? {
      ...item,
      [campo]: valor
    } : item));
  };
  const removerCustoEstudio = (id: string) => {
    setCustosEstudio(custosEstudio.filter(item => item.id !== id));
  };

  // Funções para Equipamentos
  const adicionarEquipamento = () => {
    setEquipamentos([...equipamentos, {
      id: Date.now().toString(),
      nome: '',
      valorPago: 0,
      dataCompra: '',
      vidaUtil: 5
    }]);
  };
  const atualizarEquipamento = (id: string, campo: keyof Equipamento, valor: any) => {
    setEquipamentos(equipamentos.map(eq => eq.id === id ? {
      ...eq,
      [campo]: valor
    } : eq));
  };
  const removerEquipamento = (id: string) => {
    setEquipamentos(equipamentos.filter(eq => eq.id !== id));
  };

  // Funções para linhas de adição rápida
  const adicionarNovoGastoPessoal = () => {
    if (novoGastoPessoal.descricao && novoGastoPessoal.valor) {
      setGastosPessoais(prev => [...prev, {
        id: Date.now().toString(),
        descricao: novoGastoPessoal.descricao,
        valor: parseFloat(novoGastoPessoal.valor) || 0
      }]);
      setNovoGastoPessoal({
        descricao: '',
        valor: ''
      });
    }
  };
  const adicionarNovoCustoEstudio = () => {
    if (novoCustoEstudio.descricao && novoCustoEstudio.valor) {
      setCustosEstudio(prev => [...prev, {
        id: Date.now().toString(),
        descricao: novoCustoEstudio.descricao,
        valor: parseFloat(novoCustoEstudio.valor) || 0
      }]);
      setNovoCustoEstudio({
        descricao: '',
        valor: ''
      });
    }
  };
  const adicionarNovoEquipamento = () => {
    if (novoEquipamento.nome && novoEquipamento.valorPago) {
      setEquipamentos(prev => [...prev, {
        id: Date.now().toString(),
        nome: novoEquipamento.nome,
        valorPago: parseFloat(novoEquipamento.valorPago) || 0,
        dataCompra: novoEquipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: parseInt(novoEquipamento.vidaUtil) || 5
      }]);
      setNovoEquipamento({
        nome: '',
        valorPago: '',
        dataCompra: '',
        vidaUtil: '5'
      });
    }
  };
  // Função para validar e salvar manualmente
  const salvarManualmente = () => {
    try {
      setStatusSalvamento('salvando');
      const dadosParaSalvar = {
        gastosPessoais,
        percentualProLabore,
        custosEstudio,
        equipamentos,
        totalCalculado: totalPrincipal
      };

      // Validar antes de salvar
      const erros = EstruturaCustosService.validar(dadosParaSalvar);
      if (erros.length > 0) {
        console.warn('Dados com avisos:', erros);
      }
      const sucesso = EstruturaCustosService.salvar(dadosParaSalvar);
      if (sucesso) {
        setStatusSalvamento('salvo');
        IndicadoresService.atualizarIndicador('estrutura_custos', 'salvo', 'Salvo manualmente');
      } else {
        setStatusSalvamento('erro');
      }
    } catch (error) {
      console.error('Erro no salvamento manual:', error);
      setStatusSalvamento('erro');
    }
  };

  // Função para exportar dados
  const exportarDados = () => {
    try {
      const dados = {
        gastosPessoais,
        percentualProLabore,
        custosEstudio,
        equipamentos,
        totalCalculado: totalPrincipal,
        dataExport: new Date().toISOString()
      };
      const dataStr = JSON.stringify(dados, null, 2);
      const blob = new Blob([dataStr], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estrutura-custos-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  // Renderizar indicador de status
  // ============= FUNÇÕES DE SINCRONIZAÇÃO =============

  const openSyncDialog = async () => {
    setIsLoadingSync(true);
    try {
      const preview = pricingFinancialIntegrationService.generateSyncPreview();
      setSyncPreview(preview);
      setSelectedItems(preview.filter(p => p.acao !== 'manter').map(p => p.item.id));
      setSyncDialogOpen(true);
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do financeiro.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSync(false);
    }
  };
  const executeSyncronization = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Nenhum item selecionado",
        description: "Selecione pelo menos um item para sincronizar.",
        variant: "destructive"
      });
      return;
    }
    setIsLoadingSync(true);
    try {
      const result = pricingFinancialIntegrationService.executeSyncronization(selectedItems, true);
      if (result.success) {
        // Recarregar custos atualizados
        const custosAtualizados = pricingFinancialIntegrationService.getCustosEstudioFromPricing();
        setCustosEstudio(custosAtualizados.map(custo => ({
          id: custo.id,
          descricao: custo.descricao,
          valor: custo.valor
        })));
        toast({
          title: "Sincronização concluída",
          description: `${result.imported} itens importados, ${result.updated} itens atualizados.`
        });
        setSyncDialogOpen(false);
      } else {
        toast({
          title: "Erro na sincronização",
          description: result.errors.join(', '),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      toast({
        title: "Erro",
        description: "Falha durante a sincronização.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSync(false);
    }
  };
  const renderStatusIndicator = () => {
    switch (statusSalvamento) {
      case 'salvando':
        return <div className="flex items-center gap-1 text-xs text-blue-600">
          <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
          Salvando...
        </div>;
      case 'salvo':
        return <div className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3 w-3" />
          Salvo
        </div>;
      case 'erro':
        return <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          Erro
        </div>;
      default:
        return <div className="flex items-center gap-1 text-xs text-gray-500">
          <AlertCircle className="h-3 w-3" />
          Não salvo
        </div>;
    }
  };
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              💼 Estrutura de Custos Fixos
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Configure todos os seus custos fixos mensais para um cálculo preciso do valor da sua hora de trabalho
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {renderStatusIndicator()}
            <div className="text-right space-y-1 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-600 font-medium">Total Mensal</p>
              <p className="font-bold text-green-700 text-lg">R$ {totalPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-[9px]">
        <Tabs defaultValue="gastos-pessoais" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="gastos-pessoais" className="text-xs px-2 py-2 md:text-xs">
              Gastos Pessoais
            </TabsTrigger>
            <TabsTrigger value="pro-labore" className="text-xs px-2 py-2 md:text-xs">
              Pró-labore
            </TabsTrigger>
            <TabsTrigger value="custos-estudio" className="text-xs px-2 py-2 md:text-xs">
              Custos do Estúdio
            </TabsTrigger>
            <TabsTrigger value="equipamentos" className="text-xs px-2 py-2 md:text-xs">
              Equipamentos
            </TabsTrigger>
          </TabsList>

          {/* Gastos Pessoais */}
          <TabsContent value="gastos-pessoais" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Gastos Pessoais</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-green-600 font-medium">
                  Total: R$ {totalGastosPessoais.toFixed(2)}
                </span>
                <Button onClick={adicionarGastoPessoal} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Linha de adição rápida */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Input placeholder="Ex: Alimentação, Transporte..." value={novoGastoPessoal.descricao} onChange={e => setNovoGastoPessoal(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} className="bg-card" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoGastoPessoal.valor} onChange={e => setNovoGastoPessoal(prev => ({
                  ...prev,
                  valor: e.target.value
                }))} className="bg-card" />
                </div>
              </div>
              <div className="mt-3">
                <Button onClick={adicionarNovoGastoPessoal} disabled={!novoGastoPessoal.descricao || !novoGastoPessoal.valor} className="h-9 w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-elegant">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 w-40">Descrição</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 w-32">Valor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosPessoais.map(gasto => <tr key={gasto.id} className="border-b border-border">
                      <td className="pr-4 py-0">
                        <Input placeholder="Ex: Alimentação, Transporte..." value={gasto.descricao} onChange={e => atualizarGastoPessoal(gasto.id, 'descricao', e.target.value)} className="border-0 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0" />
                      </td>
                      <td className="pr-4 py-0">
                        <Input type="number" min="0" step="0.01" value={gasto.valor} onChange={e => atualizarGastoPessoal(gasto.id, 'valor', parseFloat(e.target.value) || 0)} className="border-0 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0" />
                      </td>
                      <td className="py-3">
                        <Button onClick={() => removerGastoPessoal(gasto.id)} variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Pró-labore */}
          <TabsContent value="pro-labore" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="percentual-pro-labore">Percentual sobre Custos Pessoais (%)</Label>
                <Input id="percentual-pro-labore" type="number" min="0" step="1" value={percentualProLabore} onChange={e => setPercentualProLabore(Number(e.target.value))} className="max-w-32" />
              </div>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gastos Pessoais:</span>
                  <span>R$ {totalGastosPessoais.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Percentual aplicado:</span>
                  <span>{percentualProLabore}%</span>
                </div>
                <div className="flex justify-between font-bold text-green-600">
                  <span>Pró-labore Calculado:</span>
                  <span>R$ {proLaboreCalculado.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Custos do Estúdio */}
          <TabsContent value="custos-estudio" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Custos do Estúdio</h3>
              
              <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openSyncDialog} variant="outline" size="sm" disabled={isLoadingSync} className="text-orange-400 text-sm font-thin px-[4px] mx-[23px]">
                    {isLoadingSync ? <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Sincronizar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      Sincronizar com Finanças
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Importe despesas fixas do sistema financeiro para a precificação. 
                        Os valores serão baseados na média dos últimos 6 meses.
                      </p>
                    </div>

                    {syncPreview.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        <p>Nenhuma despesa fixa encontrada no sistema financeiro.</p>
                      </div> : <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Checkbox checked={selectedItems.length === syncPreview.length} onCheckedChange={checked => {
                        if (checked) {
                          setSelectedItems(syncPreview.map(p => p.item.id));
                        } else {
                          setSelectedItems([]);
                        }
                      }} />
                          <Label className="text-sm font-medium">
                            Selecionar todos ({syncPreview.length} itens)
                          </Label>
                        </div>

                        {syncPreview.map(preview => <div key={preview.item.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <Checkbox checked={selectedItems.includes(preview.item.id)} onCheckedChange={checked => {
                          if (checked) {
                            setSelectedItems(prev => [...prev, preview.item.id]);
                          } else {
                            setSelectedItems(prev => prev.filter(id => id !== preview.item.id));
                          }
                        }} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{preview.item.nome}</span>
                                  <Badge variant={preview.acao === 'adicionar' ? 'default' : preview.acao === 'atualizar' ? 'secondary' : 'outline'}>
                                    {preview.acao === 'adicionar' ? 'Novo' : preview.acao === 'atualizar' ? 'Atualizar' : 'Manter'}
                                  </Badge>
                                </div>
                                
                                <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                                  <span>Valor médio (financeiro): R$ {preview.valorFinanceiro.toFixed(2)}</span>
                                  {preview.valorPrecificacao !== undefined && <>
                                      <span>•</span>
                                      <span>Atual (precificação): R$ {preview.valorPrecificacao.toFixed(2)}</span>
                                    </>}
                                  {preview.diferenca !== undefined && Math.abs(preview.diferenca) > 0.01 && <>
                                      <span>•</span>
                                      <span className={preview.diferenca > 0 ? 'text-red-600' : 'text-green-600'}>
                                        {preview.diferenca > 0 ? '+' : ''}R$ {preview.diferenca.toFixed(2)}
                                      </span>
                                    </>}
                                </div>
                                
                                {preview.item.transacoesCount && preview.item.transacoesCount > 0 && <div className="text-xs text-muted-foreground mt-1">
                                    Baseado em {preview.item.transacoesCount} transações dos últimos 6 meses
                                  </div>}
                              </div>
                            </div>
                          </div>)}
                      </div>}

                    <Separator />

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={executeSyncronization} disabled={selectedItems.length === 0 || isLoadingSync}>
                        {isLoadingSync ? <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2" /> : null}
                        Sincronizar ({selectedItems.length})
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <span className="text-green-600 font-medium text-xs">
                Total: R$ {totalCustosEstudio.toFixed(2)}
              </span>
            </div>
            
            {/* Linha de adição rápida */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-foreground">Descrição</Label>
                  <Input placeholder="Ex: Aluguel, Energia, Internet..." value={novoCustoEstudio.descricao} onChange={e => setNovoCustoEstudio(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} className="bg-card" />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Valor</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoCustoEstudio.valor} onChange={e => setNovoCustoEstudio(prev => ({
                  ...prev,
                  valor: e.target.value
                }))} className="bg-card" />
                </div>
              </div>
              <div className="mt-3">
                <Button onClick={adicionarNovoCustoEstudio} disabled={!novoCustoEstudio.descricao || !novoCustoEstudio.valor} className="h-9 w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-elegant">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 w-40">Descrição</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 w-32">Valor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {custosEstudio.map(custo => <tr key={custo.id} className="border-b border-border">
                      <td className="pr-4 py-0">
                        <Input placeholder="Ex: Aluguel, Energia, Internet..." value={custo.descricao} onChange={e => atualizarCustoEstudio(custo.id, 'descricao', e.target.value)} className="border-0 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0" />
                      </td>
                      <td className="pr-4 py-1">
                        <Input type="number" min="0" step="0.01" value={custo.valor} onChange={e => atualizarCustoEstudio(custo.id, 'valor', parseFloat(e.target.value) || 0)} className="border-0 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0" />
                      </td>
                      <td className="py-3">
                        <Button onClick={() => removerCustoEstudio(custo.id)} variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Equipamentos */}
          <TabsContent value="equipamentos" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Equipamentos</h3>
              <div className="flex items-center gap-4">
                <span className="text-green-600 text-xs font-normal text-center">
                  Depreciação Mensal: R$ {totalDepreciacaoMensal.toFixed(2)}
                </span>
                
              </div>
            </div>
            
            
            {/* Formulário de adição rápida - Desktop */}
            <div className="hidden lg:block bg-muted border border-border rounded-lg p-2 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                <div>
                  <Label className="text-xs text-foreground">Nome</Label>
                  <Input placeholder="Ex: Câmera Canon..." value={novoEquipamento.nome} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  nome: e.target.value
                }))} className="bg-card h-8" />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Valor Pago</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoEquipamento.valorPago} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  valorPago: e.target.value
                }))} className="bg-card h-8" />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Data da Compra</Label>
                  <Input type="date" value={novoEquipamento.dataCompra} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  dataCompra: e.target.value
                }))} className="bg-card h-8" />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Vida Útil (Anos)</Label>
                  <Input type="number" min="1" value={novoEquipamento.vidaUtil} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  vidaUtil: e.target.value
                }))} className="bg-card h-8" />
                </div>
                <div>
                  <Label className="text-xs text-chart-expense">Depreciação Mensal</Label>
                  <div className="text-xs text-green-600 font-medium p-1 bg-muted rounded border border-border h-8 flex items-center">
                    R$ {novoEquipamento.valorPago && novoEquipamento.vidaUtil ? (parseFloat(novoEquipamento.valorPago) / (parseInt(novoEquipamento.vidaUtil) * 12)).toFixed(2) : '0,00'}
                  </div>
                </div>
                <div>
                  <Button onClick={adicionarNovoEquipamento} disabled={!novoEquipamento.nome || !novoEquipamento.valorPago} className="h-8 w-full text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* Formulário de adição rápida - Tablet/Mobile */}
            <div className="lg:hidden bg-muted border border-border rounded-lg p-2 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-foreground">Nome</Label>
                  <Input 
                    placeholder="Ex: Câmera Canon..." 
                    value={novoEquipamento.nome} 
                    onChange={e => setNovoEquipamento(prev => ({
                      ...prev,
                      nome: e.target.value
                    }))} 
                    className="bg-card h-8 text-xs" 
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Valor Pago</Label>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    placeholder="0,00" 
                    value={novoEquipamento.valorPago} 
                    onChange={e => setNovoEquipamento(prev => ({
                      ...prev,
                      valorPago: e.target.value
                    }))} 
                    className="bg-card h-8 text-xs" 
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Data da Compra</Label>
                  <Input 
                    type="date" 
                    value={novoEquipamento.dataCompra} 
                    onChange={e => setNovoEquipamento(prev => ({
                      ...prev,
                      dataCompra: e.target.value
                    }))} 
                    className="bg-card h-8 text-xs" 
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground">Vida Útil (Anos)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={novoEquipamento.vidaUtil} 
                    onChange={e => setNovoEquipamento(prev => ({
                      ...prev,
                      vidaUtil: e.target.value
                    }))} 
                    className="bg-card h-8 text-xs" 
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-xs text-chart-expense">Depreciação/mês</Label>
                  <div className="text-xs text-green-600 font-medium p-1 bg-background rounded border border-border h-8 flex items-center justify-center">
                    R$ {novoEquipamento.valorPago && novoEquipamento.vidaUtil ? (parseFloat(novoEquipamento.valorPago) / (parseInt(novoEquipamento.vidaUtil) * 12)).toFixed(2) : '0,00'}
                  </div>
                </div>
                <div className="col-span-2">
                  <Button 
                    onClick={adicionarNovoEquipamento} 
                    disabled={!novoEquipamento.nome || !novoEquipamento.valorPago} 
                    className="h-8 w-full text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Desktop - Tabela (lg and up) */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valor Pago</TableHead>
                      <TableHead>Data da Compra</TableHead>
                      <TableHead>Vida Útil (Anos)</TableHead>
                      <TableHead>Depreciação Mensal</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentos.map(equipamento => (
                      <TableRow key={equipamento.id}>
                        <TableCell>
                          <Input placeholder="Ex: Câmera Canon..." value={equipamento.nome} onChange={e => atualizarEquipamento(equipamento.id, 'nome', e.target.value)} className="bg-card" />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={equipamento.valorPago} 
                              onChange={e => atualizarEquipamento(equipamento.id, 'valorPago', parseFloat(e.target.value) || 0)} 
                              className="bg-card pl-8" 
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input type="date" value={equipamento.dataCompra} onChange={e => atualizarEquipamento(equipamento.id, 'dataCompra', e.target.value)} className="bg-card" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="1" value={equipamento.vidaUtil} onChange={e => atualizarEquipamento(equipamento.id, 'vidaUtil', parseInt(e.target.value) || 1)} className="bg-card" />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-green-600 font-medium">
                            R$ {(equipamento.valorPago / (equipamento.vidaUtil * 12)).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button onClick={() => removerEquipamento(equipamento.id)} variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Tablet - 2 Column Grid (md to lg) */}
              <div className="hidden md:grid lg:hidden grid-cols-2 gap-3">
                {equipamentos.map(equipamento => (
                  <Card key={equipamento.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm truncate flex-1 pr-2">{equipamento.nome || 'Sem nome'}</h4>
                        <Button 
                          onClick={() => removerEquipamento(equipamento.id)} 
                          variant="outline" 
                          size="icon"
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor Pago</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                            <Input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={equipamento.valorPago} 
                              onChange={e => atualizarEquipamento(equipamento.id, 'valorPago', parseFloat(e.target.value) || 0)} 
                              className="h-8 text-sm pl-8"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Vida Útil</Label>
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              min="1" 
                              value={equipamento.vidaUtil} 
                              onChange={e => atualizarEquipamento(equipamento.id, 'vidaUtil', parseInt(e.target.value) || 1)} 
                              className="h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">anos</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Data da Compra</Label>
                        <Input 
                          type="date" 
                          value={equipamento.dataCompra} 
                          onChange={e => atualizarEquipamento(equipamento.id, 'dataCompra', e.target.value)} 
                          className="h-8 text-sm"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between bg-muted/50 p-2 rounded">
                        <span className="text-xs text-muted-foreground">Depreciação/mês:</span>
                        <span className="text-sm font-medium text-green-600">
                          R$ {(equipamento.valorPago / (equipamento.vidaUtil * 12)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Mobile - Single Column Cards (sm and below) */}
              <div className="md:hidden space-y-2">
                {equipamentos.map(equipamento => (
                  <Card key={equipamento.id} className="p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Nome no topo com botão de deletar */}
                      <div className="col-span-2 flex items-start gap-1">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Nome</Label>
                          <Input 
                            placeholder="Ex: Câmera Canon..." 
                            value={equipamento.nome} 
                            onChange={e => atualizarEquipamento(equipamento.id, 'nome', e.target.value)} 
                            className="h-7 text-xs"
                          />
                        </div>
                        <Button 
                          onClick={() => removerEquipamento(equipamento.id)} 
                          variant="outline" 
                          size="icon"
                          className="h-7 w-7 mt-[18px]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Valor e Data */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Valor Pago</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={equipamento.valorPago} 
                            onChange={e => atualizarEquipamento(equipamento.id, 'valorPago', parseFloat(e.target.value) || 0)} 
                            className="h-7 text-xs pl-8"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Data da Compra</Label>
                        <Input 
                          type="date" 
                          value={equipamento.dataCompra} 
                          onChange={e => atualizarEquipamento(equipamento.id, 'dataCompra', e.target.value)} 
                          className="h-7 text-xs"
                        />
                      </div>
                      
                      {/* Vida útil e Depreciação */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Vida Útil (Anos)</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={equipamento.vidaUtil} 
                          onChange={e => atualizarEquipamento(equipamento.id, 'vidaUtil', parseInt(e.target.value) || 1)} 
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <Label className="text-xs text-muted-foreground">Depreciação/mês</Label>
                        <div className="h-7 px-2 bg-muted rounded border border-border flex items-center justify-center">
                          <span className="text-xs text-green-600 font-medium">
                            R$ {(equipamento.valorPago / (equipamento.vidaUtil * 12)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}