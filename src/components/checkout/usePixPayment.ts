import { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AsaasCheckoutData } from './types';
import { validateCpfCnpj } from './checkoutValidation';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';
const POLL_INTERVAL = 15_000;
const POLL_MAX = 10 * 60 * 1000;

interface UsePixPaymentParams {
  data: AsaasCheckoutData;
  pixName: string;
  pixEmail: string;
  pixCpfCnpj: string;
  pixPhone: string;
  needsName: boolean;
  needsEmail: boolean;
  needsCpf: boolean;
  needsPhone: boolean;
  showPixContactForm: boolean;
  onPersistContact?: (data: {
    email?: string;
    phone?: string;
    nome?: string;
    cpfCnpj?: string;
  }) => Promise<void>;
  onMissingCpf?: () => void;
  onPaymentSuccess: () => void;
  setPixConfirmed: (v: boolean) => void;
  setFieldError: (key: string, msg: string | null) => void;
  pixNameRef: React.RefObject<HTMLInputElement | null>;
  pixEmailRef: React.RefObject<HTMLInputElement | null>;
  pixCpfRef: React.RefObject<HTMLInputElement | null>;
  pixPhoneRef: React.RefObject<HTMLInputElement | null>;
}

export function usePixPayment({
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
}: UsePixPaymentParams) {
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixContactLoading, setPixContactLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const generatePix = useCallback(async () => {
    setPixLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
      }

      let result;
      let res;

      const payerContactData = {
        name: pixName.trim(),
        email: pixEmail.trim(),
        cpfCnpj: pixCpfCnpj.replace(/\D/g, ''),
        phone: pixPhone.replace(/\D/g, ''),
      };

      if (data.cobrancaId) {
        res = await fetch(`${SUPABASE_URL}/functions/v1/checkout-process-payment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            cobrancaId: data.cobrancaId,
            billingType: 'PIX',
            payerContact: payerContactData,
          }),
        });
        result = await res.json();
      } else {
        res = await fetch(`${SUPABASE_URL}/functions/v1/create-cobranca`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: data.userId,
            clienteId: data.clienteId,
            sessionId: data.sessionId,
            valor: data.valorTotal,
            descricao: data.descricao,
            galeriaId: data.galeriaId,
            qtdFotos: data.qtdFotos,
            finalidade: data.finalidade || 'fotos_extras',
            provedor: data.provedor || 'asaas',
            billingType: 'PIX',
            payerContact: payerContactData,
            dadosExtras: {
              valorBase: data.valorTotal,
              repassarTaxasProcessamento: false,
              repassarTaxaAntecipacao: false,
            },
          }),
        });
        result = await res.json();
      }

      if (!res.ok || !result.success) {
        if (result?.code === 'MISSING_CPF_CNPJ') {
          setPixQrCode(null);
          setPixCopiaECola(null);
          if (showPixContactForm) {
            setFieldError('pixCpf', 'Confirme seu CPF ou CNPJ para gerar o PIX.');
            pixCpfRef.current?.focus();
          } else if (onMissingCpf) {
            onMissingCpf();
          }
          return;
        }
        if (result?.code === 'INVALID_EMAIL') {
          setPixQrCode(null);
          setPixCopiaECola(null);
          setFieldError(
            'pixEmail',
            'Este email não é aceito pelo Asaas. Use um email sem acentos ou caracteres especiais.',
          );
          pixEmailRef.current?.focus();
          return;
        }
        throw new Error(result.error || 'Erro ao gerar PIX');
      }

      const rawQrCode = result.pixQrCodeBase64 || result.pixQrCode;
      const rawCopiaECola = result.pixCopiaCola || result.pixCopiaECola;

      if (rawQrCode && rawQrCode.length > 50) {
        setPixQrCode(
          rawQrCode.startsWith('data:image')
            ? rawQrCode
            : `data:image/png;base64,${rawQrCode}`,
        );
      } else if (rawCopiaECola) {
        try {
          const qrCodeUrl = await QRCode.toDataURL(rawCopiaECola);
          setPixQrCode(qrCodeUrl);
        } catch (e) {
          console.error('Erro gerando QRCode fallback:', e);
        }
      } else {
        setPixQrCode(null);
      }

      setPixCopiaECola(rawCopiaECola || null);

      pollStartRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_MAX) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        try {
          const pollRes = await fetch(
            `${SUPABASE_URL}/functions/v1/check-payment-status`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cobrancaId: result.cobrancaId,
                sessionId: data.sessionId,
                forceUpdate: false,
              }),
            },
          );
          const pollData = await pollRes.json();
          if (pollData.status === 'pago' || pollData.updated) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPixConfirmed(true);
            onPaymentSuccess();
          }
        } catch {
          /* silently retry */
        }
      }, POLL_INTERVAL);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [
    data,
    onPaymentSuccess,
    onMissingCpf,
    showPixContactForm,
    pixName,
    pixEmail,
    pixCpfCnpj,
    pixPhone,
    setFieldError,
    setPixConfirmed,
    pixCpfRef,
    pixEmailRef,
  ]);

  const handleGeneratePixClick = async () => {
    if (needsName && pixName.trim().length < 2) {
      setFieldError('pixName', 'Informe seu nome');
      pixNameRef.current?.focus();
      return;
    }
    if (needsEmail && !/\S+@\S+\.\S+/.test(pixEmail)) {
      setFieldError('pixEmail', 'Email inválido');
      pixEmailRef.current?.focus();
      return;
    }
    if (needsCpf && !validateCpfCnpj(pixCpfCnpj)) {
      setFieldError('pixCpf', 'CPF ou CNPJ inválido');
      pixCpfRef.current?.focus();
      return;
    }
    if (needsPhone && pixPhone.replace(/\D/g, '').length < 10) {
      setFieldError('pixPhone', 'Telefone inválido');
      pixPhoneRef.current?.focus();
      return;
    }

    if (showPixContactForm && onPersistContact) {
      setPixContactLoading(true);
      try {
        await onPersistContact({
          nome: needsName ? pixName.trim() : undefined,
          email: needsEmail ? pixEmail.trim() : undefined,
          cpfCnpj: needsCpf ? pixCpfCnpj.replace(/\D/g, '') : undefined,
          phone: needsPhone ? pixPhone.replace(/\D/g, '') : undefined,
        });
      } catch (e) {
        setPixContactLoading(false);
        toast.error(
          e instanceof Error ? e.message : 'Não foi possível salvar seus dados.',
        );
        return;
      }
      setPixContactLoading(false);
    }

    await generatePix();
  };

  const handleCopyPix = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return {
    pixLoading,
    pixQrCode,
    pixCopiaECola,
    pixCopied,
    pixContactLoading,
    handleGeneratePixClick,
    handleCopyPix,
  };
}
