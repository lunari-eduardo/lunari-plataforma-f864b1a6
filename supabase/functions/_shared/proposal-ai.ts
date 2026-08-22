/**
 * proposal-ai — IA para o módulo Comercial (geração de propostas e ajuda por campo).
 *
 * Reutiliza a mesma infra do Assistente Lu: provider/model definidos em
 * `app_settings` (assistant_ai_provider / assistant_ai_model) e chave no
 * cofre `assistant_provider_keys`; fallback Lovable AI Gateway.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "npm:ai@^5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^1";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^2";
import { createLovableAiGatewayProvider } from "./ai-gateway.ts";

const DEFAULT_MODEL = "gemini-2.5-flash";

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
    },
  });
}

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  return null;
}

/** Exige JWT do usuário logado; retorna user id ou null. */
export async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function resolveModel() {
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [{ data: provRow }, { data: modRow }] = await Promise.all([
    supabaseService.from("app_settings").select("value").eq("key", "assistant_ai_provider").maybeSingle(),
    supabaseService.from("app_settings").select("value").eq("key", "assistant_ai_model").maybeSingle(),
  ]);

  const providerName = typeof provRow?.value === "string" ? provRow.value : "lovable";
  const modelId = typeof modRow?.value === "string" && modRow.value ? modRow.value : DEFAULT_MODEL;

  const { data: keyRow } = await supabaseService
    .from("assistant_provider_keys")
    .select("api_key")
    .eq("provider_name", providerName)
    .maybeSingle();
  const apiKey = keyRow?.api_key;

  if (providerName === "gemini" && apiKey) {
    const google = createGoogleGenerativeAI({ apiKey });
    return { model: google(modelId), providerName, modelId, supabaseService };
  }
  if (providerName === "deepseek" && apiKey) {
    const ds = createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/beta",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { model: ds(modelId), providerName, modelId, supabaseService };
  }
  if (providerName === "openai" && apiKey) {
    const oa = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { model: oa(modelId), providerName, modelId, supabaseService };
  }

  const lovableKey = apiKey || Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("Nenhuma chave de IA configurada (vault/lovable)");
  const gateway = createLovableAiGatewayProvider(lovableKey);
  return { model: gateway(modelId), providerName, modelId, supabaseService };
}

/** Extrai o primeiro objeto/array JSON de uma resposta de texto. */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("Resposta da IA não contém JSON");
  const sliced = candidate.slice(start);
  // Tenta parse progressivo (de trás pra frente) para tolerar texto ao redor
  for (let end = sliced.length; end > 1; end--) {
    const attempt = sliced.slice(0, end).trim();
    if (!/[\]}]$/.test(attempt)) continue;
    try {
      return JSON.parse(attempt);
    } catch { /* tenta cortar antes */ }
  }
  throw new Error("Não foi possível interpretar o JSON da IA");
}

/** Completa um prompt exigindo saída JSON estrita; retorna objeto parseado + client service. */
export async function completeJson(system: string, user: string): Promise<{ data: any; supabaseService: any }> {
  const { model, supabaseService } = await resolveModel();
  const { text } = await generateText({
    model,
    system: `${system}\n\nResponda APENAS com JSON válido, sem texto ao redor, sem markdown.`,
    prompt: user,
  });
  return { data: extractJson(text), supabaseService };
}

/** Log de geração (best-effort) em public.proposal_ai_logs. */
export async function logGeneration(
  supabaseService: any,
  userId: string,
  kind: "generate" | "outline" | "field",
  input: unknown,
  output: unknown,
  status: string
) {
  try {
    await supabaseService
      .from("proposal_ai_logs")
      .insert({
        user_id: userId,
        kind,
        input: JSON.parse(JSON.stringify(input ?? {})),
        output: JSON.parse(JSON.stringify(output ?? {})),
        status,
      });
  } catch (err) {
    console.log("[proposal-ai] log falhou (não crítico):", (err as Error)?.message);
  }
}
