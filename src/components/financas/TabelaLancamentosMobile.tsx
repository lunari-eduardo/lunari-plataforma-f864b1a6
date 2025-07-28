import { useState } from 'react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro, StatusTransacao } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, DollarSign, Trash2, Edit } from 'lucide-react';
import EditTransactionModal from './EditTransactionModal';

interface TabelaLancamentosMobileProps {
  transacoes: TransacaoComItem[];
  onAtualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  onMarcarComoPago?: (id: string) => void;
  grupoAtivo: GrupoPrincipal;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
}

export default function TabelaLancamentosMobile({
  transacoes,
  onAtualizarTransacao,
  onRemoverTransacao,
  onMarcarComoPago,
  grupoAtivo,
  obterItensPorGrupo
}: TabelaLancamentosMobileProps) {
  const [editingTransaction, setEditingTransaction] = useState<TransacaoComItem | null>(null);
  
  const formatarData = (dataISO: string) => {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getStatusBadge = (status: string, onMarcarPago?: () => void) => {
    switch (status) {
      case 'Agendado':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Agendado</Badge>;
      case 'Faturado':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-red-100 text-red-800 border-red-200">Faturado</Badge>
            {onMarcarPago && (
              <input 
                type="checkbox" 
                onChange={onMarcarPago}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                title="Marcar como pago"
              />
            )}
          </div>
        );
      case 'Pago':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">-</Badge>;
    }
  };

  if (transacoes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <Calendar className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação encontrada</h3>
        <p className="text-gray-500">Use o botão + para adicionar uma transação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transacoes.map((transacao) => (
        <Card key={transacao.id} className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{transacao.item.nome}</h3>
                {getStatusBadge(transacao.status, transacao.status === 'Faturado' && onMarcarComoPago ? () => onMarcarComoPago(transacao.id) : undefined)}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingTransaction(transacao)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoverTransacao(transacao.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{formatCurrency(transacao.valor)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{formatarData(transacao.data_vencimento)}</span>
              </div>
            </div>

            {(transacao.parcelas || transacao.parcelaInfo) && (
              <div className="mt-2 text-sm text-gray-500">
                Parcela {(transacao.parcelas?.atual || transacao.parcelaInfo?.atual || 1)} de {(transacao.parcelas?.total || transacao.parcelaInfo?.total || 1)}
              </div>
            )}

            {transacao.observacoes && (
              <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {transacao.observacoes}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={(dados) => {
            console.log('Mobile - Salvando transação:', editingTransaction.id, dados);
            
            // Incluir o status no mobile, igual ao desktop
            const dadosCompletos: Partial<NovaTransacaoFinanceira> = {
              ...dados,
              status: (dados.data_vencimento && dados.data_vencimento <= new Date().toISOString().split('T')[0]) ? 'Faturado' as StatusTransacao : 'Agendado' as StatusTransacao
            };
            
            console.log('Mobile - Dados completos:', dadosCompletos);
            onAtualizarTransacao(editingTransaction.id, dadosCompletos);
            setEditingTransaction(null);
          }}
          initialData={{
            valor: editingTransaction.valor,
            data_vencimento: editingTransaction.data_vencimento,
            observacoes: editingTransaction.observacoes
          }}
        />
      )}
    </div>
  );
}