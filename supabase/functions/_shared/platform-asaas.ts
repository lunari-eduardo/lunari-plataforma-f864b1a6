/**
 * Helper EXCLUSIVO para a integração Asaas da PLATAFORMA LUNARI
 * (assinaturas dos planos do sistema).
 *
 * ⚠️ ISOLAMENTO FINANCEIRO CRÍTICO ⚠️
 * - NUNCA importe este arquivo em funções de cobrança de fotógrafos
 *   (gestao-asaas-*, checkout-*, gallery-create-payment, check-payment-status).
 * - Aquelas funções DEVEM ler a chave de `usuarios_integracoes`
 *   filtrando por user_id, garantindo que cada empresa cobra com sua própria conta.
 *
 * Ordem de resolução:
 *   1. Linha em `platform_integrations` (provider='asaas', scope='subscriptions')
 *      gerenciada pelo Admin Lunari.
 *   2. Fallback transicional para os secrets ASAAS_API_KEY / ASAAS_ENV
 *      até que o admin configure a chave no painel.
 */

export interface PlatformAsaasConfig {
  apiKey: string;
  baseUrl: string;
  environment: "sandbox" | "production";
  source: "platform_integrations" | "env_fallback";
}

export async function getPlatformAsaasConfig(
  adminClient: any
): Promise<PlatformAsaasConfig | null> {
  // 1. Try DB-managed config (preferred)
  try {
    const { data } = await adminClient
      .from("platform_integrations")
      .select("environment, api_key")
      .eq("provider", "asaas")
      .eq("scope", "subscriptions")
      .maybeSingle();

    if (data?.api_key) {
      const environment = (data.environment === "production" ? "production" : "sandbox") as
        | "sandbox"
        | "production";
      return {
        apiKey: data.api_key,
        environment,
        baseUrl: environment === "production"
          ? "https://api.asaas.com"
          : "https://api-sandbox.asaas.com",
        source: "platform_integrations",
      };
    }
  } catch (err) {
    console.warn("[platform-asaas] Failed to read platform_integrations:", err);
  }

  // 2. Fallback to env vars (legacy, until admin configures the UI)
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return null;
  const environment = (Deno.env.get("ASAAS_ENV") === "production" ? "production" : "sandbox") as
    | "sandbox"
    | "production";
  return {
    apiKey,
    environment,
    baseUrl: environment === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com",
    source: "env_fallback",
  };
}
