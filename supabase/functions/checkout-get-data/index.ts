import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { resolvePayerHints } from '../_shared/payer-hints.ts';
import { normalizeAsaasFees, NormalizedAsaasFees, ensureAsaasWebhookSubscription } from '../_shared/asaas-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
        .select('nome, avatar_url, logo_url')
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

    // Logotipo de cobrança: prioriza billing_logo_url, depois studio_logo_url, depois profile.logo_url
    const themeOverrides = (gallerySettings?.theme_overrides as Record<string, any>) || {};
    const rawLogo = themeOverrides.billing_logo_url || themeOverrides.billingLogoUrl || gallerySettings?.studio_logo_url || profile?.logo_url || null;
    const logoUrl = (typeof rawLogo === 'string' && !rawLogo.startsWith('data:image')) ? rawLogo : null;

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

    const rawExtras = (integracao.dados_extras || {}) as Record<string, any>;
    const settings = {
      ...((rawExtras.gestao_settings as Record<string, any>) || {}),
      ...((rawExtras.gallery_settings as Record<string, any>) || {}),
      ...rawExtras,
    };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Auto-garantir que o webhook Asaas está ativo no gateway
    const webhookEndpoint = `${supabaseUrl}/functions/v1/asaas-webhook`;
    ensureAsaasWebhookSubscription(asaasBaseUrl, integracao.access_token, webhookEndpoint).catch((e) => {
      console.warn('[checkout-get-data] Webhook auto-sync error (non-fatal):', e);
    });

    // Resolve fee settings: per-charge overrides (cobranca.dados_extras) > global settings (usuarios_integracoes)
    const chargeOverrides = (cobranca.dados_extras || {}) as {
      repassarTaxasProcessamento?: boolean;
      anteciparParcelas?: boolean;
      repassarTaxaAntecipacao?: boolean;
    };

    const legacyAntecipar = settings.incluirTaxaAntecipacao === true;
    const globalAbsorverTaxa = settings.absorverTaxa === true;
    const globalIreiAntecipar = settings.ireiAntecipar ?? legacyAntecipar;
    const globalRepassarAntecipacao = globalIreiAntecipar ? (settings.repassarTaxaAntecipacao ?? legacyAntecipar) : false;

    // Regra canônica: qualquer override explícito na cobrança PREVALECE sobre a configuração global
    const repassarTaxas = chargeOverrides.repassarTaxasProcessamento !== undefined
      ? chargeOverrides.repassarTaxasProcessamento
      : !globalAbsorverTaxa;
    const absorverTaxa = !repassarTaxas;
    const ireiAntecipar = chargeOverrides.anteciparParcelas !== undefined
      ? chargeOverrides.anteciparParcelas
      : globalIreiAntecipar;
    const repassarTaxaAntecipacao = ireiAntecipar
      ? (chargeOverrides.repassarTaxaAntecipacao !== undefined ? chargeOverrides.repassarTaxaAntecipacao : globalRepassarAntecipacao)
      : false;

    // 4. Fetch Asaas account fees
    let accountFees: NormalizedAsaasFees | null = null;
    try {
      const feesResponse = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
        headers: { access_token: integracao.access_token },
      });
      if (feesResponse.ok) {
        const rawFees = await feesResponse.json();
        accountFees = normalizeAsaasFees(rawFees);
      } else {
        console.warn('Could not fetch Asaas fees, status:', feesResponse.status);
        accountFees = normalizeAsaasFees(null);
      }
    } catch (err) {
      console.warn('Error fetching Asaas fees:', err);
      accountFees = normalizeAsaasFees(null);
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
