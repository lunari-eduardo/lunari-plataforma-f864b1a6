const EXPECTED_GCP_VERSION = 'v2.2.1';

export async function handleRegenerateCharge(
  supabase: any,
  galleryId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    console.log('[regenerate_charge][step:1] rpc regenerate_pending_charge', { galleryId });
    const { data: rpcData, error: rpcError } = await supabase.rpc('regenerate_pending_charge', { p_gallery_id: galleryId });
    if (rpcError) throw rpcError;

    const isReused = (rpcData as any)?.reused === true;
    const reusedCobrancaId = (rpcData as any)?.cobranca_id;

    if (isReused && reusedCobrancaId) {
      const { data: existingCobranca } = await supabase
        .from('cobrancas')
        .select('id, checkout_url, ip_checkout_url, mp_payment_link, pix_copia_cola, mp_pix_copia_cola, pix_qr_code_base64, mp_qr_code_base64, provedor, status, valor')
        .eq('id', reusedCobrancaId)
        .maybeSingle();

      if (existingCobranca) {
        const checkoutUrl = existingCobranca.checkout_url || existingCobranca.ip_checkout_url || existingCobranca.mp_payment_link;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...rpcData,
              charge: {
                success: true,
                reused: true,
                cobrancaId: existingCobranca.id,
                checkoutUrl,
                paymentLink: checkoutUrl,
                provedor: existingCobranca.provedor,
                status: existingCobranca.status,
                pixCopiaCola: existingCobranca.pix_copia_cola || existingCobranca.mp_pix_copia_cola || undefined,
                pixQrCodeBase64: existingCobranca.pix_qr_code_base64 || existingCobranca.mp_qr_code_base64 || undefined,
              },
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const provedor = (rpcData as any)?.provedor || null;
    const valorACobrar = Number((rpcData as any)?.calc?.valor_a_cobrar || 0);
    const isFullyPaid = (rpcData as any)?.calc?.is_fully_paid === true;

    console.log('[regenerate_charge][step:2] rpc-ok', { provedor, valorACobrar, isFullyPaid });

    // Sem saldo → devolve NO_AMOUNT_DUE (front trata como pagamento já concluído)
    if (valorACobrar <= 0 || isFullyPaid) {
      return new Response(
        JSON.stringify({
          success: true,
          code: 'NO_AMOUNT_DUE',
          data: { ...rpcData, charge: { success: true, code: 'NO_AMOUNT_DUE', alreadyPaid: true } },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chama gallery-create-payment via fetch com service role (padrão do projeto)
    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gcpUrl = `${supabaseUrlEnv}/functions/v1/gallery-create-payment`;

    console.log('[regenerate_charge][step:3] calling gallery-create-payment', { provedor, valorACobrar });

    const gcpAc = new AbortController();
    const gcpTimer = setTimeout(() => gcpAc.abort(), 25_000);

    let gcpResp: Response;
    try {
      gcpResp = await fetch(gcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          galleryId,
          valor: valorACobrar,
          qtdFotosExtras: Number((rpcData as any)?.calc?.extras_a_cobrar || (rpcData as any)?.calc?.extras_necessarias || 1),
          provedor: provedor || undefined,
          provider: provedor || undefined,
          descricao: 'Regeneração via cliente',
          expectedVersion: EXPECTED_GCP_VERSION,
        }),
        signal: gcpAc.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(gcpTimer);
      const aborted = fetchErr?.name === 'AbortError';
      console.error('[regenerate_charge][step:3 fetch-error]', fetchErr?.message || fetchErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: aborted ? 'Gateway não respondeu a tempo' : 'Falha ao contatar o gateway de pagamento',
          code: aborted ? 'GATEWAY_TIMEOUT' : 'GATEWAY_UNREACHABLE',
        }),
        { status: aborted ? 504 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(gcpTimer);
    }

    let charge = await gcpResp.json().catch(() => ({} as any));

    // ── Handshake de versão ──
    const gotGcpVersion = charge?.version || gcpResp.headers.get('x-gcp-version') || 'unknown';
    if (gotGcpVersion !== EXPECTED_GCP_VERSION) {
      console.warn(`⚠️ PIPELINE_VERSION_DRIFT expected=${EXPECTED_GCP_VERSION} got=${gotGcpVersion}`);
    }

    // ── Shim de compatibilidade com build legada do gcp ──
    if (gcpResp.status === 400 && /clienteid/i.test(String(charge?.error ?? ''))) {
      console.warn('⚠️ GCP_LEGACY_FALLBACK — build antiga detectada, repetindo com payload legado');
      const { data: legacyGallery } = await supabase
        .from('galerias')
        .select('cliente_id, session_id, nome_sessao')
        .eq('id', galleryId)
        .maybeSingle();

      gcpResp = await fetch(gcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          galleryId,
          provider: provedor || undefined,
          descricao: 'Regeneração via cliente',
          expectedVersion: EXPECTED_GCP_VERSION,
          clienteId: legacyGallery?.cliente_id || null,
          sessionId: legacyGallery?.session_id || null,
          valorTotal: valorACobrar,
        }),
      });
      charge = await gcpResp.json().catch(() => ({} as any));
    }

    if (!gcpResp.ok || !charge?.success) {
      console.error('[regenerate_charge][step:4 upstream-error]', gcpResp.status, charge);
      return new Response(
        JSON.stringify({
          success: false,
          error: charge?.error || 'Não foi possível gerar o link de pagamento',
          code: charge?.code || 'PAYMENT_CREATE_ERROR',
        }),
        { status: gcpResp.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[regenerate_charge][step:5] charge-ok', {
      provedor: charge.provedor,
      hasCheckoutUrl: !!charge.checkoutUrl,
      transparentCheckout: !!charge.transparentCheckout,
    });

    try {
      await supabase.from('galeria_acoes').insert({
        galeria_id: galleryId,
        tipo: 'pagamento_regenerado',
        descricao: 'Cliente solicitou regeneração do link de pagamento',
        user_id: null,
        payload: { via: 'client-selection', provedor: charge.provedor, cobrancaId: charge.cobrancaId ?? null },
      });
    } catch (_logErr) { /* não crítico */ }

    return new Response(
      JSON.stringify({ success: true, data: { ...rpcData, charge } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[regenerate_charge][fatal]', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Falha ao regenerar cobrança' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
