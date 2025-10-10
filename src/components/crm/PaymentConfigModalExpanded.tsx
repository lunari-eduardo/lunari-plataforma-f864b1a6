import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, DollarSign, Calendar, Package, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { formatDateForStorage, safeParseInputDate } from '@/utils/dateUtils';
import { SessionPaymentExtended } from '@/types/sessionPayments';
import { useNumberInput } from '@/hooks/useNumberInput';
interface PaymentConfigModalExpandedProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  clienteId?: string;
  valorTotal: number;
  valorJaPago: number;
  valorRestante: number;
  clienteNome: string;
  onAddPayment: (payment: Omit<SessionPaymentExtended, 'id'>) => void;
  onCreateInstallments: (totalValue: number, installmentCount: number, startDate: Date, intervalDays?: number) => void;
  onSchedulePayment: (value: number, dueDate: Date, observacoes?: string) => void;
}
export function PaymentConfigModalExpanded({
  isOpen,
  onClose,
  sessionId,
  clienteId,
  valorTotal,
  valorJaPago,
  valorRestante,
  clienteNome,
  onAddPayment,
  onCreateInstallments,
  onSchedulePayment
}: PaymentConfigModalExpandedProps) {
  const [activeTab, setActiveTab] = useState('parcelamento');
  const [loading, setLoading] = useState(false);

  // Estados para parcelamento
  const [valorParcelar, setValorParcelar] = useState<number | string>(valorRestante);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(2);
  const [dataInicioParcelas, setDataInicioParcelas] = useState(formatDateForStorage(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [intervaloParcelas, setIntervaloParcelas] = useState(30);

  // Estados para agendamento
  const [valorAgendado, setValorAgendado] = useState<number | string>(valorRestante);
  const [dataAgendamento, setDataAgendamento] = useState(formatDateForStorage(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [observacoesAgendamento, setObservacoesAgendamento] = useState('');
  const [entradaAgora, setEntradaAgora] = useState<number | string>('');

  // Hooks para inputs numéricos
  const valorParcelarInput = useNumberInput({
    value: valorParcelar,
    onChange: setValorParcelar
  });
  const entradaAgoraInput = useNumberInput({
    value: entradaAgora,
    onChange: setEntradaAgora
  });
  const valorAgendadoInput = useNumberInput({
    value: valorAgendado,
    onChange: setValorAgendado
  });
  const handleParcelamento = async () => {
    const valor = parseFloat(String(valorParcelar)) || 0;
    if (valor <= 0 || quantidadeParcelas <= 0) {
      toast({
        title: "Erro",
        description: "Valores inválidos para parcelamento",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      // Corrigir conversão de data para evitar problema de timezone
      const startDateForInstallments = safeParseInputDate(dataInicioParcelas);
      if (!startDateForInstallments) {
        toast({
          title: "Erro",
          description: "Data inválida para início das parcelas",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      onCreateInstallments(valor, quantidadeParcelas, startDateForInstallments, intervaloParcelas);
      toast({
        title: "Parcelas criadas",
        description: `${quantidadeParcelas} parcelas de ${formatCurrency(valor / quantidadeParcelas)} criadas`
      });
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar parcelas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleAgendamento = async () => {
    const valorAgendadoParsed = parseFloat(String(valorAgendado)) || 0;
    const entradaAgoraParsed = parseFloat(String(entradaAgora)) || 0;
    if (valorAgendadoParsed <= 0 || !dataAgendamento) {
      toast({
        title: "Erro",
        description: "Valores inválidos para agendamento",
        variant: "destructive"
      });
      return;
    }
    if (entradaAgoraParsed < 0 || entradaAgoraParsed + valorAgendadoParsed > valorRestante) {
      toast({
        title: "Erro",
        description: "Valores de entrada e agendamento excedem o valor restante",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      // Se há entrada, registrar pagamento imediato primeiro
      if (entradaAgoraParsed > 0) {
        const dataHoje = formatDateForStorage(new Date());
        console.log('💰 [PaymentConfig] Criando entrada:', {
          valor: entradaAgoraParsed,
          data: dataHoje,
          observacoes: 'Entrada'
        });
        
        onAddPayment({
          valor: entradaAgoraParsed,
          data: dataHoje,
          tipo: 'pago',
          statusPagamento: 'pago',
          origem: 'workflow_rapido',
          editavel: true,
          observacoes: 'Entrada'
        });
      }

      // Corrigir conversão de data para evitar problema de timezone
      const dateForScheduling = safeParseInputDate(dataAgendamento);
      if (!dateForScheduling) {
        toast({
          title: "Erro",
          description: "Data inválida para agendamento",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      console.log('🗓️ [Agendamento] Data selecionada:', dataAgendamento);
      console.log('🗓️ [Agendamento] Data processada:', dateForScheduling.toISOString());
      onSchedulePayment(valorAgendadoParsed, dateForScheduling, observacoesAgendamento);
      const totalMessage = entradaAgoraParsed > 0 ? `${formatCurrency(entradaAgoraParsed)} entrada + ${formatCurrency(valorAgendadoParsed)} agendado` : `${formatCurrency(valorAgendadoParsed)} agendado`;
      toast({
        title: "Pagamento configurado",
        description: `${totalMessage} para ${dateForScheduling.toLocaleDateString()}`
      });
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao configurar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-lg lg:max-w-xl max-w-[95vw] max-h-[80vh] overflow-y-auto px-2 sm:px-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 sm:gap-2 text-sm sm:text-lg">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Gerenciar Pagamentos
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Cliente: <span className="font-medium">{clienteNome}</span>
          </p>
        </DialogHeader>

        {/* Resumo Financeiro */}
        <Card className="bg-muted/30">
          <CardContent className="p-2 sm:p-3 lg:p-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 text-center">
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="font-bold text-primary text-xs sm:text-sm">{formatCurrency(valorTotal)}</p>
              </div>
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Pago</p>
                <p className="font-bold text-green-600 text-xs sm:text-sm">{formatCurrency(valorJaPago)}</p>
              </div>
              <div>
                <p className="text-2xs sm:text-xs text-muted-foreground uppercase tracking-wide">Restante</p>
                <p className="font-bold text-red-600 text-xs sm:text-sm">{formatCurrency(valorRestante)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-8 sm:h-10">
            <TabsTrigger value="parcelamento" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Parcelamento</span>
              <span className="sm:hidden">Parcelas</span>
            </TabsTrigger>
            <TabsTrigger value="agendamento" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Agendamento</span>
              <span className="sm:hidden">Agendar</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Parcelamento */}
          <TabsContent value="parcelamento" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-2 sm:pb-6">
                <CardTitle className="text-sm sm:text-base lg:text-lg">Configurar Parcelamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valorParcelar">Valor Total a Parcelar</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="valorParcelar" type="number" value={valorParcelarInput.displayValue} onChange={valorParcelarInput.handleChange} onFocus={valorParcelarInput.handleFocus} className="pl-10" min="0" max={valorRestante} step="0.01" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas</Label>
                    <Input id="quantidadeParcelas" type="number" value={quantidadeParcelas} onChange={e => setQuantidadeParcelas(parseInt(e.target.value) || 2)} min="2" max="12" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicioParcelas">Data da Primeira Parcela</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="dataInicioParcelas" type="date" value={dataInicioParcelas} onChange={e => setDataInicioParcelas(e.target.value)} className="pl-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intervaloParcelas">Intervalo (dias)</Label>
                    <Input id="intervaloParcelas" type="number" value={intervaloParcelas} onChange={e => setIntervaloParcelas(parseInt(e.target.value) || 30)} min="1" max="365" />
                  </div>
                </div>

                {(parseFloat(String(valorParcelar)) || 0) > 0 && quantidadeParcelas > 0 && <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Preview das Parcelas</h4>
                      <p className="text-sm text-blue-800">
                        {quantidadeParcelas} parcelas de {formatCurrency((parseFloat(String(valorParcelar)) || 0) / quantidadeParcelas)}
                      </p>
                      <p className="text-xs text-blue-600">
                        Primeira parcela: {new Date(dataInicioParcelas).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>}

                <Button onClick={handleParcelamento} disabled={loading || (parseFloat(String(valorParcelar)) || 0) <= 0 || quantidadeParcelas <= 0} className="w-full">
                  {loading ? 'Criando...' : `Criar ${quantidadeParcelas} Parcelas`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Agendamento */}
          <TabsContent value="agendamento" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-2 sm:pb-6">
                <CardTitle className="text-sm sm:text-base lg:text-lg">Agendar Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entradaAgora">Entrada Agora (opcional)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="entradaAgora" type="number" value={entradaAgoraInput.displayValue} onChange={e => {
                      entradaAgoraInput.handleChange(e);
                      const entrada = parseFloat(e.target.value) || 0;
                      const valorAgendadoParsed = parseFloat(String(valorAgendado)) || 0;
                      // Ajustar valor agendado automaticamente
                      if (entrada >= 0 && entrada + valorAgendadoParsed <= valorRestante) {
                        // OK, manter valores
                      } else if (entrada >= 0) {
                        setValorAgendado(Math.max(0, valorRestante - entrada));
                      }
                    }} onFocus={entradaAgoraInput.handleFocus} className="pl-10" min="0" max={valorRestante} step="0.01" placeholder="0,00" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Será registrado como pago hoje
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valorAgendado">Valor a Agendar</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="valorAgendado" type="number" value={valorAgendadoInput.displayValue} onChange={valorAgendadoInput.handleChange} onFocus={valorAgendadoInput.handleFocus} className="pl-10" min="0" max={valorRestante - (parseFloat(String(entradaAgora)) || 0)} step="0.01" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dataAgendamento">Data de Vencimento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="dataAgendamento" type="date" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} className="pl-10" />
                      </div>
                    </div>
                  </div>

                  {(parseFloat(String(entradaAgora)) || 0) + (parseFloat(String(valorAgendado)) || 0) > 0 && <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Resumo</h4>
                        {(parseFloat(String(entradaAgora)) || 0) > 0 && <p className="text-sm text-blue-800">
                            Entrada hoje: {formatCurrency(parseFloat(String(entradaAgora)) || 0)}
                          </p>}
                        {(parseFloat(String(valorAgendado)) || 0) > 0 && <p className="text-sm text-blue-800">
                            Agendado: {formatCurrency(parseFloat(String(valorAgendado)) || 0)} para {new Date(dataAgendamento).toLocaleDateString()}
                          </p>}
                        <p className="text-xs text-blue-600 mt-1">
                          Total: {formatCurrency((parseFloat(String(entradaAgora)) || 0) + (parseFloat(String(valorAgendado)) || 0))}
                        </p>
                      </CardContent>
                    </Card>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoesAgendamento">Observações (opcional)</Label>
                  <Textarea id="observacoesAgendamento" value={observacoesAgendamento} onChange={e => setObservacoesAgendamento(e.target.value)} placeholder="Observações sobre este pagamento..." rows={3} />
                </div>

                <Button onClick={handleAgendamento} disabled={loading || (parseFloat(String(valorAgendado)) || 0) <= 0 && (parseFloat(String(entradaAgora)) || 0) <= 0 || !dataAgendamento || (parseFloat(String(entradaAgora)) || 0) + (parseFloat(String(valorAgendado)) || 0) > valorRestante} className="w-full">
                  {loading ? 'Configurando...' : (parseFloat(String(entradaAgora)) || 0) > 0 ? `Entrada ${formatCurrency(parseFloat(String(entradaAgora)) || 0)} + Agendar ${formatCurrency(parseFloat(String(valorAgendado)) || 0)}` : `Agendar ${formatCurrency(parseFloat(String(valorAgendado)) || 0)}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>;
}