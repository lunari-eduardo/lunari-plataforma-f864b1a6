import { useState } from 'react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro, StatusTransacao } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, DollarSign, Trash2, Edit, Check, X } from 'lucide-react';
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
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    valor: string;
    data_vencimento: string;
    observacoes: string;
  }>({
    valor: '',
    data_vencimento: '',
    observacoes: ''
  });
  const formatarData = (dataISO: string) => {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  };
  const getStatusBadge = (status: string, onMarcarPago?: () => void) => {
    switch (status) {
      case 'Agendado':
        return <Badge className="bg-primary/15 text-primary border-primary/20">Agendado</Badge>;
      case 'Faturado':
        return <div className="flex items-center gap-2">
            <Badge className="bg-destructive/15 text-destructive border-destructive/20">Faturado</Badge>
            {onMarcarPago && <input type="checkbox" onChange={onMarcarPago} className="w-4 h-4 text-lunar-success bg-muted border-border rounded focus:ring-lunar-success" title="Marcar como pago" />}
          </div>;
      case 'Pago':
        return <Badge className="bg-lunar-success/15 text-lunar-success border-lunar-success/20">Pago</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">-</Badge>;
    }
  };
  const startEdit = (transacao: TransacaoComItem) => {
    setEditingTransaction(transacao.id);
    setEditValues({
      valor: transacao.valor.toString(),
      data_vencimento: transacao.data_vencimento,
      observacoes: transacao.observacoes || ''
    });
  };
  const cancelEdit = () => {
    setEditingTransaction(null);
    setEditValues({
      valor: '',
      data_vencimento: '',
      observacoes: ''
    });
  };
  const saveEdit = (transacaoId: string) => {
    const valorNumerico = parseFloat(editValues.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert('Por favor, insira um valor válido maior que zero');
      return;
    }
    if (!editValues.data_vencimento) {
      alert('Por favor, insira uma data válida');
      return;
    }

    // Encontrar a transação original para preservar campos críticos
    const transacaoOriginal = transacoes.find(t => t.id === transacaoId);
    if (!transacaoOriginal) {
      alert('Transação não encontrada');
      return;
    }
    const dadosCompletos: Partial<NovaTransacaoFinanceira> = {
      item_id: transacaoOriginal.item_id,
      // ✅ PRESERVAR item_id crítico
      valor: valorNumerico,
      data_vencimento: editValues.data_vencimento,
      observacoes: editValues.observacoes.trim() || null,
      status: editValues.data_vencimento <= new Date().toISOString().split('T')[0] ? 'Faturado' as StatusTransacao : 'Agendado' as StatusTransacao
    };
    onAtualizarTransacao(transacaoId, dadosCompletos);
    cancelEdit();
  };
  if (transacoes.length === 0) {
    return <div className="text-center py-8">
        <div className="text-muted-foreground mb-4">
          <Calendar className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma transação encontrada</h3>
        <p className="text-muted-foreground">Use o botão + para adicionar uma transação.</p>
      </div>;
  }
  return <div className="space-y-3">
      {transacoes.map(transacao => <Card key={transacao.id} className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-base">{transacao.item?.nome || 'Item não encontrado'}</h3>
                {getStatusBadge(transacao.status, transacao.status === 'Faturado' && onMarcarComoPago ? () => onMarcarComoPago(transacao.id) : undefined)}
              </div>
              <div className="flex items-center gap-1">
                {editingTransaction === transacao.id ? <>
                    <Button size="sm" variant="ghost" onClick={() => saveEdit(transacao.id)} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:text-gray-700 hover:bg-gray-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </> : <>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(transacao)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onRemoverTransacao(transacao.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>}
              </div>
            </div>
            
            {editingTransaction === transacao.id ? <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input type="number" step="0.01" min="0" value={editValues.valor} onChange={e => setEditValues({
                ...editValues,
                valor: e.target.value
              })} placeholder="Valor" className="text-sm" />
                  </div>
                  <div>
                    <Input type="date" value={editValues.data_vencimento} onChange={e => setEditValues({
                ...editValues,
                data_vencimento: e.target.value
              })} className="text-sm" />
                  </div>
                </div>
                <Textarea value={editValues.observacoes} onChange={e => setEditValues({
            ...editValues,
            observacoes: e.target.value
          })} placeholder="Observações (opcional)" rows={2} className="text-sm" />
              </div> : <>
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

                {(transacao.parcelas || transacao.parcelaInfo) && <div className="mt-2 text-sm text-gray-500">
                    Parcela {transacao.parcelas?.atual || transacao.parcelaInfo?.atual || 1} de {transacao.parcelas?.total || transacao.parcelaInfo?.total || 1}
                  </div>}

                {transacao.observacoes}
              </>}
          </CardContent>
        </Card>)}
    </div>;
}