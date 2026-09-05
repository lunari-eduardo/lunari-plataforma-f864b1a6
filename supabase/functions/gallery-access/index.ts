import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchGalleryByToken, resolveStudioSettings, resolveThemeData } from './tokenResolver.ts';
import { resolvePaymentStatus } from './paymentResolver.ts';
import { resolvePayerHintsAndMissing } from './payerHintsResolver.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const publicToken = body.publicToken || body.token;
    const password = body.password;
    const visitorId = body.visitorId;

    // 1. Fetch gallery with photographer's global settings (supports UUID, public_token, alias)
    console.log(`Fetching gallery with token: ${publicToken}`);
    const { gallery, galleryError } = await fetchGalleryByToken(supabase, publicToken);

    if (galleryError) {
      console.error('Database error fetching gallery:', galleryError);
      return new Response(JSON.stringify({ 
        error: 'Database error', 
        details: galleryError,
        code: 'INTERNAL_ERROR'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!gallery) {
      console.warn(`Gallery not found for token: ${publicToken}`);
      return new Response(JSON.stringify({ 
        error: 'Gallery not found',
        code: 'NOT_FOUND' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Pre-fetch studio settings (detailed) + perfil do fotógrafo (profiles)
    const { settings, settingsWithOwner } = await resolveStudioSettings(supabase, gallery.user_id);
    const accountTheme = settingsWithOwner;

    // Resolve Theme and Client Mode early (needed for Password / Visitor access screens)
    const { themeData, themeId, clientMode, themeOverrides, galleryConfig } = await resolveThemeData(
      supabase,
      gallery,
      accountTheme
    );

    // 3. Check password if private (só exige senha se realmente houver uma cadastrada)
    const hasPassword = typeof gallery.gallery_password === 'string' && gallery.gallery_password.length > 0;
    if (gallery.permissao === 'private' && hasPassword && gallery.gallery_password !== password) {
      return new Response(JSON.stringify({
        success: true,
        requiresPassword: true,
        sessionName: gallery.nome_sessao,
        studioSettings: settingsWithOwner,
        theme: themeData,
        clientMode,
        settings: {
          sessionFont: galleryConfig?.sessionFont || undefined,
          titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
        },
        error: password ? 'Senha incorreta' : undefined,
        code: password ? 'WRONG_PASSWORD' : 'AUTH_REQUIRED'
      }), {
        status: password ? 401 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2.5 TRACKING: Marcar galeria de seleção como acessada/em seleção no primeiro acesso
    if (gallery.tipo !== 'entrega' && gallery.status === 'enviado') {
      try {
        await supabase
          .from('galerias')
          .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
          .eq('id', gallery.id);
          
        console.log(`[gallery-access] Tracking: Galeria de seleção ${gallery.id} marcada como selecao_iniciada no primeiro acesso`);
      } catch (err) {
        console.error('[gallery-access] Erro ao atualizar status para selecao_iniciada:', err);
      }
    }

    // 4. Fetch related data
    const [
      { data: photos },
      { data: folders },
    ] = await Promise.all([
      supabase
        .from('galeria_fotos')
        .select('*')
        .eq('galeria_id', gallery.id)
        .order('original_filename', { ascending: true })
        .order('id', { ascending: true }),
      supabase.from('galeria_pastas').select('*').eq('galeria_id', gallery.id).order('ordem'),
    ]);

    // 3.1. CHECK FOR PENDING PAYMENT (Server-side Gating)
    const {
      isFinalized,
      currentSelectionStatus,
      selectionLocked,
      galleryFinalizedAt,
      visitorFinalizedAt,
      hasPaid,
      canonicalCalc,
      pendingPaymentData,
    } = await resolvePaymentStatus({
      supabase,
      gallery,
      visitorId,
    });

    // R3 (gallery-rules): Filtro de fotos e blockedReason canônico
    let filteredPhotos = photos || [];
    let blockedReason: 'awaiting_payment' | 'awaiting_charge_regeneration' | 'finalized_paid' | null = null;
    if (selectionLocked && !hasPaid) {
      filteredPhotos = [];
      blockedReason = (pendingPaymentData as any)?.awaitingCharge
        ? 'awaiting_charge_regeneration'
        : 'awaiting_payment';
    } else if (isFinalized) {
      blockedReason = 'finalized_paid';
      if (visitorId && gallery.permissao === 'public') {
        const { data: visitorSelections } = await supabase
          .from('visitante_selecoes')
          .select('foto_id')
          .eq('visitante_id', visitorId)
          .eq('is_selected', true);
        const selectedIds = new Set(visitorSelections?.map((s: any) => s.foto_id) || []);
        filteredPhotos = filteredPhotos.filter((p: any) => selectedIds.has(p.id));
      } else {
        filteredPhotos = filteredPhotos.filter((p: any) => p.is_selected);
      }
    }

    // 4. Normalize saleSettings — canonical columns > JSON > default.
    const rawSaleSettings = (galleryConfig?.saleSettings || {}) as Record<string, unknown>;
    const canonicalSaleMode = (gallery as any).venda_modo
      || (rawSaleSettings.mode as string | undefined)
      || 'no_sale';
    const canonicalPaymentMethod = (gallery as any).venda_pagamento_provedor
      || (rawSaleSettings.paymentMethod as string | undefined)
      || null;
    const canonicalChargeType = (gallery as any).venda_tipo_cobranca
      || (rawSaleSettings.chargeType as string | undefined)
      || 'only_extras';
    const normalizedSaleSettings = {
      mode: canonicalSaleMode,
      paymentMethod: canonicalPaymentMethod,
      chargeType: canonicalChargeType,
      pricingModel: (rawSaleSettings.pricingModel as string | undefined) || 'fixed',
      fixedPrice: rawSaleSettings.fixedPrice as number | undefined,
      discountPackages: (rawSaleSettings.discountPackages as unknown[]) || [],
    };
    const saleModeSource: 'column' | 'json' | 'default' =
      (gallery as any).venda_modo ? 'column'
      : (rawSaleSettings.mode ? 'json' : 'default');
    if ((rawSaleSettings.mode as string | undefined) && (gallery as any).venda_modo
        && rawSaleSettings.mode !== (gallery as any).venda_modo) {
      console.warn(`[gallery-access] SALE_MODE_DIVERGENCE gallery=${gallery.id} column=${(gallery as any).venda_modo} json=${rawSaleSettings.mode}`);
    }

    // Payer hints missing (booleans only — não expõe valores)
    const { payerHintsMissing, payerHintsValues } = await resolvePayerHintsAndMissing({
      supabase,
      gallery,
      visitorId,
    });

    // 6. Response
    return new Response(
      JSON.stringify({
        success: true,
        deliver: gallery.tipo === 'entrega',
        galleryId: gallery.id,
        gallery: {
          id: gallery.id,
          sessionId: gallery.session_id || null,
          sessionName: gallery.nome_sessao,
          clientName: gallery.cliente_nome,
          clientEmail: gallery.cliente_email,
          packageName: gallery.nome_pacote,
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: Number(gallery.valor_foto_extra || 0),
          regrasCongeladas: gallery.regras_congeladas || null,
          selectionStatus: currentSelectionStatus,
          welcomeMessage: gallery.mensagem_boas_vindas,
          expirationDate: gallery.prazo_selecao,
          publicToken: gallery.public_token,
          extrasPagasTotal: Number((canonicalCalc as any)?.extras_pagas ?? gallery.total_fotos_extras_vendidas ?? 0),
          totalFotosExtrasVendidas: Number(gallery.total_fotos_extras_vendidas ?? 0),
          valorTotalVendido: Number((canonicalCalc as any)?.valor_pago ?? gallery.valor_total_vendido ?? 0),
          canonicalCalc: canonicalCalc || null,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            coverPhotoId: galleryConfig?.coverPhotoId || undefined,
            photoSpacing: galleryConfig?.photoSpacing || undefined,
            themeId: themeId,
            useCustomTheme: gallery.use_custom_theme ?? false,
            themeOverrides: themeOverrides,
            coverId: (gallery as any).cover_id ?? null,
            defaultCoverId: (settings as any)?.default_cover_id ?? 'fullscreen',
            subtitulo: galleryConfig?.subtitulo || undefined,
            dataEvento: galleryConfig?.dataEvento || undefined,
            categoria: galleryConfig?.categoria || undefined,
          },
          saleSettings: normalizedSaleSettings,
          saleModeSource,
        },
        photos: filteredPhotos,
        finalized: isFinalized,
        selectionLocked,
        hasPaid,
        blockedReason,
        finalizedAt: galleryFinalizedAt || visitorFinalizedAt || null,
        folders: folders || [],
        studioSettings: settingsWithOwner || null,
        theme: themeData,
        clientMode,
        accountTheme,
        payerHintsMissing,
        payerHints: payerHintsValues,
        ...pendingPaymentData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
