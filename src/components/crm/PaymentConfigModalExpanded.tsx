import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Package,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from '@/hooks/use-toast';
import { formatDateForStorage, safeParseInputDate } from '@/utils/dateUtils';
import { SessionPaymentExtended } from '@/types/sessionPayments';

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
  onCreateInstallments: (
    totalValue: number,
    installmentCount: number,
    startDate: Date,
    intervalDays?: number
  ) => void;
  onSchedulePayment: (
    value: number,
    dueDate: Date,
    observacoes?: string
  ) => void;
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
  const [activeTab, setActiveTab] = useState('rapido');
  const [loading, setLoading] = useState(false);

  // Estados para pagamento rápido
  const [valorRapido, setValorRapido] = useState(valorRestante);

  // Estados para parcelamento
  const [valorParcelar, setValorParcelar] = useState(valorRestante);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(2);
  const [dataInicioParcelas, setDataInicioParcelas] = useState(
    formatDateForStorage(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );
  const [intervaloParcelas, setIntervaloParcelas] = useState(30);

  // Estados para agendamento
  const [valorAgendado, setValorAgendado] = useState(valorRestante);
  const [dataAgendamento, setDataAgendamento] = useState(
    formatDateForStorage(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );
  const [observacoesAgendamento, setObservacoesAgendamento] = useState('');
  const [entradaAgora, setEntradaAgora] = useState(0);

  const handlePagamentoRapido = async () => {
    if (valorRapido <= 0 || valorRapido > valorRestante) {
      toast({
        title: "Erro",
        description: "Valor inválido para pagamento",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      onAddPayment({
        valor: valorRapido,
        data: formatDateForStorage(new Date()),
        tipo: 'pago',
        statusPagamento: 'pago',
        origem: 'workflow_rapido',
        editavel: true
      });

      toast({
        title: "Pagamento registrado",
        description: `${formatCurrency(valorRapido)} registrado com sucesso`
      });

      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao registrar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleParcelamento = async () => {
    if (valorParcelar <= 0 || quantidadeParcelas <= 0) {
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

      onCreateInstallments(
        valorParcelar,
        quantidadeParcelas,
        startDateForInstallments,
        intervaloParcelas
      );

      toast({
        title: "Parcelas criadas",
        description: `${quantidadeParcelas} parcelas de ${formatCurrency(valorParcelar / quantidadeParcelas)} criadas`
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
    if (valorAgendado <= 0 || !dataAgendamento) {
      toast({
        title: "Erro",
        description: "Valores inválidos para agendamento",
        variant: "destructive"
      });
      return;
    }

    if (entradaAgora < 0 || (entradaAgora + valorAgendado) > valorRestante) {
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
      if (entradaAgora > 0) {
        onAddPayment({
          valor: entradaAgora,
          data: formatDateForStorage(new Date()),
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
      
      onSchedulePayment(
        valorAgendado,
        dateForScheduling,
        observacoesAgendamento
      );

      const totalMessage = entradaAgora > 0 
        ? `${formatCurrency(entradaAgora)} entrada + ${formatCurrency(valorAgendado)} agendado`
        : `${formatCurrency(valorAgendado)} agendado`;

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gerenciar Pagamentos
          </DialogTitle>
          <p className="text-muted-foreground">
            Cliente: <span className="font-medium">{clienteNome}</span>
          </p>
        </DialogHeader>

        {/* Resumo Financeiro */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(valorTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pago</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(valorJaPago)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Restante</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(valorRestante)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rapido" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Pagamento Rápido
            </TabsTrigger>
            <TabsTrigger value="parcelamento" className="gap-2">
              <Package className="h-4 w-4" />
              Parcelamento
            </TabsTrigger>
            <TabsTrigger value="agendamento" className="gap-2">
              <Clock className="h-4 w-4" />
              Agendamento
            </TabsTrigger>
          </TabsList>

          {/* Tab Pagamento Rápido */}
          <TabsContent value="rapido" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registrar Pagamento Imediato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="valorRapido">Valor do Pagamento</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="valorRapido"
                      type="number"
                      value={valorRapido}
                      onChange={(e) => setValorRapido(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                      min="0"
                      max={valorRestante}
                      step="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Máximo disponível: {formatCurrency(valorRestante)}
                  </p>
                </div>

                <Button 
                  onClick={handlePagamentoRapido}
                  disabled={loading || valorRapido <= 0 || valorRapido > valorRestante}
                  className="w-full"
                >
                  {loading ? 'Registrando...' : `Registrar ${formatCurrency(valorRapido)}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Parcelamento */}
          <TabsContent value="parcelamento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configurar Parcelamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valorParcelar">Valor Total a Parcelar</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="valorParcelar"
                        type="number"
                        value={valorParcelar}
                        onChange={(e) => setValorParcelar(parseFloat(e.target.value) || 0)}
                        className="pl-10"
                        min="0"
                        max={valorRestante}
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas</Label>
                    <Input
                      id="quantidadeParcelas"
                      type="number"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 2)}
                      min="2"
                      max="12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicioParcelas">Data da Primeira Parcela</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="dataInicioParcelas"
                        type="date"
                        value={dataInicioParcelas}
                        onChange={(e) => setDataInicioParcelas(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intervaloParcelas">Intervalo (dias)</Label>
                    <Input
                      id="intervaloParcelas"
                      type="number"
                      value={intervaloParcelas}
                      onChange={(e) => setIntervaloParcelas(parseInt(e.target.value) || 30)}
                      min="1"
                      max="365"
                    />
                  </div>
                </div>

                {valorParcelar > 0 && quantidadeParcelas > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Preview das Parcelas</h4>
                      <p className="text-sm text-blue-800">
                        {quantidadeParcelas} parcelas de {formatCurrency(valorParcelar / quantidadeParcelas)}
                      </p>
                      <p className="text-xs text-blue-600">
                        Primeira parcela: {new Date(dataInicioParcelas).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  onClick={handleParcelamento}
                  disabled={loading || valorParcelar <= 0 || quantidadeParcelas <= 0}
                  className="w-full"
                >
                  {loading ? 'Criando...' : `Criar ${quantidadeParcelas} Parcelas`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Agendamento */}
          <TabsContent value="agendamento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Agendar Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entradaAgora">Entrada Agora (opcional)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="entradaAgora"
                        type="number"
                        value={entradaAgora}
                        onChange={(e) => {
                          const entrada = parseFloat(e.target.value) || 0;
                          setEntradaAgora(entrada);
                          // Ajustar valor agendado automaticamente
                          if (entrada >= 0 && (entrada + valorAgendado) <= valorRestante) {
                            // OK, manter valores
                          } else if (entrada >= 0) {
                            setValorAgendado(Math.max(0, valorRestante - entrada));
                          }
                        }}
                        className="pl-10"
                        min="0"
                        max={valorRestante}
                        step="0.01"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Será registrado como pago hoje
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valorAgendado">Valor a Agendar</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="valorAgendado"
                          type="number"
                          value={valorAgendado}
                          onChange={(e) => setValorAgendado(parseFloat(e.target.value) || 0)}
                          className="pl-10"
                          min="0"
                          max={valorRestante - entradaAgora}
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dataAgendamento">Data de Vencimento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="dataAgendamento"
                          type="date"
                          value={dataAgendamento}
                          onChange={(e) => setDataAgendamento(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  {(entradaAgora + valorAgendado) > 0 && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Resumo</h4>
                        {entradaAgora > 0 && (
                          <p className="text-sm text-blue-800">
                            Entrada hoje: {formatCurrency(entradaAgora)}
                          </p>
                        )}
                        {valorAgendado > 0 && (
                          <p className="text-sm text-blue-800">
                            Agendado: {formatCurrency(valorAgendado)} para {new Date(dataAgendamento).toLocaleDateString()}
                          </p>
                        )}
                        <p className="text-xs text-blue-600 mt-1">
                          Total: {formatCurrency(entradaAgora + valorAgendado)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoesAgendamento">Observações (opcional)</Label>
                  <Textarea
                    id="observacoesAgendamento"
                    value={observacoesAgendamento}
                    onChange={(e) => setObservacoesAgendamento(e.target.value)}
                    placeholder="Observações sobre este pagamento..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleAgendamento}
                  disabled={loading || (valorAgendado <= 0 && entradaAgora <= 0) || !dataAgendamento || (entradaAgora + valorAgendado) > valorRestante}
                  className="w-full"
                >
                  {loading ? 'Configurando...' : (
                    entradaAgora > 0 
                      ? `Entrada ${formatCurrency(entradaAgora)} + Agendar ${formatCurrency(valorAgendado)}`
                      : `Agendar ${formatCurrency(valorAgendado)}`
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}