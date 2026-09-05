import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  SUPABASE_URL,
  CheckoutData,
  PayerHints,
  maskPhone,
  maskCpfCnpj,
  Tab,
} from '../types';

export function usePublicCheckoutData() {
  const { cobrancaId } = useParams<{ cobrancaId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [tab, setTab] = useState<Tab>('pix');
  const [cardSuccess, setCardSuccess] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);

  // Payer inline collection (shared across providers)
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerCpf, setPayerCpf] = useState('');

  // Fetch checkout data
  useEffect(() => {
    if (!cobrancaId) return;
    fetch(`${SUPABASE_URL}/functions/v1/checkout-get-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cobrancaId }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setData(result);
          const h: PayerHints | undefined = result.payerHints;
          if (h) {
            setPayerName(h.fullName || '');
            setPayerEmail(h.email || '');
            setPayerPhone(h.phone ? maskPhone(h.phone) : '');
            setPayerCpf(h.cpfCnpj ? maskCpfCnpj(h.cpfCnpj) : '');
          }
          setTab(result.settings?.habilitarPix ? 'pix' : 'card');
        } else if (result.code === 'INVALID_STATUS' && result.error?.includes('já foi paga')) {
          setCardSuccess(true);
        } else {
          setError(result.error || 'Cobrança não encontrada');
        }
      })
      .catch(() => setError('Erro ao carregar dados do pagamento'))
      .finally(() => setLoading(false));
  }, [cobrancaId]);

  const handlePersistContact = async (contactData: {
    email?: string;
    phone?: string;
    nome?: string;
    cpfCnpj?: string;
  }) => {
    if (!cobrancaId) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/checkout-save-payer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobrancaId,
          payer: {
            nome: contactData.nome,
            email: contactData.email,
            telefone: contactData.phone,
            cpfCnpj: contactData.cpfCnpj,
          },
        }),
      });
    } catch (e) {
      console.error('Erro ao salvar payer:', e);
    }
  };

  const isConfirmed =
    pixConfirmed || cardSuccess || data?.isPaid || data?.cobranca?.status === 'pago';

  return {
    cobrancaId,
    loading,
    error,
    data,
    tab,
    setTab,
    cardSuccess,
    setCardSuccess,
    pixConfirmed,
    setPixConfirmed,
    isConfirmed,
    payerName,
    setPayerName,
    payerEmail,
    setPayerEmail,
    payerPhone,
    setPayerPhone,
    payerCpf,
    setPayerCpf,
    handlePersistContact,
  };
}
