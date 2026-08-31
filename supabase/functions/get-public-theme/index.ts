import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let customPrimaryColor = null;

    const { data: accountTheme } = await supabase
      .from('gallery_settings')
      .select('active_theme_id, default_theme_id, theme_type')
      .eq('user_id', userId)
      .maybeSingle();

    const themeId = accountTheme?.active_theme_id || accountTheme?.default_theme_id;

    if (themeId && themeId !== 'lunari' && themeId !== 'system') {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('primary_color')
        .eq('id', themeId)
        .maybeSingle();
      if (theme?.primary_color) customPrimaryColor = theme.primary_color;
    }

    if (!customPrimaryColor && userId) {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('primary_color')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (theme?.primary_color) customPrimaryColor = theme.primary_color;
    }

    return new Response(
      JSON.stringify({ success: true, primaryColor: customPrimaryColor }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[get-public-theme] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
