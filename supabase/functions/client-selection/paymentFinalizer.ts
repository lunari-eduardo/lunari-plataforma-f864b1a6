import { syncSessionOnFinalize } from '../_shared/session-sync.ts';

export async function handleFinalizePayment(
  supabase: any,
  galleryId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: gallery, error: galleryError } = await supabase
    .from('galerias')
    .select('id, status_selecao, session_id')
    .eq('id', galleryId)
    .single();

  if (galleryError || !gallery) {
    return new Response(
      JSON.stringify({ error: 'Galeria não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (gallery.status_selecao !== 'aguardando_pagamento') {
    return new Response(
      JSON.stringify({ error: 'Esta galeria não está aguardando pagamento' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Finalize the gallery
  const now = new Date().toISOString();
  await supabase
    .from('galerias')
    .update({
      status_selecao: 'selecao_completa',
      finalized_at: now,
      status_pagamento: 'aguardando_confirmacao',
      updated_at: now,
    })
    .eq('id', galleryId);

  // Sincronização Sessão via edge do Gestão (contrato 2026-07-11).
  if (gallery.session_id) {
    await syncSessionOnFinalize({
      supabase,
      galleryId,
      sessionId: gallery.session_id,
    });
  }

  // Log action
  await supabase.from('galeria_acoes').insert({
    galeria_id: galleryId,
    tipo: 'pagamento_informado',
    descricao: 'Cliente informou pagamento PIX manual',
    user_id: null,
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Pagamento informado com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
