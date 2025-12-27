import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Package, PlusCircle, Calculator, Trash2, Plus } from 'lucide-react';
import { SimpleProductSelector } from './SimpleProductSelector';
import { SalvarPacoteModal } from './SalvarPacoteModal';
import { FeedbackContextual } from './FeedbackContextual';
import { PadraoHorasService } from '@/services/PricingService';
import type { ProdutoAdicional, CustoExtra } from '@/types/precificacao';
import type { NormalizedProduct } from '@/utils/productUtils';

interface EtapaCalculadoraProps {
  custosFixosTotal: number;
  metaFaturamentoMensal: number;
  onPrecoFinalChange?: (preco: number) => void;
}

export function EtapaCalculadora({ 
  custosFixosTotal, 
  metaFaturamentoMensal,
  onPrecoFinalChange 
}: EtapaCalculadoraProps) {
  const [salvarPacoteModalOpen, setSalvarPacoteModalOpen] = useState(false);
  const [horasDisponiveis, setHorasDisponiveis] = useState(8);
  const [diasTrabalhados, setDiasTrabalhados] = useState(5);
  const [horasEstimadas, setHorasEstimadas] = useState(0);
  const [markup, setMarkup] = useState(2);
  const [produtos, setProdutos] = useState<ProdutoAdicional[]>([]);
  const [custosExtras, setCustosExtras] = useState<CustoExtra[]>([]);

  // Carregar padrão de horas
  useEffect(() => {
    try {
      const dados = PadraoHorasService.carregar();
      setHorasDisponiveis(dados.horasDisponiveis);
      setDiasTrabalhados(dados.diasTrabalhados);
    } catch (error) {
      console.error('Erro ao carregar padrão de horas:', error);
    }
  }, []);

  // Cálculos
  const horasMensais = horasDisponiveis * diasTrabalhados * 4;
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const custoHorasServico = horasEstimadas * custoHora;
  const valorProdutos = produtos.reduce((total, p) => total + p.valorVenda * p.quantidade, 0);
  const valorCustosExtras = custosExtras.reduce((total, c) => total + c.valorUnitario * c.quantidade, 0);
  const custoBaseProjeto = custoHorasServico + valorCustosExtras;
  const precoBaseComMarkup = custoBaseProjeto * markup;
  const precoFinal = precoBaseComMarkup + valorProdutos;
  const custoProdutos = produtos.reduce((total, p) => total + (p.custo || 0) * p.quantidade, 0);
  const custoTotalReal = custoHorasServico + custoProdutos + valorCustosExtras;
  const lucroLiquido = precoFinal - custoTotalReal;
  const lucratividade = precoFinal > 0 ? (lucroLiquido / precoFinal) * 100 : 0;

  // Notificar mudança no preço final
  useEffect(() => {
    onPrecoFinalChange?.(precoFinal);
  }, [precoFinal, onPrecoFinalChange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const adicionarCustoExtra = () => {
    setCustosExtras([...custosExtras, { id: Date.now().toString(), descricao: '', valorUnitario: 0, quantidade: 1 }]);
  };

  const removerProduto = (id: string) => setProdutos(produtos.filter(p => p.id !== id));
  const removerCustoExtra = (id: string) => setCustosExtras(custosExtras.filter(c => c.id !== id));
  const atualizarProduto = (id: string, campo: keyof ProdutoAdicional, valor: any) => {
    setProdutos(produtos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };
  const atualizarCustoExtra = (id: string, campo: keyof CustoExtra, valor: any) => {
    setCustosExtras(custosExtras.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
          3
        </div>
        <div>
          <h2 className="text-lg font-semibold">Calcule o Preço do Seu Serviço</h2>
          <p className="text-sm text-muted-foreground">O principal resultado de toda sua precificação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card: Tempo do Projeto */}
        <Card className="shadow-md border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-blue-500" />
              Tempo do Projeto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Horas/dia</Label>
                <Input type="number" value={horasDisponiveis} onChange={e => setHorasDisponiveis(Number(e.target.value))} className="h-12 text-lg font-medium text-center" />
              </div>
              <div>
                <Label className="text-sm">Dias/semana</Label>
                <Input type="number" value={diasTrabalhados} onChange={e => setDiasTrabalhados(Number(e.target.value))} className="h-12 text-lg font-medium text-center" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Horas estimadas para este serviço</Label>
              <Input type="number" value={horasEstimadas} onChange={e => setHorasEstimadas(Number(e.target.value))} className="h-14 text-xl font-bold text-center mt-2" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span>Custo da sua hora:</span>
                <span className="font-bold text-blue-600">{formatCurrency(custoHora)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Produtos */}
        <Card className="shadow-md border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-green-500" />
              Produtos Adicionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleProductSelector value="" onSelect={(product: NormalizedProduct | null) => {
              if (product) {
                setProdutos([...produtos, { id: Date.now().toString(), nome: product.nome, custo: product.custo || 0, valorVenda: product.valorVenda || 0, quantidade: 1 }]);
              }
            }} />
            <div className="space-y-2 mt-3">
              {produtos.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  <span className="flex-1 text-sm truncate">{p.nome}</span>
                  <Input type="number" value={p.quantidade} onChange={e => atualizarProduto(p.id, 'quantidade', parseInt(e.target.value) || 1)} className="w-16 h-8 text-sm text-center" min="1" />
                  <span className="text-sm font-medium w-20 text-right">{formatCurrency(p.valorVenda * p.quantidade)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removerProduto(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card: Custos Extras */}
        <Card className="shadow-md border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-5 w-5 text-orange-500" />
              Custos Adicionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={adicionarCustoExtra} size="sm" variant="outline" className="w-full mb-3"><Plus className="h-4 w-4 mr-1" />Adicionar Custo</Button>
            <div className="space-y-2">
              {custosExtras.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  <Input value={c.descricao} onChange={e => atualizarCustoExtra(c.id, 'descricao', e.target.value)} placeholder="Descrição" className="flex-1 h-8 text-sm" />
                  <Input type="number" value={c.valorUnitario} onChange={e => atualizarCustoExtra(c.id, 'valorUnitario', parseFloat(e.target.value) || 0)} className="w-24 h-8 text-sm" min="0" step="0.01" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removerCustoExtra(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card: Resultado Final */}
        <Card className="shadow-lg border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-purple-700 dark:text-purple-300">
              <Calculator className="h-5 w-5" />
              Resultado Final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Markup:</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={markup} onChange={e => setMarkup(Number(e.target.value) || 1)} className="w-20 h-10 text-lg font-bold text-center" min="1" step="0.1" />
                <span className="text-lg">x</span>
              </div>
            </div>

            <div className="text-center py-4 border-t border-purple-200 dark:border-purple-700">
              <p className="text-sm text-muted-foreground mb-1">Preço Final do Serviço</p>
              <p className="text-4xl font-black text-purple-600 dark:text-purple-400">{formatCurrency(precoFinal)}</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm">Lucro Líquido:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(lucroLiquido)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Lucratividade:</span>
                <span className="font-medium text-green-600">{lucratividade.toFixed(1)}%</span>
              </div>
            </div>

            <FeedbackContextual precoFinal={precoFinal} metaMensal={metaFaturamentoMensal} lucratividade={lucratividade} custoHora={custoHora} />

            <Button className="w-full" size="lg" onClick={() => setSalvarPacoteModalOpen(true)} disabled={precoFinal <= 0}>
              📦 Salvar como Pacote
            </Button>
          </CardContent>
        </Card>
      </div>

      <SalvarPacoteModal isOpen={salvarPacoteModalOpen} onClose={() => setSalvarPacoteModalOpen(false)} precoFinal={precoFinal} produtos={produtos} horasEstimadas={horasEstimadas} markup={markup} />
    </section>
  );
}
