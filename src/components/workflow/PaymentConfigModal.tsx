import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CreditCard, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { useClientReceivables } from '@/hooks/useClientReceivables';

interface PaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  clienteId: string;
  valorTotal: number;
  valorJaPago: number;
  clienteNome: string;
}

export function PaymentConfigModal({
  isOpen,
  onClose,
  sessionId,
  clienteId,
  valorTotal,
  valorJaPago,
  clienteNome
}: PaymentConfigModalProps) {
  const [valorTotalNegociado, setValorTotalNegociado] = useState(valorTotal);
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'parcelado'>('avista');
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  const { criarOuAtualizarPlanoPagamento } = useClientReceivables();

  const valorRestante = Math.max(0, valorTotalNegociado - valorJaPago);
  const valorParcela = formaPagamento === 'avista' ? valorRestante : valorRestante / numeroParcelas;

  const handleSave = async () => {
    setLoading(true);
    try {
      await criarOuAtualizarPlanoPagamento(
        sessionId,
        clienteId,
        valorTotalNegociado,
        valorJaPago,
        formaPagamento,
        formaPagamento === 'avista' ? 1 : numeroParcelas,
        diaVencimento
      );
      onClose();
    } catch (error) {
      console.error('Erro ao criar plano de pagamento:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-lunar-surface border border-lunar-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-lunar-text flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Configurar Pagamento
          </DialogTitle>
          <p className="text-lunar-textSecondary">
            Cliente: <span className="font-medium text-lunar-text">{clienteNome}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo Financeiro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-lunar-textSecondary">Valor Total Negociado:</span>
              <Input
                type="text"
                value={formatCurrency(valorTotalNegociado)}
                onChange={(e) => {
                  const valor = parseFloat(e.target.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                  setValorTotalNegociado(valor);
                }}
                onFocus={(e) => {
                  const numericValue = valorTotalNegociado.toFixed(2).replace('.', ',');
                  e.target.value = numericValue;
                  e.target.select();
                }}
                onBlur={(e) => {
                  const valor = parseFloat(e.target.value.replace(',', '.')) || 0;
                  setValorTotalNegociado(valor);
                  e.target.value = formatCurrency(valor);
                }}
                className="w-32 text-right font-bold text-primary bg-background"
              />
            </div>
            
            {valorJaPago > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunar-textSecondary">Já Pago:</span>
                <span className="font-medium text-green-600">- {formatCurrency(valorJaPago)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium text-lunar-text">Restante a Pagar:</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(valorRestante)}</span>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-lunar-text">Forma de Pagamento</Label>
            <RadioGroup value={formaPagamento} onValueChange={(value: 'avista' | 'parcelado') => setFormaPagamento(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="avista" id="avista" />
                <Label htmlFor="avista" className="text-lunar-text cursor-pointer">
                  À vista
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parcelado" id="parcelado" />
                <Label htmlFor="parcelado" className="text-lunar-text cursor-pointer">
                  Parcelado
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Configurações de Parcelamento */}
          {formaPagamento === 'parcelado' && (
            <div className="space-y-4 bg-card/50 border border-border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parcelas" className="text-sm font-medium text-lunar-text">
                    Número de Parcelas
                  </Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="2"
                    max="12"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(parseInt(e.target.value) || 2)}
                    className="bg-background border-border text-lunar-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diaVencimento" className="text-sm font-medium text-lunar-text">
                    Dia do Vencimento
                  </Label>
                  <Input
                    id="diaVencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(parseInt(e.target.value) || 10)}
                    className="bg-background border-border text-lunar-text"
                  />
                </div>
              </div>

              {/* Preview das Parcelas */}
              <div className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-lunar-text">Preview das Parcelas</span>
                </div>
                <div className="text-lg font-semibold text-primary">
                  {numeroParcelas}x de {formatCurrency(valorParcela)}
                </div>
                {valorJaPago > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    + Entrada: {formatCurrency(valorJaPago)}
                  </div>
                )}
                <div className="text-xs text-lunar-textSecondary mt-1">
                  Vencimento todo dia {diaVencimento}
                </div>
              </div>
            </div>
          )}

          {/* À Vista */}
          {formaPagamento === 'avista' && (
            <div className="space-y-3 bg-card/50 border border-border rounded-lg p-4">
              <div className="space-y-2">
                <Label htmlFor="diaVencimentoAvista" className="text-sm font-medium text-lunar-text">
                  Dia do Vencimento
                </Label>
                <Input
                  id="diaVencimentoAvista"
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(parseInt(e.target.value) || 10)}
                  className="bg-background border-border text-lunar-text"
                />
              </div>
              <div className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-lunar-text">Vencimento</span>
                </div>
                <div className="text-lg font-semibold text-primary">
                  {formatCurrency(valorRestante)}
                </div>
                {valorJaPago > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    + Entrada: {formatCurrency(valorJaPago)}
                  </div>
                )}
                <div className="text-xs text-lunar-textSecondary">
                  Vencimento no dia {diaVencimento}
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-sm font-medium text-lunar-text">
              Observações (opcional)
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Observações sobre o pagamento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="bg-background border-border text-lunar-text resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Configurar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}