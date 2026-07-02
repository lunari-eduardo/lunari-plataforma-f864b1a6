import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import {
  assertExtraPaymentWithinIdeal,
  assertNotAmbiguousSessionCharge,
  resolveCobrancaBinding,
} from '../_shared/cobrancaBinding.ts';
import { payerHintsFlags, resolvePayerHints } from '../_shared/payer-hints.ts';
import {
  ensureAsaasCustomerCpf,
  isAsaasSafeEmail,
  putAsaasCustomer,
} from '../_shared/asaas-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function errorResponse(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, code, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

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
  // Per-charge overrides (from ChargeModal)
  overrides?: {
    repassarTaxasProcessamento?: boolean;
    anteciparParcelas?: boolean;
    repassarTaxaAntecipacao?: boolean;
  };
  // Contrato Gestão↔Gallery (opcional; default = 'sessao')
  finalidade?: 'sessao' | 'fotos_extras';
  galeriaId?: string;
  qtdFotos?: number;
  snapshotFotosIncluidas?: number | null;
  correlationId?: string;
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

    // Resolve contrato finalidade/galeria_id/qtd_fotos (default sessao)
    const { binding, error: bindingError } = await resolveCobrancaBinding(
      supabase,
      userId,
      {
        finalidade: body.finalidade,
        galeriaId: body.galeriaId,
        qtdFotos: body.qtdFotos,
        snapshotFotosIncluidas: body.snapshotFotosIncluidas,
        correlationId: body.correlationId,
      },
    );
    if (bindingError || !binding) {
      return new Response(
        JSON.stringify({ success: false, error: bindingError?.message, code: bindingError?.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Guardas de contrato
    if (binding.finalidade === 'fotos_extras' && binding.galeria_id) {
      const guard = await assertExtraPaymentWithinIdeal(supabase, binding.galeria_id, valor);
      if (guard.error) {
        return new Response(
          JSON.stringify({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (binding.finalidade === 'sessao' && sessionId) {
      const guard = await assertNotAmbiguousSessionCharge(
        supabase, sessionId, valor,
        (body as { allowAmbiguous?: boolean }).allowAmbiguous === true,
      );
      if (guard.error) {
        return new Response(
          JSON.stringify({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1. Fetch user's Asaas integration
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
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
      ireiAntecipar?: boolean;
      repassarTaxaAntecipacao?: boolean;
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

    // 2. Resolve payer hints (ASCII-safe) + validações fiscais para PIX/BOLETO
    const hints = await resolvePayerHints({ supabase, clienteId });
    console.log(`[gestao-asaas] hints: ${payerHintsFlags(hints)}`);

    // PIX/BOLETO exigem CPF/CNPJ e telefone no customer Asaas
    if (billingType === 'PIX' || billingType === 'BOLETO') {
      if (!hints.cpfCnpj) {
        return errorResponse(
          'MISSING_CPF',
          'CPF/CNPJ do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
        );
      }
      if (!hints.phone) {
        return errorResponse(
          'MISSING_PHONE',
          'Telefone do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
        );
      }
    }
    if (!hints.name) {
      return errorResponse('MISSING_NAME', 'Nome do cliente é obrigatório.');
    }

    // 3. Get or create Asaas customer (com todos os dados fiscais disponíveis)
    let asaasCustomerId: string | null = null;

    // Busca por email primeiro (só se ASCII válido)
    if (hints.email && isAsaasSafeEmail(hints.email)) {
      const searchResp = await fetch(
        `${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(hints.email)}`,
        { headers: { access_token: asaasApiKey } },
      );
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.data && searchData.data.length > 0) {
          asaasCustomerId = searchData.data[0].id;
          console.log(`📋 Found existing Asaas customer: ${asaasCustomerId}`);
        }
      }
    }
    // Fallback: busca por externalReference (clienteId Lunari)
    if (!asaasCustomerId) {
      const searchResp = await fetch(
        `${asaasBaseUrl}/v3/customers?externalReference=${encodeURIComponent(clienteId)}`,
        { headers: { access_token: asaasApiKey } },
      );
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.data && searchData.data.length > 0) {
          asaasCustomerId = searchData.data[0].id;
          console.log(`📋 Found existing Asaas customer (by ref): ${asaasCustomerId}`);
        }
      }
    }

    const customerPayload: Record<string, unknown> = {
      name: hints.name,
      email: hints.email, // undefined removido pelo helper
      phone: hints.phone,
      mobilePhone: hints.phone,
      cpfCnpj: hints.cpfCnpj,
      postalCode: hints.postalCode,
      address: hints.address,
      addressNumber: hints.addressNumber,
      complement: hints.complement,
      province: hints.province,
      cityName: hints.cityName,
      state: hints.state,
      externalReference: clienteId,
    };

    if (asaasCustomerId) {
      // Atualiza customer com os dados que temos (resiliente a email inválido)
      const upd = await putAsaasCustomer(asaasBaseUrl, asaasApiKey, asaasCustomerId, customerPayload);
      if (!upd.ok) {
        console.warn('[gestao-asaas] customer update failed but proceeding', upd.data);
      } else if (upd.retriedWithoutEmail) {
        console.warn('[gestao-asaas] customer atualizado sem email (rejeitado pelo Asaas)');
      }
    } else {
      // Cria novo customer. Tenta com email; se falhar por email inválido, retenta sem.
      const cleanCreate = Object.fromEntries(
        Object.entries(customerPayload).filter(([, v]) => v !== undefined && v !== null && v !== ''),
      );
      const createResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
        body: JSON.stringify(cleanCreate),
      });
      const createData = await createResp.json();
      if (createResp.ok && createData.id) {
        asaasCustomerId = createData.id;
        console.log(`📋 Created Asaas customer: ${asaasCustomerId}`);
      } else {
        const errors = Array.isArray(createData?.errors) ? createData.errors : [];
        const emailErr = errors.some((e: any) =>
          String(e?.code || '').toLowerCase().includes('invalid_email') ||
          String(e?.description || '').toLowerCase().includes('email'),
        );
        if (emailErr && 'email' in cleanCreate) {
          const { email: _drop, ...rest } = cleanCreate;
          void _drop;
          const retryResp = await fetch(`${asaasBaseUrl}/v3/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: asaasApiKey },
            body: JSON.stringify(rest),
          });
          const retryData = await retryResp.json();
          if (retryResp.ok && retryData.id) {
            asaasCustomerId = retryData.id;
            console.warn('[gestao-asaas] customer criado sem email (rejeitado pelo Asaas)');
          } else {
            console.error('Failed to create Asaas customer (retry):', retryData);
            return errorResponse('ASAAS_CUSTOMER_ERROR', 'Erro ao criar cliente no Asaas.', 500);
          }
        } else {
          console.error('Failed to create Asaas customer:', createData);
          return errorResponse('ASAAS_CUSTOMER_ERROR', 'Erro ao criar cliente no Asaas.', 500);
        }
      }
    }

    if (!asaasCustomerId) {
      return errorResponse('ASAAS_CUSTOMER_ERROR', 'Não foi possível resolver cliente Asaas.', 500);
    }

    // Pré-check crítico para PIX/BOLETO: garante que o customer tem cpfCnpj
    if (billingType === 'PIX' || billingType === 'BOLETO') {
      const check = await ensureAsaasCustomerCpf(
        asaasBaseUrl,
        asaasApiKey,
        asaasCustomerId,
        hints.cpfCnpj,
      );
      if (!check.ok) {
        return errorResponse(
          'MISSING_CPF',
          'Não foi possível sincronizar CPF/CNPJ do cliente com o Asaas.',
        );
      }
    }



    // 3. Resolve fee settings (per-charge overrides > global settings)
    // New logic: ireiAntecipar controls whether anticipation exists at all
    const legacyAntecipar = settings.incluirTaxaAntecipacao === true;
    const globalAbsorverTaxa = !!settings.absorverTaxa;
    const globalIreiAntecipar = settings.ireiAntecipar ?? legacyAntecipar;
    const globalRepassarAntecipacao = settings.repassarTaxaAntecipacao ?? legacyAntecipar;

    // Per-charge overrides (inverted logic: repassarTaxas = !absorverTaxa)
    const repassarTaxas = body.overrides?.repassarTaxasProcessamento ?? !globalAbsorverTaxa;
    const antecipar = body.overrides?.anteciparParcelas ?? globalIreiAntecipar;
    const repassarAntecipacao = antecipar ? (body.overrides?.repassarTaxaAntecipacao ?? globalRepassarAntecipacao) : false;

    let valorFinal = valor;

    if (billingType === 'CREDIT_CARD' && (repassarTaxas || repassarAntecipacao)) {
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
          if (antecipar && repassarAntecipacao) {
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

          valorFinal = Math.round((valor + (repassarTaxas ? processingCost : 0) + (repassarAntecipacao ? anticipationCost : 0)) * 100) / 100;
          console.log(`📊 Fee calc: repassarTaxas=${repassarTaxas}, antecipar=${antecipar}, repassarAntecipacao=${repassarAntecipacao}, processing=R$${processingCost.toFixed(2)}, anticipation=R$${anticipationCost.toFixed(2)}, total=R$${valorFinal.toFixed(2)}`);
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

    // 8. Save cobrança with installment data
    const tipoCobranca = billingType === 'UNDEFINED' ? 'link' : billingType === 'CREDIT_CARD' ? 'link' : billingType === 'PIX' ? 'pix' : 'link';
    // Status always pendente — webhook handles transition via parcelas

    // Resolve installment data
    const installmentCount = paymentBody.installmentCount as number | undefined;
    const totalParcelas = installmentCount && installmentCount > 1 ? installmentCount : 1;
    // Asaas returns installment group ID in paymentData.installment for installment payments
    const asaasInstallmentId = paymentData.installment || null;

    const cobrancaData: Record<string, unknown> = {
      user_id: userId,
      cliente_id: clienteId,
      session_id: sessionId || null,
      valor: valor,
      valor_liquido: null, // Webhook fills this via cobranca_parcelas
      status: 'pendente', // Always pendente — webhook + parcelas trigger will set 'pago'
      provedor: 'asaas',
      tipo_cobranca: tipoCobranca,
      descricao: descricao || 'Cobrança Asaas',
      mp_payment_id: paymentData.id,
      data_pagamento: null, // Webhook sets this when parcelas are confirmed
      total_parcelas: totalParcelas,
      asaas_installment_id: asaasInstallmentId,
      dados_extras: {
        repassarTaxasProcessamento: repassarTaxas,
        anteciparParcelas: antecipar,
        repassarTaxaAntecipacao: repassarAntecipacao,
      },
      finalidade: binding.finalidade,
      galeria_id: binding.galeria_id,
      qtd_fotos: binding.qtd_fotos,
      snapshot_fotos_incluidas: binding.snapshot_fotos_incluidas,
      correlation_id: binding.correlation_id,
    };

    if (billingType === 'PIX' && pixData) {
      cobrancaData.mp_qr_code_base64 = pixData.encodedImage;
      cobrancaData.mp_pix_copia_cola = pixData.payload;
    }

    if (billingType === 'BOLETO' && boletoUrl) {
      cobrancaData.ip_checkout_url = boletoUrl;
    }

    if (billingType === 'UNDEFINED' && invoiceUrl) {
      cobrancaData.mp_payment_link = invoiceUrl;
    }

    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .insert(cobrancaData)
      .select('id')
      .single();

    if (cobrancaError) {
      console.error('Error saving cobrança:', cobrancaError);
    }

    // Transaction creation is handled EXCLUSIVELY by the database trigger

    return new Response(
      JSON.stringify({
        success: true,
        cobrancaId: cobranca?.id,
        asaasPaymentId: paymentData.id,
        paid: false, // Always false — webhook confirms payment
        creditCardStatus: billingType === 'CREDIT_CARD' ? paymentData.status : undefined,
        pixQrCode: pixData?.encodedImage,
        pixCopiaECola: pixData?.payload,
        boletoUrl,
        invoiceUrl,
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
