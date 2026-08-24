import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { resolveCallerAuth, corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { normalizeAsaasFees } from "../_shared/asaas-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json();
    }

    const authResult = await resolveCallerAuth(req, supabase);
    let userId: string;
    
    // Suporta chamada de fotógrafo autenticado ou visitante passando userId
    if (authResult.authType === "user" && authResult.userId) {
      userId = authResult.userId;
    } else if (body.userId) {
      userId = body.userId;
    } else if (authResult.errorResponse) {
      return authResult.errorResponse;
    } else {
      return errorResponse("userId é obrigatório", 400, "MISSING_USER_ID");
    }

    const { data: integracao, error: integErr } = await supabase
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", userId)
      .eq("provedor", "asaas")
      .eq("status", "ativo")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (integErr || !integracao?.access_token) {
      return errorResponse("Integração Asaas não configurada", 400, "ASAAS_NOT_CONFIGURED");
    }

    const settings = (integracao.dados_extras || {}) as { environment?: string };
    const baseUrl = settings.environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    const res = await fetch(`${baseUrl}/v3/myAccount/fees`, {
      headers: { access_token: integracao.access_token },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[asaas-fetch-fees] Erro ao buscar taxas:", err);
      return errorResponse("Falha ao consultar API do Asaas", 502, "ASAAS_API_ERROR");
    }

    const data = await res.json();
    const accountFees = normalizeAsaasFees(data);

    return jsonResponse({
      success: true,
      accountFees,
    }, 200);

  } catch (err: any) {
    console.error("[asaas-fetch-fees] Erro inesperado:", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
