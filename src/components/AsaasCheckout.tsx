import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle,
  Loader2,
  Lock,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  AccountFees,
  AsaasCheckoutData,
  PayerHintsPrefill,
  PayerHintsMissingFlags,
  AsaasCheckoutProps,
} from './checkout/types';
import { MERCADOPAGO_DEFAULT_FEES } from './checkout/types';
import { PixCheckoutView } from './checkout/PixCheckoutView';
import { CreditCardCheckoutForm } from './checkout/CreditCardCheckoutForm';

export type {
  AccountFees,
  AsaasCheckoutData,
  PayerHintsPrefill,
  PayerHintsMissingFlags,
  AsaasCheckoutProps,
};
export { MERCADOPAGO_DEFAULT_FEES };

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';

export function AsaasCheckout({
  data,
  studioName,
  studioLogoUrl,
  onPaymentConfirmed,
  onCancel,
  onMissingCpf,
  payerHints,
  payerMissing,
  onPersistContact,
  themeStyles = {},
  backgroundMode = 'light',
  initialAccountFees,
}: AsaasCheckoutProps) {
  const computedDefaultTab = data.enabledMethods.pix
    ? 'pix'
    : data.enabledMethods.creditCard
      ? 'card'
      : 'pix';
  const [activeTab, setActiveTab] = useState<string>(computedDefaultTab);

  useEffect(() => {
    if (!data.enabledMethods.pix && data.enabledMethods.creditCard) {
      setActiveTab('card');
    } else if (data.enabledMethods.pix && !data.enabledMethods.creditCard) {
      setActiveTab('pix');
    }
  }, [data.enabledMethods.pix, data.enabledMethods.creditCard]);

  // Estados de confirmação
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [cardSuccess, setCardSuccess] = useState(false);
  const [cardProcessing, setCardProcessing] = useState(false);

  // Erros de campos
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const setFieldError = (key: string, msg: string | null) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  };

  const handlePaymentSuccess = useCallback(() => {
    if (!data.cobrancaId) {
      setTimeout(() => onPaymentConfirmed(), 2000);
    }
  }, [data.cobrancaId, onPaymentConfirmed]);

  // Taxas de conta
  const [accountFees, setAccountFees] = useState<AccountFees | null>(
    initialAccountFees || null,
  );
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError] = useState(false);

  useEffect(() => {
    if (initialAccountFees) {
      setAccountFees(initialAccountFees);
      return;
    }
    if (data.provedor === 'mercadopago') {
      setAccountFees(MERCADOPAGO_DEFAULT_FEES);
      setFeesLoading(false);
      setFeesError(false);
      return;
    }
    if (!data.userId || data.absorverTaxa) return;

    let cancelled = false;
    setFeesLoading(true);
    setFeesError(false);

    fetch(`${SUPABASE_URL}/functions/v1/asaas-fetch-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.userId }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.accountFees) {
          setAccountFees(result.accountFees);
        } else {
          console.warn('Failed to load Asaas fees:', result.error);
          setFeesError(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching Asaas fees:', err);
        setFeesError(true);
      })
      .finally(() => {
        if (!cancelled) setFeesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data.userId, data.absorverTaxa, data.provedor, initialAccountFees]);

  // ——— Success state ———
  if (pixConfirmed || cardSuccess) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center p-4 bg-background text-foreground',
          backgroundMode === 'dark' && 'dark',
        )}
        style={themeStyles}
      >
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
            <p className="text-muted-foreground">
              {data.cobrancaId
                ? 'Obrigado! Seu pagamento foi processado com sucesso.'
                : 'Sua seleção foi finalizada com sucesso.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ——— Processing state ———
  if (cardProcessing) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center p-4 bg-background text-foreground',
          backgroundMode === 'dark' && 'dark',
        )}
        style={themeStyles}
      >
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold">Pagamento em análise</h1>
          <p className="text-muted-foreground">
            Seu pagamento está sendo processado. Você receberá a confirmação por
            e-mail assim que for aprovado.
          </p>
          <Button onClick={onCancel} variant="outline" className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const enabledCount = [
    data.enabledMethods.pix,
    data.enabledMethods.creditCard,
  ].filter(Boolean).length;

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center bg-background text-foreground p-4',
        backgroundMode === 'dark' && 'dark',
      )}
      style={themeStyles}
    >
      <div className="max-w-md w-full space-y-6 py-6">
        {/* Logo */}
        {studioLogoUrl ? (
          <img
            src={studioLogoUrl}
            alt={studioName || 'Estúdio'}
            className="h-16 mx-auto object-contain"
          />
        ) : studioName ? (
          <h1 className="text-xl font-semibold text-center">{studioName}</h1>
        ) : null}

        {/* Selo de segurança no topo */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span>Ambiente seguro e criptografado</span>
        </div>

        {/* Hierarquia premium do valor */}
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Pagamento
          </p>
          <p className="text-5xl font-bold text-primary tracking-tight">
            R$ {data.valorTotal.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{data.descricao}</span>
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {enabledCount > 1 && (
            <TabsList
              className="w-full grid h-14 p-1 bg-muted/50 rounded-xl"
              style={{
                gridTemplateColumns: `repeat(${enabledCount}, 1fr)`,
              }}
            >
              {data.enabledMethods.pix && (
                <TabsTrigger
                  value="pix"
                  className="gap-2 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <QrCode className="h-5 w-5" /> PIX
                </TabsTrigger>
              )}
              {data.enabledMethods.creditCard && (
                <TabsTrigger
                  value="card"
                  className="gap-2 h-full rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <CreditCard className="h-5 w-5" /> Cartão
                </TabsTrigger>
              )}
            </TabsList>
          )}

          {/* PIX Tab */}
          {data.enabledMethods.pix && (
            <TabsContent value="pix" className="space-y-4 mt-6">
              <PixCheckoutView
                data={data}
                payerHints={payerHints}
                payerMissing={payerMissing}
                onPersistContact={onPersistContact}
                onMissingCpf={onMissingCpf}
                onPaymentSuccess={handlePaymentSuccess}
                setPixConfirmed={setPixConfirmed}
                fieldErrors={fieldErrors}
                setFieldError={setFieldError}
              />
            </TabsContent>
          )}

          {/* Card Tab */}
          {data.enabledMethods.creditCard && (
            <TabsContent value="card" className="space-y-3.5 mt-4">
              <CreditCardCheckoutForm
                data={data}
                payerHints={payerHints}
                accountFees={accountFees}
                feesLoading={feesLoading}
                feesError={feesError}
                onPaymentSuccess={handlePaymentSuccess}
                setCardSuccess={setCardSuccess}
                setCardProcessing={setCardProcessing}
                fieldErrors={fieldErrors}
                setFieldError={setFieldError}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Cancel */}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
      </div>
    </div>
  );
}
