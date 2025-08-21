import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForStorage } from '@/utils/dateUtils';
import { toast } from '@/hooks/use-toast';
import { SessionPaymentExtended } from '@/types/sessionPayments';

interface EditPaymentModalProps {
  payment: SessionPaymentExtended;
  onClose: () => void;
  onSave: (updates: Partial<SessionPaymentExtended>) => void;
}

export function EditPaymentModal({ payment, onClose, onSave }: EditPaymentModalProps) {
  const [valor, setValor] = useState(payment.valor);
  const [data, setData] = useState(payment.data || '');
  const [dataVencimento, setDataVencimento] = useState(payment.dataVencimento || '');
  const [statusPagamento, setStatusPagamento] = useState(payment.statusPagamento);
  const [observacoes, setObservacoes] = useState(payment.observacoes || '');
  const [formaPagamento, setFormaPagamento] = useState(payment.forma_pagamento || '');
  const [loading, setLoading] = useState(false);

  const canEditStatus = payment.origem !== 'agenda';
  const canEditAll = payment.editavel;

  const handleSave = async () => {
    if (valor <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const updates: Partial<SessionPaymentExtended> = {
        valor,
        observacoes,
        forma_pagamento: formaPagamento
      };

      // Só atualizar data se puder editar tudo
      if (canEditAll) {
        updates.data = data;
        updates.dataVencimento = dataVencimento;
      }

      // Só atualizar status se puder
      if (canEditStatus) {
        updates.statusPagamento = statusPagamento;
        
        // Se marcou como pago e não tinha data, definir data atual
        if (statusPagamento === 'pago' && !updates.data) {
          updates.data = formatDateForStorage(new Date());
        }
      }

      onSave(updates);

      toast({
        title: "Pagamento atualizado",
        description: "As informações foram salvas com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Editar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações da Origem */}
          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Origem</p>
                  <p className="font-medium capitalize">
                    {payment.origem.replace('_', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</p>
                  <p className="font-medium capitalize">{payment.tipo}</p>
                </div>
              </div>
              {payment.numeroParcela && (
                <p className="text-xs text-muted-foreground mt-2">
                  Parcela {payment.numeroParcela} de {payment.totalParcelas}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Limitações de Edição */}
          {!canEditAll && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Edição Limitada</p>
                    <p className="text-xs text-yellow-700">
                      Alguns campos não podem ser editados para pagamentos da {payment.origem}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="valor"
                type="number"
                value={valor}
                onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                className="pl-10"
                min="0"
                step="0.01"
                disabled={!canEditAll}
              />
            </div>
          </div>

          {/* Status */}
          {canEditStatus && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusPagamento} onValueChange={(value: any) => setStatusPagamento(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            {canEditAll && (
              <div className="space-y-2">
                <Label htmlFor="data">Data Pagamento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {canEditAll && payment.tipo !== 'pago' && (
              <div className="space-y-2">
                <Label htmlFor="dataVencimento">Data Vencimento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataVencimento"
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre este pagamento..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || valor <= 0}
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}