import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  Copy,
  CheckCircle,
  Loader2,
  User,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  AsaasCheckoutData,
  PayerHintsPrefill,
  PayerHintsMissingFlags,
} from './types';
import {
  maskCpfCnpj,
  maskPhone,
  validateCpfCnpj,
} from './checkoutValidation';
import { usePixPayment } from './usePixPayment';

interface PixCheckoutViewProps {
  data: AsaasCheckoutData;
  payerHints?: PayerHintsPrefill;
  payerMissing?: PayerHintsMissingFlags;
  onPersistContact?: (data: {
    email?: string;
    phone?: string;
    nome?: string;
    cpfCnpj?: string;
  }) => Promise<void>;
  onMissingCpf?: () => void;
  onPaymentSuccess: () => void;
  setPixConfirmed: (v: boolean) => void;
  fieldErrors: Record<string, string>;
  setFieldError: (key: string, msg: string | null) => void;
}

export const PixCheckoutView: React.FC<PixCheckoutViewProps> = ({
  data,
  payerHints,
  payerMissing,
  onPersistContact,
  onMissingCpf,
  onPaymentSuccess,
  setPixConfirmed,
  fieldErrors,
  setFieldError,
}) => {
  const initialFullName = payerHints?.fullName || '';
  const initialEmail = payerHints?.email || '';
  const initialPhone = payerHints?.phone ? maskPhone(payerHints.phone) : '';
  const initialCpfCnpj = payerHints?.cpfCnpj
    ? maskCpfCnpj(payerHints.cpfCnpj)
    : '';

  const [pixName, setPixName] = useState(initialFullName);
  const [pixEmail, setPixEmail] = useState(initialEmail);
  const [pixCpfCnpj, setPixCpfCnpj] = useState(initialCpfCnpj);
  const [pixPhone, setPixPhone] = useState(initialPhone);

  const pixNameRef = useRef<HTMLInputElement>(null);
  const pixEmailRef = useRef<HTMLInputElement>(null);
  const pixCpfRef = useRef<HTMLInputElement>(null);
  const pixPhoneRef = useRef<HTMLInputElement>(null);
  const pixGenerateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (payerHints?.fullName && !pixName) setPixName(payerHints.fullName);
    if (payerHints?.email && !pixEmail) setPixEmail(payerHints.email);
    if (payerHints?.cpfCnpj && !pixCpfCnpj)
      setPixCpfCnpj(maskCpfCnpj(payerHints.cpfCnpj));
    if (payerHints?.phone && !pixPhone) setPixPhone(maskPhone(payerHints.phone));
  }, [payerHints, pixName, pixEmail, pixCpfCnpj, pixPhone]);

  const needsName = !!payerMissing?.name || !initialFullName;
  const needsEmail = !!payerMissing?.email || !initialEmail;
  const needsCpf = !!payerMissing?.cpfCnpj || !initialCpfCnpj;
  const needsPhone = !!payerMissing?.phone || !initialPhone;
  const showPixContactForm = needsName || needsEmail || needsCpf || needsPhone;

  const pixFormValid = (() => {
    if (needsName && pixName.trim().length < 2) return false;
    if (needsEmail && !/\S+@\S+\.\S+/.test(pixEmail)) return false;
    if (needsCpf && !validateCpfCnpj(pixCpfCnpj)) return false;
    if (needsPhone && pixPhone.replace(/\D/g, '').length < 10) return false;
    return true;
  })();

  const {
    pixLoading,
    pixQrCode,
    pixCopiaECola,
    pixCopied,
    pixContactLoading,
    handleGeneratePixClick,
    handleCopyPix,
  } = usePixPayment({
    data,
    pixName,
    pixEmail,
    pixCpfCnpj,
    pixPhone,
    needsName,
    needsEmail,
    needsCpf,
    needsPhone,
    showPixContactForm,
    onPersistContact,
    onMissingCpf,
    onPaymentSuccess,
    setPixConfirmed,
    setFieldError,
    pixNameRef,
    pixEmailRef,
    pixCpfRef,
    pixPhoneRef,
  });

  const checkoutInputClass = (errKey?: string) =>
    cn(
      'h-12 bg-background border border-border/70 hover:border-border transition-colors',
      'focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:ring-offset-0',
      'placeholder:text-muted-foreground/50',
      errKey &&
        fieldErrors[errKey] &&
        'border-destructive/50 focus-visible:border-destructive focus-visible:ring-destructive/20',
    );

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <div className="space-y-4">
      {!pixQrCode && !pixLoading && (
        <div className="space-y-4">
          {showPixContactForm && (
            <section className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/30">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Seus dados para o PIX
                </h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Precisamos destes dados para gerar a cobrança e enviar o comprovante.
              </p>

              {needsName && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="pix-name"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Nome completo
                  </Label>
                  <Input
                    ref={pixNameRef}
                    id="pix-name"
                    autoFocus
                    value={pixName}
                    onChange={(e) => {
                      setPixName(e.target.value);
                      if (fieldErrors.pixName) setFieldError('pixName', null);
                    }}
                    placeholder="Como você se chama"
                    autoComplete="name"
                    maxLength={80}
                    className={checkoutInputClass('pixName')}
                  />
                  <FieldError name="pixName" />
                </div>
              )}

              {needsEmail && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="pix-email"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    ref={pixEmailRef}
                    id="pix-email"
                    type="email"
                    inputMode="email"
                    autoFocus={!needsName}
                    value={pixEmail}
                    onChange={(e) => {
                      setPixEmail(e.target.value);
                      if (fieldErrors.pixEmail) setFieldError('pixEmail', null);
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !/\S+@\S+\.\S+/.test(val))
                        setFieldError('pixEmail', 'Email inválido');
                    }}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    maxLength={160}
                    className={checkoutInputClass('pixEmail')}
                  />
                  <FieldError name="pixEmail" />
                </div>
              )}

              {needsCpf && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="pix-cpf"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    CPF ou CNPJ
                  </Label>
                  <Input
                    ref={pixCpfRef}
                    id="pix-cpf"
                    inputMode="numeric"
                    autoFocus={!needsName && !needsEmail}
                    value={pixCpfCnpj}
                    onChange={(e) => {
                      const masked = maskCpfCnpj(e.target.value);
                      setPixCpfCnpj(masked);
                      if (fieldErrors.pixCpf) setFieldError('pixCpf', null);
                      const digits = masked.replace(/\D/g, '');
                      if (digits.length === 11 || digits.length === 14) {
                        if (needsPhone) pixPhoneRef.current?.focus();
                        else pixGenerateRef.current?.focus();
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val && !validateCpfCnpj(val))
                        setFieldError('pixCpf', 'CPF ou CNPJ inválido');
                    }}
                    placeholder="000.000.000-00"
                    maxLength={18}
                    className={checkoutInputClass('pixCpf')}
                  />
                  <FieldError name="pixCpf" />
                </div>
              )}

              {needsPhone && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="pix-phone"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Telefone (WhatsApp)
                  </Label>
                  <Input
                    ref={pixPhoneRef}
                    id="pix-phone"
                    type="tel"
                    inputMode="tel"
                    autoFocus={!needsName && !needsEmail && !needsCpf}
                    value={pixPhone}
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      setPixPhone(masked);
                      if (fieldErrors.pixPhone) setFieldError('pixPhone', null);
                      if (masked.replace(/\D/g, '').length === 11)
                        pixGenerateRef.current?.focus();
                    }}
                    placeholder="(11) 98765-4321"
                    autoComplete="tel"
                    maxLength={15}
                    className={checkoutInputClass('pixPhone')}
                  />
                  <FieldError name="pixPhone" />
                </div>
              )}
            </section>
          )}

          <Button
            ref={pixGenerateRef}
            onClick={handleGeneratePixClick}
            disabled={
              pixContactLoading || (showPixContactForm && !pixFormValid)
            }
            className="w-full gap-2 h-12 rounded-lg active:scale-[0.98] transition-transform"
            variant="gallery-primary"
          >
            {pixContactLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Salvando dados...
              </>
            ) : (
              <>
                <QrCode className="h-5 w-5" /> Gerar QR Code PIX
              </>
            )}
          </Button>
        </div>
      )}

      {pixLoading && (
        <div className="space-y-4 py-8">
          <Skeleton className="w-48 h-48 mx-auto rounded-2xl" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <p className="text-center text-sm text-muted-foreground">
            Gerando QR Code...
          </p>
        </div>
      )}

      {pixQrCode && (
        <div className="space-y-4 text-center animate-in fade-in duration-300">
          <div className="inline-block p-5 bg-white rounded-2xl shadow-md border border-border/50 mx-auto">
            <img src={pixQrCode} alt="QR Code PIX" className="w-52 h-52" />
          </div>

          {pixCopiaECola && (
            <div className="space-y-2 text-left">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                PIX Copia e Cola
              </p>
              <div className="relative">
                <div className="p-3 pr-24 rounded-lg bg-muted/40 border border-border/70 max-h-20 overflow-y-auto">
                  <code className="text-xs break-all font-mono text-muted-foreground">
                    {pixCopiaECola}
                  </code>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPix}
                  className="absolute top-2 right-2 h-8"
                >
                  {pixCopied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" /> Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Aguardando pagamento...</span>
          </div>
        </div>
      )}
    </div>
  );
};
