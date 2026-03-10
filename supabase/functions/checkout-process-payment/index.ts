import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  cobrancaId: string;
  billingType: 'PIX' | 'CREDIT_CARD';
  installmentCount?: number;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { cobrancaId, billingType, installmentCount, creditCard, creditCardHolderInfo } = body;

    if (!cobrancaId || !billingType) {
      return new Response(
        JSON.stringify({ success: false, error: 'cobrancaId e billingType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch and validate cobrança
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .select('id, user_id, cliente_id, session_id, valor, descricao, status, provedor')
      .eq('id', cobrancaId)
      .maybeSingle();

    if (cobrancaError || !cobranca) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobranca.status !== 'pendente') {
      return new Response(
        JSON.stringify({
          success: false,
          error: cobranca.status === 'pago' ? 'Esta cobrança já foi paga' : 'Cobrança não disponível',
          code: 'INVALID_STATUS',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = cobranca.user_id;
    const valor = cobranca.valor;

    // 2. Fetch photographer's Asaas integration
    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as {
      environment?: string;
      maxParcelas?: number;
      absorverTaxa?: boolean;
      incluirTaxaAntecipacao?: boolean;
    };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // 3. Get or create Asaas customer
    let asaasCustomerId: string | null = null;

    const { data: cliente } = await supabase
      .from('clientes')
      .select('nome, email, telefone, whatsapp')
      .eq('id', cobranca.cliente_id)
      .maybeSingle();

    if (cliente?.email) {
      const searchResp = await fetch(`${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(cliente.email)}`, {
        headers: { access_token: asaasApiKey },
      });
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.data?.length > 0) {
          asaasCustomerId = searchData.data[0].id;
        }
      }
    }

    if (!asaasCustomerId) {
      const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
        body: JSON.stringify({
          name: cliente?.nome || 'Cliente',
          email: cliente?.email || undefined,
          phone: cliente?.whatsapp || cliente?.telefone || undefined,
          externalReference: cobranca.cliente_id,
        }),
      });

      if (createResp.ok) {
        const createData = await createResp.json();
        asaasCustomerId = createData.id;
      } else {
        const errData = await createResp.json();
        console.error('Failed to create Asaas customer:', errData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar cliente no Asaas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Calculate fees for credit card (server-side)
    let valorFinal = valor;
    const incluirAntecipacao = settings.incluirTaxaAntecipacao !== false;

    if (billingType === 'CREDIT_CARD' && !settings.absorverTaxa) {
      const installments = installmentCount && installmentCount > 1 ? installmentCount : 1;

      try {
        const feesResp = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
          headers: { access_token: asaasApiKey },
        });

        if (feesResp.ok) {
          const feesData = await feesResp.json();
          const payment = feesData.payment || {};
          const ccFees = payment.creditCard || {};
          const anticipationCC = (feesData.anticipation || {}).creditCard || {};

          const operationValue = ccFees.operationValue ?? 0.49;
          let percentageFee = 0;

          const hasDiscount = ccFees.hasValidDiscount === true;
          const discountExpiration = ccFees.discountExpiration;
          const discountValid = hasDiscount && (!discountExpiration || new Date(discountExpiration) > new Date());

          if (discountValid) {
            if (installments === 1) percentageFee = ccFees.discountOneInstallmentPercentage ?? ccFees.oneInstallmentPercentage ?? 2.99;
            else if (installments <= 6) percentageFee = ccFees.discountUpToSixInstallmentsPercentage ?? ccFees.upToSixInstallmentsPercentage ?? 3.49;
            else if (installments <= 12) percentageFee = ccFees.discountUpToTwelveInstallmentsPercentage ?? ccFees.upToTwelveInstallmentsPercentage ?? 3.99;
            else percentageFee = ccFees.discountUpToTwentyOneInstallmentsPercentage ?? ccFees.upToTwentyOneInstallmentsPercentage ?? 4.29;
          } else {
            if (installments === 1) percentageFee = ccFees.oneInstallmentPercentage ?? 2.99;
            else if (installments <= 6) percentageFee = ccFees.upToSixInstallmentsPercentage ?? 3.49;
            else if (installments <= 12) percentageFee = ccFees.upToTwelveInstallmentsPercentage ?? 3.99;
            else percentageFee = ccFees.upToTwentyOneInstallmentsPercentage ?? 4.29;
          }

          const processingCost = (valor * percentageFee / 100) + operationValue;

          let anticipationCost = 0;
          if (incluirAntecipacao) {
            const detachedMonthlyFee = anticipationCC.detachedMonthlyFeeValue ?? 1.25;
            const installmentMonthlyFee = anticipationCC.installmentMonthlyFeeValue ?? 1.70;
            const taxaMensal = installments === 1 ? detachedMonthlyFee : installmentMonthlyFee;

            if (taxaMensal > 0) {
              const valorParcela = valor / installments;
              let valorLiquido = 0;
              for (let i = 1; i <= installments; i++) {
                const taxaTotal = taxaMensal * i;
                valorLiquido += valorParcela * (1 - taxaTotal / 100);
              }
              anticipationCost = Math.round((valor - valorLiquido) * 100) / 100;
            }
          }

          valorFinal = Math.round((valor + processingCost + anticipationCost) * 100) / 100;
          console.log(`📊 Fee calc: processing=R$${processingCost.toFixed(2)}, anticipation=R$${anticipationCost.toFixed(2)}, total=R$${valorFinal.toFixed(2)}`);
        }
      } catch (feeErr) {
        console.warn('Error fetching Asaas fees for payment:', feeErr);
      }
    }

    // 5. Create payment in Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType,
      value: valorFinal,
      dueDate: dueDate.toISOString().split('T')[0],
      description: cobranca.descricao || 'Cobrança Lunari',
      externalReference: cobranca.session_id || cobranca.cliente_id,
    };

    if (billingType === 'CREDIT_CARD' && installmentCount && installmentCount > 1) {
      const maxParcelas = settings.maxParcelas || 12;
      paymentBody.installmentCount = Math.min(installmentCount, maxParcelas);
      paymentBody.installmentValue = valorFinal / (paymentBody.installmentCount as number);
    }

    if (billingType === 'CREDIT_CARD' && creditCard) {
      paymentBody.creditCard = creditCard;
      paymentBody.creditCardHolderInfo = creditCardHolderInfo;
    }

    console.log(`💳 Creating Asaas payment: ${billingType}, R$ ${valorFinal}, customer: ${asaasCustomerId}`);

    const paymentResp = await fetch(`${asaasBaseUrl}/v3/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentResp.json();

    if (!paymentResp.ok) {
      const errorMsg = paymentData.errors?.[0]?.description || 'Erro ao processar pagamento';
      console.error('Asaas payment error:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Asaas payment created: ${paymentData.id}, status: ${paymentData.status}`);

    // 6. Get PIX QR code if needed
    let pixData: { encodedImage?: string; payload?: string } | null = null;
    if (billingType === 'PIX') {
      const pixResp = await fetch(`${asaasBaseUrl}/v3/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: asaasApiKey },
      });
      if (pixResp.ok) {
        pixData = await pixResp.json();
      }
    }

    // 7. Update cobrança in database
    const isConfirmed = paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED';

    const updateData: Record<string, unknown> = {
      mp_payment_id: paymentData.id,
      status: isConfirmed ? 'pago' : 'pendente',
      updated_at: new Date().toISOString(),
    };

    if (isConfirmed) {
      updateData.data_pagamento = new Date().toISOString();
    }

    if (billingType === 'PIX' && pixData) {
      updateData.mp_qr_code_base64 = pixData.encodedImage;
      updateData.mp_pix_copia_cola = pixData.payload;
    }

    await supabase
      .from('cobrancas')
      .update(updateData)
      .eq('id', cobrancaId);

    // 8. Transaction creation is handled EXCLUSIVELY by the database trigger
    // `ensure_transaction_on_cobranca_paid` when cobrancas.status changes to 'pago'.
    // Do NOT insert into clientes_transacoes here to avoid duplicates.

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId,
        asaasPaymentId: paymentData.id,
        paid: isConfirmed,
        creditCardStatus: billingType === 'CREDIT_CARD' ? paymentData.status : undefined,
        pixQrCode: pixData?.encodedImage,
        pixCopiaECola: pixData?.payload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout process payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
