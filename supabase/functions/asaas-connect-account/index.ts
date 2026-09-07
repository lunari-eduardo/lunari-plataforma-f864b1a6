import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apiKey = String(body.apiKey || "").trim();
    const environment = body.environment === "production" ? "production" : "sandbox";
    const settings = body.settings || {};
    const setAsDefault = body.setAsDefault ?? true;

    if (!apiKey || apiKey.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Informe uma API Key válida do Asaas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validação Ativa na API do Asaas
    const baseUrl = environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    let asaasStatusData: any = null;
    try {
      const validateRes = await fetch(`${baseUrl}/v3/myAccount/status`, {
        headers: { access_token: apiKey },
      });

      if (!validateRes.ok) {
        let errDesc = "";
        try {
          const errJson = await validateRes.json();
          errDesc = errJson.errors?.[0]?.description || "";
        } catch {
          errDesc = await validateRes.text();
        }

        if (validateRes.status === 401) {
          const envLabel = environment === "production" ? "Produção" : "Sandbox";
          return new Response(
            JSON.stringify({
              success: false,
              error: `Chave de API inválida para o ambiente ${envLabel}. Verifique se copiou a chave correta no painel do Asaas (${envLabel}).`,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (validateRes.status === 403) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "A chave de API não tem permissões para acessar a conta ou a conta está desativada no Asaas.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro ao validar com Asaas (HTTP ${validateRes.status}): ${errDesc.slice(0, 150)}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      asaasStatusData = await validateRes.json();
    } catch (netErr: any) {
      console.error("[asaas-connect-account] Erro de rede ao consultar Asaas:", netErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Falha ao conectar com os servidores do Asaas: ${netErr.message || "tempo limite esgotado"}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Criptografia AES-256-GCM da chave
    const encryptedToken = await encryptToken(apiKey);
    const last4 = apiKey.slice(-4);
    const keyMask = `••••••••••••${last4}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Buscar dados existentes para mesclar configurações
    const { data: existing } = await admin
      .from("usuarios_integracoes")
      .select("id, dados_extras")
      .eq("user_id", user.id)
      .eq("provedor", "asaas")
      .maybeSingle();

    const currentExtras = (existing?.dados_extras || {}) as Record<string, any>;
    const mergedExtras = {
      ...currentExtras,
      ...settings,
      environment,
      key_last4: last4,
      key_mask: keyMask,
      account_status: asaasStatusData?.general || null,
      commercial_status: asaasStatusData?.commercialInfo || null,
      validated_at: new Date().toISOString(),
    };

    const payload = {
      user_id: user.id,
      provedor: "asaas",
      status: "ativo",
      access_token: encryptedToken,
      dados_extras: mergedExtras,
      is_default: setAsDefault,
      conectado_em: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from("usuarios_integracoes")
        .update(payload)
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await admin
        .from("usuarios_integracoes")
        .insert(payload);
      if (insertErr) throw insertErr;
    }

    // 4. Se configurado como default, remove default dos outros provedores
    if (setAsDefault) {
      await admin
        .from("usuarios_integracoes")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("provedor", "asaas");
    }

    // 5. Se houver configuração de antecipação, dispara sincronização de fundo
    if (settings.ireiAntecipar !== undefined) {
      try {
        const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-asaas-anticipation`;
        fetch(syncUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ automaticAnticipation: settings.ireiAntecipar }),
        }).catch((e) => console.warn("[asaas-connect-account] sync-anticipation background error:", e));
      } catch {
        // não bloqueia
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Asaas conectado e validado com sucesso!",
        account: {
          status: asaasStatusData?.general,
          environment,
          last4,
          mask: keyMask,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[asaas-connect-account] Erro interno:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro interno ao conectar Asaas" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
