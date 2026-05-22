// Public endpoint: retorna o preset de tema do fotógrafo dono.
// Usado pelo Lunari Gallery quando o visitante não está autenticado
// para que a galeria pública herde a aparência escolhida pelo studio.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const DEFAULT = { preset_id: 'lunari', mode: 'system' };

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let ownerUserId = url.searchParams.get('owner_user_id') ?? '';

    if (!ownerUserId && (req.method === 'POST')) {
      try {
        const body = await req.json();
        ownerUserId = body?.owner_user_id ?? '';
      } catch { /* ignore */ }
    }

    if (!ownerUserId || !isUuid(ownerUserId)) {
      return new Response(JSON.stringify(DEFAULT), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from('user_theme_preferences')
      .select('preset_id, mode')
      .eq('user_id', ownerUserId)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify(DEFAULT), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({
      preset_id: data.preset_id ?? DEFAULT.preset_id,
      mode: data.mode ?? DEFAULT.mode,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      status: 200,
    });
  } catch (_e) {
    return new Response(JSON.stringify(DEFAULT), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
