import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { mode, identifier } = await req.json();

    if (!mode || !identifier) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getTheme = async (userId: string) => {
      try {
        const { data: accountTheme } = await supabaseClient
          .from('gallery_settings')
          .select('active_theme_id, default_theme_id, theme_type')
          .eq('user_id', userId)
          .maybeSingle();

        const themeId = accountTheme?.active_theme_id || accountTheme?.default_theme_id;

        if (themeId && themeId !== 'lunari') {
          const { data: theme } = await supabaseClient
            .from('gallery_themes')
            .select('primary_color')
            .eq('id', themeId)
            .maybeSingle();
          if (theme?.primary_color) return theme.primary_color;
        }

        if (accountTheme?.theme_type === 'custom') {
          const { data: theme } = await supabaseClient
            .from('gallery_themes')
            .select('primary_color')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (theme?.primary_color) return theme.primary_color;
        }
      } catch (err) {}
      return null;
    };

    if (mode === 'tracked') {
      const token = identifier;
      // 1. Buscar o share rastreável
      const { data: share, error: shareErr } = await supabaseClient
        .from('material_shares')
        .select('id, material_id, version_id, user_id, custom_message, is_active')
        .eq('token', token)
        .single();

      if (shareErr || !share || !share.is_active) {
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Buscar informações do material
      const { data: material } = await supabaseClient
        .from('commercial_materials')
        .select('title, cover_image_url')
        .eq('id', share.material_id)
        .single();

      // 3. Buscar conteúdo exato da versão "travada"
      const { data: version } = await supabaseClient
        .from('material_versions')
        .select('content, version_number')
        .eq('id', share.version_id)
        .single();

      if (!version) {
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 4. Buscar perfil do fotógrafo
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id, nome, whatsapp, avatar_url')
        .eq('id', share.user_id)
        .single();

      return new Response(JSON.stringify({
        type: 'active',
        data: version.content,
        materialInfo: {
          title: material?.title || 'Proposta',
          cover_image_url: material?.cover_image_url,
          version_number: version.version_number
        },
        userProfile: profile,
        shareLinkId: share.id,
        customMessage: share.custom_message,
        theme: { primaryColor: await getTheme(share.user_id) }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === 'public') {
      const slug = identifier;
      
      const { data: activeLink, error: activeErr } = await supabaseClient
        .from('material_share_links')
        .select('id, material_id, user_id, is_active')
        .eq('slug', slug.toLowerCase())
        .single();

      let targetMaterialId = activeLink?.material_id;
      let targetUserId = activeLink?.user_id;

      if (!activeLink) {
        const { data: historicalSlug } = await supabaseClient
          .from('material_share_link_slugs')
          .select('share_link_id')
          .eq('slug', slug.toLowerCase())
          .single();

        if (historicalSlug) {
          const { data: currentLink } = await supabaseClient
            .from('material_share_links')
            .select('slug')
            .eq('id', historicalSlug.share_link_id)
            .single();
          
          if (currentLink) {
            return new Response(JSON.stringify({ type: 'redirect', redirectSlug: currentLink.slug }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!activeLink.is_active) {
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: material } = await supabaseClient
        .from('commercial_materials')
        .select('id, title, cover_image_url, active_version_id')
        .eq('id', targetMaterialId)
        .single();

      if (!material || !material.active_version_id) {
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: version } = await supabaseClient
        .from('material_versions')
        .select('content, version_number')
        .eq('id', material.active_version_id)
        .single();

      if (!version) {
        return new Response(JSON.stringify({ type: 'not_found' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id, nome, whatsapp, avatar_url')
        .eq('id', targetUserId)
        .single();

      return new Response(JSON.stringify({
        type: 'active',
        data: version.content,
        materialInfo: {
          title: material.title,
          cover_image_url: material.cover_image_url,
          version_number: version.version_number
        },
        userProfile: profile,
        shareLinkId: activeLink.id,
        theme: { primaryColor: await getTheme(targetUserId) }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
