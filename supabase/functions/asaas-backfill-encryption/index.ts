// Admin-only: script seguro de backfill para criptografar chaves legadas em repouso
// Varre `usuarios_integracoes` e `platform_integrations` cifrando tokens sem prefixo enc:v1:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Migrar fotógrafos (usuarios_integracoes)
    const { data: fotografoRows, error: fErr } = await admin
      .from("usuarios_integracoes")
      .select("id, access_token, dados_extras")
      .eq("provedor", "asaas")
      .not("access_token", "is", null);

    if (fErr) throw fErr;

    let fotografoCount = 0;
    for (const row of (fotografoRows || [])) {
      const token = row.access_token?.trim();
      if (token && !token.startsWith("enc:v1:")) {
        const encrypted = await encryptToken(token);
        const last4 = token.slice(-4);
        const currentExtras = (row.dados_extras || {}) as Record<string, any>;
        const updatedExtras = {
          ...currentExtras,
          key_last4: last4,
          key_mask: `••••••••••••${last4}`,
        };

        const { error: upErr } = await admin
          .from("usuarios_integracoes")
          .update({
            access_token: encrypted,
            dados_extras: updatedExtras,
          })
          .eq("id", row.id);

        if (!upErr) fotografoCount++;
      }
    }

    // 2. Migrar chave da plataforma (platform_integrations)
    const { data: platformRows, error: pErr } = await admin
      .from("platform_integrations")
      .select("id, api_key")
      .eq("provider", "asaas")
      .not("api_key", "is", null);

    if (pErr) throw pErr;

    let platformCount = 0;
    for (const row of (platformRows || [])) {
      const key = row.api_key?.trim();
      if (key && !key.startsWith("enc:v1:")) {
        const encrypted = await encryptToken(key);
        const { error: upErr } = await admin
          .from("platform_integrations")
          .update({ api_key: encrypted })
          .eq("id", row.id);

        if (!upErr) platformCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backfill de criptografia concluído.",
        migrated: {
          photographers: fotografoCount,
          platform: platformCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[asaas-backfill-encryption] Erro:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro no backfill" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
