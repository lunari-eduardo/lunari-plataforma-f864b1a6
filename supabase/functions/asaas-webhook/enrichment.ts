import { enrichClienteIfMissing } from "../_shared/enrich-cliente.ts";

/**
 * Enriquece o cadastro do cliente com dados vindos do Asaas após pagamento
 * confirmado. Fire-and-forget: nunca falha o webhook por erro de enrich.
 */
export async function enrichClienteFromAsaasPayment(
  adminClient: any,
  cobrancaId: string,
  asaasCustomerId: string,
  photographerUserId: string,
) {
  try {
    const { data: integ } = await adminClient
      .from("usuarios_integracoes")
      .select("access_token, dados_extras")
      .eq("user_id", photographerUserId)
      .eq("provedor", "asaas")
      .eq("status", "ativo")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!integ?.access_token) return;
    const env = (integ.dados_extras as any)?.environment === "production" ? "production" : "sandbox";
    const baseUrl = env === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";

    const custRes = await fetch(`${baseUrl}/v3/customers/${asaasCustomerId}`, {
      headers: { access_token: integ.access_token },
    });
    if (!custRes.ok) {
      console.warn(`[enrich] GET customer ${asaasCustomerId} → ${custRes.status}`);
      await custRes.text().catch(() => {});
      return;
    }
    const cust = await custRes.json();

    const { data: cobranca } = await adminClient
      .from("cobrancas")
      .select("cliente_id")
      .eq("id", cobrancaId)
      .maybeSingle();
    if (!cobranca?.cliente_id) return;

    const result = await enrichClienteIfMissing(adminClient, cobranca.cliente_id, {
      email: cust.email,
      telefone: cust.mobilePhone || cust.phone,
      cpfCnpj: cust.cpfCnpj,
      cep: cust.postalCode,
      endereco: cust.address,
      enderecoNumero: cust.addressNumber,
      enderecoComplemento: cust.complement,
      bairro: cust.province,
      cidade: cust.city || cust.cityName,
      uf: cust.state,
    });
    if (result.updated) {
      console.log(`[enrich] cliente ${cobranca.cliente_id} → ${result.fields.join(",")}`);
    }
  } catch (err) {
    console.warn("[enrich] failed (ignored):", err);
  }
}
