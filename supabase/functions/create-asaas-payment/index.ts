// supabase/functions/create-asaas-payment/index.ts
// Adaptador técnico para a API do Asaas (Service Role / Compatibility Proxy)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { requireServiceRole, corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import { AdapterCreatePaymentInput, AdapterCreatePaymentOutput } from "../_shared/payment-types.ts";
import { createAsaasPayment } from "../_shared/adapters/asaas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://app.lunarihub.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authErr = requireServiceRole(req);
  if (authErr) return authErr;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: AdapterCreatePaymentInput = await req.json();

    const output: AdapterCreatePaymentOutput = await createAsaasPayment(
      supabase,
      body,
      PUBLIC_SITE_URL
    );

    if (!output.success) {
      return jsonResponse(output, 400);
    }

    return jsonResponse(output, 200);
  } catch (err: any) {
    console.error("[create-asaas-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Falha ao processar criação de pagamento no Asaas", 500);
  }
});
