import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Package, PlusCircle, Calculator, Trash2, Plus } from 'lucide-react';
import { SimpleProductSelector } from './SimpleProductSelector';
import { SalvarPacoteModal } from './SalvarPacoteModal';
import { FeedbackContextual } from './FeedbackContextual';
import { EtapaColapsavel } from './EtapaColapsavel';
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
  const precoFinalBruto = precoBaseComMarkup + valorProdutos;
  const precoFinal = Math.round(precoFinalBruto / 10) * 10; // Arredonda para dezena
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
    <EtapaColapsavel
      numero={3}
      titulo="Calcule o Preço do Seu Serviço"
      descricao="O principal resultado de toda sua precificação"
      defaultOpen={false}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Card: Tempo do Projeto */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            Tempo do projeto
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Horas/dia</Label>
                <Input type="number" value={horasDisponiveis} onChange={e => setHorasDisponiveis(Number(e.target.value))} onFocus={e => e.target.select()} className="h-9 mt-1 text-sm text-center tabular-nums" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Dias/semana</Label>
                <Input type="number" value={diasTrabalhados} onChange={e => setDiasTrabalhados(Number(e.target.value))} onFocus={e => e.target.select()} className="h-9 mt-1 text-sm text-center tabular-nums" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Horas do serviço</Label>
                <Input type="number" value={horasEstimadas} onChange={e => setHorasEstimadas(Number(e.target.value))} onFocus={e => e.target.select()} className="h-9 mt-1 text-sm text-center font-semibold tabular-nums" />
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-border/20 pt-2.5 text-xs">
              <span className="text-muted-foreground">Custo da sua hora</span>
              <span className="text-[15px] font-semibold text-foreground tabular-nums">{formatCurrency(custoHora)}</span>
            </div>
          </div>
        </div>

        {/* Card: Produtos */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
            <Package className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            Produtos adicionais
          </h3>
          <div>
            <SimpleProductSelector value="" onSelect={(product: NormalizedProduct | null) => {
              if (product) {
                setProdutos([...produtos, { id: Date.now().toString(), nome: product.nome, custo: product.custo || 0, valorVenda: product.valorVenda || 0, quantidade: 1 }]);
              }
            }} />
            {produtos.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">Nenhum produto adicionado.</p>
            )}
            <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
              {produtos.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                  <span className="flex-1 text-sm truncate">{p.nome}</span>
                  <Input type="number" value={p.quantidade} onChange={e => atualizarProduto(p.id, 'quantidade', parseInt(e.target.value) || 1)} onFocus={e => e.target.select()} className="w-16 h-8 text-sm text-center" min="1" />
                  <span className="text-sm font-medium w-20 text-right">{formatCurrency(p.valorVenda * p.quantidade)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removerProduto(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card: Custos Extras */}
        <div className="rounded-lg border border-border/20 bg-card/60 p-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
            <PlusCircle className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            Custos adicionais
          </h3>
          <div>
            <Button onClick={adicionarCustoExtra} size="sm" variant="outline" className="w-full h-8 mb-2"><Plus className="h-4 w-4 mr-1" />Adicionar Custo</Button>
            {custosExtras.length > 0 && (
              <div className="flex items-center gap-2 px-2 mb-2 text-xs text-muted-foreground">
                <span className="flex-1">Descrição</span>
                <span className="w-24 text-center">Valor (R$)</span>
                <span className="w-8"></span>
              </div>
            )}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {custosExtras.map(c => (
                <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                  <Input value={c.descricao} onChange={e => atualizarCustoExtra(c.id, 'descricao', e.target.value)} placeholder="Ex: Deslocamento" className="flex-1 h-8 text-sm" />
                  <Input type="number" value={c.valorUnitario} onChange={e => atualizarCustoExtra(c.id, 'valorUnitario', parseFloat(e.target.value) || 0)} onFocus={e => e.target.select()} placeholder="0,00" className="w-24 h-8 text-sm" min="0" step="0.01" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removerCustoExtra(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado final */}
        <div className="rounded-lg border border-border/30 bg-card p-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4" style={{ color: 'hsl(var(--accent-gold))' }} />
            Resultado final
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Markup</Label>
              <div className="flex items-center gap-1.5">
                <Input type="number" value={markup} onChange={e => setMarkup(Number(e.target.value) || 1)} onFocus={e => e.target.select()} className="w-16 h-8 text-sm font-semibold text-center tabular-nums" min="1" step="0.1" />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
            </div>

            <div className="border-t border-border/20 pt-3">
              <p className="text-[11px] text-muted-foreground">Preço final do serviço</p>
              <p className="text-[30px] font-semibold leading-tight tabular-nums" style={{ color: 'hsl(var(--accent-gold))' }}>
                {formatCurrency(precoFinal)}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/20 pt-2.5">
              <div>
                <p className="text-[11px] text-muted-foreground">Lucro líquido</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums">{formatCurrency(lucroLiquido)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Lucratividade</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums">{lucratividade.toFixed(1)}%</p>
              </div>
            </div>

            <FeedbackContextual precoFinal={precoFinal} metaMensal={metaFaturamentoMensal} lucratividade={lucratividade} custoHora={custoHora} />

            <Button className="w-full h-9" onClick={() => setSalvarPacoteModalOpen(true)} disabled={precoFinal <= 0}>
              Salvar como pacote
            </Button>
          </div>
        </div>
      </div>

      <SalvarPacoteModal isOpen={salvarPacoteModalOpen} onClose={() => setSalvarPacoteModalOpen(false)} precoFinal={precoFinal} produtos={produtos} horasEstimadas={horasEstimadas} markup={markup} />
    </EtapaColapsavel>
  );
}
