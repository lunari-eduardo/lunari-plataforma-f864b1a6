import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';

interface PaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  clienteId: string;
  valorTotal: number;
  valorJaPago: number;
  clienteNome: string;
  onAddPayment: (sessionId: string, valor: number) => void;
}

export function PaymentConfigModal({
  isOpen,
  onClose,
  sessionId,
  clienteId,
  valorTotal,
  valorJaPago,
  clienteNome,
  onAddPayment
}: PaymentConfigModalProps) {
  const [valorPagamento, setValorPagamento] = useState(0);
  const [loading, setLoading] = useState(false);

  const valorRestante = Math.max(0, valorTotal - valorJaPago);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setValorPagamento(valorRestante);
    }
  }, [isOpen, valorRestante]);

  const handleSave = async () => {
    if (valorPagamento <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      onAddPayment(sessionId, valorPagamento);
      
      toast({
        title: "Pagamento registrado",
        description: `${formatCurrency(valorPagamento)} adicionado com sucesso`
      });
      
      onClose();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-lunar-surface border border-lunar-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-lunar-text flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Registrar Pagamento
          </DialogTitle>
          <p className="text-lunar-textSecondary">
            Cliente: <span className="font-medium text-lunar-text">{clienteNome}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo Financeiro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-lunar-textSecondary">Valor Total:</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(valorTotal)}</span>
            </div>
            
            {valorJaPago > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunar-textSecondary">Já Pago:</span>
                <span className="font-medium text-green-600">- {formatCurrency(valorJaPago)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium text-lunar-text">Restante:</span>
              <span className="text-lg font-bold text-yellow-600">{formatCurrency(valorRestante)}</span>
            </div>
          </div>

          {/* Valor do Pagamento */}
          <div className="space-y-3">
            <Label htmlFor="valorPagamento" className="text-sm font-medium text-lunar-text">
              Valor do Pagamento
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-lunar-textSecondary" />
              <Input
                id="valorPagamento"
                type="number"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(parseFloat(e.target.value) || 0)}
                className="pl-10 bg-background border-border text-lunar-text text-lg font-bold"
                min="0"
                max={valorRestante}
                step="0.01"
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-lunar-textSecondary">
              Máximo disponível: {formatCurrency(valorRestante)}
            </p>
          </div>

          {/* Preview */}
          {valorPagamento > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span className="text-sm font-medium text-green-800">
                    Novo Saldo
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-green-600">
                    Pago: {formatCurrency(valorJaPago + valorPagamento)}
                  </div>
                  <div className="text-sm text-yellow-600">
                    Restante: {formatCurrency(valorRestante - valorPagamento)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || valorPagamento <= 0 || valorPagamento > valorRestante}
          >
            {loading ? 'Registrando...' : 'Registrar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}