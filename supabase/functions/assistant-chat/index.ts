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
import {
  convertToModelMessages,
  jsonSchema,
  streamText,
  stepCountIs,
  type UIMessage,
} from "npm:ai@^5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^1";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^2";
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

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Auditoria de turno do assistente (best-effort — nunca derruba o stream). */
async function logInvocation(
  db: any,
  entry: {
    userId: string | null;
    page?: string | null;
    model: string;
    provider: string;
    toolCount: number;
    status: "success" | "error";
    error?: string;
    finishReason?: string;
    usage?: unknown;
    durationMs: number;
  },
) {
  try {
    const { error: auditError } = await db.from("assistant_invocations").insert({
      user_id: entry.userId,
      capability_id: "assistant.chat.turn",
      module: "assistant",
      kind: "query",
      actor: "assistant",
      output_status: entry.status,
      error_message: entry.error ?? null,
      latency_ms: Math.round(entry.durationMs),
      surface: "chat",
      auth_source: "supabase",
      tool_name: `${entry.provider}:${entry.model} (${entry.toolCount} tools${
        entry.finishReason ? `, ${entry.finishReason}` : ""
      })`,
    });
  } catch (e) {
    console.error("[assistant-chat] falha ao auditar invocação:", e);
  }
}

const DEFAULT_SYSTEM_PROMPT = `Você é a Lunari, assistente operacional do Lunari Studio (plataforma para fotógrafos).
Regras invioláveis de Segurança e Operação:
- Você executa APENAS as tools listadas neste turno; nunca invente tools.
- Tools marcadas como destrutivas ou sensíveis (needsApproval) exigem confirmação humana ANTES de serem chamadas.
- Nunca envie mensagem para o cliente final, nunca publique nada sem consentimento explícito.
- Responda em pt-BR, tom operacional e curto. Sem emojis.
- Se faltar informação para executar uma ação, pergunte de forma direta antes de chamar a tool.

DIRETRIZES DE RENDERIZAÇÃO DE INTERFACE (Generative UI):
Você NÃO DEVE responder sempre como texto puro. Você deve estruturar os dados visualmente quando apropriado, usando o bloco Markdown tipado: \`\`\`json ui-render
Este bloco será interceptado pelo frontend e renderizado como um componente nativo da interface.

Os tipos suportados ("type") dentro do bloco JSON são:
1. "table": Para dados comparáveis com 3+ itens e atributos repetidos. Exige "title", "columns" (string[]), "rows" (string[][]).
2. "metric_group": Para resumos numéricos e desempenho. Exige "title" e "metrics" (array com "value", "label", "trend").
3. "card_list": Para listar entidades independentes (clientes, sessões, orçamentos) que podem ter ações associadas. Exige "items" (array com "title", "subtitle", "description", "action_label", "action_id").
4. "action": Sugestão de ação isolada. Exige "label" e "action_id".
5. "confirmation": Para ações críticas. Exige "title", "warning_text", "confirm_label", "cancel_label", "action_id".
6. "alert": Para avisos, sucesso ou erro. Exige "variant" ("info"|"warning"|"success"|"error") e "message".

Regra de Densidade (quando usar o quê):
- Pouca informação ou conceito: Texto simples.
- 3 a 6 itens muito simples: Lista Markdown normal com marcadores ou números.
- 3+ itens comparáveis (ex: relatório financeiro ou de atrasos): type: "table".
- Processo ou checklist acompanhamento: Lista numerada normal.
- Resumo de métricas (ex: faturamento mensal): type: "metric_group".
- Entidades para interação (ex: resultados de busca de clientes ou sessões): type: "card_list".

NUNCA gere HTML ou tags XML diretamente. Se precisar desenhar uma UI, APENAS use o \`\`\`json ui-render e um único JSON válido dentro dele. Use \`action_id\` correspondente ao nome da tool ou entidade relevante.`;

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
  console.log("[assistant-chat] ▶ Requisição recebida");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[assistant-chat] ✗ Auth: header ausente ou malformado");
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
    console.log("[assistant-chat] ✗ Auth: JWT inválido —", claimsError?.message);
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;
  console.log("[assistant-chat] ✓ Auth OK — userId:", userId);

  // Rollout gate (Admin → Beta → Geral)
  const { assertAssistantAccess } = await import("../_shared/assistant-guard.ts");
  const denied = await assertAssistantAccess(supabase, userId, corsHeaders);
  if (denied) {
    console.log("[assistant-chat] ✗ Rollout gate: acesso negado para userId:", userId);
    return denied;
  }
  console.log("[assistant-chat] ✓ Rollout gate: acesso permitido");

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

  // --- Fetch API Configuration from Vault via service_role ---
  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [{ data: provRow, error: provErr }, { data: modRow, error: modErr }] = await Promise.all([
    supabaseService.from("app_settings").select("value").eq("key", "assistant_ai_provider").maybeSingle(),
    supabaseService.from("app_settings").select("value").eq("key", "assistant_ai_model").maybeSingle(),
  ]);
  if (provErr) console.log("[assistant-chat] ⚠ Erro ao ler provider:", provErr.message);
  if (modErr) console.log("[assistant-chat] ⚠ Erro ao ler modelo:", modErr.message);

  const providerName = typeof provRow?.value === "string" ? provRow.value : "lovable";
  const modelId = typeof modRow?.value === "string" ? modRow.value : DEFAULT_MODEL;
  console.log(`[assistant-chat] ✓ Configuração: provider='${providerName}' model='${modelId}'`);

  const { data: keyRow, error: keyErr } = await supabaseService
    .from("assistant_provider_keys")
    .select("api_key")
    .eq("provider_name", providerName)
    .maybeSingle();
  if (keyErr) console.log("[assistant-chat] ⚠ Erro ao buscar chave:", keyErr.message);

  const apiKey = keyRow?.api_key;
  console.log(`[assistant-chat] ✓ Chave no cofre: ${apiKey ? `${apiKey.length} chars, prefixo='${apiKey.slice(0, 6)}...'` : 'NÃO ENCONTRADA'}`);

  // Validação mínima de API Key
  if (providerName !== "lovable" && (!apiKey || apiKey.length < 20)) {
    const msg = `API Key inválida ou ausente no cofre para provider '${providerName}'. Verifique o Painel Admin.`;
    console.log("[assistant-chat] ✗", msg);
    return json({ error: msg }, 500);
  }

  // --- Adapt tools (client → AI SDK). Sem `execute` → cliente resolve. ---
  // IMPORTANTE: `inputSchema` precisa do helper `jsonSchema()` do AI SDK 5.
  // Um objeto cru cai no caminho Zod e quebra em `parseDef` (typeName undefined).
  const tools: Record<string, any> = {};
  for (const decl of body.tools ?? []) {
    if (!decl?.name) continue;
    const params =
      decl.parameters && typeof decl.parameters === "object"
        ? decl.parameters
        : { type: "object", properties: {} };
    tools[decl.name] = {
      description: buildToolDescription(decl),
      inputSchema: jsonSchema(params as any),
    };
  }

  // --- Provider ---
  let model;
  let gateway: any = undefined;

  if (providerName === "gemini") {
    if (!apiKey) return json({ error: "Gemini API key not configured in vault" }, 500);
    const google = createGoogleGenerativeAI({ apiKey });
    model = google(modelId);
  } else if (providerName === "deepseek") {
    if (!apiKey) return json({ error: "DeepSeek API key not configured in vault" }, 500);
    const dsProvider = createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/beta",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    model = dsProvider(modelId);
  } else if (providerName === "openai") {
    if (!apiKey) return json({ error: "OpenAI API key not configured in vault" }, 500);
    const oaProvider = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    model = oaProvider(modelId);
  } else {
    // fallback to lovable
    const lovableKey = apiKey || Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "Lovable API key not configured" }, 500);
    const initialRunId = getLovableAiGatewayRunId(req);
    gateway = createLovableAiGatewayProvider(lovableKey, initialRunId);
    model = gateway(modelId);
  }

  const systemPrompt = [DEFAULT_SYSTEM_PROMPT, body.system?.trim()].filter(Boolean).join("\n\n");

  console.log(`[assistant-chat] ✓ Iniciando streamText — ${body.messages?.length ?? 0} msgs, ${Object.keys(tools).length} tools`);
  try {
    let coreMessages = await convertToModelMessages(body.messages);

    // --- Otimização de Histórico (Sliding Window & Truncamento) ---
    // Corta sempre numa fronteira segura: nunca começa em mensagem `tool`
    // (isso separaria o tool-result do seu tool-call e invalida o histórico).
    if (coreMessages.length > 10) {
      let start = coreMessages.length - 10;
      while (start > 0 && coreMessages[start].role === "tool") start--;
      coreMessages = coreMessages.slice(start);
    }
    let toolResultCount = 0;
    for (let i = coreMessages.length - 1; i >= 0; i--) {
      const msg = coreMessages[i];
      if (msg.role === "tool" && Array.isArray(msg.content)) {
        toolResultCount++;
        if (toolResultCount > 2) {
          msg.content = msg.content.map((part: any) => {
            if (part.type === "tool-result") {
              // AI SDK 5: o payload do resultado vive em `output`, não em `result`.
              return {
                ...part,
                output: {
                  type: "json",
                  value: { _truncated: "Resultados antigos omitidos para economia de tokens" },
                },
              };
            }
            return part;
          });
        }
      }
    }

    const startedAt = Date.now();
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(8),
      // metadata útil para debug via AI Gateway logs
      providerOptions: {
        lovable: {
          metadata: { userId, page: body.page ?? null, source: "assistant-chat" },
        },
      },
      onError({ error }) {
        const m = error instanceof Error ? error.message : String(error);
        console.error("[assistant-chat] ✗ Erro no stream:", m, error instanceof Error ? error.stack : "");
        void logInvocation(supabaseService, {
          userId,
          page: body.page ?? null,
          model: modelId,
          provider: providerName,
          toolCount: Object.keys(tools).length,
          status: "error",
          error: m,
          durationMs: Date.now() - startedAt,
        });
      },
      onFinish({ finishReason, usage }) {
        console.log(
          `[assistant-chat] ✓ Turno concluído — reason=${finishReason} tokens=${usage?.totalTokens ?? "?"}`,
        );
        void logInvocation(supabaseService, {
          userId,
          page: body.page ?? null,
          model: modelId,
          provider: providerName,
          toolCount: Object.keys(tools).length,
          status: "success",
          finishReason,
          usage,
          durationMs: Date.now() - startedAt,
        });
      },
    });

    const streamResponse = result.toUIMessageStreamResponse({
      // Sem isto o AI SDK mascara tudo como "An error occurred."
      onError: (error) => {
        const m = error instanceof Error ? error.message : String(error);
        return `Falha na Lunari: ${m}`;
      },
      headers: getLovableAiGatewayResponseHeaders(undefined, {
        ...corsHeaders,
        ...(gateway ? { [LOVABLE_AIG_RUN_ID_HEADER]: gateway.getRunId?.() } : {}),
      }),
    });

    if (gateway) {
      console.log("[assistant-chat] ✓ Stream iniciado (via gateway)");
      return withLovableAiGatewayRunIdHeader(streamResponse, gateway, corsHeaders);
    }
    console.log("[assistant-chat] ✓ Stream iniciado com sucesso");
    return streamResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[assistant-chat] ✗ streamText falhou:", message, stack ?? "");
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
