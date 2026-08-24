import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function getPublicThemeRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      return c.json({ success: false, error: "userId é obrigatório" }, 400);
    }

    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let customPrimaryColor = null;

    const { data: accountTheme } = await supabase
      .from('gallery_settings')
      .select('active_theme_id, default_theme_id, theme_type')
      .eq('user_id', userId)
      .maybeSingle();

    const themeId = accountTheme?.active_theme_id || accountTheme?.default_theme_id;

    if (themeId && themeId !== 'lunari') {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('primary_color')
        .eq('id', themeId)
        .maybeSingle();
      if (theme?.primary_color) customPrimaryColor = theme.primary_color;
    }

    if (!customPrimaryColor && accountTheme?.theme_type === 'custom') {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('primary_color')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (theme?.primary_color) customPrimaryColor = theme.primary_color;
    }

    return c.json({ success: true, primaryColor: customPrimaryColor });
  } catch (err) {
    console.error("[get-public-theme] error:", err);
    return c.json({ success: false, error: "Erro interno do servidor" }, 500);
  }
}
