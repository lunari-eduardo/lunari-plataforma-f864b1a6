/**
 * assistant-chat — Runtime da Lu (Onda E.1).
 *
 * Proxy fino entre o UI (`useChat` do AI SDK) e o LLM.
 *
 * Contrato:
 *  - POST body: {
 *      messages: UIMessage[],                 // histórico (AI SDK UI)
 *      system?: string,                       // system prompt (opcional; E.2 injeta snapshot)
 *      tools?: LLMToolDeclaration[],          // capabilities visíveis ao usuário
 *      model?: string,                        // override; default gemini-3.6-flash
 *      page?: string,                         // rótulo informativo (auditoria)
 *    }
 *  - Response: UI message stream (streamText.toUIMessageStreamResponse).
 *
 * Por que as tools vêm do cliente?
 *  - As capabilities Lunari vivem no bundle React e executam com a sessão
 *    Supabase do usuário (RLS + ownership). Duplicá-las no Deno quebra a
 *    fonte-de-verdade e força um segundo gate de segurança.
 *  - O modelo emite `tool_call`, o cliente executa via
 *    `runCapabilityAsAssistant` (auditoria + approval central) e devolve
 *    `tool_result` no próximo turno. É o padrão canônico do AI SDK
 *    (server sem `execute` + client-side handler).
 *
 * Segurança:
 *  - Verifica JWT via `getClaims`; user_id vem do token, nunca do body.
 *  - CORS aberto (browser da app + preview + published).
 *  - Erros do gateway (429/402) propagam com status HTTP correspondente.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "npm:ai@^5";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
  LOVABLE_AIG_RUN_ID_HEADER,
} from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "google/gemini-3.6-flash";

const DEFAULT_SYSTEM_PROMPT = `Você é a Lu, assistente operacional do Lunari Studio (plataforma para fotógrafos).
Regras invioláveis:
- Você executa APENAS as tools listadas neste turno; nunca invente tools.
- Tools marcadas como destrutivas ou sensíveis (needsApproval) exigem confirmação humana em linguagem natural ANTES de serem chamadas. Peça a confirmação explicitamente ("Digite 'confirmo' para prosseguir" ou peça para o usuário repetir o nome do item quando for exclusão).
- Nunca envie mensagem para o cliente final, nunca publique nada sem consentimento explícito, nunca acesse o banco fora das tools.
- Responda em pt-BR, tom operacional e curto. Prefira listas objetivas. Sem emojis.
- Se faltar informação para executar uma ação, pergunte de forma direta antes de chamar a tool.`;

interface ClientToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  needsApproval?: boolean;
  kind?: "query" | "command";
}

interface ChatRequestBody {
  messages: UIMessage[];
  system?: string;
  tools?: ClientToolDeclaration[];
  model?: string;
  page?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // --- Auth: user_id vem do token, nunca do body. ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  // Rollout gate (Admin → Beta → Geral)
  const { assertAssistantAccess } = await import("../_shared/assistant-guard.ts");
  const denied = await assertAssistantAccess(supabase, userId, corsHeaders);
  if (denied) return denied;

  // --- API key ---
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    return json({ error: "LOVABLE_API_KEY not configured" }, 500);
  }

  // --- Parse body ---
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages: array required" }, 400);
  }

  const modelId = typeof body.model === "string" && body.model.startsWith("google/")
    ? body.model
    : typeof body.model === "string" && body.model.startsWith("openai/")
    ? body.model
    : DEFAULT_MODEL;

  // --- Adapt tools (client → AI SDK). Sem `execute` → cliente resolve. ---
  const tools: Record<string, any> = {};
  for (const decl of body.tools ?? []) {
    if (!decl?.name) continue;
    tools[decl.name] = {
      description: buildToolDescription(decl),
      inputSchema: {
        // AI SDK aceita JSON Schema puro no lugar de zod via `jsonSchema()`,
        // mas para máxima interop deixamos como schema livre (o modelo enxerga
        // igual). O provider OpenAI-compatible faz o passthrough.
        jsonSchema: decl.parameters ?? { type: "object", properties: {} },
      },
    };
  }

  // --- Provider ---
  const initialRunId = getLovableAiGatewayRunId(req);
  const gateway = createLovableAiGatewayProvider(lovableApiKey, initialRunId);
  const model = gateway(modelId);

  const systemPrompt = [DEFAULT_SYSTEM_PROMPT, body.system?.trim()].filter(Boolean).join("\n\n");

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(body.messages),
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(50),
      // metadata útil para debug via AI Gateway logs
      providerOptions: {
        lovable: {
          metadata: { userId, page: body.page ?? null, source: "assistant-chat" },
        },
      },
    });

    const streamResponse = result.toUIMessageStreamResponse({
      headers: getLovableAiGatewayResponseHeaders(undefined, {
        ...corsHeaders,
        ...(initialRunId ? { [LOVABLE_AIG_RUN_ID_HEADER]: initialRunId } : {}),
      }),
    });

    return withLovableAiGatewayRunIdHeader(streamResponse, gateway, corsHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[assistant-chat] streamText failed:", message);
    // 429/402 do gateway sobem como Error com status embutido — repassa se der.
    const status = extractStatus(err) ?? 500;
    return json({ error: message }, status);
  }
});

function buildToolDescription(decl: ClientToolDeclaration): string {
  const parts: string[] = [decl.description ?? ""];
  if (decl.kind === "command") parts.push("[COMMAND — modifica dados]");
  if (decl.kind === "query") parts.push("[QUERY — apenas leitura]");
  if (decl.needsApproval) {
    parts.push(
      "[APPROVAL — peça confirmação humana explícita ANTES de chamar; se o usuário não confirmar, não execute].",
    );
  }
  return parts.filter(Boolean).join(" ");
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { status?: number; statusCode?: number };
    if (typeof anyErr.status === "number") return anyErr.status;
    if (typeof anyErr.statusCode === "number") return anyErr.statusCode;
  }
  return undefined;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
