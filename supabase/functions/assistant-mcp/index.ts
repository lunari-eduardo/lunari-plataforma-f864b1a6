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
      const args = (req.params?.arguments as Record<string, unknown>) ?? {};
      const started = Date.now();

      if (!auth.userId) {
        await audit({
          userId: null,
          toolName: name,
          status: "blocked_no_token",
          latencyMs: Date.now() - started,
        });
        return rpcResult(id, needsAuthResponse(name));
      }
      if (!auth.rolloutAllowed) {
        await audit({
          userId: auth.userId,
          toolName: name,
          status: "blocked_by_rollout",
          latencyMs: Date.now() - started,
        });
        return rpcResult(id, rolloutBlockedResponse());
      }
      if (!isBridged(name)) {
        await audit({
          userId: auth.userId,
          toolName: name,
          status: "bridge_unsupported",
          latencyMs: Date.now() - started,
        });
        return rpcResult(id, inAppFallback(name));
      }

      const sb = admin();
      const result = await runBridged(sb, auth.userId, name, args as any);
      await audit({
        userId: auth.userId,
        toolName: name,
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
