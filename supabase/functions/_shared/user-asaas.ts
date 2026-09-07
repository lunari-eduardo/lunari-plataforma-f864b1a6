/**
 * Helper centralizado para obter a configuração Asaas do fotógrafo / usuário da conta.
 * Descriptografa automaticamente o token armazenado em repouso.
 */
import { decryptToken } from "./crypto.ts";

export interface PhotographerAsaasConfig {
  apiKey: string;
  baseUrl: string;
  environment: "sandbox" | "production";
  dadosExtras: Record<string, any>;
  integrationId: string;
  isDefault: boolean;
}

export async function getPhotographerAsaasConfig(
  supabaseClient: any,
  userId: string
): Promise<PhotographerAsaasConfig | null> {
  if (!userId) return null;

  const { data: integracao, error } = await supabaseClient
    .from("usuarios_integracoes")
    .select("id, access_token, dados_extras, is_default")
    .eq("user_id", userId)
    .eq("provedor", "asaas")
    .eq("status", "ativo")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[user-asaas] Erro ao buscar integracao Asaas para user ${userId}:`, error);
    return null;
  }

  if (!integracao?.access_token) {
    return null;
  }

  const rawKey = integracao.access_token;
  const apiKey = await decryptToken(rawKey);

  if (!apiKey) {
    console.warn(`[user-asaas] Chave vazia ou falha na descriptografia para user ${userId}`);
    return null;
  }

  const dadosExtras = (integracao.dados_extras || {}) as Record<string, any>;
  const rawEnv = dadosExtras.environment || dadosExtras.gestao_settings?.environment;
  const environment: "sandbox" | "production" = rawEnv === "production" ? "production" : "sandbox";

  const baseUrl = environment === "production"
    ? "https://api.asaas.com"
    : "https://api-sandbox.asaas.com";

  return {
    apiKey,
    baseUrl,
    environment,
    dadosExtras,
    integrationId: integracao.id,
    isDefault: integracao.is_default || false,
  };
}
