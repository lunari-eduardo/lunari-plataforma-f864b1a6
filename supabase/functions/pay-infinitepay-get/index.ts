/**
 * pay-infinitepay-get — endpoint público (verify_jwt=false) chamado pela
 * página /pay/ip/:cobrancaId no domínio do Gestão.
 *
 * Retorna somente o mínimo necessário para renderizar a tela de pagamento
 * ao cliente final: valor, descrição, nome comercial do fotógrafo e um
 * snapshot dos dados fiscais já presentes no CRM, com a lista de campos
 * ainda faltantes por provedor (InfinitePay).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** InfinitePay exige pelo menos nome + telefone para pré-preencher. */
const REQUIRED_MIN: Array<"nome" | "telefone"> = ["nome", "telefone"];

function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cobrancaId = url.searchParams.get("cobrancaId");
    if (!cobrancaId) {
      return new Response(
        JSON.stringify({ success: false, error: "cobrancaId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cobranca, error: cobError } = await supabase
      .from("cobrancas")
      .select("id, user_id, cliente_id, valor, descricao, status, provedor, ip_checkout_url")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobError || !cobranca) {
      return new Response(
        JSON.stringify({ success: false, error: "Cobrança não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (cobranca.provedor !== "infinitepay") {
      return new Response(
        JSON.stringify({ success: false, error: "Cobrança não é InfinitePay" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Nome do fotógrafo — profiles ou photographer_accounts
    const [{ data: profile }, { data: photoAcc }] = await Promise.all([
      supabase.from("profiles").select("nome").eq("user_id", cobranca.user_id).maybeSingle(),
      supabase
        .from("photographer_accounts")
        .select("nome_empresa, nome")
        .eq("user_id", cobranca.user_id)
        .maybeSingle(),
    ]);
    const displayName =
      (photoAcc as any)?.nome_empresa ||
      (photoAcc as any)?.nome ||
      (profile as any)?.nome ||
      "Fotógrafo";

    // Snapshot do cliente
    const { data: cliente } = await supabase
      .from("clientes")
      .select(
        "nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, endereco_numero, endereco_complemento, bairro, cidade, uf",
      )
      .eq("id", cobranca.cliente_id)
      .maybeSingle();

    const payer_snapshot = {
      nome: (cliente as any)?.nome || "",
      email: (cliente as any)?.email || "",
      telefone: (cliente as any)?.whatsapp || (cliente as any)?.telefone || "",
      cpfCnpj: (cliente as any)?.cpf_cnpj || "",
      cep: (cliente as any)?.cep || "",
      endereco: (cliente as any)?.endereco || "",
      endereco_numero: (cliente as any)?.endereco_numero || "",
      endereco_complemento: (cliente as any)?.endereco_complemento || "",
      bairro: (cliente as any)?.bairro || "",
      cidade: (cliente as any)?.cidade || "",
      uf: (cliente as any)?.uf || "",
    };

    const missingFields: string[] = [];
    if (isEmpty(payer_snapshot.nome) || payer_snapshot.nome.trim().length < 2) missingFields.push("nome");
    if (isEmpty(payer_snapshot.telefone)) missingFields.push("telefone");
    // CPF/CNPJ e endereço são recomendados mas não bloqueiam
    if (isEmpty(payer_snapshot.cpfCnpj)) missingFields.push("cpfCnpj_optional");
    if (isEmpty(payer_snapshot.cep) || isEmpty(payer_snapshot.endereco_numero)) missingFields.push("address_optional");

    return new Response(
      JSON.stringify({
        success: true,
        cobranca: {
          id: cobranca.id,
          valor: Number(cobranca.valor),
          descricao: cobranca.descricao,
          status: cobranca.status,
          ip_checkout_url: cobranca.ip_checkout_url,
        },
        photographer: { display_name: displayName },
        payer_snapshot,
        missingFields,
        required_min: REQUIRED_MIN,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[pay-infinitepay-get] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
