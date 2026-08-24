import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function trackShareEventRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const supabaseClient = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await c.req.json().catch(() => ({}));
    const { token, share_link_slug, session_token, event_type, payload = {}, occurred_at } = body;

    if ((!token && !share_link_slug) || !session_token || !event_type) {
      return c.json({ error: "Parâmetros faltando" }, 400);
    }

    // Hash do IP para privacidade (LGPD)
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0].trim() || "0.0.0.0";
    const userAgent = c.req.header("user-agent") || "unknown";
    const salt = c.env.ANALYTICS_SALT || "lunari-salt";
    
    const data = new TextEncoder().encode(ip + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    let share_id = null;
    let share_link_id = null;

    // 1. Validar token ou slug
    if (token) {
      const { data: share } = await supabaseClient
        .from('material_shares')
        .select('id')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();
      if (!share) return c.json({ error: "Compartilhamento inválido ou expirado" }, 400);
      share_id = share.id;
    } else if (share_link_slug) {
      let { data: link } = await supabaseClient
        .from('material_share_links')
        .select('id')
        .eq('slug', share_link_slug.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();
      
      if (!link) {
        const { data: oldLink } = await supabaseClient
          .from('material_share_link_slugs')
          .select('share_link_id')
          .eq('slug', share_link_slug.toLowerCase())
          .maybeSingle();
        if (oldLink) link = { id: oldLink.share_link_id };
      }
      
      if (!link) return c.json({ error: "Link público inválido" }, 400);
      share_link_id = link.id;

      // Incrementar views se for view_start
      if (event_type === 'view_start') {
        await supabaseClient.rpc('increment_share_link_views', { link_id: link.id }).catch(() => {
          supabaseClient.from('material_share_links')
            .select('total_views')
            .eq('id', link.id)
            .single()
            .then(({ data: v }) => {
              if (v) supabaseClient.from('material_share_links').update({ total_views: v.total_views + 1 }).eq('id', link.id);
            });
        });
      }
    }

    // 2. Criar ou Recuperar Sessão pelo session_token
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

    // 3. Inserir Evento (exceto heartbeat)
    if (event_type !== 'heartbeat') {
      const { error: insertError } = await supabaseClient
        .from("material_share_events")
        .insert({
          session_id: session.id,
          event_type,
          payload,
          occurred_at: occurred_at || new Date().toISOString()
        });

      if (insertError) throw insertError;
    }

    // 4. Se for view_end ou heartbeat ou qualquer evento que estenda a sessão, atualizar a duração
    if (event_type === 'view_end' || event_type === 'heartbeat' || event_type === 'scroll_depth' || event_type === 'section_view') {
      const endedAt = new Date();
      const startedAt = new Date(session.started_at);
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
      
      const updateData: any = {
        duration_seconds: duration > 0 ? duration : 0
      };
      
      if (event_type === 'view_end') {
        updateData.ended_at = endedAt.toISOString();
      }

      await supabaseClient
        .from("material_share_sessions")
        .update(updateData)
        .eq('id', session.id);
    }

    return c.json({ success: true, session_id: session.id });
  } catch (error: any) {
    console.error("Erro no Worker track-share-event:", error.message);
    return c.json({ error: error.message || "Erro interno" }, 500);
  }
}
