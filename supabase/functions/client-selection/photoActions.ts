export async function handlePhotoAction(params: {
  supabase: any;
  galleryId: string;
  photoId?: string;
  action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite';
  comment?: string;
  visitorId?: string;
  corsHeaders: Record<string, string>;
}): Promise<Response> {
  const { supabase, galleryId, photoId, action, comment, visitorId, corsHeaders } = params;

  if (!photoId) {
    return new Response(
      JSON.stringify({ error: 'photoId é obrigatório para esta ação' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Fetch gallery to validate status
  const { data: gallery, error: galleryError } = await supabase
    .from('galerias')
    .select('id, tipo, status, status_selecao, prazo_selecao, finalized_at, session_id, permissao')
    .eq('id', galleryId)
    .single();

  if (galleryError || !gallery) {
    return new Response(
      JSON.stringify({ error: 'Galeria não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Validate gallery is in allowed status
  const allowedStatuses = ['enviado', 'selecao_iniciada', 'selecao_completa'];
  if (!allowedStatuses.includes(gallery.status)) {
    return new Response(
      JSON.stringify({ error: 'Esta galeria não está aberta para seleção' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2.5. Check if gallery is expired
  if (gallery.status === 'expirado' || 
      (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date())) {
    return new Response(
      JSON.stringify({ error: 'O prazo desta galeria expirou' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 3. For PUBLIC galleries with visitor, check visitor-level finalization instead
  const isPublicGallery = gallery.permissao === 'public';
  
  if (!isPublicGallery) {
    if (gallery.status_selecao === 'selecao_completa' || gallery.finalized_at) {
      return new Response(
        JSON.stringify({ error: 'A seleção desta galeria já foi confirmada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } else if (visitorId) {
    const { data: visitor } = await supabase
      .from('galeria_visitantes')
      .select('status')
      .eq('id', visitorId)
      .eq('galeria_id', galleryId)
      .single();
    if (visitor?.status === 'finalizado') {
      return new Response(
        JSON.stringify({ error: 'Sua seleção já foi confirmada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // 4. Check if deadline has passed
  if (gallery.prazo_selecao) {
    const deadline = new Date(gallery.prazo_selecao);
    if (deadline < new Date()) {
      return new Response(
        JSON.stringify({ error: 'O prazo de seleção expirou' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // 5. Verify photo exists in gallery
  const { data: photo, error: photoError } = await supabase
    .from('galeria_fotos')
    .select('id, is_selected, is_favorite, comment')
    .eq('id', photoId)
    .eq('galeria_id', galleryId)
    .single();

  if (photoError || !photo) {
    return new Response(
      JSON.stringify({ error: 'Foto não encontrada nesta galeria' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── PUBLIC GALLERY: Use visitante_selecoes ──
  if (isPublicGallery && visitorId) {
    const { data: existingSel } = await supabase
      .from('visitante_selecoes')
      .select('is_selected, is_favorite, comment')
      .eq('visitante_id', visitorId)
      .eq('foto_id', photoId)
      .maybeSingle();

    const currentSel = existingSel || { is_selected: false, is_favorite: false, comment: null };

    let upsertData: { is_selected?: boolean; is_favorite?: boolean; comment?: string } = {};

    switch (action) {
      case 'toggle': upsertData.is_selected = !currentSel.is_selected; break;
      case 'select': upsertData.is_selected = true; break;
      case 'deselect': upsertData.is_selected = false; break;
      case 'comment': upsertData.comment = comment || ''; break;
      case 'favorite': upsertData.is_favorite = !currentSel.is_favorite; break;
      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: upsertError } = await supabase
      .from('visitante_selecoes')
      .upsert({
        visitante_id: visitorId,
        foto_id: photoId,
        is_selected: upsertData.is_selected ?? currentSel.is_selected,
        is_favorite: upsertData.is_favorite ?? currentSel.is_favorite,
        comment: upsertData.comment ?? currentSel.comment,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'visitante_id,foto_id' });

    if (upsertError) {
      console.error('Visitor selection upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (gallery.status === 'enviado') {
      await supabase.from('galerias')
        .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
        .eq('id', galleryId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        photo: {
          id: photoId,
          is_selected: upsertData.is_selected ?? currentSel.is_selected,
          is_favorite: upsertData.is_favorite ?? currentSel.is_favorite,
          comment: upsertData.comment ?? currentSel.comment,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── PRIVATE GALLERY: Original flow ──
  let updateData: { is_selected?: boolean; is_favorite?: boolean; comment?: string; updated_at?: string } = {
    updated_at: new Date().toISOString()
  };

  switch (action) {
    case 'toggle':
      updateData.is_selected = !photo.is_selected;
      break;
    case 'select':
      updateData.is_selected = true;
      break;
    case 'deselect':
      updateData.is_selected = false;
      break;
    case 'comment':
      updateData.comment = comment || '';
      break;
    case 'favorite':
      updateData.is_favorite = !photo.is_favorite;
      break;
    default:
      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }

  const { error: updateError } = await supabase
    .from('galeria_fotos')
    .update(updateData)
    .eq('id', photoId)
    .eq('galeria_id', galleryId);

  if (updateError) {
    console.error('Update error:', updateError);
    return new Response(
      JSON.stringify({ error: 'Erro ao atualizar seleção' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (gallery.tipo !== 'entrega' && gallery.status === 'enviado') {
    await supabase
      .from('galerias')
      .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
      .eq('id', galleryId);
    
    await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: 'selecao_iniciada',
      descricao: 'Cliente iniciou a seleção de fotos',
      user_id: null,
    });
  }

  const actionType = action === 'comment' 
    ? 'comment_added' 
    : action === 'favorite'
      ? (updateData.is_favorite ? 'photo_favorited' : 'photo_unfavorited')
      : (updateData.is_selected ? 'photo_selected' : 'photo_deselected');
  const actionDesc = action === 'comment' 
    ? 'Comentário adicionado à foto' 
    : action === 'favorite'
      ? (updateData.is_favorite ? 'Foto favoritada pelo cliente' : 'Foto desfavoritada pelo cliente')
      : (updateData.is_selected ? 'Foto selecionada pelo cliente' : 'Foto desmarcada pelo cliente');
  
  await supabase.from('galeria_acoes').insert({
    galeria_id: galleryId,
    tipo: actionType,
    descricao: actionDesc,
    user_id: null,
  });

  return new Response(
    JSON.stringify({ 
      success: true,
      photo: {
        id: photoId,
        is_selected: action === 'comment' || action === 'favorite' ? photo.is_selected : updateData.is_selected,
        is_favorite: action === 'favorite' ? updateData.is_favorite : photo.is_favorite,
        comment: action === 'comment' ? updateData.comment : photo.comment,
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
