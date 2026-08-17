import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { resolvePayerHints } from '../_shared/payer-hints.ts';

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
      .select('id, user_id, cliente_id, session_id, galeria_id, valor, descricao, status, provedor, tipo_cobranca, dados_extras, mp_payment_link, mp_pix_copia_cola, mp_qr_code_base64, ip_checkout_url, checkout_url')
      .eq('id', cobrancaId)
      .maybeSingle();

    if (cobrancaError || !cobranca) {
      console.error('Cobrança not found:', cobrancaError);
      return new Response(
        JSON.stringify({ success: false, error: 'Cobrança não encontrada', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cobranca.status !== 'pendente' && cobranca.status !== 'pago') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Esta cobrança não está mais disponível',
          code: 'INVALID_STATUS',
          status: cobranca.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch photographer profile & gallery settings for logo & theme
    const [profileRes, gallerySettingsRes, galleryThemeRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('nome, avatar_url')
        .eq('user_id', cobranca.user_id)
        .maybeSingle(),
      supabase
        .from('gallery_settings')
        .select('studio_logo_url, studio_name, active_theme_id, default_theme_id, theme_type, theme_overrides')
        .eq('user_id', cobranca.user_id)
        .maybeSingle(),
      supabase
        .from('gallery_themes')
        .select('primary_color')
        .eq('user_id', cobranca.user_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const gallerySettings = gallerySettingsRes.data;
    const galleryTheme = galleryThemeRes.data;

    let galleryToken: string | null = null;
    if (cobranca.galeria_id) {
      const { data: gal } = await supabase
        .from('galerias')
        .select('public_token')
        .eq('id', cobranca.galeria_id)
        .maybeSingle();
      galleryToken = gal?.public_token || null;
    }

    // Logotipo: prioriza gallery_settings.studio_logo_url, depois profiles.avatar_url
    const logoUrl = gallerySettings?.studio_logo_url || profile?.avatar_url || null;

    // 2b. Fetch payer hints — pré-preenchimento + flags de campos ausentes via cascata canônica.
    const resolvedHints = await resolvePayerHints({
      supabase,
      clienteId: cobranca.cliente_id || null,
      galleryId: cobranca.galeria_id || null,
      sessionId: cobranca.session_id || null,
    });

    const payerHints = {
      fullName: resolvedHints.name || null,
      email: resolvedHints.email || null,
      phone: resolvedHints.phone || null,
      cpfCnpj: resolvedHints.cpfCnpj || null,
    };
    const payerMissing = {
      name: !payerHints.fullName,
      email: !payerHints.email,
      phone: !payerHints.phone,
      cpfCnpj: !payerHints.cpfCnpj,
    };

    // 2d. Resolver cor primária do tema com fallback oficial Lunari (#C6A36A)
    let customPrimaryColor = galleryTheme?.primary_color || null;
    if (!customPrimaryColor && gallerySettings?.theme_overrides) {
      const overrides = gallerySettings.theme_overrides as Record<string, any>;
      if (overrides.primaryColor) customPrimaryColor = overrides.primaryColor;
    }
    if (!customPrimaryColor) {
      customPrimaryColor = '#C6A36A'; // Paleta oficial Lunari
    }

    const provedor = (cobranca.provedor || 'asaas').toLowerCase();

    // 2c. Provedores não-Asaas: devolvem casca branded + bloco próprio.
    if (provedor !== 'asaas') {
      const providerBlock: Record<string, unknown> = {};

      if (provedor === 'mercadopago') {
        providerBlock.initPoint = cobranca.mp_payment_link || cobranca.checkout_url || null;
        providerBlock.pixCopiaECola = cobranca.mp_pix_copia_cola || null;
        providerBlock.pixQrCodeBase64 = cobranca.mp_qr_code_base64 || null;
      } else if (provedor === 'pix_manual') {
        providerBlock.pixCopiaECola = cobranca.mp_pix_copia_cola || null;
      } else if (provedor === 'infinitepay') {
        providerBlock.checkoutUrl = cobranca.ip_checkout_url || cobranca.checkout_url || null;
      }

      return new Response(
        JSON.stringify({
          success: true,
          provedor,
          isPaid: cobranca.status === 'pago',
          galleryToken,
          cobranca: {
            id: cobranca.id,
            valor: cobranca.valor,
            descricao: cobranca.descricao,
            status: cobranca.status,
          },
          photographer: {
            name: profile?.nome || gallerySettings?.studio_name || null,
            logoUrl,
            userId: cobranca.user_id,
          },
          settings: {
            habilitarPix: provedor !== 'infinitepay',
            habilitarCartao: false,
            habilitarBoleto: false,
            maxParcelas: 1,
            absorverTaxa: true,
          },
          accountFees: null,
          provider: providerBlock,
          payerHints,
          payerMissing,
          theme: { primaryColor: customPrimaryColor },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Fetch Asaas integration settings
    const { data: integracao } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', cobranca.user_id)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
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
      ireiAntecipar?: boolean;
      repassarTaxaAntecipacao?: boolean;
      incluirTaxaAntecipacao?: boolean;
    };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Resolve fee settings: per-charge overrides (dados_extras) > global settings
    const chargeOverrides = (cobranca.dados_extras || {}) as {
      repassarTaxasProcessamento?: boolean;
      anteciparParcelas?: boolean;
      repassarTaxaAntecipacao?: boolean;
    };
    const hasOverrides = Object.keys(chargeOverrides).length > 0;

    const legacyAntecipar = settings.incluirTaxaAntecipacao === true;
    const globalAbsorverTaxa = settings.absorverTaxa === true;
    const globalIreiAntecipar = settings.ireiAntecipar ?? legacyAntecipar;
    const globalRepassarAntecipacao = globalIreiAntecipar ? (settings.repassarTaxaAntecipacao ?? legacyAntecipar) : false;

    const repassarTaxas = hasOverrides ? (chargeOverrides.repassarTaxasProcessamento ?? !globalAbsorverTaxa) : !globalAbsorverTaxa;
    const absorverTaxa = !repassarTaxas;
    const ireiAntecipar = hasOverrides ? (chargeOverrides.anteciparParcelas ?? globalIreiAntecipar) : globalIreiAntecipar;
    const repassarTaxaAntecipacao = ireiAntecipar
      ? (hasOverrides ? (chargeOverrides.repassarTaxaAntecipacao ?? globalRepassarAntecipacao) : globalRepassarAntecipacao)
      : false;

    // 4. Fetch Asaas account fees
    let accountFees: AccountFees | null = null;
    try {
      const feesResponse = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
        headers: { access_token: integracao.access_token },
      });
      if (feesResponse.ok) {
        accountFees = await feesResponse.json();
      } else {
        console.warn('Could not fetch Asaas fees, status:', feesResponse.status);
      }
    } catch (err) {
      console.warn('Error fetching Asaas fees:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        provedor: 'asaas',
        isPaid: cobranca.status === 'pago',
        galleryToken,
        cobranca: {
          id: cobranca.id,
          valor: cobranca.valor,
          descricao: cobranca.descricao,
          status: cobranca.status,
        },
        photographer: {
          name: profile?.nome || gallerySettings?.studio_name || null,
          logoUrl,
          userId: cobranca.user_id,
        },
        settings: {
          habilitarPix: settings.habilitarPix !== false,
          habilitarCartao: settings.habilitarCartao !== false,
          habilitarBoleto: settings.habilitarBoleto === true,
          maxParcelas: settings.maxParcelas || 12,
          absorverTaxa,
          ireiAntecipar,
          repassarTaxaAntecipacao,
        },
        accountFees,
        payerHints,
        payerMissing,
        theme: { primaryColor: customPrimaryColor },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in checkout-get-data:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno ao buscar dados do checkout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
