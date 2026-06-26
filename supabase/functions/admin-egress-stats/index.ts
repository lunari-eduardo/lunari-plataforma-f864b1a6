// Edge function: estatísticas de egress/uso do Supabase para o admin.
// Retorna proxies de egress por tabela (rows lidas via pg_stat) + tamanho.
// Gate: somente usuários com role 'admin' em user_roles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente como usuário para validar identidade
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Cliente admin para checar role e rodar queries privilegiadas
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return json({ error: "Forbidden — admin only" }, 403);
    }

    // Top 20 tabelas por proxy de egress (rows lidas desde último reset do pg_stat)
    const { data: tableStats, error: statsErr } = await admin.rpc(
      "admin_egress_table_stats",
      { _user_id: userData.user.id },
    );
    if (statsErr) {
      return json(
        { error: "Failed to fetch table stats", detail: statsErr.message },
        500,
      );
    }

    return json({
      generatedAt: new Date().toISOString(),
      note:
        "Rows lidas (seq_tup_read + idx_tup_fetch) é proxy de egress. Resetado em restart do Postgres.",
      tables: tableStats ?? [],
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
