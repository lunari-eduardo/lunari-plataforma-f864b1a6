import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard, History } from 'lucide-react';
import { useCobranca } from '@/hooks/useCobranca';
import { Cobranca } from '@/types/cobranca';
import { ChargeLinkSection } from './ChargeLinkSection';
import { PixManualSection } from './PixManualSection';
import { ChargeHistory } from './ChargeHistory';
import { ProviderSelector } from './ProviderSelector';
import { SelectedProvider } from './ProviderRow';

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId?: string;
  valorSugerido: number;
}

export function ChargeModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  clienteWhatsapp,
  sessionId,
  valorSugerido,
}: ChargeModalProps) {
  const [valor, setValor] = useState(valorSugerido);
  const [valorType, setValorType] = useState<'total' | 'parcial'>('total');
  const [descricao, setDescricao] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historico'>('cobrar');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [currentChargeId, setCurrentChargeId] = useState<string | null>(null);
  
  // Current charge state (after generation)
  const [currentCharge, setCurrentCharge] = useState<{
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopiaCola?: string;
    pixPayload?: string;
    paymentLink?: string;
    checkoutUrl?: string;
    status?: Cobranca['status'];
  } | null>(null);

  const {
    cobrancas,
    creatingCharge,
    createPixCharge,
    createLinkCharge,
    createPixManualCharge,
    confirmPixManualPayment,
    cancelCharge,
    checkPaymentStatus,
  } = useCobranca({ clienteId, sessionId });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setValor(valorSugerido);
      setValorType('total');
      setDescricao('');
      setSelectedProvider(null); // Will be auto-selected by ProviderSelector
      setCurrentCharge(null);
      setCurrentChargeId(null);
      setCheckingStatus(false);
      setActiveTab('cobrar');
    }
  }, [isOpen, valorSugerido]);

  // Update valor when type changes
  useEffect(() => {
    if (valorType === 'total') {
      setValor(valorSugerido);
    }
  }, [valorType, valorSugerido]);

  const handleProviderSelect = (provider: SelectedProvider) => {
    setSelectedProvider(provider);
    setCurrentCharge(null);
    setCurrentChargeId(null);
  };

  const handleGenerateCharge = async () => {
    if (!selectedProvider) return;

    // PIX Manual flow - local generation, no Edge Function
    if (selectedProvider === 'pix_manual') {
      const result = await createPixManualCharge({
        clienteId,
        sessionId,
        valor,
        descricao: descricao || undefined,
        tipoCobranca: 'pix',
        provedor: 'pix_manual',
      });

      if (result.success) {
        setCurrentCharge({
          pixPayload: result.pixPayload,
          pixCopiaCola: result.pixPayload,
          status: 'pendente',
        });
        if (result.cobranca?.id) {
          setCurrentChargeId(result.cobranca.id);
        }
      }
      return;
    }

    // Edge Function flow for MP and InfinitePay
    const provedor = selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago';

    const result = await createLinkCharge({
      clienteId,
      sessionId,
      valor,
      descricao: descricao || undefined,
      tipoCobranca: 'link',
      provedor,
    });

    if (result.success) {
      const linkUrl = result.checkoutUrl || result.paymentLink;
      if (linkUrl) {
        setCurrentCharge({
          paymentLink: linkUrl,
          checkoutUrl: linkUrl,
          status: 'pendente',
        });
        if (result.cobranca?.id) {
          setCurrentChargeId(result.cobranca.id);
        }
      }
    }
  };

  const handleCheckStatus = async () => {
    if (!currentChargeId) return;
    
    setCheckingStatus(true);
    try {
      const result = await checkPaymentStatus(currentChargeId);
      if (result.updated || result.status === 'pago') {
        setCurrentCharge(prev => prev ? { ...prev, status: 'pago' } : null);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleViewCharge = (cobranca: Cobranca) => {
    // Determine provider from cobranca
    if (cobranca.provedor === 'infinitepay') {
      setSelectedProvider('infinitepay');
    } else if (cobranca.provedor === 'mercadopago') {
      setSelectedProvider('mercadopago_link');
    } else if (cobranca.provedor === 'pix_manual') {
      setSelectedProvider('pix_manual');
    }
    
    const linkUrl = cobranca.ipCheckoutUrl || cobranca.mpPaymentLink;
    setCurrentCharge({
      qrCode: cobranca.mpQrCode,
      qrCodeBase64: cobranca.mpQrCodeBase64,
      pixCopiaCola: cobranca.mpPixCopiaCola,
      pixPayload: cobranca.provedor === 'pix_manual' ? cobranca.mpPixCopiaCola : undefined,
      paymentLink: linkUrl,
      checkoutUrl: linkUrl,
      status: cobranca.status,
    });
    setCurrentChargeId(cobranca.id);
    setActiveTab('cobrar');
  };

  // Show different sections based on provider
  const showLinkSection = selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay';
  const showPixManualSection = selectedProvider === 'pix_manual';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden z-[60] shadow-2xl border-2 border-border">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cobrar cliente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{clienteNome}</p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cobrar' | 'historico')}>
          <TabsList className="w-full grid grid-cols-2 mx-4 mb-2" style={{ width: 'calc(100% - 32px)' }}>
            <TabsTrigger value="cobrar" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Nova Cobrança
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" />
              Histórico ({cobrancas.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[calc(90vh-140px)]">
            <TabsContent value="cobrar" className="p-4 pt-2 space-y-4 m-0">
              {/* Valor da cobrança */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Valor da cobrança
                </Label>
                
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      R$
                    </span>
                    <Input
                      type="number"
                      value={valor}
                      onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                      className="pl-10 h-10 text-lg font-semibold"
                      disabled={valorType === 'total'}
                    />
                  </div>
                  
                  <RadioGroup
                    value={valorType}
                    onValueChange={(v) => setValorType(v as 'total' | 'parcial')}
                    className="flex gap-3"
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="total" id="total" />
                      <Label htmlFor="total" className="text-sm cursor-pointer">Total</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="parcial" id="parcial" />
                      <Label htmlFor="parcial" className="text-sm cursor-pointer">Parcial</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Textarea
                  placeholder="Descrição da cobrança (opcional)"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="resize-none h-16 text-sm"
                />
              </div>

              <Separator />

              {/* Provider Selection */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Meio de cobrança
                </Label>
                
                <ProviderSelector
                  selectedProvider={selectedProvider}
                  onSelect={handleProviderSelect}
                />
              </div>

              <Separator />

              {/* Charge Generation Section */}
              <div className="min-h-[200px]">
                {showPixManualSection && (
                  <PixManualSection
                    valor={valor}
                    pixPayload={currentCharge?.pixPayload}
                    status={currentCharge?.status}
                    loading={creatingCharge}
                    clienteWhatsapp={clienteWhatsapp}
                    chargeId={currentChargeId || undefined}
                    onGenerate={handleGenerateCharge}
                    onConfirmPayment={confirmPixManualPayment}
                  />
                )}

                {showLinkSection && (
                  <ChargeLinkSection
                    valor={valor}
                    paymentLink={currentCharge?.paymentLink}
                    status={currentCharge?.status}
                    loading={creatingCharge}
                    checkingStatus={checkingStatus}
                    onGenerate={handleGenerateCharge}
                    onCheckStatus={currentChargeId ? handleCheckStatus : undefined}
                    clienteWhatsapp={clienteWhatsapp}
                  />
                )}

                {!selectedProvider && (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Selecione um meio de cobrança acima
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="historico" className="p-4 pt-2 m-0">
              <ChargeHistory
                cobrancas={cobrancas}
                onCancel={cancelCharge}
                onView={handleViewCharge}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="p-4 pt-2 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
