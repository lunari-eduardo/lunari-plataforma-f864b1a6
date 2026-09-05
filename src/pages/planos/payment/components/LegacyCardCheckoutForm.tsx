import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { CardData, isValidCPF, isValidCNPJ, formatCardNumber } from '../types';

interface LegacyCardCheckoutFormProps {
  onSubmit: (data: CardData) => Promise<{ success: boolean }>;
  submitLabel: string;
  isProcessing: boolean;
  providerLabel: string;
}

export function LegacyCardCheckoutForm({
  onSubmit,
  submitLabel,
  isProcessing,
  providerLabel,
}: LegacyCardCheckoutFormProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'personal' | 'card' | 'processing' | 'success' | 'error'>('personal');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  const validatePersonalData = (): boolean => {
    if (!name.trim()) {
      toast.error('Informe seu nome completo.');
      return false;
    }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      if (!isValidCPF(cleanCpf)) {
        toast.error('CPF inválido.');
        return false;
      }
    } else if (cleanCpf.length === 14) {
      if (!isValidCNPJ(cleanCpf)) {
        toast.error('CNPJ inválido.');
        return false;
      }
    } else {
      toast.error('CPF ou CNPJ inválido.');
      return false;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      toast.error('Telefone inválido.');
      return false;
    }
    if (postalCode.replace(/\D/g, '').length !== 8) {
      toast.error('CEP inválido.');
      return false;
    }
    return true;
  };

  const validateCardData = (): boolean => {
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) {
      toast.error('Número do cartão inválido.');
      return false;
    }
    if (!cardHolderName.trim()) {
      toast.error('Informe o nome no cartão.');
      return false;
    }
    const month = parseInt(expiryMonth);
    if (isNaN(month) || month < 1 || month > 12) {
      toast.error('Mês inválido.');
      return false;
    }
    const year = parseInt(expiryYear);
    if (isNaN(year) || expiryYear.length !== 4 || year < new Date().getFullYear()) {
      toast.error('Ano inválido.');
      return false;
    }
    if (ccv.length < 3 || ccv.length > 4) {
      toast.error('CVV inválido.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateCardData()) return;
    setStep('processing');
    setErrorMessage('');
    try {
      await onSubmit({
        name: name.trim(),
        cpfCnpj,
        phone,
        postalCode,
        cardNumber,
        cardHolderName,
        expiryMonth,
        expiryYear,
        ccv,
      });
      setStep('success');
    } catch (error) {
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento.');
    }
  };

  if (step === 'processing') {
    return (
      <div className="rounded-lg border p-12 text-center bg-card space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="font-medium text-foreground">Processando pagamento...</p>
        <p className="text-sm text-muted-foreground">Não feche esta página.</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-3">
        <div className="text-4xl">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-xs text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-4">
        <div className="text-5xl">❌</div>
        <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setStep('card')}>
            Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => navigate('/credits/checkout')}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'card') {
    return (
      <div className="rounded-lg border p-6 bg-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Dados do Cartão
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <Input
            id="cardNumber"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardHolderName">Nome no cartão</Label>
          <Input
            id="cardHolderName"
            placeholder="NOME COMO NO CARTÃO"
            value={cardHolderName}
            onChange={(e) => setCardHolderName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="expiryMonth">Mês</Label>
            <Input
              id="expiryMonth"
              placeholder="MM"
              maxLength={2}
              value={expiryMonth}
              onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryYear">Ano</Label>
            <Input
              id="expiryYear"
              placeholder="AAAA"
              maxLength={4}
              value={expiryYear}
              onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccv">CVV</Label>
            <Input
              id="ccv"
              placeholder="000"
              maxLength={4}
              type="password"
              value={ccv}
              onChange={(e) => setCcv(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep('personal')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />
          {providerLabel}
        </p>
      </div>
    );
  }

  // step === 'personal'
  return (
    <div className="rounded-lg border p-6 bg-card space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
        <Input
          id="cpfCnpj"
          placeholder="000.000.000-00"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input value={user?.email || ''} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="postalCode">CEP</Label>
        <Input
          id="postalCode"
          placeholder="00000-000"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={() => {
          if (validatePersonalData()) setStep('card');
        }}
      >
        Próximo: Dados do cartão
      </Button>
    </div>
  );
}
