export async function fetchGalleryByToken(supabase: any, publicToken: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicToken);

  let gallery: any = null;
  let galleryError: any = null;

  if (isUUID) {
    const res = await supabase
      .from('galerias')
      .select('*')
      .eq('id', publicToken)
      .maybeSingle();
    gallery = res.data;
    galleryError = res.error;
  }

  if (!gallery && !galleryError) {
    const res = await supabase
      .from('galerias')
      .select('*')
      .eq('public_token', publicToken)
      .maybeSingle();
    gallery = res.data;
    galleryError = res.error;
  }

  if (!gallery && !galleryError) {
    const { data: alias } = await supabase
      .from('gallery_token_aliases')
      .select('gallery_id')
      .eq('old_token', publicToken)
      .maybeSingle();

    if (alias?.gallery_id) {
      const res = await supabase
        .from('galerias')
        .select('*')
        .eq('id', alias.gallery_id)
        .maybeSingle();
      gallery = res.data;
      galleryError = res.error;
    }
  }

  return { gallery, galleryError };
}

export async function resolveStudioSettings(supabase: any, userId: string) {
  const [{ data: settings }, { data: ownerProfile }] = await Promise.all([
    supabase
      .from('gallery_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('nome, empresa, logo_url, avatar_url')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const studioCandidate = (settings?.studio_name || '').trim();
  const companyCandidate = (ownerProfile?.empresa || '').trim();
  const nameCandidate = (ownerProfile?.nome || '').trim();

  let brandName: string | null = null;
  if (studioCandidate && studioCandidate !== 'Meu Estúdio') {
    brandName = studioCandidate;
  } else if (companyCandidate) {
    brandName = companyCandidate;
  } else if (nameCandidate) {
    brandName = nameCandidate;
  } else if (studioCandidate) {
    brandName = studioCandidate;
  }

  const faviconUrl =
    (settings?.favicon_url && String(settings.favicon_url).trim()) ||
    (settings?.studio_logo_url && String(settings.studio_logo_url).trim()) ||
    (ownerProfile?.logo_url && String(ownerProfile.logo_url).trim()) ||
    null;

  const studioLogoUrl =
    (settings?.studio_logo_url && String(settings.studio_logo_url).trim()) ||
    (ownerProfile?.logo_url && String(ownerProfile.logo_url).trim()) ||
    null;

  const photographerName: string | null = nameCandidate || studioCandidate || null;

  const settingsWithOwner = {
    ...(settings || {}),
    studio_name: brandName || settings?.studio_name || 'Meu Estúdio',
    brand_name: brandName,
    empresa: companyCandidate || null,
    photographer_name: photographerName,
    studio_logo_url: studioLogoUrl,
    favicon_url: faviconUrl,
  };

  return { settings, ownerProfile, settingsWithOwner };
}

export async function resolveThemeData(supabase: any, gallery: any, accountTheme: any) {
  const galleryConfig = (gallery.configuracoes as any) || {};
  const galleryThemeId = gallery.use_custom_theme ? gallery.theme_id : null;
  const accountThemeId = accountTheme?.active_theme_id || accountTheme?.default_theme_id || null;
  const themeId = galleryThemeId || accountThemeId || galleryConfig?.themeId || 'lunari';
  const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
  const themeOverrides = (gallery.use_custom_theme ? gallery.theme_overrides : accountTheme?.theme_overrides) || galleryConfig?.themeOverrides || {};

  let themeData = null;

  if (themeId && themeId !== 'lunari' && themeId !== 'system') {
    const { data: theme } = await supabase
      .from('gallery_themes')
      .select('*')
      .eq('id', themeId)
      .maybeSingle();
    if (theme) {
      themeData = {
        id: theme.id,
        name: theme.name,
        backgroundMode: clientMode,
        primaryColor: theme.primary_color,
        accentColor: theme.accent_color,
        emphasisColor: theme.emphasis_color,
      };
    }
  }

  // Se a galeria não tiver um tema individual específico, sempre prioriza o tema personalizado do fotógrafo em gallery_themes
  if (!themeData && !galleryThemeId && gallery.user_id) {
    const { data: theme } = await supabase
      .from('gallery_themes')
      .select('*')
      .eq('user_id', gallery.user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (theme) {
      themeData = {
        id: theme.id,
        name: theme.name,
        backgroundMode: clientMode,
        primaryColor: theme.primary_color,
        accentColor: theme.accent_color,
        emphasisColor: theme.emphasis_color,
      };
    }
  }

  if (!themeData) {
    themeData = { id: 'system', name: 'Sistema', backgroundMode: clientMode, primaryColor: null, accentColor: null, emphasisColor: null };
  }

  return { themeData, themeId, clientMode, themeOverrides, galleryConfig };
}
