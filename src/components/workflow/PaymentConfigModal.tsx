import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, DollarSign, CalendarIcon, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { useClientReceivables } from '@/hooks/useClientReceivables';
import { formatDateForDisplay, getCurrentDateString } from '@/utils/dateUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  const [valorEntrada, setValorEntrada] = useState(valorJaPago);
  const [formaPagamento, setFormaPagamento] = useState<'avista' | 'parcelado'>('avista');
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [dataPrimeiroPagamento, setDataPrimeiroPagamento] = useState<Date>();
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingPlan, setExistingPlan] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);

  const { 
    criarOuAtualizarPlanoPagamento, 
    paymentPlans, 
    obterParcelasPorPlano,
    temAgendamentos,
    obterInfoAgendamento
  } = useClientReceivables();

  // Calcular valores restantes (apenas considerando entradas -1)
  const getValuesDiff = () => {
    const agendamentoInfo = obterInfoAgendamento(sessionId);
    let valorTotalEntradas = 0;
    
    if (agendamentoInfo) {
      // Somar apenas entradas (numeroParcela === -1)
      valorTotalEntradas = agendamentoInfo.installments
        .filter(i => i.numeroParcela === -1 && i.status === 'pago')
        .reduce((total, i) => total + i.valor, 0);
    }
    
    return {
      valorTotalEntradas,
      valorRestante: Math.max(0, valorTotal - valorTotalEntradas - valorEntrada)
    };
  };

  const { valorTotalEntradas, valorRestante } = getValuesDiff();

  // Função para calcular datas de vencimento
  const calculateDueDates = (startDate: Date, parcelas: number) => {
    const dates: string[] = [];
    
    for (let i = 0; i < parcelas; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      dates.push(formatDateForDisplay(dueDate.toISOString().split('T')[0]));
    }
    
    return dates;
  };

  // Validação se pode salvar
  const canSave = dataPrimeiroPagamento !== undefined;

  // Carregar informações do agendamento existente
  useEffect(() => {
    if (isOpen && sessionId) {
      const agendamentoInfo = obterInfoAgendamento(sessionId);
      
      if (agendamentoInfo?.hasScheduled) {
        setExistingPlan(agendamentoInfo.plan);
        setFormaPagamento(agendamentoInfo.plan.formaPagamento);
        setNumeroParcelas(agendamentoInfo.plan.numeroParcelas);
        setDataPrimeiroPagamento(new Date());
        setObservacoes(agendamentoInfo.plan.observacoes || '');
        setInstallments(agendamentoInfo.installments);
      } else {
        // Reset para novo agendamento
        setExistingPlan(null);
        setFormaPagamento('avista');
        setNumeroParcelas(2);
        setDataPrimeiroPagamento(undefined);
        setObservacoes('');
        setInstallments([]);
      }
      
      // Valor entrada sempre inicia com valorJaPago
      setValorEntrada(valorJaPago);
    }
  }, [isOpen, sessionId, obterInfoAgendamento, valorJaPago]);

  const valorTotalNegociado = valorTotal;
  const valorParcela = formaPagamento === 'avista' ? valorRestante : valorRestante / numeroParcelas;

  const handleSave = async () => {
    if (!canSave) return;
    
    setLoading(true);
    try {
      // V2: Agendar pagamentos com entrada e data
      await criarOuAtualizarPlanoPagamento(
        sessionId,
        clienteId,
        valorTotalNegociado, // Total da sessão
        valorEntrada, // Entrada informada
        formaPagamento,
        formaPagamento === 'avista' ? 1 : numeroParcelas,
        dataPrimeiroPagamento!.toISOString().split('T')[0], // Data do primeiro pagamento
        observacoes
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
            Agendar Pagamento
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
                        <Calendar className="h-3 w-3 text-orange-600" />
                      )}
                      <span className="text-lunar-textSecondary">
                        {installment.numeroParcela === -1 ? 'Entrada' : 
                         installment.numeroParcela === 0 ? 'À Vista' : 
                         `Parcela ${installment.numeroParcela}`}
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
            
            {valorTotalEntradas > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunar-textSecondary">Entradas Anteriores:</span>
                <span className="font-medium text-green-600">- {formatCurrency(valorTotalEntradas)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-lunar-textSecondary">Entrada (Este Agendamento):</span>
              <Input
                type="number"
                value={valorEntrada}
                onChange={(e) => setValorEntrada(parseFloat(e.target.value) || 0)}
                className="w-32 text-right bg-background border-border text-lunar-text"
                min="0"
                max={valorTotal - valorTotalEntradas}
                step="0.01"
              />
            </div>
            
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium text-lunar-text">Restante a Agendar:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(valorRestante)}
              </span>
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
                  <Label htmlFor="dataPrimeiro" className="text-sm font-medium text-lunar-text">
                    Data do Primeiro Pagamento*
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background border-border text-lunar-text",
                          !dataPrimeiroPagamento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataPrimeiroPagamento ? format(dataPrimeiroPagamento, "dd/MM/yyyy") : <span>Selecionar data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dataPrimeiroPagamento}
                        onSelect={setDataPrimeiroPagamento}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Preview das Parcelas */}
              {canSave && valorRestante > 0 && (
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
                      {dataPrimeiroPagamento && calculateDueDates(dataPrimeiroPagamento, numeroParcelas).join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* À Vista */}
          {formaPagamento === 'avista' && (
            <div className="space-y-3 bg-card/50 border border-border rounded-lg p-4">
              <div className="space-y-2">
                <Label htmlFor="dataVencimentoAvista" className="text-sm font-medium text-lunar-text">
                  Data do Pagamento*
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background border-border text-lunar-text",
                        !dataPrimeiroPagamento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPrimeiroPagamento ? format(dataPrimeiroPagamento, "dd/MM/yyyy") : <span>Selecionar data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataPrimeiroPagamento}
                      onSelect={setDataPrimeiroPagamento}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Preview de À Vista */}
              {canSave && valorRestante > 0 && (
                <div className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-lunar-text">Cobrança</span>
                  </div>
                  <div className="text-lg font-semibold text-primary mb-2">
                    {formatCurrency(valorRestante)}
                  </div>
                  
                  {/* Data específica */}
                  <div className="space-y-1">
                    <div className="text-xs text-lunar-textSecondary">Data de vencimento:</div>
                    <div className="text-xs text-lunar-text">
                      {dataPrimeiroPagamento && formatDateForDisplay(dataPrimeiroPagamento.toISOString().split('T')[0])}
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
            {loading ? 'Salvando...' : (existingPlan ? 'Atualizar Agendamento' : 'Agendar Pagamento')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}