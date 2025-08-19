import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { useClientReceivables } from '@/hooks/useClientReceivables';
import { formatDateForDisplay } from '@/utils/dateUtils';

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
  const [valorRestanteEditavel, setValorRestanteEditavel] = useState(Math.max(0, valorTotal - valorJaPago));
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'parcelado'>('avista');
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [diaVencimento, setDiaVencimento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingPlan, setExistingPlan] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);

  const { 
    criarOuAtualizarPlanoPagamento, 
    paymentPlans, 
    obterParcelasPorPlano,
    savePaymentPlans 
  } = useClientReceivables();

  // Função para calcular datas de vencimento
  const calculateDueDates = (day: number, parcelas: number) => {
    const dates: string[] = [];
    const currentDate = new Date();
    
    for (let i = 0; i < parcelas; i++) {
      const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, day);
      dates.push(formatDateForDisplay(dueDate.toISOString().split('T')[0]));
    }
    
    return dates;
  };

  // Função para calcular próxima data de vencimento
  const getNextDueDate = (day: number) => {
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
    return formatDateForDisplay(nextMonth.toISOString().split('T')[0]);
  };

  // Validação se pode salvar
  const canSave = diaVencimento !== '' && parseInt(diaVencimento) >= 1 && parseInt(diaVencimento) <= 31;

  // Carregar plano existente ao abrir modal
  useEffect(() => {
    if (isOpen && sessionId) {
      const plano = paymentPlans.find(p => p.sessionId === sessionId);
      setExistingPlan(plano);
      
      if (plano) {
        setFormaPagamento(plano.formaPagamento);
        setNumeroParcelas(plano.numeroParcelas);
        setDiaVencimento(plano.diaVencimento.toString());
        setObservacoes(plano.observacoes || '');
        
        // Carregar parcelas do plano
        const parcelasDoPlan = obterParcelasPorPlano(plano.id);
        setInstallments(parcelasDoPlan);
      } else {
        // Reset para novo plano
        setFormaPagamento('avista');
        setNumeroParcelas(2);
        setDiaVencimento('');
        setObservacoes('');
        setInstallments([]);
      }
    }
  }, [isOpen, sessionId, paymentPlans, obterParcelasPorPlano]);

  // Sincronizar com mudanças nas props
  useEffect(() => {
    const novoValorRestante = Math.max(0, valorTotal - valorJaPago);
    setValorRestanteEditavel(novoValorRestante);
    if (!isEditing) {
      setDisplayValue(formatCurrency(novoValorRestante));
    }
  }, [valorTotal, valorJaPago, isEditing]);

  const valorTotalNegociado = valorRestanteEditavel + valorJaPago;
  const valorParcela = formaPagamento === 'avista' ? valorRestanteEditavel : valorRestanteEditavel / numeroParcelas;

  const handleSave = async () => {
    if (!canSave) return;
    
    setLoading(true);
    try {
      // IMPORTANTE: Só criar parcelas com o valor restante (não pago)
      // Evita duplicação de valores já pagos
      await criarOuAtualizarPlanoPagamento(
        sessionId,
        clienteId,
        valorJaPago + valorRestanteEditavel, // Total negociado
        valorJaPago, // Valor já pago (para criar parcela de entrada)
        formaPagamento,
        formaPagamento === 'avista' ? 1 : numeroParcelas,
        parseInt(diaVencimento)
      );
      
      // Dispatch evento para sincronização global
      window.dispatchEvent(new CustomEvent('payment-plan:created', {
        detail: {
          sessionId,
          clienteId,
          valorTotal: valorJaPago + valorRestanteEditavel,
          valorRestante: valorRestanteEditavel,
          formaPagamento,
          numeroParcelas: formaPagamento === 'avista' ? 1 : numeroParcelas
        }
      }));
      
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
          {/* Plano Existente */}
          {existingPlan && installments.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-lunar-text">Plano de Pagamento Ativo</span>
              </div>
              
              <div className="space-y-2">
                {installments.map((installment, index) => (
                  <div key={installment.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {installment.status === 'pago' ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <Clock className="h-3 w-3 text-orange-600" />
                      )}
                      <span className="text-lunar-textSecondary">
                        {installment.numeroParcela === 0 ? 'Entrada' : `Parcela ${installment.numeroParcela}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={installment.status === 'pago' ? 'text-green-600' : 'text-lunar-text'}>
                        {formatCurrency(installment.valor)}
                      </span>
                      <Badge variant={installment.status === 'pago' ? 'default' : 'secondary'} className="text-xs">
                        {formatDateForDisplay(installment.dataVencimento)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo Financeiro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-lunar-textSecondary">Valor Total Negociado:</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(valorTotalNegociado)}</span>
            </div>
            
            {valorJaPago > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunar-textSecondary">Já Pago:</span>
                <span className="font-medium text-green-600">- {formatCurrency(valorJaPago)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium text-lunar-text">Restante a Pagar:</span>
              <Input
                type="text"
                value={isEditing ? displayValue : formatCurrency(valorRestanteEditavel)}
                onChange={(e) => {
                  setDisplayValue(e.target.value);
                }}
                onFocus={() => {
                  setIsEditing(true);
                  setDisplayValue(valorRestanteEditavel.toFixed(2).replace('.', ','));
                }}
                onBlur={() => {
                  setIsEditing(false);
                  // Parse the value and update
                  const cleanValue = displayValue.replace(/[^\d,]/g, '').replace(',', '.');
                  const numericValue = parseFloat(cleanValue) || 0;
                  const finalValue = Math.max(0, numericValue);
                  setValorRestanteEditavel(finalValue);
                  setDisplayValue(formatCurrency(finalValue));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-32 text-right font-bold text-primary bg-background"
                placeholder="0,00"
              />
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
                    Dia do Vencimento*
                  </Label>
                  <Input
                    id="diaVencimento"
                    type="number"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    placeholder="Ex: 15"
                    className={`bg-background border-border text-lunar-text ${!canSave && diaVencimento !== '' ? 'border-red-500' : ''}`}
                  />
                  {!canSave && diaVencimento !== '' && (
                    <p className="text-xs text-red-500">Dia deve ser entre 1 e 31</p>
                  )}
                </div>
              </div>

              {/* Preview das Parcelas - Melhorado */}
              {canSave && (
                <div className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-lunar-text">Cobrança</span>
                  </div>
                  <div className="text-lg font-semibold text-primary mb-2">
                    {numeroParcelas}x de {formatCurrency(valorParcela)}
                  </div>
                  
                  {/* Datas específicas */}
                  <div className="space-y-1">
                    <div className="text-xs text-lunar-textSecondary">Datas de vencimento:</div>
                    <div className="text-xs text-lunar-text">
                      {calculateDueDates(parseInt(diaVencimento), numeroParcelas).join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* À Vista - Melhorado */}
          {formaPagamento === 'avista' && (
            <div className="space-y-3 bg-card/50 border border-border rounded-lg p-4">
              <div className="space-y-2">
                <Label htmlFor="diaVencimentoAvista" className="text-sm font-medium text-lunar-text">
                  Dia do Vencimento*
                </Label>
                <Input
                  id="diaVencimentoAvista"
                  type="number"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  placeholder="Ex: 15"
                  className={`bg-background border-border text-lunar-text ${!canSave && diaVencimento !== '' ? 'border-red-500' : ''}`}
                />
                {!canSave && diaVencimento !== '' && (
                  <p className="text-xs text-red-500">Dia deve ser entre 1 e 31</p>
                )}
              </div>
              
              {/* Preview de À Vista - Simplificado */}
              {canSave && (
                <div className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-lunar-text">Cobrança</span>
                  </div>
                  <div className="text-lg font-semibold text-primary mb-2">
                    {formatCurrency(valorRestanteEditavel)}
                  </div>
                  
                  {/* Data específica */}
                  <div className="space-y-1">
                    <div className="text-xs text-lunar-textSecondary">Data de vencimento:</div>
                    <div className="text-xs text-lunar-text">
                      {getNextDueDate(parseInt(diaVencimento))}
                    </div>
                  </div>
                </div>
              )}
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
          <Button onClick={handleSave} disabled={loading || !canSave}>
            {loading ? 'Salvando...' : 'Configurar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}