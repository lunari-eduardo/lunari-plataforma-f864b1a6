/**
 * assistant-mcp — Onda F.2
 *
 * Servidor MCP (Model Context Protocol) público do Lunari via Streamable HTTP.
 *
 * Escopo v2 (F.2):
 *  - `initialize` e `tools/list` públicos (descoberta).
 *  - `tools/call`:
 *     * Sem PAT → resposta orientando a usar a Lu no app.
 *     * Com PAT válido (Authorization: Bearer lmcp_...) + rollout permitido +
 *       tool na whitelist read-only → executa server-side com Supabase
 *       service-role escopado ao user_id do token.
 *     * Tools de escrita / não-whitelisted → resposta "execute no app".
 *  - Toda invocação (ok, negada, com erro) grava linha em `assistant_invocations`.
 *
 * Referência: MCP Streamable HTTP
 *   https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import catalog from "./catalog.json" with { type: "json" };
import { isBridged, runBridged, getBridged, BRIDGED_TOOLS, READ_ONLY_BRIDGE } from "./executor.ts";

const mcpHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version",
};

const SERVER_INFO = {
  name: catalog.manifest.name,
  title: catalog.manifest.title,
  version: "0.2.0", // F.2
};
const PROTOCOL_VERSION = "2025-06-18";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

interface AuthContext {
  userId: string | null;
  tokenId: string | null;
  scopes: string[];
  rolloutAllowed: boolean;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const raw = req.headers.get("authorization") ?? "";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
  if (!token || !token.startsWith("lmcp_")) {
    return { userId: null, tokenId: null, scopes: [], rolloutAllowed: false };
  }
  const sb = admin();
  const { data, error } = await sb.rpc("assistant_mcp_token_validate", { _token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { userId: null, tokenId: null, scopes: [], rolloutAllowed: false };
  }
  const row = Array.isArray(data) ? data[0] : (data as any);
  const userId = row.user_id as string;
  const { data: allowed } = await sb.rpc("assistant_access_allowed", { _uid: userId });
  return {
    userId,
    tokenId: row.token_id as string,
    scopes: (row.scopes ?? []) as string[],
    rolloutAllowed: allowed === true,
  };
}

async function audit(entry: {
  userId: string | null;
  toolName: string;
  status: string;
  latencyMs: number;
  errorMessage?: string | null;
}) {
  try {
    const sb = admin();
    await sb.from("assistant_invocations").insert({
      user_id: entry.userId,
      surface: "mcp",
      tool_name: entry.toolName,
      output_status: entry.status,
      latency_ms: entry.latencyMs,
      error_message: entry.errorMessage ?? null,
    });
  } catch {
    /* auditoria best-effort */
  }
}

function inAppFallback(name: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `A tool "${name}" ainda não está habilitada para execução remota (F.2 cobre apenas leituras curadas). ` +
          `Ferramentas cobertas hoje: ${Object.keys(READ_ONLY_BRIDGE).join(", ")}. ` +
          `Use a Lu dentro do app (https://lunari.app) para executar as demais.`,
      },
    ],
  };
}

function needsAuthResponse(name: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `Autenticação necessária para executar "${name}". Gere um Personal Access Token em ` +
          `https://lunari.app/configuracoes/assistente-mcp e envie no header Authorization: Bearer lmcp_...`,
      },
    ],
  };
}

function rolloutBlockedResponse() {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `Seu acesso à Lu ainda não está liberado neste estágio de rollout. ` +
          `Peça acesso beta ao administrador.`,
      },
    ],
  };
}

