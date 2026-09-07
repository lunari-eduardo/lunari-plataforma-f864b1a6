import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const { automaticAnticipation } = body as { automaticAnticipation?: boolean };

    // Fetch Asaas integration com chave decifrada
    const asaasConfig = await getPhotographerAsaasConfig(supabase, userId);
    if (!asaasConfig) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração Asaas ativa não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dadosExtras = asaasConfig.dadosExtras;
    const baseUrl = asaasConfig.baseUrl;
    const apiKey = asaasConfig.apiKey;
    const env = dadosExtras.environment === "production" ? "production" : "sandbox";

    const shouldEnable = automaticAnticipation !== undefined 
      ? automaticAnticipation 
      : Boolean(dadosExtras.ireiAntecipar);

    console.log(`[sync-asaas-anticipation] User ${userId} | Target automatic anticipation: ${shouldEnable}`);

    let updateSuccess = true;
    let updateErrorMsg: string | null = null;
    let updatedConfig: any = null;

    // 1. Envia configuração de antecipação automática para a API do Asaas
    try {
      const putRes = await fetch(`${baseUrl}/v3/anticipations/configurations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          creditCardAutomaticEnabled: shouldEnable,
        }),
      });

      const putData = await putRes.json().catch(() => ({}));

      if (!putRes.ok) {
        updateSuccess = false;
        updateErrorMsg = putData.errors?.[0]?.description || `HTTP ${putRes.status}: Erro ao atualizar antecipação no Asaas`;
        console.warn(`[sync-asaas-anticipation] PUT /v3/anticipations/configurations error:`, putData);
      } else {
        updatedConfig = putData;
      }
    } catch (putErr) {
      updateSuccess = false;
      updateErrorMsg = putErr instanceof Error ? putErr.message : "Falha na requisição Asaas";
    }

    // 2. Consulta estado atual da configuração
    let currentConfig: any = null;
    try {
      const getRes = await fetch(`${baseUrl}/v3/anticipations/configurations`, {
        headers: { access_token: apiKey },
      });
      if (getRes.ok) {
        currentConfig = await getRes.json();
      }
    } catch (getErr) {
      console.warn(`[sync-asaas-anticipation] GET /v3/anticipations/configurations error:`, getErr);
    }

    const finalConfig = currentConfig || updatedConfig || {};

    // 3. Atualiza estado de sincronização em dados_extras
    const syncStatus = {
      creditCardAutomaticEnabled: finalConfig.creditCardAutomaticEnabled ?? shouldEnable,
      syncedAt: new Date().toISOString(),
      success: updateSuccess,
      error: updateErrorMsg,
      status: finalConfig.creditCardStatus || null,
      environment: env,
    };

    const newDadosExtras = {
      ...dadosExtras,
      ireiAntecipar: shouldEnable,
      asaasAnticipationSync: syncStatus,
    };

    await supabase
      .from("usuarios_integracoes")
      .update({
        dados_extras: newDadosExtras,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asaasConfig.integrationId);

    return new Response(
      JSON.stringify({
        success: updateSuccess,
        syncStatus,
        config: finalConfig,
        error: updateErrorMsg,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[sync-asaas-anticipation] Internal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
