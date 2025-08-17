import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Calendar, DollarSign, Plus, Settings } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro, StatusTransacao } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import OpcoesLancamento, { OpcoesLancamentoState } from './OpcoesLancamento';
import { CreateTransactionInput } from '@/services/FinancialEngine';
interface TabelaLancamentosProps {
  transacoes: TransacaoComItem[];
  onAtualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  onMarcarComoPago: (id: string) => void;
  grupoAtivo: GrupoPrincipal;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  onAdicionarTransacao: (transacao: Omit<NovaTransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  createTransactionEngine?: (input: any) => void; // Opcional para usar o motor centralizado
  filtroMesAno: {
    mes: number;
    ano: number;
  }; // Adicionado para sincronização
}
export default function TabelaLancamentos({
  transacoes,
  onAtualizarTransacao,
  onRemoverTransacao,
  onMarcarComoPago,
  grupoAtivo,
  obterItensPorGrupo,
  onAdicionarTransacao,
  createTransactionEngine,
  filtroMesAno
}: TabelaLancamentosProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valoresEditando, setValoresEditando] = useState<{
    item_id: string;
    valor: string;
    data_vencimento: string;
    status: StatusTransacao;
    observacoes: string;
  }>({
    item_id: '',
    valor: '',
    data_vencimento: '',
    status: 'Agendado',
    observacoes: ''
  });

  // Função para gerar data padrão baseada no filtro mes/ano
  const gerarDataPadrao = () => {
    const ano = filtroMesAno.ano;
    const mes = filtroMesAno.mes.toString().padStart(2, '0');
    return `${ano}-${mes}-01`;
  };

  // Estado para nova transação (linha em branco)
  const [novaTransacao, setNovaTransacao] = useState({
    item_id: '',
    valor: '',
    data_vencimento: gerarDataPadrao(),
    observacoes: ''
  });

  // Estado para opções da nova transação
  const [opcoesNovaTransacao, setOpcoesNovaTransacao] = useState<OpcoesLancamentoState>({
    despesaRecorrente: false,
    cartaoCredito: false,
    cartaoCreditoId: '',
    numeroParcelas: 1
  });
  const [popoverAberto, setPopoverAberto] = useState(false);

  // Efeito para sincronizar a data da nova transação com o filtro mes/ano
  useEffect(() => {
    setNovaTransacao(prev => ({
      ...prev,
      data_vencimento: gerarDataPadrao()
    }));
  }, [filtroMesAno.mes, filtroMesAno.ano]);
  const iniciarEdicao = (transacao: TransacaoComItem) => {
    setEditandoId(transacao.id);
    setValoresEditando({
      item_id: transacao.item_id,
      valor: transacao.valor.toString(),
      data_vencimento: transacao.data_vencimento,
      status: transacao.status,
      observacoes: transacao.observacoes || ''
    });
  };
  const salvarEdicao = () => {
    if (!editandoId) return;
    const dadosAtualizados: Partial<NovaTransacaoFinanceira> = {
      item_id: valoresEditando.item_id,
      valor: parseFloat(valoresEditando.valor) || 0,
      data_vencimento: valoresEditando.data_vencimento,
      observacoes: valoresEditando.observacoes || null
    };

    // Se a data foi alterada, reavalia o status automaticamente
    dadosAtualizados.status = determinarStatus(valoresEditando.data_vencimento);
    onAtualizarTransacao(editandoId, dadosAtualizados);
    setEditandoId(null);
  };
  const cancelarEdicao = () => {
    setEditandoId(null);
  };

  // Função para determinar status automático baseado na data
  const determinarStatus = (dataVencimento: string): StatusTransacao => {
    const hoje = new Date().toISOString().split('T')[0];
    return dataVencimento <= hoje ? 'Faturado' : 'Agendado';
  };

