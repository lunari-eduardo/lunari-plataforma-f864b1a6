// supabase/functions/create-payment/index.ts
// PROXY DE COMPATIBILIDADE: Redireciona todas as chamadas legadas para o orquestrador central create-cobranca

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth-guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const body = await req.json();

    const targetUrl = `${SUPABASE_URL}/functions/v1/create-cobranca`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader || `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "x-lunari-legacy-proxy": "create-payment",
      },
      body: JSON.stringify({
        ...body,
        provedor: body.provedor || body.provider,
        idempotencyKey: body.idempotencyKey || crypto.randomUUID(),
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro no proxy create-payment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
