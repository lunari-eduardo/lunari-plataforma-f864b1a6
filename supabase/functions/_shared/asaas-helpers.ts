/**
 * Asaas helpers — resiliência para casos onde o email do cliente é rejeitado
 * pelo Asaas (não-ASCII) ou o customer legado não tem CPF cadastrado.
 *
 * Usar em toda edge function que criar/atualizar customer Asaas do fotógrafo.
 */

export function isAsaasSafeEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email).trim());
}

interface AsaasCustomerPayload {
  name?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  cityName?: string;
  state?: string;
  externalReference?: string;
  [k: string]: unknown;
}

/**
 * PUT /v3/customers/{id} com retry sem `email` quando o Asaas responde
 * `invalid_email`. Preserva CPF/telefone/endereço mesmo com email inválido.
 */
export async function putAsaasCustomer(
  baseUrl: string,
  accessToken: string,
  customerId: string,
  payload: AsaasCustomerPayload,
): Promise<{ ok: boolean; data: any; retriedWithoutEmail: boolean }> {
  // Remove campos undefined para não sobrescrever com null no Asaas
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  const doPut = async (body: Record<string, unknown>) => {
    const res = await fetch(`${baseUrl}/v3/customers/${customerId}`, {
      method: "POST", // Asaas usa POST em /v3/customers/{id} para atualizar
      headers: { "Content-Type": "application/json", access_token: accessToken },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data };
  };

  const first = await doPut(clean);
  if (first.res.ok) {
    return { ok: true, data: first.data, retriedWithoutEmail: false };
  }

  const errors = Array.isArray(first.data?.errors) ? first.data.errors : [];
  const isEmailError = errors.some((e: any) => {
    const code = String(e?.code || "").toLowerCase();
    const desc = String(e?.description || "").toLowerCase();
    return code.includes("invalid_email") || desc.includes("email");
  });

  if (isEmailError && "email" in clean) {
    const { email: _drop, ...rest } = clean;
    void _drop;
    const retry = await doPut(rest);
    return {
      ok: retry.res.ok,
      data: retry.data,
      retriedWithoutEmail: true,
    };
  }

  return { ok: false, data: first.data, retriedWithoutEmail: false };
}

/**
 * Antes de criar cobrança PIX/BOLETO, garante que o customer no Asaas tem
 * `cpfCnpj` preenchido. Se estiver vazio E temos CPF nos hints, faz um PUT
 * dedicado só com { cpfCnpj }.
 */
export async function ensureAsaasCustomerCpf(
  baseUrl: string,
  accessToken: string,
  customerId: string,
  cpfCnpj: string | undefined,
): Promise<{ ok: boolean; alreadyHad: boolean }> {
  try {
    const res = await fetch(`${baseUrl}/v3/customers/${customerId}`, {
      headers: { access_token: accessToken },
    });
    if (!res.ok) return { ok: false, alreadyHad: false };
    const cust = await res.json();
    if (cust?.cpfCnpj) return { ok: true, alreadyHad: true };
    if (!cpfCnpj) return { ok: false, alreadyHad: false };
    const put = await putAsaasCustomer(baseUrl, accessToken, customerId, { cpfCnpj });
    return { ok: put.ok, alreadyHad: false };
  } catch (err) {
    console.error("[ensureAsaasCustomerCpf] failed:", err);
    return { ok: false, alreadyHad: false };
  }
}
