/**
 * assistant-mcp — Onda F.1
 *
 * Servidor MCP (Model Context Protocol) público do Lunari via Streamable HTTP.
 * Expõe o catálogo de tools da Lu (gerado por `scripts/build-mcp-catalog.ts`)
 * a clientes externos (Claude, ChatGPT, Cursor, Codex, n8n).
 *
 * Escopo v1:
 *  - `initialize` e `tools/list` públicos (descoberta).
 *  - `tools/call` responde com orientação clara: execução acontece no app
 *    autenticado (RLS + approvals humanas em UI). Um bridge de execução
 *    remota fica para uma onda futura.
 *
 * Referência: MCP Streamable HTTP
 *   https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import catalog from "./catalog.json" with { type: "json" };

const mcpHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version",
};

const SERVER_INFO = {
  name: catalog.manifest.name,
  title: catalog.manifest.title,
  version: catalog.manifest.version,
};

const PROTOCOL_VERSION = "2025-06-18";

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

function handleMethod(req: JsonRpcRequest) {
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
      return null; // notification — no response
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
      return rpcResult(id, {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Execução remota de "${name}" ainda não está habilitada neste servidor MCP.\n` +
              `As tools do Lunari rodam com a sessão autenticada do fotógrafo (RLS + aprovações humanas). ` +
              `Use a Lu dentro do app (https://lunari.app) para executar, ou aguarde a próxima onda do MCP com bridge de execução.`,
          },
        ],
      });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${req.method}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: mcpHeaders });

  // GET → info humano
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        server: SERVER_INFO,
        protocolVersion: PROTOCOL_VERSION,
        tools: catalog.tools.length,
        generatedAt: catalog.generatedAt,
        docs: "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
      }, null, 2),
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
    return new Response(
      JSON.stringify(rpcError(null, -32700, "Parse error")),
      { status: 400, headers: { ...mcpHeaders, "Content-Type": "application/json" } },
    );
  }

  // Batch ou request único
  const requests = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];
  for (const r of requests) {
    if (!r || typeof r !== "object" || (r as JsonRpcRequest).jsonrpc !== "2.0") {
      responses.push(rpcError(null, -32600, "Invalid Request"));
      continue;
    }
    const res = handleMethod(r as JsonRpcRequest);
    if (res) responses.push(res);
  }

  if (responses.length === 0) {
    // Só notifications — MCP spec pede 202 Accepted.
    return new Response(null, { status: 202, headers: mcpHeaders });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...mcpHeaders, "Content-Type": "application/json" },
  });
});
