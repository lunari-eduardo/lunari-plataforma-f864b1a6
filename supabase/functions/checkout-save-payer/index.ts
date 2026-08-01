/**
 * checkout-save-payer — grava no CRM os dados coletados no checkout público.
 *
 * PÚBLICO (verify_jwt = false). Recebe apenas o `cobrancaId` e os campos do
 * pagador; resolve o `cliente_id` pelo banco (nunca aceita do cliente) e usa
 * `enrichClienteIfMissing`, que só preenche colunas vazias e nunca toca em
 * `whatsapp`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { enrichClienteIfMissing } from "../_shared/enrich-cliente.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cobrancaId, payer } = await req.json();
    if (!cobrancaId) return json({ success: false, error: "cobrancaId é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cobranca } = await supabase
      .from("cobrancas")
      .select("id, cliente_id")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (!cobranca) return json({ success: false, error: "Cobrança não encontrada" }, 404);
    if (!cobranca.cliente_id) return json({ success: true, updated: false, fields: [] });

    const result = await enrichClienteIfMissing(supabase, cobranca.cliente_id, {
      email: payer?.email,
      telefone: payer?.telefone,
      cpfCnpj: payer?.cpfCnpj,
    });

    // Nome: grava só quando o cadastro está vazio/placeholder.
    const nome = (payer?.nome || "").trim();
    if (nome.length >= 2) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", cobranca.cliente_id)
        .maybeSingle();
      const atual = (cli?.nome || "").trim();
      if (!atual) {
        await supabase.from("clientes").update({ nome }).eq("id", cobranca.cliente_id);
        result.fields.push("nome");
      }
    }

    return json({ success: true, updated: result.fields.length > 0, fields: result.fields });
  } catch (err) {
    console.error("[checkout-save-payer]", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
