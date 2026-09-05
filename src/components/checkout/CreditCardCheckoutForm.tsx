import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  AlertCircle,
  User,
  FileText,
  Mail,
  Calendar,
  Phone,
  MapPin,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AsaasCheckoutData, AccountFees, PayerHintsPrefill } from './types';
import {
  maskCpfCnpj,
  maskCardNumber,
  maskExpiry,
  maskPhone,
  maskCep,
  validateCpfCnpj,
} from './checkoutValidation';
import { buildInstallmentOptions } from './checkoutFees';
import { useCreditCardPayment } from './useCreditCardPayment';

interface CreditCardCheckoutFormProps {
  data: AsaasCheckoutData;
  payerHints?: PayerHintsPrefill;
  accountFees: AccountFees | null;
  feesLoading: boolean;
  feesError: boolean;
  onPaymentSuccess: () => void;
  setCardSuccess: (v: boolean) => void;
  setCardProcessing: (v: boolean) => void;
  fieldErrors: Record<string, string>;
  setFieldError: (key: string, msg: string | null) => void;
}

export const CreditCardCheckoutForm: React.FC<CreditCardCheckoutFormProps> = ({
  data,
  payerHints,
  accountFees,
  feesLoading,
  feesError,
  onPaymentSuccess,
  setCardSuccess,
  setCardProcessing,
  fieldErrors,
  setFieldError,
}) => {
  const initialFullName = payerHints?.fullName || '';
  const initialEmail = payerHints?.email || '';
  const initialPhone = payerHints?.phone ? maskPhone(payerHints.phone) : '';
  const initialCpfCnpj = payerHints?.cpfCnpj
    ? maskCpfCnpj(payerHints.cpfCnpj)
    : '';

  const [cardName, setCardName] = useState(initialFullName.toUpperCase());
  const [cardCpfCnpj, setCardCpfCnpj] = useState(initialCpfCnpj);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPhone, setCardPhone] = useState(initialPhone);
  const [cardEmail, setCardEmail] = useState(initialEmail);
  const [cardCep, setCardCep] = useState('');
  const [cardInstallments, setCardInstallments] = useState('1');

  const cpfRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);
  const cardPhoneRef = useRef<HTMLInputElement>(null);
  const cardCepRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (payerHints?.fullName && (!cardName || cardName === ''))
      setCardName(payerHints.fullName.toUpperCase());
    if (payerHints?.email && !cardEmail) setCardEmail(payerHints.email);
    if (payerHints?.cpfCnpj && !cardCpfCnpj)
      setCardCpfCnpj(maskCpfCnpj(payerHints.cpfCnpj));
    if (payerHints?.phone && !cardPhone)
      setCardPhone(maskPhone(payerHints.phone));
  }, [payerHints, cardName, cardEmail, cardCpfCnpj, cardPhone]);

  const { installmentOptions, repassarAntecipacao } = useMemo(
    () => buildInstallmentOptions(data, accountFees, feesLoading),
    [data, accountFees, feesLoading],
  );

  const selectedInstallmentOption = installmentOptions.find(
    (o) => o.value === cardInstallments,
  );
  const valorComTaxas =
    selectedInstallmentOption?.totalValue ?? data.valorTotal;

  const { cardLoading, cardError, handleCardSubmit } = useCreditCardPayment({
    data,
    payerHints,
    initialFullName,
    cardName,
    cardCpfCnpj,
    cardNumber,
    cardExpiry,
    cardCvv,
    cardPhone,
    cardEmail,
    cardCep,
    cardInstallments,
    valorComTaxas,
    repassarAntecipacao,
    onPaymentSuccess,
    setCardSuccess,
    setCardProcessing,
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

  if (feesError && !data.absorverTaxa) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-medium text-destructive">
          Não foi possível calcular as taxas de parcelamento no momento.
        </p>
        <p className="text-xs text-muted-foreground">
          Para sua segurança, o pagamento via cartão está temporariamente
          indisponível. Tente novamente mais tarde ou utilize PIX.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 mt-4">
      {/* Seção 1: Dados do titular */}
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label
            htmlFor="cc-name"
            className="text-xs font-medium text-muted-foreground"
          >
            Nome no cartão
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="cc-name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              placeholder="NOME COMPLETO"
              autoComplete="cc-name"
              className={cn(checkoutInputClass(), 'pl-10')}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="cc-cpf"
            className="text-xs font-medium text-muted-foreground"
          >
            CPF / CNPJ
          </Label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              ref={cpfRef}
              id="cc-cpf"
              value={cardCpfCnpj}
              onChange={(e) => {
                const masked = maskCpfCnpj(e.target.value);
                setCardCpfCnpj(masked);
                if (fieldErrors.cpf) setFieldError('cpf', null);
                const digits = masked.replace(/\D/g, '');
                if (digits.length === 11) emailRef.current?.focus();
              }}
              onBlur={(e) => {
                const val = e.target.value;
                if (val && !validateCpfCnpj(val)) {
                  setFieldError('cpf', 'CPF/CNPJ inválido');
                }
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={18}
              className={cn(checkoutInputClass('cpf'), 'pl-10')}
            />
          </div>
          <FieldError name="cpf" />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="cc-email"
            className="text-xs font-medium text-muted-foreground"
          >
            Email do titular
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              ref={emailRef}
              id="cc-email"
              type="email"
              value={cardEmail}
              onChange={(e) => {
                setCardEmail(e.target.value);
                if (fieldErrors.email) setFieldError('email', null);
              }}
              onBlur={(e) => {
                const val = e.target.value;
                if (val && !/\S+@\S+\.\S+/.test(val)) {
                  setFieldError('email', 'Email inválido');
                }
              }}
              placeholder="email@exemplo.com"
              autoComplete="email"
              className={cn(checkoutInputClass('email'), 'pl-10')}
            />
          </div>
          <FieldError name="email" />
        </div>
      </div>

      <div className="border-t border-border/40 my-2" />

      {/* Seção 2: Dados do cartão */}
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label
            htmlFor="cc-number"
            className="text-xs font-medium text-muted-foreground"
          >
            Número do cartão
          </Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              ref={cardNumberRef}
              id="cc-number"
              value={cardNumber}
              onChange={(e) => {
                const masked = maskCardNumber(e.target.value);
                setCardNumber(masked);
                if (fieldErrors.cardNumber) setFieldError('cardNumber', null);
                const digits = masked.replace(/\s/g, '');
                if (digits.length >= 16) cardExpiryRef.current?.focus();
              }}
              onBlur={(e) => {
                const digits = e.target.value.replace(/\s/g, '');
                if (digits && digits.length < 13) {
                  setFieldError('cardNumber', 'Número do cartão inválido');
                }
              }}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              maxLength={19}
              autoComplete="cc-number"
              className={cn(checkoutInputClass('cardNumber'), 'pl-10')}
            />
          </div>
          <FieldError name="cardNumber" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label
              htmlFor="cc-exp"
              className="text-xs font-medium text-muted-foreground"
            >
              Validade
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                ref={cardExpiryRef}
                id="cc-exp"
                value={cardExpiry}
                onChange={(e) => {
                  const masked = maskExpiry(e.target.value);
                  setCardExpiry(masked);
                  setFieldError('expiry', null);
                  if (masked.length === 5) cardCvvRef.current?.focus();
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val && val.length === 5) {
                    const [m, y] = val.split('/');
                    const mm = parseInt(m);
                    if (!mm || mm < 1 || mm > 12) {
                      setFieldError('expiry', 'Validade inválida');
                    } else {
                      setFieldError('expiry', null);
                    }
                  } else if (val && val.length > 0) {
                    setFieldError('expiry', 'Validade incompleta');
                  } else {
                    setFieldError('expiry', null);
                  }
                }}
                placeholder="MM/AA"
                inputMode="numeric"
                maxLength={5}
                autoComplete="cc-exp"
                className={cn(checkoutInputClass('expiry'), 'pl-10')}
              />
            </div>
            <FieldError name="expiry" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="cc-cvv"
                className="text-xs font-medium text-muted-foreground"
              >
                CVV
              </Label>
              <span
                className="text-[10px] text-muted-foreground/70 flex items-center gap-1"
                title="3 dígitos no verso"
              >
                <Info className="h-3 w-3" /> verso
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                ref={cardCvvRef}
                id="cc-cvv"
                value={cardCvv}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCardCvv(v);
                  if (v.length >= 3) cardPhoneRef.current?.focus();
                }}
                placeholder="000"
                inputMode="numeric"
                maxLength={4}
                autoComplete="cc-csc"
                className={cn(checkoutInputClass(), 'pl-10')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40 my-2" />

      {/* Seção 3: Contato */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label
              htmlFor="cc-phone"
              className="text-xs font-medium text-muted-foreground"
            >
              Telefone{' '}
              <span className="text-muted-foreground/60">(opcional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                ref={cardPhoneRef}
                id="cc-phone"
                value={cardPhone}
                onChange={(e) => {
                  const masked = maskPhone(e.target.value);
                  setCardPhone(masked);
                  if (masked.replace(/\D/g, '').length === 11)
                    cardCepRef.current?.focus();
                }}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                maxLength={15}
                className={cn(checkoutInputClass(), 'pl-10')}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="cc-cep"
              className="text-xs font-medium text-muted-foreground"
            >
              CEP
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                ref={cardCepRef}
                id="cc-cep"
                value={cardCep}
                onChange={(e) => setCardCep(maskCep(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                className={cn(checkoutInputClass(), 'pl-10')}
              />
            </div>
          </div>
        </div>

        {/* Installments */}
        {data.maxParcelas > 1 && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              Parcelas
            </Label>
            {feesLoading && !data.absorverTaxa ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-md" />
                <p className="text-xs text-muted-foreground">
                  Carregando taxas...
                </p>
              </div>
            ) : (
              <Select
                value={cardInstallments}
                onValueChange={setCardInstallments}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {cardError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {cardError}
        </div>
      )}

      <Button
        onClick={handleCardSubmit}
        disabled={cardLoading || feesLoading}
        className="w-full gap-2 h-12 rounded-lg text-base font-semibold active:scale-[0.98] transition-transform"
        variant="gallery-primary"
      >
        {cardLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Processando...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> Finalizar pagamento • R${' '}
            {valorComTaxas.toFixed(2).replace('.', ',')}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        Seus dados estão protegidos com segurança de ponta a ponta.
      </p>
    </div>
  );
};