  // Função para adicionar nova transação
  const adicionarNovaTransacao = () => {
    if (!novaTransacao.item_id || !novaTransacao.valor) return;
    const valor = parseFloat(novaTransacao.valor);
    if (isNaN(valor) || valor <= 0) return;

    // Validação específica para cartão de crédito
    if (opcoesNovaTransacao.cartaoCredito && !opcoesNovaTransacao.cartaoCreditoId) {
      return;
    }

    // Usar motor centralizado quando disponível
    if (createTransactionEngine) {
      const input: CreateTransactionInput = {
        valorTotal: valor,
        dataPrimeiraOcorrencia: novaTransacao.data_vencimento,
        itemId: novaTransacao.item_id,
        observacoes: novaTransacao.observacoes || '',
        isRecorrente: opcoesNovaTransacao.despesaRecorrente,
        isParcelado: opcoesNovaTransacao.cartaoCredito,
        numeroDeParcelas: opcoesNovaTransacao.cartaoCredito ? opcoesNovaTransacao.numeroParcelas : undefined,
        isValorFixo: true,
        // Default para valor fixo na tabela
        cartaoCreditoId: opcoesNovaTransacao.cartaoCredito ? opcoesNovaTransacao.cartaoCreditoId : undefined
      };
      createTransactionEngine(input);
    } else {
      // Fallback para compatibilidade legada
      const baseTransacao = {
        item_id: novaTransacao.item_id,
        valor,
        data_vencimento: novaTransacao.data_vencimento,
        status: determinarStatus(novaTransacao.data_vencimento),
        observacoes: novaTransacao.observacoes || null
      };
      onAdicionarTransacao(baseTransacao);
    }

    // Limpar formulário
    setNovaTransacao({
      item_id: '',
      valor: '',
      data_vencimento: gerarDataPadrao(),
      // Usar data padrão baseada no filtro
      observacoes: ''
    });
    setOpcoesNovaTransacao({
      despesaRecorrente: false,
      cartaoCredito: false,
      cartaoCreditoId: '',
      numeroParcelas: 1
    });
    setPopoverAberto(false);
  };
  const formatarData = (dataISO: string) => {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  };
  const getStatusBadge = (status: StatusTransacao, onMarcarPago?: () => void) => {
    switch (status) {
      case 'Agendado':
        return <Badge className="bg-primary/15 text-primary border-border my-[2px] py-0">Agendado</Badge>;
      case 'Faturado':
        return <div className="flex items-center gap-2">
            <Badge className="bg-lunar-error/20 text-lunar-error border-lunar-error/30">Faturado</Badge>
            {onMarcarPago && <input type="checkbox" onChange={onMarcarPago} className="w-4 h-4 text-lunar-success bg-muted border-border rounded focus:ring-lunar-success" title="Marcar como pago" />}
          </div>;
      case 'Pago':
        return <Badge className="bg-lunar-success/20 text-lunar-success border-lunar-success/30 py-0 my-[2px]">Pago</Badge>;
      default:
        return <Badge className="bg-muted text-foreground border-border">-</Badge>;
    }
  };
  const itensDisponiveis = obterItensPorGrupo(grupoAtivo);

