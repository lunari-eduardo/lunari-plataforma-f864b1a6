import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  clienteId: string;
  sessionId?: string;
  valor: number;
  descricao?: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
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
  installmentCount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error('JWT validation failed:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const body: RequestBody = await req.json();
    const { clienteId, sessionId, valor, descricao, billingType = 'PIX' } = body;

    if (!clienteId || !valor || valor <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'clienteId e valor são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch user's Asaas integration
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      console.error('Asaas integration not found:', integError);
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada', code: 'ASAAS_NOT_CONFIGURED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as {
      environment?: string;
      habilitarPix?: boolean;
      habilitarCartao?: boolean;
      habilitarBoleto?: boolean;
      maxParcelas?: number;
      absorverTaxa?: boolean;
      incluirTaxaAntecipacao?: boolean;
    };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Validate billing type is enabled
    if (billingType === 'PIX' && settings.habilitarPix === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIX não está habilitado', code: 'PIX_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (billingType === 'CREDIT_CARD' && settings.habilitarCartao === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cartão de crédito não está habilitado', code: 'CARD_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (billingType === 'BOLETO' && settings.habilitarBoleto === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Boleto não está habilitado', code: 'BOLETO_DISABLED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get or create Asaas customer
    let asaasCustomerId: string | null = null;

    const { data: cliente } = await supabase
      .from('clientes')
      .select('nome, email, telefone, whatsapp')
      .eq('id', clienteId)
      .maybeSingle();

    if (cliente) {
      const clientEmail = cliente.email;
      
      // Search for existing customer by email
      if (clientEmail) {
        const searchResp = await fetch(`${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(clientEmail)}`, {
          headers: { access_token: asaasApiKey },
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.data && searchData.data.length > 0) {
            asaasCustomerId = searchData.data[0].id;
            console.log(`📋 Found existing Asaas customer: ${asaasCustomerId}`);
          }
        }
      }

      // Create new customer if not found
      if (!asaasCustomerId) {
        const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: asaasApiKey,
          },
          body: JSON.stringify({
            name: cliente.nome || 'Cliente',
            email: cliente.email || undefined,
            phone: cliente.whatsapp || cliente.telefone || undefined,
            externalReference: clienteId,
          }),
        });

        if (createResp.ok) {
          const createData = await createResp.json();
          asaasCustomerId = createData.id;
          console.log(`📋 Created Asaas customer: ${asaasCustomerId}`);
        } else {
          const errData = await createResp.json();
          console.error('Failed to create Asaas customer:', errData);
        }
      }
    }

    // Fallback: create generic customer
    if (!asaasCustomerId) {
      const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          name: 'Cliente Lunari',
          externalReference: clienteId,
        }),
      });

      if (createResp.ok) {
        const createData = await createResp.json();
        asaasCustomerId = createData.id;
      } else {
        const errData = await createResp.json();
        console.error('Failed to create fallback Asaas customer:', errData);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar cliente no Asaas', code: 'ASAAS_CUSTOMER_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Calculate fees for credit card (server-side validation)
    let valorFinal = valor;
    const incluirAntecipacao = settings.incluirTaxaAntecipacao !== false;

    if (billingType === 'CREDIT_CARD' && !settings.absorverTaxa) {
      const installments = body.installmentCount && body.installmentCount > 1 ? body.installmentCount : 1;

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
        console.warn('Error fetching Asaas fees:', feeErr);
      }
    }

    // 4. Create payment in Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const paymentBody: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType,
      value: valorFinal,
      dueDate: dueDate.toISOString().split('T')[0],
      description: descricao || 'Cobrança Lunari',
      externalReference: sessionId || clienteId,
    };

    if (billingType === 'CREDIT_CARD' && body.installmentCount && body.installmentCount > 1) {
      const maxParcelas = settings.maxParcelas || 12;
      paymentBody.installmentCount = Math.min(body.installmentCount, maxParcelas);
      paymentBody.installmentValue = valorFinal / (paymentBody.installmentCount as number);
    }

    if (billingType === 'CREDIT_CARD' && body.creditCard) {
      paymentBody.creditCard = body.creditCard;
      paymentBody.creditCardHolderInfo = body.creditCardHolderInfo;
    }

    console.log(`💳 Creating Asaas payment: ${billingType}, R$ ${valorFinal}, customer: ${asaasCustomerId}`);

    const paymentResp = await fetch(`${asaasBaseUrl}/v3/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentResp.json();

    if (!paymentResp.ok) {
      const errorMsg = paymentData.errors?.[0]?.description || 'Erro ao criar pagamento no Asaas';
      console.error('Asaas payment creation error:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, code: 'ASAAS_PAYMENT_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Asaas payment created: ${paymentData.id}, status: ${paymentData.status}`);

    // 5. Get PIX QR code if billing type is PIX
    let pixData: { encodedImage?: string; payload?: string } | null = null;
    if (billingType === 'PIX') {
      const pixResp = await fetch(`${asaasBaseUrl}/v3/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: asaasApiKey },
      });
      if (pixResp.ok) {
        pixData = await pixResp.json();
        console.log('📱 PIX QR code generated');
      }
    }

    // 6. Get boleto URL
    let boletoUrl: string | null = null;
    if (billingType === 'BOLETO') {
      boletoUrl = paymentData.bankSlipUrl || null;
    }

    // 7. Get invoice URL for UNDEFINED billing type (checkout link)
    let invoiceUrl: string | null = null;
    if (billingType === 'UNDEFINED') {
      invoiceUrl = paymentData.invoiceUrl || `${asaasBaseUrl.replace('api', 'www').replace('/v3', '')}/i/${paymentData.id}`;
      console.log(`🔗 Invoice URL: ${invoiceUrl}`);
    }

    // 8. Save cobrança
    const tipoCobranca = billingType === 'UNDEFINED' ? 'link' : billingType === 'CREDIT_CARD' ? 'link' : billingType === 'PIX' ? 'pix' : 'link';
    const isConfirmed = paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED';

    const cobrancaData: Record<string, unknown> = {
      user_id: userId,
      cliente_id: clienteId,
      session_id: sessionId || null,
      valor: valor,
      status: isConfirmed ? 'pago' : 'pendente',
      provedor: 'asaas',
      tipo_cobranca: tipoCobranca,
      descricao: descricao || 'Cobrança Asaas',
      mp_payment_id: paymentData.id,
      data_pagamento: isConfirmed ? new Date().toISOString() : null,
    };

    if (billingType === 'PIX' && pixData) {
      cobrancaData.mp_qr_code_base64 = pixData.encodedImage;
      cobrancaData.mp_pix_copia_cola = pixData.payload;
    }

    if (billingType === 'BOLETO' && boletoUrl) {
      cobrancaData.ip_checkout_url = boletoUrl;
    }

    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert(cobrancaData)
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Error saving cobrança:', cobrancaError);
    }

    // 8. If payment confirmed immediately (credit card), create transaction
    if (isConfirmed && sessionId) {
      const { data: sessao } = await supabase
        .from('clientes_sessoes')
        .select('cliente_id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (sessao) {
        await supabase.from('clientes_transacoes').insert({
          user_id: userId,
          cliente_id: sessao.cliente_id,
          session_id: sessionId,
          valor: valor,
          tipo: 'pagamento',
          data_transacao: new Date().toISOString().split('T')[0],
          descricao: `Pagamento Asaas - Cartão ${body.installmentCount || 1}x`,
        });

        console.log(`✅ Transaction created for session ${sessionId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId: cobranca?.id,
        asaasPaymentId: paymentData.id,
        paid: isConfirmed,
        creditCardStatus: billingType === 'CREDIT_CARD' ? paymentData.status : undefined,
        pixQrCode: pixData?.encodedImage,
        pixCopiaECola: pixData?.payload,
        boletoUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Gestao Asaas payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
