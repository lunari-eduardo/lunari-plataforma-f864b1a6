import { resolveGalleryByToken } from '../_shared/database.ts';
import { errorResponse } from '../_shared/responses.ts';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function validateAndLockSelection(params: {
  supabase: any;
  galleryToken: string;
  visitorId?: string;
  selectedCountFromBody?: number;
}) {
  const { supabase, galleryToken, visitorId, selectedCountFromBody } = params;

  if (!galleryToken) {
    return { error: errorResponse('galleryToken é obrigatório', 400) };
  }

  const { id: galleryId, error: tokenError } = await resolveGalleryByToken(supabase, galleryToken);

  if (tokenError || !galleryId) {
    console.error('Gallery not found or token error:', tokenError);
    return { error: errorResponse('Galeria não encontrada', 404) };
  }

  // 🔒 R1 (gallery-rules): guard determinístico ANTES do lock
  const { data: gRow } = await supabase
    .from('galerias')
    .select('finalized_at, status_selecao')
    .eq('id', galleryId)
    .maybeSingle();
  let vFinalized = false;
  if (visitorId) {
    const { data: vRow } = await supabase
      .from('galeria_visitantes')
      .select('finalized_at')
      .eq('id', visitorId)
      .maybeSingle();
    vFinalized = !!(vRow as any)?.finalized_at;
  }
  if ((gRow as any)?.finalized_at || vFinalized) {
    console.log(`🔒 [confirm-selection] ALREADY_FINALIZED gallery=${galleryId} visitor=${visitorId || 'n/a'}`);
    return { error: errorResponse('Seleção já finalizada', 409, 'ALREADY_FINALIZED') };
  }

  // ── SERVER-SIDE COUNT: Never trust frontend selectedCount ──
  let selectedCount = 0;
  if (visitorId) {
    const { count: visitorCount, error: vCountError } = await supabase
      .from('visitante_selecoes')
      .select('id', { count: 'exact', head: true })
      .eq('visitante_id', visitorId)
      .eq('is_selected', true);
    if (vCountError) {
      console.error('❌ Error counting visitor selections:', vCountError);
      return { error: errorResponse('Erro ao contar fotos selecionadas', 500) };
    }
    selectedCount = visitorCount || 0;
  } else {
    const { count: serverSelectedCount, error: countError } = await supabase
      .from('galeria_fotos')
      .select('id', { count: 'exact', head: true })
      .eq('galeria_id', galleryId)
      .eq('is_selected', true);
    if (countError) {
      console.error('❌ Error counting selected photos:', countError);
      return { error: errorResponse('Erro ao contar fotos selecionadas', 500) };
    }
    selectedCount = serverSelectedCount || 0;
  }
  console.log(`🔒 Server-side selected count: ${selectedCount} (frontend sent: ${selectedCountFromBody}, visitorId: ${visitorId || 'none'})`);

  if (selectedCount === 0) {
    await supabase.from('galerias').update({
      status_selecao: 'selecao_iniciada',
      updated_at: new Date().toISOString(),
    }).eq('id', galleryId);
    return { error: errorResponse('Nenhuma foto selecionada', 400) };
  }

  // 1. Acquire atomic lock
  let lockResult: any;
  let lockError: any;

  if (visitorId) {
    const res = await supabase.rpc('try_lock_visitor_selection', { p_visitor_id: visitorId });
    lockResult = res.data;
    lockError = res.error;
  } else {
    const res = await supabase.rpc('try_lock_gallery_selection', { p_gallery_id: galleryId });
    lockResult = res.data;
    lockError = res.error;
  }

  if (lockError) {
    console.error('Lock RPC error:', JSON.stringify({ message: lockError.message, code: lockError.code, details: lockError.details, hint: lockError.hint }));
    return { error: errorResponse('Erro ao processar seleção', 500, lockError.code || 'LOCK_ERROR') };
  }

  if (!lockResult?.locked) {
    const reason = lockResult?.reason || 'unknown';
    console.log(`🔒 Lock denied (visitor=${visitorId || 'none'}, gallery=${galleryId}): ${reason}`);
    return { error: errorResponse('A seleção já está sendo processada ou foi confirmada', 409, 'ALREADY_PROCESSING') };
  }

  // Rollback helper
  const rollbackGalleryStatus = async () => {
    try {
      if (visitorId) {
        const { data: v } = await supabase
          .from('galeria_visitantes')
          .select('finalized_at')
          .eq('id', visitorId)
          .maybeSingle();
        if ((v as any)?.finalized_at) {
          console.log(`🛡️ Rollback ignorado: visitor ${visitorId} já finalizado.`);
          return;
        }
        await supabase.from('galeria_visitantes').update({
          status_selecao: 'selecao_iniciada',
          updated_at: new Date().toISOString(),
        }).eq('id', visitorId);
        console.log(`🔓 Rollback: Visitor ${visitorId} status_selecao reset to selecao_iniciada`);
      } else {
        const { data: g } = await supabase
          .from('galerias')
          .select('finalized_at')
          .eq('id', galleryId)
          .maybeSingle();
        if ((g as any)?.finalized_at) {
          console.log(`🛡️ Rollback ignorado: galeria ${galleryId} já finalizada.`);
          return;
        }
        await supabase.from('galerias').update({
          status_selecao: 'selecao_iniciada',
          updated_at: new Date().toISOString(),
        }).eq('id', galleryId);
        console.log(`🔓 Rollback: Gallery ${galleryId} status_selecao reset to selecao_iniciada`);
      }
    } catch (rollbackErr) {
      console.error(`❌ Rollback failed:`, rollbackErr);
    }
  };

  const gallery = lockResult.gallery;

  // Auto-heal preventivo se contadores zerados
  let extrasPagasTotal = gallery.total_fotos_extras_vendidas || 0;
  let valorJaPago = gallery.valor_total_vendido || 0;

  if (extrasPagasTotal === 0) {
    const { count: paidCount } = await supabase
      .from('cobrancas')
      .select('id', { count: 'exact', head: true })
      .eq('galeria_id', galleryId)
      .in('status', ['pago', 'pago_manual']);

    if ((paidCount ?? 0) > 0) {
      const { data: paidCharges } = await supabase
        .from('cobrancas')
        .select('id, valor, qtd_fotos, extras_contabilizados, status')
        .eq('galeria_id', galleryId)
        .in('status', ['pago', 'pago_manual']);

      const needsHeal = (paidCharges || []).filter((c: any) => c.extras_contabilizados !== true);
      if (needsHeal.length > 0) {
        console.warn(`⚠️ DIVERGÊNCIA: galeria ${galleryId} tem ${needsHeal.length} cobrança(s) paga(s) não contabilizada(s). Auto-heal disparado.`);
        for (const c of needsHeal) {
          try {
            await supabase.rpc('finalize_gallery_payment', {
              p_cobranca_id: c.id,
              p_receipt_url: null,
              p_paid_at: new Date().toISOString(),
              p_manual_method: null,
              p_manual_obs: null,
            });
          } catch (healErr) {
            console.error(`❌ Auto-heal falhou para cobrança ${c.id}:`, healErr);
          }
        }
        const { data: refreshed } = await supabase
          .from('galerias')
          .select('total_fotos_extras_vendidas, valor_total_vendido')
          .eq('id', galleryId)
          .single();
        if (refreshed) {
          extrasPagasTotal = refreshed.total_fotos_extras_vendidas || 0;
          valorJaPago = refreshed.valor_total_vendido || 0;
          console.log(`✅ Auto-heal concluído: extras_pagas=${extrasPagasTotal}, valor_pago=R$${valorJaPago}`);
        }
      }
    }
  }

  // Sync antes da RPC canônica
  const { error: syncErr } = await supabase
    .from('galerias')
    .update({ fotos_selecionadas: selectedCount, updated_at: new Date().toISOString() })
    .eq('id', galleryId);

  if (syncErr) {
    console.error('❌ Falha ao sincronizar fotos_selecionadas antes da RPC:', syncErr);
    await rollbackGalleryStatus();
    return { error: errorResponse('Erro ao sincronizar seleção', 500, 'SELECTION_SYNC_ERROR') };
  }

  return {
    galleryId,
    selectedCount,
    gallery,
    extrasPagasTotal,
    valorJaPago,
    rollbackGalleryStatus,
  };
}
