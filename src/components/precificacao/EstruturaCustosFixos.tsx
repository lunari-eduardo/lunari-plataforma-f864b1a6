import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { storage } from '@/utils/localStorage';
interface GastoItem {
  id: string;
  descricao: string;
  valor: number;
}
interface Equipamento {
  id: string;
  nome: string;
  valorPago: number;
  dataCompra: string;
  vidaUtil: number;
}
interface EstruturaCustosFixosProps {
  onTotalChange: (total: number) => void;
}
export function EstruturaCustosFixos({
  onTotalChange
}: EstruturaCustosFixosProps) {
  const [gastosPessoais, setGastosPessoais] = useState<GastoItem[]>([]);
  const [percentualProLabore, setPercentualProLabore] = useState(30);
  const [custosEstudio, setCustosEstudio] = useState<GastoItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

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

  // Carregar dados salvos
  useEffect(() => {
    const dados = storage.load('precificacao_custos_fixos', {
      gastosPessoais: [],
      percentualProLabore: 30,
      custosEstudio: [],
      equipamentos: []
    });
    setGastosPessoais(dados.gastosPessoais);
    setPercentualProLabore(dados.percentualProLabore);
    setCustosEstudio(dados.custosEstudio);
    setEquipamentos(dados.equipamentos);
  }, []);

  // Salvar dados automaticamente
  useEffect(() => {
    storage.save('precificacao_custos_fixos', {
      gastosPessoais,
      percentualProLabore,
      custosEstudio,
      equipamentos
    });
  }, [gastosPessoais, percentualProLabore, custosEstudio, equipamentos]);

  // Cálculos
  const totalGastosPessoais = gastosPessoais.reduce((total, item) => total + item.valor, 0);
  const proLaboreCalculado = totalGastosPessoais * (1 + percentualProLabore / 100);
  const totalCustosEstudio = custosEstudio.reduce((total, item) => total + item.valor, 0);
  const totalDepreciacaoMensal = equipamentos.reduce((total, eq) => {
    const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
    return total + depreciacaoMensal;
  }, 0);

  // Total principal (não inclui gastos pessoais para evitar contagem dupla)
  const totalPrincipal = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;

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
  return <Card>
      <CardHeader className="border bg-card text-foreground">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Estrutura de Custos Fixos</CardTitle>
            <p className="text-lunar-textSecondary mt-1 text-xs">
              Defina seus custos fixos mensais para calcular o valor da sua hora de trabalho.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-lunar-textSecondary">Total:</p>
            <p className="font-bold text-green-600 text-base">R$ {totalPrincipal.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="border bg-card text-foreground px-[9px]">
        <Tabs defaultValue="gastos-pessoais" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="gastos-pessoais" className="text-xs md:text-sm px-2 py-2">
              Gastos Pessoais
            </TabsTrigger>
            <TabsTrigger value="pro-labore" className="text-xs md:text-sm px-2 py-2">
              Pró-labore
            </TabsTrigger>
            <TabsTrigger value="custos-estudio" className="text-xs md:text-sm px-2 py-2">
              Custos do Estúdio
            </TabsTrigger>
            <TabsTrigger value="equipamentos" className="text-xs md:text-sm px-2 py-2">
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
            <div className="border bg-card text-foreground border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-blue-700">Descrição</Label>
                  <Input placeholder="Ex: Alimentação, Transporte..." value={novoGastoPessoal.descricao} onChange={e => setNovoGastoPessoal(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Valor</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoGastoPessoal.valor} onChange={e => setNovoGastoPessoal(prev => ({
                  ...prev,
                  valor: e.target.value
                }))} className="bg-white" />
                </div>
              </div>
              <div className="mt-3">
                <Button onClick={adicionarNovoGastoPessoal} disabled={!novoGastoPessoal.descricao || !novoGastoPessoal.valor} className="h-9 w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 pr-4 w-40">Descrição</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 pr-4 w-32">Valor</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosPessoais.map(gasto => <tr key={gasto.id} className="border-b border-gray-100">
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
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
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
              <div className="flex items-center gap-4">
                <span className="text-sm text-green-600 font-medium">
                  Total: R$ {totalCustosEstudio.toFixed(2)}
                </span>
                <Button onClick={adicionarCustoEstudio} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Linha de adição rápida */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-blue-700">Descrição</Label>
                  <Input placeholder="Ex: Aluguel, Energia, Internet..." value={novoCustoEstudio.descricao} onChange={e => setNovoCustoEstudio(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Valor</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoCustoEstudio.valor} onChange={e => setNovoCustoEstudio(prev => ({
                  ...prev,
                  valor: e.target.value
                }))} className="bg-white" />
                </div>
              </div>
              <div className="mt-3">
                <Button onClick={adicionarNovoCustoEstudio} disabled={!novoCustoEstudio.descricao || !novoCustoEstudio.valor} className="h-9 w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 pr-4 w-40">Descrição</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 pr-4 w-32">Valor</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-2 w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {custosEstudio.map(custo => <tr key={custo.id} className="border-b border-gray-100">
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
                <Button onClick={adicionarEquipamento} size="sm" className="text-xs">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            
            {/* Formulário de adição rápida */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <Label className="text-xs text-blue-700">Nome</Label>
                  <Input placeholder="Ex: Câmera Canon..." value={novoEquipamento.nome} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  nome: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Valor Pago</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" value={novoEquipamento.valorPago} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  valorPago: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Data da Compra</Label>
                  <Input type="date" value={novoEquipamento.dataCompra} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  dataCompra: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Vida Útil (Anos)</Label>
                  <Input type="number" min="1" value={novoEquipamento.vidaUtil} onChange={e => setNovoEquipamento(prev => ({
                  ...prev,
                  vidaUtil: e.target.value
                }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-blue-700">Depreciação Mensal</Label>
                  <div className="text-xs text-green-600 font-medium p-2 bg-white rounded border">
                    R$ {novoEquipamento.valorPago && novoEquipamento.vidaUtil ? (parseFloat(novoEquipamento.valorPago) / (parseInt(novoEquipamento.vidaUtil) * 12)).toFixed(2) : '0,00'}
                  </div>
                </div>
                <div>
                  <Button onClick={adicionarNovoEquipamento} disabled={!novoEquipamento.nome || !novoEquipamento.valorPago} className="h-9 w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Desktop - Tabela */}
              <div className="hidden md:block">
                {equipamentos.map(equipamento => <div key={equipamento.id} className="grid grid-cols-6 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Nome</Label>
                      <Input placeholder="Ex: Câmera Canon..." value={equipamento.nome} onChange={e => atualizarEquipamento(equipamento.id, 'nome', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Valor Pago</Label>
                      <Input type="number" min="0" step="0.01" value={equipamento.valorPago} onChange={e => atualizarEquipamento(equipamento.id, 'valorPago', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Data da Compra</Label>
                      <Input type="date" value={equipamento.dataCompra} onChange={e => atualizarEquipamento(equipamento.id, 'dataCompra', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Vida Útil (Anos)</Label>
                      <Input type="number" min="1" value={equipamento.vidaUtil} onChange={e => atualizarEquipamento(equipamento.id, 'vidaUtil', parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                      <Label className="text-xs">Depreciação Mensal</Label>
                      <div className="text-xs text-green-600 font-medium p-2">
                        R$ {(equipamento.valorPago / (equipamento.vidaUtil * 12)).toFixed(2)}
                      </div>
                    </div>
                    <Button onClick={() => removerEquipamento(equipamento.id)} variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>)}
              </div>
              
              {/* Mobile - Cards */}
              <div className="md:hidden space-y-4">
                {equipamentos.map(equipamento => <Card key={equipamento.id} className="p-4 px-[10px] py-[7px]">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <Label className="text-xs">Nome</Label>
                          <Input placeholder="Ex: Câmera Canon..." value={equipamento.nome} onChange={e => atualizarEquipamento(equipamento.id, 'nome', e.target.value)} />
                        </div>
                        <Button onClick={() => removerEquipamento(equipamento.id)} variant="outline" size="sm" className="ml-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Valor Pago</Label>
                          <Input type="number" min="0" step="0.01" value={equipamento.valorPago} onChange={e => atualizarEquipamento(equipamento.id, 'valorPago', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label className="text-xs">Vida Útil (Anos)</Label>
                          <Input type="number" min="1" value={equipamento.vidaUtil} onChange={e => atualizarEquipamento(equipamento.id, 'vidaUtil', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Data da Compra</Label>
                        <Input type="date" value={equipamento.dataCompra} onChange={e => atualizarEquipamento(equipamento.id, 'dataCompra', e.target.value)} />
                      </div>
                      
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Depreciação Mensal:</span>
                          <span className="text-sm text-green-600 font-medium">
                            R$ {(equipamento.valorPago / (equipamento.vidaUtil * 12)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>)}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>;
}