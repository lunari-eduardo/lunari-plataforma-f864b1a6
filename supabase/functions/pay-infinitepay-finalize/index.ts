/**
 * pay-infinitepay-finalize — endpoint público (verify_jwt=false) chamado pela
 * página /pay/ip/:cobrancaId quando o cliente confirma seus dados. Executa:
 *
 * 1. Enriquece o CRM com o payerPatch (nunca sobrescreve dados existentes,
 *    nunca toca `whatsapp`).
 * 2. Resolve os payer hints consolidados a partir do CRM já atualizado.
 * 3. Chama a API real da InfinitePay `POST /invoices/public/checkout/links`
 *    com `customer{ name, email?, phone_number }` e `address{}` quando
 *    completos.
 * 4. Atualiza `cobrancas.ip_checkout_url` com a URL definitiva do checkout.
 * 5. Devolve `{ checkoutUrl }` para o front redirecionar.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrichClienteIfMissing, type EnrichPatch } from "../_shared/enrich-cliente.ts";
import { resolvePayerHints } from "../_shared/payer-hints.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INFINITEPAY_API_URL = "https://api.checkout.infinitepay.io/links";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

interface FinalizeRequest {
  cobrancaId: string;
  payerPatch?: EnrichPatch & { nome?: string };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: FinalizeRequest = await req.json();
    const { cobrancaId, payerPatch } = body;
    if (!cobrancaId) return json(400, { success: false, error: "cobrancaId é obrigatório" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Carrega cobrança
    const { data: cobranca, error: cobError } = await supabase
      .from("cobrancas")
      .select("id, user_id, cliente_id, valor, descricao, status, provedor, ip_checkout_url")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobError || !cobranca) return json(404, { success: false, error: "Cobrança não encontrada" });
    if (cobranca.provedor !== "infinitepay") return json(400, { success: false, error: "Cobrança não é InfinitePay" });
    if (cobranca.status === "pago") return json(400, { success: false, error: "Cobrança já paga", code: "ALREADY_PAID" });

    // Se já está finalizada (URL na InfinitePay), retorna a existente
    const ipUrl: string | null = cobranca.ip_checkout_url as any;
    if (ipUrl && !ipUrl.startsWith(PUBLIC_SITE_URL) && ipUrl.includes("infinitepay")) {
      return json(200, { success: true, checkoutUrl: ipUrl, reused: true });
    }

    // 2. Enriquecimento do CRM (nunca sobrescreve; nunca toca whatsapp)
    if (payerPatch && cobranca.cliente_id) {
      // Nome é campo especial: se CRM está vazio E patch tem nome, gravar em `nome`.
      const { nome, ...rest } = payerPatch;
      const patchForEnrich: EnrichPatch = { ...rest };
      // Enriquecer campos "extras"
      await enrichClienteIfMissing(supabase, cobranca.cliente_id, patchForEnrich);
      // Nome tratado à parte (enrichClienteIfMissing não altera nome)
      if (nome && nome.trim().length >= 2) {
        const { data: c } = await supabase
          .from("clientes")
          .select("nome")
          .eq("id", cobranca.cliente_id)
          .maybeSingle();
        if (c && (!c.nome || (c.nome as string).trim() === "")) {
          await supabase.from("clientes").update({ nome: nome.trim() }).eq("id", cobranca.cliente_id);
        }
      }
    }

    // 3. Resolve hints consolidados
    const hints = cobranca.cliente_id
      ? await resolvePayerHints({ supabase, clienteId: cobranca.cliente_id })
      : {};

    // 4. Validação mínima
    if (!hints.name) return json(400, { success: false, error: "Nome do pagador é obrigatório", code: "MISSING_NAME" });
    if (!hints.phone) return json(400, { success: false, error: "Telefone do pagador é obrigatório", code: "MISSING_PHONE" });

    // 5. Handle do fotógrafo
    const { data: integracao } = await supabase
      .from("usuarios_integracoes")
      .select("dados_extras")
      .eq("user_id", cobranca.user_id)
      .eq("provedor", "infinitepay")
      .eq("status", "ativo")
      .maybeSingle();
    const handle = (integracao as any)?.dados_extras?.handle;
    if (!handle) return json(400, { success: false, error: "InfinitePay não configurado para este fotógrafo", code: "IP_NOT_CONFIGURED" });

    // 6. Payload InfinitePay
    const valorEmCentavos = Math.round(Number(cobranca.valor) * 100);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/infinitepay-webhook`;
    const redirectUrl = `${PUBLIC_SITE_URL}/pay/ip/${cobranca.id}?done=1`;

    const customer: Record<string, string> = {
      name: hints.name,
      phone_number: `+55${hints.phone}`,
    };
    if (hints.email) customer.email = hints.email;

    const payload: Record<string, unknown> = {
      handle,
      items: [
        {
          quantity: 1,
          price: valorEmCentavos,
          description: cobranca.descricao || "Serviço fotográfico",
        },
      ],
      order_nsu: cobranca.id,
      webhook_url: webhookUrl,
      redirect_url: redirectUrl,
      customer,
    };

    // Address só quando completo (cep + numero + logradouro)
    if (hints.postalCode && hints.addressNumber && hints.address) {
      const address: Record<string, string> = {
        cep: hints.postalCode,
        street: hints.address,
        number: hints.addressNumber,
      };
      if (hints.province) address.neighborhood = hints.province;
      if (hints.complement) address.complement = hints.complement;
      (payload as any).address = address;
    }

    console.log(`[pay-infinitepay-finalize] Calling InfinitePay for cobranca ${cobranca.id}`, {
      handle,
      hasEmail: !!hints.email,
      hasAddress: !!(payload as any).address,
    });

    const ipRes = await fetch(INFINITEPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!ipRes.ok) {
      const errText = await ipRes.text();
      console.error(`[pay-infinitepay-finalize] InfinitePay API ${ipRes.status}: ${errText}`);
      return json(502, {
        success: false,
        error: "Falha ao comunicar com a InfinitePay. Tente novamente.",
        code: "IP_API_ERROR",
      });
    }

    const ipData = await ipRes.json();
    const finalUrl = ipData.checkout_url || ipData.url || ipData.link;
    if (!finalUrl) {
      console.error(`[pay-infinitepay-finalize] Sem URL no retorno:`, ipData);
      return json(502, { success: false, error: "Resposta inválida da InfinitePay", code: "IP_NO_URL" });
    }

    // 7. Atualiza cobranca com URL definitiva
    await supabase
      .from("cobrancas")
      .update({
        ip_checkout_url: finalUrl,
        ip_order_nsu: cobranca.id,
        mp_payment_link: finalUrl,
      })
      .eq("id", cobranca.id);

    console.log(`[pay-infinitepay-finalize] Success cobranca=${cobranca.id} finalUrl=${finalUrl}`);

    return json(200, { success: true, checkoutUrl: finalUrl });
  } catch (err) {
    console.error("[pay-infinitepay-finalize] Error:", err);
    return json(500, { success: false, error: err instanceof Error ? err.message : "Erro" });
  }
});
