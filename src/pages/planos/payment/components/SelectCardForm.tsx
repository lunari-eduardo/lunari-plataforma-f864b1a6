import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { LegacyCardCheckoutForm } from './LegacyCardCheckoutForm';
import { SelectPayment } from '../types';

interface SelectCardFormProps {
  pkg: SelectPayment;
  formattedPrice: string;
}

export function SelectCardForm({ pkg, formattedPrice }: SelectCardFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createCustomer, isCreatingCustomer, createPayment, isCreatingPayment } = useAsaasSubscription();

  return (
    <LegacyCardCheckoutForm
      onSubmit={async (cardData) => {
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

        const result = await (createPayment as any)({
          productType: 'select',
          packageId: pkg.packageId,
          credits: pkg.credits,
          priceCents: pkg.priceCents,
          creditCard: {
            holderName: cardData.cardHolderName.toUpperCase(),
            number: cardData.cardNumber.replace(/\s/g, ''),
            expiryMonth: cardData.expiryMonth.padStart(2, '0'),
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv,
          },
          creditCardHolderInfo: {
            name: cardData.name,
            email: user?.email || '',
            cpfCnpj: cardData.cpfCnpj.replace(/\D/g, ''),
            postalCode: cardData.postalCode.replace(/\D/g, ''),
            addressNumber: 'S/N',
            phone: cardData.phone.replace(/\D/g, ''),
          },
          remoteIp,
        });

        if (result.status === 'CONFIRMED' || result.status === 'RECEIVED') {
          setTimeout(() => navigate('/app/minha-conta?tab=planos'), 2000);
          return { success: true };
        } else {
          throw new Error('Pagamento não foi aprovado. Verifique os dados do cartão.');
        }
      }}
      submitLabel={`Pagar ${formattedPrice}`}
      isProcessing={isCreatingCustomer || isCreatingPayment}
      providerLabel="Pagamento seguro via Asaas (PCI DSS)"
    />
  );
}
