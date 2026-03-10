import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: { fixedFeeValue: number };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cobrancaId } = await req.json();

    if (!cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: 'cobrancaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch cobrança
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('cobrancas')
      .select('id, user_id, cliente_id, session_id, valor, descricao, status, provedor, tipo_cobranca')
      .eq('id', cobrancaId)
      .maybeSingle();

    if (cobrancaError || !cobranca) {
      console.error('Cobrança not found:', cobrancaError);
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobranca.status !== 'pendente') {
      return new Response(
        JSON.stringify({
          success: false,
          error: cobranca.status === 'pago' ? 'Esta cobrança já foi paga' : 'Esta cobrança não está mais disponível',
          code: 'INVALID_STATUS',
          status: cobranca.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch photographer profile (public info only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, avatar_url')
      .eq('user_id', cobranca.user_id)
      .maybeSingle();

    // 3. Fetch Asaas integration settings
    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', cobranca.user_id)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (!integracao?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração de pagamento não configurada', code: 'NO_INTEGRATION' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 4. Fetch real fees from Asaas API (same logic as asaas-fetch-fees)
    let accountFees: AccountFees | null = null;
    const absorverTaxa = settings.absorverTaxa === true;

    if (!absorverTaxa && (settings.habilitarCartao !== false)) {
      try {
        const feesResp = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
          headers: { access_token: integracao.access_token },
        });

        if (feesResp.ok) {
          const feesData = await feesResp.json();
          const payment = feesData.payment || {};
          const creditCard = payment.creditCard || {};
          const pix = payment.pix || {};
          const anticipation = feesData.anticipation || {};
          const anticipationCC = anticipation.creditCard || {};

          // Build standard tiers
          const oneInstallment = creditCard.oneInstallmentPercentage;
          const upToSix = creditCard.upToSixInstallmentsPercentage;
          const upToTwelve = creditCard.upToTwelveInstallmentsPercentage;
          const upToTwentyOne = creditCard.upToTwentyOneInstallmentsPercentage;

          const tiers: Array<{ min: number; max: number; percentageFee: number }> = [];

          if (oneInstallment !== undefined) {
            if (upToSix !== undefined || upToTwelve !== undefined) {
              tiers.push({ min: 1, max: 1, percentageFee: oneInstallment });
              if (upToSix !== undefined) tiers.push({ min: 2, max: 6, percentageFee: upToSix });
              if (upToTwelve !== undefined) tiers.push({ min: 7, max: 12, percentageFee: upToTwelve });
              if (upToTwentyOne !== undefined) tiers.push({ min: 13, max: 21, percentageFee: upToTwentyOne });
            } else {
              tiers.push({ min: 1, max: 21, percentageFee: oneInstallment });
            }
          } else {
            tiers.push({ min: 1, max: 21, percentageFee: 2.99 });
          }

          // Discount tiers
          let discountInfo: AccountFees['discount'] = undefined;
          const hasDiscount = creditCard.hasValidDiscount === true;
          const discountExpiration = creditCard.discountExpiration;
          const discountStillValid = hasDiscount && (!discountExpiration || new Date(discountExpiration) > new Date());

          if (discountStillValid) {
            const discountTiers: Array<{ min: number; max: number; percentageFee: number }> = [];
            const dOne = creditCard.discountOneInstallmentPercentage;
            const dSix = creditCard.discountUpToSixInstallmentsPercentage;
            const dTwelve = creditCard.discountUpToTwelveInstallmentsPercentage;
            const dTwentyOne = creditCard.discountUpToTwentyOneInstallmentsPercentage;

            if (dOne !== undefined) {
              if (dSix !== undefined || dTwelve !== undefined) {
                discountTiers.push({ min: 1, max: 1, percentageFee: dOne });
                if (dSix !== undefined) discountTiers.push({ min: 2, max: 6, percentageFee: dSix });
                if (dTwelve !== undefined) discountTiers.push({ min: 7, max: 12, percentageFee: dTwelve });
                if (dTwentyOne !== undefined) discountTiers.push({ min: 13, max: 21, percentageFee: dTwentyOne });
              } else {
                discountTiers.push({ min: 1, max: 21, percentageFee: dOne });
              }
            }

            if (discountTiers.length > 0) {
              discountInfo = { active: true, expiration: discountExpiration, tiers: discountTiers };
            }
          }

          accountFees = {
            creditCard: {
              operationValue: creditCard.operationValue ?? 0.49,
              detachedMonthlyFeeValue: anticipationCC.detachedMonthlyFeeValue ?? 1.25,
              installmentMonthlyFeeValue: anticipationCC.installmentMonthlyFeeValue ?? 1.70,
              tiers,
            },
            pix: { fixedFeeValue: pix.fixedFeeValue ?? pix.operationValue ?? 0.99 },
            ...(discountInfo ? { discount: discountInfo } : {}),
          };

          console.log('📊 Fees loaded for checkout');
        }
      } catch (err) {
        console.warn('Error fetching Asaas fees:', err);
      }
    }

    // 5. Return checkout data
    return new Response(
      JSON.stringify({
        success: true,
        cobranca: {
          id: cobranca.id,
          valor: cobranca.valor,
          descricao: cobranca.descricao,
          status: cobranca.status,
        },
        photographer: {
          name: profile?.nome || null,
          logoUrl: profile?.avatar_url || null,
          userId: cobranca.user_id,
        },
        settings: {
          habilitarPix: settings.habilitarPix !== false,
          habilitarCartao: settings.habilitarCartao !== false,
          habilitarBoleto: settings.habilitarBoleto === true,
          maxParcelas: settings.maxParcelas || 12,
          absorverTaxa,
          incluirTaxaAntecipacao: settings.incluirTaxaAntecipacao !== false,
        },
        accountFees,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout get data error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
