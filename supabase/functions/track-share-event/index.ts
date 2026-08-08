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

    const body = await req.json();
    const { token, share_link_slug, session_token, event_type, payload = {}, occurred_at } = body;

    if ((!token && !share_link_slug) || !session_token || !event_type) {
      return new Response(JSON.stringify({ error: "Parâmetros faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash do IP para privacidade (LGPD)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const salt = Deno.env.get("ANALYTICS_SALT") || "lunari-salt";
    
    const data = new TextEncoder().encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    let share_id = null;
    let share_link_id = null;

    // 1. Validar token ou slug
    if (token) {
      const { data: share, error } = await supabaseClient
        .from('material_shares')
        .select('id')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();
      if (!share) throw new Error("Compartilhamento inválido ou expirado");
      share_id = share.id;
    } else if (share_link_slug) {
      // Tentar slug principal
      let { data: link } = await supabaseClient
        .from('material_share_links')
        .select('id')
        .eq('slug', share_link_slug.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();
      
      // Tentar histórico se não achou
      if (!link) {
        const { data: oldLink } = await supabaseClient
          .from('material_share_link_slugs')
          .select('share_link_id')
          .eq('slug', share_link_slug.toLowerCase())
          .maybeSingle();
        if (oldLink) link = { id: oldLink.share_link_id };
      }
      
      if (!link) throw new Error("Link público inválido");
      share_link_id = link.id;

      // Incrementar views se for view_start
      if (event_type === 'view_start') {
        await supabaseClient.rpc('increment_share_link_views', { link_id: link.id }).catch(() => {
          // Fallback se RPC não existir
          supabaseClient.from('material_share_links')
            .select('total_views')
            .eq('id', link.id)
            .single()
            .then(({data: v}) => {
              if (v) supabaseClient.from('material_share_links').update({ total_views: v.total_views + 1 }).eq('id', link.id);
            });
        });
      }
    }

    // 2. Criar ou Recuperar Sessão pelo session_token (que é garantido ser persistente na aba pelo frontend)
    let { data: session } = await supabaseClient
      .from("material_share_sessions")
      .select("id, started_at")
      .eq("session_token", session_token)
      .maybeSingle();

    if (!session) {
      const { data: newSession, error: createError } = await supabaseClient
        .from("material_share_sessions")
        .insert({
          share_id,
          share_link_id,
          session_token,
          ip_hash: ipHash,
          user_agent: userAgent,
        })
        .select("id, started_at")
        .single();
      if (createError) throw createError;
      session = newSession;
    }

    // 3. Inserir Evento
    const { error: insertError } = await supabaseClient
      .from("material_share_events")
      .insert({
        session_id: session.id,
        event_type,
        payload,
        occurred_at: occurred_at || new Date().toISOString()
      });

    if (insertError) throw insertError;

    // 4. Se for view_end, atualizar sessão
    if (event_type === 'view_end') {
      const endedAt = new Date();
      const startedAt = new Date(session.started_at);
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
      
      await supabaseClient
        .from("material_share_sessions")
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: duration > 0 ? duration : 0
        })
        .eq('id', session.id);
    }

    return new Response(JSON.stringify({ success: true, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro na Edge Function track-share-event:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
