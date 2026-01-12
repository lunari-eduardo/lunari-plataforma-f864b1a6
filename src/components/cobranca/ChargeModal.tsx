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
import { Badge } from '@/components/ui/badge';
import { QrCode, Link2, CreditCard, History, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { useCobranca } from '@/hooks/useCobranca';
import { TipoCobranca, Cobranca, ProvedorPagamento } from '@/types/cobranca';
import { ChargeMethodCard } from './ChargeMethodCard';
import { ChargePixSection } from './ChargePixSection';
import { ChargeLinkSection } from './ChargeLinkSection';
import { ChargeHistory } from './ChargeHistory';

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
  const [selectedMethod, setSelectedMethod] = useState<TipoCobranca>('pix');
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historico'>('cobrar');
  
  // Current charge state (after generation)
  const [currentCharge, setCurrentCharge] = useState<{
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopiaCola?: string;
    paymentLink?: string;
    checkoutUrl?: string;
    status?: Cobranca['status'];
  } | null>(null);

  const [provedorAtivo, setProvedorAtivo] = useState<ProvedorPagamento | null>(null);

  const {
    cobrancas,
    loading,
    creatingCharge,
    createPixCharge,
    createLinkCharge,
    cancelCharge,
    getProvedor,
  } = useCobranca({ clienteId, sessionId });

  // Check active provider when modal opens
  useEffect(() => {
    const checkProvedor = async () => {
      const provedor = await getProvedor();
      setProvedorAtivo(provedor);
    };
    if (isOpen) {
      checkProvedor();
    }
  }, [isOpen, getProvedor]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setValor(valorSugerido);
      setValorType('total');
      setDescricao('');
      // Default to 'link' when InfinitePay is active (no isolated Pix)
      setSelectedMethod(provedorAtivo === 'infinitepay' ? 'link' : 'pix');
      setCurrentCharge(null);
      setActiveTab('cobrar');
    }
  }, [isOpen, valorSugerido, provedorAtivo]);

  // Update valor when type changes
  useEffect(() => {
    if (valorType === 'total') {
      setValor(valorSugerido);
    }
  }, [valorType, valorSugerido]);

  const handleGeneratePix = async () => {
    const result = await createPixCharge({
      clienteId,
      sessionId,
      valor,
      descricao: descricao || undefined,
      tipoCobranca: 'pix',
    });

    if (result.success) {
      setCurrentCharge({
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        pixCopiaCola: result.pixCopiaCola,
        status: 'pendente',
      });
    }
  };

  const handleGenerateLink = async () => {
    const result = await createLinkCharge({
      clienteId,
      sessionId,
      valor,
      descricao: descricao || undefined,
      tipoCobranca: 'link',
    });

    if (result.success) {
      // Use checkoutUrl (InfinitePay) or paymentLink (Mercado Pago)
      const linkUrl = result.checkoutUrl || result.paymentLink;
      setCurrentCharge({
        paymentLink: linkUrl,
        checkoutUrl: linkUrl,
        status: 'pendente',
      });
    }
  };

  const handleViewCharge = (cobranca: Cobranca) => {
    setSelectedMethod(cobranca.tipoCobranca);
    // Prioritize InfinitePay checkout URL over Mercado Pago
    const linkUrl = cobranca.ipCheckoutUrl || cobranca.mpPaymentLink;
    setCurrentCharge({
      qrCode: cobranca.mpQrCode,
      qrCodeBase64: cobranca.mpQrCodeBase64,
      pixCopiaCola: cobranca.mpPixCopiaCola,
      paymentLink: linkUrl,
      checkoutUrl: linkUrl,
      status: cobranca.status,
    });
    setActiveTab('cobrar');
  };

  // Build methods based on active provider
  // InfinitePay only supports link checkout (Pix + Card in one), not isolated Pix
  const methods: { type: TipoCobranca; icon: React.ReactNode; title: string; description: string }[] = 
    provedorAtivo === 'infinitepay'
      ? [{ type: 'link', icon: <Link2 className="h-5 w-5" />, title: 'Link', description: 'Pix + Cartão' }]
      : [
          { type: 'pix', icon: <QrCode className="h-5 w-5" />, title: 'Pix', description: 'Imediato' },
          { type: 'link', icon: <Link2 className="h-5 w-5" />, title: 'Link', description: 'Pix + Cartão' },
        ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cobrar cliente
            {provedorAtivo && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {provedorAtivo === 'infinitepay' ? 'InfinitePay' : 'Mercado Pago'}
              </Badge>
            )}
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

              {/* Forma de cobrança */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Forma de cobrança
                </Label>
                
                <div className="grid grid-cols-4 gap-2">
                  {methods.map((method) => (
                    <ChargeMethodCard
                      key={method.type}
                      icon={method.icon}
                      title={method.title}
                      description={method.description}
                      selected={selectedMethod === method.type}
                      onClick={() => {
                        setSelectedMethod(method.type);
                        setCurrentCharge(null);
                      }}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Seção expandida do método selecionado */}
              <div className="min-h-[200px]">
                {selectedMethod === 'pix' && (
                  <ChargePixSection
                    valor={valor}
                    qrCode={currentCharge?.qrCode}
                    qrCodeBase64={currentCharge?.qrCodeBase64}
                    pixCopiaCola={currentCharge?.pixCopiaCola}
                    status={currentCharge?.status}
                    loading={creatingCharge}
                    onGenerate={handleGeneratePix}
                  />
                )}

                {selectedMethod === 'link' && (
                  <ChargeLinkSection
                    valor={valor}
                    paymentLink={currentCharge?.paymentLink}
                    status={currentCharge?.status}
                    loading={creatingCharge}
                    onGenerate={handleGenerateLink}
                    clienteWhatsapp={clienteWhatsapp}
                  />
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
