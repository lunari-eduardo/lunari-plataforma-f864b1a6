import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, DollarSign, Plus } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro, StatusTransacao } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';

interface TabelaLancamentosProps {
  transacoes: TransacaoComItem[];
  onAtualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  grupoAtivo: GrupoPrincipal;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  onAdicionarTransacao: (transacao: Omit<NovaTransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
}

export default function TabelaLancamentos({
  transacoes,
  onAtualizarTransacao,
  onRemoverTransacao,
  grupoAtivo,
  obterItensPorGrupo,
  onAdicionarTransacao
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

  // Estado para nova transação (linha em branco)
  const [novaTransacao, setNovaTransacao] = useState<{
    item_id: string;
    valor: string;
    data_vencimento: string;
    observacoes: string;
    despesaRecorrente: boolean;
    parcelado: boolean;
    parcelas: { atual: number; total: number };
  }>({
    item_id: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    observacoes: '',
    despesaRecorrente: false,
    parcelado: false,
    parcelas: { atual: 1, total: 1 }
  });

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
    return dataVencimento <= hoje ? 'Pago' : 'Agendado';
  };

  // Função para adicionar nova transação
  const adicionarNovaTransacao = () => {
    if (!novaTransacao.item_id || !novaTransacao.valor) return;

    const valor = parseFloat(novaTransacao.valor);
    if (isNaN(valor) || valor <= 0) return;

    const baseTransacao = {
      item_id: novaTransacao.item_id,
      valor,
      data_vencimento: novaTransacao.data_vencimento,
      status: determinarStatus(novaTransacao.data_vencimento),
      observacoes: novaTransacao.observacoes || null,
      parcelas: novaTransacao.parcelado ? novaTransacao.parcelas : null
    };

    if (novaTransacao.parcelado) {
      // Criar múltiplas transações para parcelas
      const valorDaParcela = valor / novaTransacao.parcelas.total;
      
      for (let i = 1; i <= novaTransacao.parcelas.total; i++) {
        const dataVencimento = new Date(novaTransacao.data_vencimento);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
        
        onAdicionarTransacao({
          ...baseTransacao,
          valor: valorDaParcela,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: determinarStatus(dataVencimento.toISOString().split('T')[0]),
          parcelas: { atual: i, total: novaTransacao.parcelas.total }
        });
      }
    } else if (novaTransacao.despesaRecorrente) {
      // Usar o motor centralizado para criar recorrências
      const dataInicial = new Date(novaTransacao.data_vencimento);
      const anoAtual = dataInicial.getFullYear();
      
      // Criar transações recorrentes para todos os meses restantes do ano
      for (let mes = dataInicial.getMonth(); mes < 12; mes++) {
        const dataVencimento = new Date(anoAtual, mes, dataInicial.getDate());
        
        onAdicionarTransacao({
          ...baseTransacao,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: determinarStatus(dataVencimento.toISOString().split('T')[0]),
          observacoes: `${baseTransacao.observacoes || ''} (Recorrente)`.trim()
        });
      }
    } else {
      // Transação única
      onAdicionarTransacao(baseTransacao);
    }

    // Limpar formulário
    setNovaTransacao({
      item_id: '',
      valor: '',
      data_vencimento: new Date().toISOString().split('T')[0],
      observacoes: '',
      despesaRecorrente: false,
      parcelado: false,
      parcelas: { atual: 1, total: 1 }
    });
  };

  const formatarData = (dataISO: string) => {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getStatusBadge = (status: StatusTransacao) => {
    return status === 'Pago' ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Agendado</Badge>
    );
  };

  const itensDisponiveis = obterItensPorGrupo(grupoAtivo);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descrição
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Parcela
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Observações
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opções
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Linha para nova transação */}
            <tr className="bg-blue-50 border-b border-blue-200">
              <td className="px-4 py-3">
                <Input
                  type="date"
                  value={novaTransacao.data_vencimento}
                  onChange={(e) => setNovaTransacao({
                    ...novaTransacao,
                    data_vencimento: e.target.value
                  })}
                  className="w-full h-8 text-sm"
                />
              </td>
              <td className="px-4 py-3">
                <Select
                  value={novaTransacao.item_id}
                  onValueChange={(value) => setNovaTransacao({
                    ...novaTransacao,
                    item_id: value
                  })}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {itensDisponiveis.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-4 py-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={novaTransacao.valor}
                  onChange={(e) => setNovaTransacao({
                    ...novaTransacao,
                    valor: e.target.value
                  })}
                  className="w-full h-8 text-sm"
                />
              </td>
              <td className="px-4 py-3">
                {novaTransacao.parcelado ? (
                  <span className="text-xs text-blue-600">
                    1/{novaTransacao.parcelas.total}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Input
                  placeholder="Observações..."
                  value={novaTransacao.observacoes}
                  onChange={(e) => setNovaTransacao({
                    ...novaTransacao,
                    observacoes: e.target.value
                  })}
                  className="w-full h-8 text-sm"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={novaTransacao.despesaRecorrente}
                      onChange={(e) => setNovaTransacao({
                        ...novaTransacao,
                        despesaRecorrente: e.target.checked,
                        parcelado: e.target.checked ? false : novaTransacao.parcelado
                      })}
                      className="w-3 h-3"
                    />
                    Recorrente
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={novaTransacao.parcelado}
                      onChange={(e) => setNovaTransacao({
                        ...novaTransacao,
                        parcelado: e.target.checked,
                        despesaRecorrente: e.target.checked ? false : novaTransacao.despesaRecorrente
                      })}
                      className="w-3 h-3"
                    />
                    Parcelado
                  </label>
                  {novaTransacao.parcelado && (
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={novaTransacao.parcelas.total}
                        onChange={(e) => setNovaTransacao({
                          ...novaTransacao,
                          parcelas: { atual: 1, total: parseInt(e.target.value) || 1 }
                        })}
                        className="w-12 h-6 text-xs"
                        placeholder="12"
                      />
                      <span className="text-xs text-gray-500">x</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Button
                  size="sm"
                  onClick={adicionarNovaTransacao}
                  disabled={!novaTransacao.item_id || !novaTransacao.valor}
                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
            </tr>

            {/* Lista de transações existentes */}
            {transacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <Calendar className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação encontrada</h3>
                  <p className="text-gray-500">Use a linha acima para adicionar uma nova transação.</p>
                </td>
              </tr>
            ) : (
              transacoes.map((transacao) => (
                <tr key={transacao.id} className="hover:bg-gray-50">
                  {editandoId === transacao.id ? (
                    // Modo de edição
                    <>
                      <td className="px-4 py-3">
                        <Input
                          type="date"
                          value={valoresEditando.data_vencimento}
                          onChange={(e) => setValoresEditando({
                            ...valoresEditando,
                            data_vencimento: e.target.value
                          })}
                          className="w-full h-8 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={valoresEditando.item_id}
                          onValueChange={(value) => setValoresEditando({
                            ...valoresEditando,
                            item_id: value
                          })}
                        >
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {itensDisponiveis.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={valoresEditando.valor}
                          onChange={(e) => setValoresEditando({
                            ...valoresEditando,
                            valor: e.target.value
                          })}
                          className="w-full h-8 text-sm"
                        />
                      </td>
                       <td className="px-4 py-3">
                         <span className="text-xs text-gray-400">-</span>
                       </td>
                       <td className="px-4 py-3">
                         <Input
                           value={valoresEditando.observacoes}
                           onChange={(e) => setValoresEditando({
                             ...valoresEditando,
                             observacoes: e.target.value
                           })}
                           className="w-full h-8 text-sm"
                           placeholder="Observações..."
                         />
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
                    </>
                  ) : (
                    // Modo de visualização
                    <>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatarData(transacao.data_vencimento)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {transacao.item.nome}
                      </td>
                     <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(transacao.valor)}
                          </span>
                          <div className="mt-1">
                            {getStatusBadge(transacao.status)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {(transacao.parcelas || transacao.parcelaInfo) ? (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {(transacao.parcelas?.atual || transacao.parcelaInfo?.atual || 1)}/{(transacao.parcelas?.total || transacao.parcelaInfo?.total || 1)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {transacao.observacoes || '-'}
                      </td>
                     <td className="px-4 py-3 text-xs text-gray-500">
                       Status atualizado automaticamente
                     </td>
                     <td className="px-4 py-3">
                       <div className="flex items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => iniciarEdicao(transacao)}
                           className="h-8"
                         >
                           Editar
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => onRemoverTransacao(transacao.id)}
                           className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </td>
                   </>
                 )}
               </tr>
             ))
           )}
          </tbody>
        </table>
      </div>
    </div>
  );
}