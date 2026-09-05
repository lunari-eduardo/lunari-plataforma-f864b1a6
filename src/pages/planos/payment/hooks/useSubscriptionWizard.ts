import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { SubscriptionPayment, isValidCPF, isValidCNPJ } from '../types';

export function useSubscriptionWizard(pkg: SubscriptionPayment) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    createCustomer,
    isCreatingCustomer,
    createSubscription,
    isCreatingSubscription,
    createPayment,
    isCreatingPayment,
    upgradeSubscription,
    isUpgrading,
  } = useAsaasSubscription();

  const isYearly = pkg.billingCycle === 'YEARLY';
  const isUpgrade = !!pkg.isUpgrade;

  // Wizard steps
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1: Personal data
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Step 2: Payment
  const [installments, setInstallments] = useState(1);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');

  // Step 3: Coupon
  const {
    result: coupon,
    loading: isValidatingCoupon,
    validate: validateCoupon,
    clear: clearCoupon,
    calculateDiscount,
  } = useCouponValidation();
  const [couponInput, setCouponInput] = useState(pkg.couponCode || '');

  // If coupon came from checkout page, validate immediately
  useEffect(() => {
    if (pkg.couponCode && !coupon?.valid) {
      validateCoupon(pkg.couponCode, pkg.planType);
    }
  }, []);

  // Processing states
  const [wizardState, setWizardState] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');

  const installmentBaseCents =
    isUpgrade && pkg.prorataValueCents != null ? pkg.prorataValueCents : pkg.priceCents;

  const couponDiscountedCents = coupon?.valid ? calculateDiscount(installmentBaseCents) : null;
  const finalChargeCents =
    couponDiscountedCents !== null ? installmentBaseCents - couponDiscountedCents : installmentBaseCents;

  const installmentOptions = isYearly
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const value = finalChargeCents / 100 / n;
        return {
          value: n,
          label: `${n}x de ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} sem juros`,
        };
      })
    : [];

  const isProcessing = isCreatingCustomer || isCreatingSubscription || isCreatingPayment || isUpgrading;

  // Validations
  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      toast.error('Informe seu nome completo.');
      return false;
    }
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      if (!isValidCPF(cleanCpf)) {
        toast.error('CPF inválido. Verifique os dígitos.');
        return false;
      }
    } else if (cleanCpf.length === 14) {
      if (!isValidCNPJ(cleanCpf)) {
        toast.error('CNPJ inválido. Verifique os dígitos.');
        return false;
      }
    } else {
      toast.error('CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.');
      return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Telefone inválido.');
      return false;
    }
    const cleanCep = postalCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
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
      toast.error('Mês de validade inválido.');
      return false;
    }
    const year = parseInt(expiryYear);
    if (isNaN(year) || expiryYear.length !== 4 || year < new Date().getFullYear()) {
      toast.error('Ano de validade inválido.');
      return false;
    }
    if (ccv.length < 3 || ccv.length > 4) {
      toast.error('CVV inválido.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (currentStep === 0) {
      if (!validateStep1()) return;
      setCompletedSteps((prev) => [...prev.filter((s) => s !== 0), 0]);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!validateStep2()) return;
      setCompletedSteps((prev) => [...prev.filter((s) => s !== 1), 1]);
      setCurrentStep(2);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleFinalSubmit = async () => {
    setWizardState('processing');
    setErrorMessage('');

    try {
      const cardData = {
        name: name.trim(),
        cpfCnpj,
        phone,
        postalCode,
        cardNumber,
        cardHolderName,
        expiryMonth,
        expiryYear,
        ccv,
      };

      // Create customer
      await createCustomer({
        name: cardData.name,
        cpfCnpj: cardData.cpfCnpj,
        email: user?.email,
      });

      let remoteIp = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        remoteIp = ipData.ip || '';
      } catch {
        remoteIp = '';
      }

      const creditCardPayload = {
        holderName: cardData.cardHolderName.toUpperCase(),
        number: cardData.cardNumber.replace(/\s/g, ''),
        expiryMonth: cardData.expiryMonth.padStart(2, '0'),
        expiryYear: cardData.expiryYear,
        ccv: cardData.ccv,
      };
      const holderInfo = {
        name: cardData.name,
        email: user?.email || '',
        cpfCnpj: cardData.cpfCnpj.replace(/\D/g, ''),
        postalCode: cardData.postalCode.replace(/\D/g, ''),
        addressNumber: 'S/N',
        phone: cardData.phone.replace(/\D/g, ''),
      };

      if (isUpgrade && (pkg.currentSubscriptionId || pkg.subscriptionIdsToCancel?.length)) {
        const upgradeBody: any = {
          newPlanType: pkg.planType,
          billingCycle: pkg.billingCycle,
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
        };
        if (pkg.subscriptionIdsToCancel && pkg.subscriptionIdsToCancel.length > 0) {
          upgradeBody.subscriptionIdsToCancel = pkg.subscriptionIdsToCancel;
        } else if (pkg.currentSubscriptionId) {
          upgradeBody.currentSubscriptionId = pkg.currentSubscriptionId;
        }
        if (isYearly && installments > 1) {
          upgradeBody.installmentCount = installments;
        }
        if (coupon.valid) {
          upgradeBody.couponCode = coupon.code;
        }
        const result = await upgradeSubscription(upgradeBody);
        if (result.status === 'ACTIVE' || result.newSubscriptionId) {
          setWizardState('success');
          setTimeout(() => navigate('/app/minha-conta?tab=planos'), 3000);
          return;
        } else {
          throw new Error('Upgrade não foi aprovado.');
        }
      } else if (isYearly && installments === 1) {
        const result = await createSubscription({
          planType: pkg.planType,
          billingCycle: 'YEARLY',
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.subscriptionId) {
          setWizardState('success');
          setTimeout(() => navigate('/app/minha-conta?tab=planos'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      } else if (isYearly) {
        const result = await createPayment({
          productType: 'subscription_yearly',
          planType: pkg.planType,
          installmentCount: installments,
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.paymentId) {
          setWizardState('success');
          setTimeout(() => navigate('/app/minha-conta?tab=planos'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      } else {
        const result = await createSubscription({
          planType: pkg.planType,
          billingCycle: 'MONTHLY',
          creditCard: creditCardPayload,
          creditCardHolderInfo: holderInfo,
          remoteIp,
          ...(coupon.valid ? { couponCode: coupon.code } : {}),
        });
        if (result.status === 'ACTIVE' || result.subscriptionId) {
          setWizardState('success');
          setTimeout(() => navigate('/app/minha-conta?tab=planos'), 3000);
          return;
        } else {
          throw new Error('Pagamento não foi aprovado.');
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setWizardState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao processar pagamento.');
    }
  };

  return {
    user,
    isYearly,
    isUpgrade,
    currentStep,
    setCurrentStep,
    completedSteps,
    name,
    setName,
    cpfCnpj,
    setCpfCnpj,
    phone,
    setPhone,
    postalCode,
    setPostalCode,
    installments,
    setInstallments,
    cardNumber,
    setCardNumber,
    cardHolderName,
    setCardHolderName,
    expiryMonth,
    setExpiryMonth,
    expiryYear,
    setExpiryYear,
    ccv,
    setCcv,
    coupon,
    isValidatingCoupon,
    validateCoupon,
    clearCoupon,
    couponInput,
    setCouponInput,
    wizardState,
    setWizardState,
    errorMessage,
    installmentBaseCents,
    finalChargeCents,
    installmentOptions,
    isProcessing,
    goNext,
    goBack,
    handleFinalSubmit,
  };
}