  // Função para obter cor dinâmica baseada no grupo
  const getCorPorGrupo = (grupo: GrupoPrincipal) => {
    switch (grupo) {
      case 'Despesa Fixa':
        return 'bg-red-500/10 border-red-500/20 dark:bg-red-500/20 dark:border-red-500/30';
      case 'Despesa Variável':
        return 'bg-orange-500/10 border-orange-500/20 dark:bg-orange-500/20 dark:border-orange-500/30';
      case 'Investimento':
        return 'bg-purple-500/10 border-purple-500/20 dark:bg-purple-500/20 dark:border-purple-500/30';
      case 'Receita Não Operacional':
        return 'bg-green-500/10 border-green-500/20 dark:bg-green-500/20 dark:border-green-500/30';
      default:
        return 'bg-primary/10 border-primary/20 dark:bg-primary/20 dark:border-primary/30';
    }
  };
  return <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto scrollbar-elegant">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Descrição
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Parcela
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Observações
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Opções
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {/* Linha para nova transação */}
            <tr className={`${getCorPorGrupo(grupoAtivo)} border-b`}>
              <td className="px-4 py-3">
                <Input type="date" value={novaTransacao.data_vencimento} onChange={e => setNovaTransacao({
                ...novaTransacao,
                data_vencimento: e.target.value
              })} className="w-full h-8 text-sm" />
              </td>
              <td className="px-2 py-3">
                <Select value={novaTransacao.item_id} onValueChange={value => setNovaTransacao({
                ...novaTransacao,
                item_id: value
              })}>
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {itensDisponiveis.map(item => <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-1 py-3">
                <Input type="number" step="0.01" placeholder="0,00" value={novaTransacao.valor} onChange={e => setNovaTransacao({
                ...novaTransacao,
                valor: e.target.value
              })} className="w-full h-8 text-sm" />
              </td>
              <td className="px-4 py-3">
                {opcoesNovaTransacao.cartaoCredito ? <span className="text-xs text-primary">
                    1/{opcoesNovaTransacao.numeroParcelas}
                  </span> : <span className="text-xs text-muted-foreground">-</span>}
              </td>
              <td className="px-4 py-3">
                <Input placeholder="Observações..." value={novaTransacao.observacoes} onChange={e => setNovaTransacao({
                ...novaTransacao,
                observacoes: e.target.value
              })} className="w-full h-8 text-sm" />
              </td>
              <td className="px-4 py-3">
                <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Opções avançadas">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <OpcoesLancamento opcoes={opcoesNovaTransacao} onOpcoesChange={setOpcoesNovaTransacao} tipoLancamento={grupoAtivo === 'Receita Não Operacional' ? 'receita' : 'despesa'} layout="popover" />
                  </PopoverContent>
                </Popover>
              </td>
              <td className="px-4 py-3">
                <Button size="sm" onClick={adicionarNovaTransacao} disabled={!novaTransacao.item_id || !novaTransacao.valor || opcoesNovaTransacao.cartaoCredito && !opcoesNovaTransacao.cartaoCreditoId} className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
            </tr>

            {/* Lista de transações existentes */}
            {transacoes.length === 0 ? <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="text-muted-foreground mb-4">
                    <Calendar className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma transação encontrada</h3>
                  <p className="text-muted-foreground">Use a linha acima para adicionar uma nova transação.</p>
                </td>
              </tr> : transacoes.map(transacao => <tr key={transacao.id} className="hover:bg-muted/50">
                  {editandoId === transacao.id ?
            // Modo de edição
            <>
                      <td className="px-4 py-3">
                        <Input type="date" value={valoresEditando.data_vencimento} onChange={e => setValoresEditando({
                  ...valoresEditando,
                  data_vencimento: e.target.value
                })} className="w-full h-8 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <Select value={valoresEditando.item_id} onValueChange={value => setValoresEditando({
                  ...valoresEditando,
                  item_id: value
                })}>
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {itensDisponiveis.map(item => <SelectItem key={item.id} value={item.id}>
                                {item.nome}
                              </SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Input type="number" step="0.01" value={valoresEditando.valor} onChange={e => setValoresEditando({
                  ...valoresEditando,
                  valor: e.target.value
                })} className="w-full h-8 text-sm" />
                      </td>
                       <td className="px-4 py-3">
                         <span className="text-xs text-gray-400">-</span>
                       </td>
                       <td className="px-4 py-3">
                         <Input value={valoresEditando.observacoes} onChange={e => setValoresEditando({
                  ...valoresEditando,
                  observacoes: e.target.value
                })} className="w-full h-8 text-sm" placeholder="Observações..." />
                       </td>
                       <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          Status: {determinarStatus(valoresEditando.data_vencimento)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={salvarEdicao} className="h-8">
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelarEdicao} className="h-8">
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </> :
            // Modo de visualização
            <>
                      <td className="px-4 text-sm text-foreground py-[2px]">
                        {formatarData(transacao.data_vencimento)}
                      </td>
                      <td className="px-4 text-sm font-medium text-foreground py-[2px]">
                        {transacao.item.nome}
                      </td>
                     <td className="px-4 py-[2px]">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {formatCurrency(transacao.valor)}
                          </span>
                          <div className="mt-1">
                            {getStatusBadge(transacao.status, transacao.status === 'Faturado' ? () => onMarcarComoPago(transacao.id) : undefined)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 text-sm text-muted-foreground py-[2px]">
                        {transacao.parcelas || transacao.parcelaInfo ? <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded">
                            {transacao.parcelas?.atual || transacao.parcelaInfo?.atual || 1}/{transacao.parcelas?.total || transacao.parcelaInfo?.total || 1}
                          </span> : '-'}
                      </td>
                      <td className="px-4 text-sm text-muted-foreground py-[2px]">
                        {transacao.observacoes || '-'}
                      </td>
                     <td className="px-4 text-xs text-muted-foreground py-[2px]">
                       Status atualizado automaticamente
                     </td>
                     <td className="px-4 py-[2px]">
                       <div className="flex items-center gap-2">
                         <Button size="sm" variant="outline" onClick={() => iniciarEdicao(transacao)} className="h-8">
                           Editar
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => onRemoverTransacao(transacao.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </td>
                   </>}
               </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}