async function handleMethod(req: JsonRpcRequest, auth: AuthContext) {
  const id = req.id ?? null;
  switch (req.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: catalog.manifest.instructions,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: catalog.tools.map((t: any) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      });
    case "tools/call": {
      const name = (req.params?.name as string) ?? "unknown";
      const args = ((req.params?.arguments as Record<string, unknown>) ?? {}) as Record<string, any>;
      const started = Date.now();

      if (!auth.userId) {
        await audit({ userId: null, toolName: name, status: "blocked_no_token", latencyMs: Date.now() - started });
        return rpcResult(id, needsAuthResponse(name));
      }
      if (!auth.rolloutAllowed) {
        await audit({ userId: auth.userId, toolName: name, status: "blocked_by_rollout", latencyMs: Date.now() - started });
        return rpcResult(id, rolloutBlockedResponse());
      }
      const bridged = getBridged(name);
      if (!bridged) {
        await audit({ userId: auth.userId, toolName: name, status: "bridge_unsupported", latencyMs: Date.now() - started });
        return rpcResult(id, inAppFallback(name));
      }

      // Escopo do PAT: por default `read`. Escrita exige `write` explícito.
      const hasWrite = auth.scopes.includes("write") || auth.scopes.includes("admin");
      if (bridged.scope === "write" && !hasWrite) {
        await audit({ userId: auth.userId, toolName: name, status: "scope_missing", latencyMs: Date.now() - started });
        return rpcResult(id, {
          isError: true,
          content: [{
            type: "text",
            text: `Este token não possui o escopo "write". Gere um novo token com escopo de escrita em https://lunari.app/assistente/mcp.`,
          }],
        });
      }

      const sb = admin();

      // Fluxo de aprovação assíncrona para tools destrutivas.
      if (bridged.requiresApproval) {
        const approvalToken = typeof args.approval_token === "string" ? (args.approval_token as string) : "";
        if (approvalToken) {
          // Tenta consumir aprovação existente para esta tool.
          const { data: consumed, error: consumeErr } = await sb.rpc("assistant_approval_consume", {
            _approval_token: approvalToken,
            _user_id: auth.userId,
            _tool_name: name,
          });
          if (consumeErr || !consumed || (Array.isArray(consumed) && consumed.length === 0)) {
            await audit({ userId: auth.userId, toolName: name, status: "approval_invalid", latencyMs: Date.now() - started });
            return rpcResult(id, {
              isError: true,
              content: [{ type: "text", text: "Token de aprovação inválido, já usado ou expirado. Solicite nova aprovação no app." }],
            });
          }
          const row = Array.isArray(consumed) ? consumed[0] : consumed;
          const effectiveArgs = { ...(row?.tool_args ?? {}), ...args };
          delete (effectiveArgs as any).approval_token;
          const result = await runBridged(sb, auth.userId, name, effectiveArgs);
          await audit({
            userId: auth.userId, toolName: name,
            status: result.isError ? "error" : "ok_approved",
            latencyMs: Date.now() - started,
            errorMessage: result.isError ? result.content?.[0]?.text ?? null : null,
          });
          return rpcResult(id, result);
        }

        // Sem token: cria pedido de aprovação e responde "pending".
        const summary = bridged.summarize ? bridged.summarize(args) : `Executar ${name}`;
        const { data: approvalId, error: apprErr } = await sb.rpc("assistant_approval_create", {
          _user_id: auth.userId,
          _token_id: auth.tokenId,
          _tool_name: name,
          _tool_args: args,
          _summary: summary,
        });
        if (apprErr) {
          await audit({ userId: auth.userId, toolName: name, status: "approval_create_failed", latencyMs: Date.now() - started, errorMessage: apprErr.message });
          return rpcResult(id, { isError: true, content: [{ type: "text", text: `Falha ao criar pedido de aprovação: ${apprErr.message}` }] });
        }
        await audit({ userId: auth.userId, toolName: name, status: "pending_approval", latencyMs: Date.now() - started });
        return rpcResult(id, {
          content: [{
            type: "text",
            text:
              `Esta ação exige aprovação humana. Abri um pedido no app: "${summary}". ` +
              `Peça ao fotógrafo aprovar em https://lunari.app/assistente/aprovacoes e reenvie esta chamada ` +
              `incluindo o argumento "approval_token" retornado.`,
          }],
          structuredContent: { status: "pending_approval", approval_id: approvalId, summary },
        });
      }

      // Escritas sem approval e leituras: executa direto.
      const result = await runBridged(sb, auth.userId, name, args);
      await audit({
        userId: auth.userId, toolName: name,
        status: result.isError ? "error" : "ok",
        latencyMs: Date.now() - started,
        errorMessage: result.isError ? result.content?.[0]?.text ?? null : null,
      });
      return rpcResult(id, result);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${req.method}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: mcpHeaders });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify(
        {
          server: SERVER_INFO,
          protocolVersion: PROTOCOL_VERSION,
          tools: catalog.tools.length,
          bridgedTools: Object.keys(READ_ONLY_BRIDGE),
          generatedAt: catalog.generatedAt,
          auth: {
            type: "bearer",
            header: "Authorization: Bearer lmcp_...",
            issue: "https://lunari.app/configuracoes/assistente-mcp",
          },
          docs: "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
        },
        null,
        2,
      ),
      { headers: { ...mcpHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: mcpHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { ...mcpHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await resolveAuth(req);
  const requests = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];
  for (const r of requests) {
    if (!r || typeof r !== "object" || (r as JsonRpcRequest).jsonrpc !== "2.0") {
      responses.push(rpcError(null, -32600, "Invalid Request"));
      continue;
    }
    const res = await handleMethod(r as JsonRpcRequest, auth);
    if (res) responses.push(res);
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: mcpHeaders });

  const payload = Array.isArray(body) ? responses : responses[0];
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...mcpHeaders, "Content-Type": "application/json" },
  });
});
