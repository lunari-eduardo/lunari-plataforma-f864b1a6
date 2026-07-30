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
import { isBridged, runBridged, getBridged, BRIDGED_TOOLS, READ_ONLY_BRIDGE, BRIDGE_SCHEMAS } from "./executor.ts";
import { normalizeScopes, tierOf, tierSatisfiedBy, TIER_LABEL, type ScopeTier } from "../_shared/mcp-scopes.ts";
import { EXPOSED_TOOLS, META_TOOL_DEFS, META_SEARCH, META_INVOKE, isExposed } from "./exposed.ts";
import { toPublicName, publicInputSchema } from "./compat.ts";

import {
  dispatchCapability,
  type CatalogTool,
  type DispatchResult,
} from "../_shared/capability-dispatch.ts";


/** A2 — índice do catálogo por nome de tool (transport declarado na capability). */
const CATALOG_BY_NAME: Map<string, CatalogTool> = new Map(
  ((catalog as any).tools ?? []).map((t: CatalogTool) => [t.name, t]),
);

/**
 * Alias público → nome interno. Conectores só aceitam `[a-zA-Z0-9_-]`, então
 * `tools/list` publica `lunari_workflow_listMonth` e `tools/call` traduz de
 * volta. Nomes internos com ponto continuam aceitos (retrocompatibilidade
 * com PATs e clientes já configurados).
 */
const PUBLIC_TO_INTERNAL: Map<string, string> = new Map(
  [...CATALOG_BY_NAME.keys(), META_SEARCH, META_INVOKE].map((n) => [toPublicName(n), n]),
);
function resolveToolName(name: string): string {
  if (CATALOG_BY_NAME.has(name) || name === META_SEARCH || name === META_INVOKE) return name;
  return PUBLIC_TO_INTERNAL.get(name) ?? name;
}


/** A3 — idade do catálogo em dias; congelamento vira sinal observável. */
const CATALOG_STALE_DAYS = 30;
function catalogAgeDays(): number {
  const t = Date.parse((catalog as any).generatedAt ?? "");
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
}
if (catalogAgeDays() > CATALOG_STALE_DAYS) {
  console.warn(
    `[assistant-mcp] catálogo gerado há ${Math.round(catalogAgeDays())} dias — ` +
      "o pipeline de regeneração pode ter parado (bun run mcp:catalog).",
  );
}

/** Só despacha genericamente quando há transporte declarado E JWT do usuário (RLS real). */
function dispatchableTool(name: string, auth: AuthContext): CatalogTool | null {
  if (!auth.userJwt) return null; // PAT não carrega JWT → cai no bridge legado
  const tool = CATALOG_BY_NAME.get(name);
  if (!tool?.transport?.name) return null;
  return tool;
}

function dispatchToMcpResult(tool: CatalogTool, r: DispatchResult) {
  if (r.ok) {
    const structured =
      r.value && typeof r.value === "object" && !Array.isArray(r.value)
        ? (r.value as Record<string, unknown>)
        : { value: r.value };
    return { content: [{ type: "text", text: r.summary }], structuredContent: structured };
  }
  return { isError: true, content: [{ type: "text", text: r.message }] };
}

const mcpHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version, accept",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, www-authenticate",
};


const SERVER_INFO = {
  name: catalog.manifest.name,
  title: catalog.manifest.title,
  version: "0.13.0", // execução remota real: bridge server-side de agenda, tarefas, clientes, workflow e financeiro
};
const PROTOCOL_VERSION = "2025-06-18";
/** Versões que aceitamos negociar no handshake (ChatGPT ainda usa 2025-03-26). */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

/**
 * Forense: fingerprint irreversível. Permite comparar se o MESMO valor
 * (state, code_challenge, token) atravessou o fluxo, sem jamais logar o segredo.
 */
async function fingerprint(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf).slice(0, 6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Log estruturado único do fluxo — sempre com flow_id para correlação. */
function flog(flowId: string, stage: string, data: Record<string, unknown>) {
  console.log(`[mcp:${stage}]`, JSON.stringify({ flow_id: flowId, ...data }));
}

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
  authSource: "pat" | "oauth" | null;
  clientId: string | null;
  /** A2 — JWT cru do usuário (só no caminho OAuth); habilita dispatch com RLS. */
  userJwt: string | null;
}

const EMPTY_AUTH: AuthContext = {
  userId: null,
  tokenId: null,
  scopes: [],
  rolloutAllowed: false,
  authSource: null,
  clientId: null,
  userJwt: null,
};


function decodeJwtPayload(jwt: string): Record<string, any> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    // atob no Deno resolve base64url com padding manual
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const raw = req.headers.get("authorization") ?? "";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
  if (!token) return EMPTY_AUTH;

  const sb = admin();

  // === Caminho 1: Personal Access Token (PAT) ===
  if (token.startsWith("lmcp_")) {
    const { data, error } = await sb.rpc("assistant_mcp_token_validate", { _token: token });
    if (error || !data || (Array.isArray(data) && data.length === 0)) return EMPTY_AUTH;
    const row = Array.isArray(data) ? data[0] : (data as any);
    const userId = row.user_id as string;
    const { data: allowed } = await sb.rpc("assistant_access_allowed", { _uid: userId });
    return {
      userId,
      tokenId: row.token_id as string,
      scopes: normalizeScopes(row.scopes as unknown[]),
      rolloutAllowed: allowed === true,
      authSource: "pat",
      clientId: null,
      userJwt: null,
    };
  }

  // === Caminho 2: JWT do Supabase OAuth Server ===
  // Aceitamos apenas JWTs que carreguem claim `client_id` — bloqueia tokens de
  // sessão vindos de signInWithPassword sendo colados como Bearer.
  if (token.startsWith("eyJ")) {
    const claims = decodeJwtPayload(token);
    if (!claims) return EMPTY_AUTH;
    const clientId = (claims.client_id as string | undefined) ?? (claims.azp as string | undefined) ?? null;
    if (!clientId) return EMPTY_AUTH;

    // Verifica assinatura consultando o Auth via SDK.
    const { data: userRes, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return EMPTY_AUTH;
    const userId = userRes.user.id;

    // A4 — o Supabase OAuth Server não emite scopes customizados, então o
    // nível de permissão vem do grant que o usuário concedeu a este cliente
    // (tabela assistant_mcp_client_grants). Default fail-closed: leitura.
    const { data: granted } = await sb.rpc("assistant_mcp_grant_resolve", {
      _user_id: userId,
      _client_id: clientId,
      _client_name: (claims.client_name as string | undefined) ?? null,
    });
    const scopes: ScopeTier[] = normalizeScopes(granted as unknown[]);

    const { data: allowed } = await sb.rpc("assistant_access_allowed", { _uid: userId });
    return {
      userId,
      tokenId: null,
      scopes,
      rolloutAllowed: allowed === true,
      authSource: "oauth",
      clientId,
      userJwt: token,
    };
  }

  return EMPTY_AUTH;
}

/**
 * A5 — auditoria completa. Antes desta onda o insert usava colunas inexistentes
 * (`surface`, `tool_name`) e omitia colunas obrigatórias, então TODA chamada MCP
 * ficava sem registro (0 linhas na tabela). Agora o contrato é completo e a
 * falha de auditoria vira log de erro visível — nunca mais silêncio.
 */
interface AuditEntry {
  userId: string | null;
  toolName: string;
  status: string;
  latencyMs: number;
  errorMessage?: string | null;
  authSource?: "pat" | "oauth" | null;
  clientId?: string | null;
  requiredTier?: string | null;
  grantedTiers?: string[] | null;
  requestId?: string | null;
  approvalId?: string | null;
  needsApproval?: boolean;
  approvedBy?: string | null;
}

async function audit(entry: AuditEntry) {
  const tool = CATALOG_BY_NAME.get(entry.toolName);
  const capabilityId = tool?.capabilityId ?? entry.toolName;
  const moduleName = capabilityId.includes(".") ? capabilityId.split(".")[0] : "mcp";
  const kind = tool?.kind ?? (tool?.scope === "read" ? "query" : "command");
  try {
    const sb = admin();
    const { error } = await sb.from("assistant_invocations").insert({
      user_id: entry.userId,
      capability_id: capabilityId,
      module: moduleName,
      kind,
      actor: "assistant",
      surface: "mcp",
      tool_name: entry.toolName,
      output_status: entry.status,
      latency_ms: entry.latencyMs,
      error_message: entry.errorMessage ?? null,
      auth_source: entry.authSource ?? null,
      client_id: entry.clientId ?? null,
      required_tier: entry.requiredTier ?? null,
      granted_tiers: entry.grantedTiers ?? null,
      request_id: entry.requestId ?? null,
      approval_id: entry.approvalId ?? null,
      needs_approval: entry.needsApproval ?? false,
      approved_by: entry.approvedBy ?? null,
      approved_at: entry.approvedBy ? new Date().toISOString() : null,
    });
    if (error) console.error("[assistant-mcp] auditoria falhou:", error.message, entry.status, entry.toolName);
  } catch (err) {
    console.error("[assistant-mcp] auditoria exception:", String(err));
  }
}

function inAppFallback(name: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `A tool "${name}" ainda não roda remotamente. ` +
          `Use lunari_tools_search para achar uma equivalente executável ` +
          `(${Object.keys(BRIDGED_TOOLS).length} disponíveis hoje: agenda, tarefas, clientes, workflow e financeiro) ` +
          `ou execute essa ação na Lu dentro do app (https://app.lunarihub.com).`,
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
          `Autenticação necessária para executar "${name}". ` +
          `Recomendado: conecte via OAuth ("Sign in with Lunari") — clientes como ChatGPT/Claude descobrem o fluxo ` +
          `automaticamente pelo endpoint MCP. Alternativa avançada: gere um Personal Access Token em ` +
          `https://app.lunarihub.com/app/assistente/mcp e envie no header Authorization: Bearer lmcp_...`,
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
    case "initialize": {
      // Negocia a versão pedida pelo cliente quando suportada. Responder sempre
      // 2025-06-18 a um cliente que pediu 2025-03-26 derruba a conexão em alguns
      // conectores logo após o OAuth.
      const asked = (req.params?.protocolVersion as string | undefined) ?? "";
      const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: catalog.manifest.instructions,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/roots/list_changed":
      return null;
    // Métodos opcionais que alguns clientes chamam no handshake. Responder
    // "Method not found" a estes derruba a conexão — devolvemos listas vazias.
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    case "logging/setLevel":
      return rpcResult(id, {});
    case "ping":
      return rpcResult(id, {});
    case "tools/list": {
      // Superfície curada + meta-tools (o catálogo completo continua acessível
      // via lunari.tools.search / lunari.tools.invoke).
      // Nomes públicos sem ponto e schemas achatados — exigência dos conectores.
      const exposed = catalog.tools
        .filter((t: any) => isExposed(t.name))
        .map((t: any) => ({
          name: toPublicName(t.name),
          title: t.title,
          description: t.description,
          inputSchema: publicInputSchema(BRIDGE_SCHEMAS[t.name] ?? t.inputSchema),
          annotations: t.annotations,
        }));

      const metas = META_TOOL_DEFS.map((t) => ({
        ...t,
        name: toPublicName(t.name),
        inputSchema: publicInputSchema(t.inputSchema),
      }));
      return rpcResult(id, { tools: [...exposed, ...metas] });
    }
    // Alguns clientes (incl. ChatGPT) chamam `server/discover` no handshake.
    // Responder "Method not found" derruba a conexão logo após o OAuth.
    case "server/discover":
    case "server/info":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: { listChanged: false } },
        instructions: catalog.manifest.instructions,
      });

    case "tools/call": {
      let name = resolveToolName((req.params?.name as string) ?? "unknown");
      let args = ((req.params?.arguments as Record<string, unknown>) ?? {}) as Record<string, any>;


      // Meta-tool de busca no catálogo completo (read-only, sem efeitos).
      if (name === META_SEARCH) {
        const q = String(args.query ?? "").toLowerCase().trim();
        const limit = Math.min(Number(args.limit ?? 20) || 20, 50);
        const hits = (catalog.tools as any[])
          .filter((t) =>
            !q ||
            t.name.toLowerCase().includes(q) ||
            String(t.title ?? "").toLowerCase().includes(q) ||
            String(t.description ?? "").toLowerCase().includes(q)
          )
          .slice(0, limit)
          .map((t) => ({
            name: toPublicName(t.name),
            internalName: t.name,
            title: t.title,
            description: t.description,
            scopeTier: t.scopeTier ?? null,
            needsApproval: t.needsApproval ?? null,
            inputSchema: publicInputSchema(t.inputSchema),
          }));

        return rpcResult(id, {
          content: [{
            type: "text",
            text: hits.length
              ? `${hits.length} ferramenta(s) encontrada(s). Execute com lunari.tools.invoke.\n` +
                hits.map((h) => `- ${h.name}: ${h.title}`).join("\n")
              : "Nenhuma ferramenta encontrada para esse termo.",
          }],
          structuredContent: { tools: hits, total: catalog.tools.length },
        });
      }

      // Meta-tool de execução: reescreve para a tool real e segue o fluxo normal
      // (escopos, rollout, aprovação e auditoria idênticos).
      if (name === META_INVOKE) {
        const target = resolveToolName(String(args.name ?? "").trim());
        if (!target) {
          return rpcResult(id, {
            isError: true,
            content: [{ type: "text", text: 'Informe "name" com o nome exato da ferramenta (use lunari.tools.search).' }],
          });
        }
        const inner = (args.arguments && typeof args.arguments === "object" ? args.arguments : {}) as Record<string, any>;
        if (typeof args.approval_token === "string") inner.approval_token = args.approval_token;
        name = target;
        args = inner;
      }

      const started = Date.now();
      const requestId = crypto.randomUUID();

      // Contexto comum de auditoria (A5): toda saída deste bloco grava uma linha.
      const actx = {
        authSource: auth.authSource,
        clientId: auth.clientId,
        grantedTiers: auth.scopes,
        requestId,
      };

      if (!auth.userId) {
        await audit({ ...actx, userId: null, toolName: name, status: "blocked_no_token", latencyMs: Date.now() - started });
        // Sinaliza pro dispatcher HTTP retornar 401 + WWW-Authenticate.
        (auth as any).__challenge = true;
        return rpcResult(id, needsAuthResponse(name));
      }
      if (!auth.rolloutAllowed) {
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "blocked_by_rollout", latencyMs: Date.now() - started });
        return rpcResult(id, rolloutBlockedResponse());
      }
      // A2 — contrato único: se a capability declarou transporte (rpc/edge) e
      // temos JWT do usuário, executamos pelo dispatcher genérico (RLS real).
      // Caso contrário, caímos no bridge legado escrito à mão (caminho PAT).
      const dispatchTool = dispatchableTool(name, auth);
      const bridged = getBridged(name);
      if (!dispatchTool && !bridged) {
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "bridge_unsupported", latencyMs: Date.now() - started });
        return rpcResult(id, inAppFallback(name));
      }

      // A5 fail-closed: sem classificação declarada, tratamos como destrutiva.
      const requiresApproval =
        bridged?.requiresApproval ??
        dispatchTool?.needsApproval ??
        (dispatchTool?.scopeTier === "destructive" ? true : dispatchTool ? false : true);
      const toolScope: "read" | "write" =
        bridged?.scope ?? (dispatchTool?.scope ?? (dispatchTool?.kind === "query" ? "read" : "write"));

      // A4 — nível exigido: read (query) / write (command) / destructive (command + aprovação).
      const requiredTier: ScopeTier =
        (dispatchTool?.scopeTier as ScopeTier | undefined) ??
        tierOf({ kind: toolScope === "read" ? "query" : "command", needsApproval: requiresApproval });

      if (!tierSatisfiedBy(requiredTier, auth.scopes)) {
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "scope_missing", latencyMs: Date.now() - started, requiredTier });
        const how = auth.authSource === "oauth"
          ? `Abra https://app.lunarihub.com/app/assistente/mcp → "Aplicativos conectados" e libere "${TIER_LABEL[requiredTier]}" para este aplicativo. Depois repita o comando.`
          : `Gere um novo Personal Access Token com o nível "${TIER_LABEL[requiredTier]}" em https://app.lunarihub.com/app/assistente/mcp.`;
        return rpcResult(id, {
          isError: true,
          content: [{
            type: "text",
            text: `Permissão insuficiente para "${name}": requer ${TIER_LABEL[requiredTier]} (atual: ${auth.scopes.map((s) => TIER_LABEL[s as ScopeTier] ?? s).join(", ")}). ${how}`,
          }],
        });
      }

      const sb = admin();

      const execute = async (effectiveArgs: Record<string, any>) => {
        if (dispatchTool) {
          const r = await dispatchCapability({
            tool: dispatchTool,
            input: effectiveArgs,
            userJwt: auth.userJwt,
            scopes: auth.scopes,
          });
          if (!r.ok && r.auditDetail) {
            console.error("[mcp-dispatch]", JSON.stringify({ tool: name, code: r.code, detail: r.auditDetail }));
          }
          return dispatchToMcpResult(dispatchTool, r) as any;
        }
        return await runBridged(sb, auth.userId!, name, effectiveArgs);
      };


      // Fluxo de aprovação assíncrona para tools destrutivas.
      if (requiresApproval) {
        const approvalToken = typeof args.approval_token === "string" ? (args.approval_token as string) : "";
        if (approvalToken) {
          // Tenta consumir aprovação existente para esta tool.
          const { data: consumed, error: consumeErr } = await sb.rpc("assistant_approval_consume", {
            _approval_token: approvalToken,
            _user_id: auth.userId,
            _tool_name: name,
          });
          if (consumeErr || !consumed || (Array.isArray(consumed) && consumed.length === 0)) {
            await audit({ ...actx, userId: auth.userId, toolName: name, status: "approval_invalid", latencyMs: Date.now() - started, requiredTier, needsApproval: true });
            return rpcResult(id, {
              isError: true,
              content: [{ type: "text", text: "Token de aprovação inválido, já usado ou expirado. Solicite nova aprovação no app." }],
            });
          }
          const row = Array.isArray(consumed) ? consumed[0] : consumed;
          const effectiveArgs = { ...(row?.tool_args ?? {}), ...args };
          delete (effectiveArgs as any).approval_token;
          const result = await execute(effectiveArgs);
          await audit({
            ...actx,
            userId: auth.userId, toolName: name,
            status: result.isError ? "error" : "ok_approved",
            latencyMs: Date.now() - started,
            errorMessage: result.isError ? result.content?.[0]?.text ?? null : null,
            requiredTier,
            needsApproval: true,
            approvalId: (row?.approval_id as string) ?? null,
            approvedBy: auth.userId,
          });
          return rpcResult(id, result);
        }

        // Sem token: cria pedido de aprovação e responde "pending".
        const summary = bridged?.summarize ? bridged.summarize(args) : `Executar ${name}: ${dispatchTool?.title ?? name}`;
        const { data: approvalId, error: apprErr } = await sb.rpc("assistant_approval_create", {
          _user_id: auth.userId,
          _token_id: auth.tokenId,
          _tool_name: name,
          _tool_args: args,
          _summary: summary,
        });
        if (apprErr) {
          await audit({ ...actx, userId: auth.userId, toolName: name, status: "approval_create_failed", latencyMs: Date.now() - started, errorMessage: apprErr.message, requiredTier, needsApproval: true });
          return rpcResult(id, { isError: true, content: [{ type: "text", text: `Falha ao criar pedido de aprovação: ${apprErr.message}` }] });
        }
        if (approvalId) {
          // Marca a origem do pedido (aplicativo OAuth ou PAT) para a fila do app.
          await sb.from("assistant_approvals")
            .update({ surface: "mcp", client_id: auth.clientId })
            .eq("id", approvalId as string);
        }
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "pending_approval", latencyMs: Date.now() - started, requiredTier, needsApproval: true, approvalId: (approvalId as string) ?? null });
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
      const result = await execute(args);
      await audit({
        ...actx,
        userId: auth.userId, toolName: name,
        status: result.isError ? "error" : "ok",
        latencyMs: Date.now() - started,
        errorMessage: result.isError ? result.content?.[0]?.text ?? null : null,
        requiredTier,
      });
      return rpcResult(id, result);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${req.method}`);
  }
}

// Endpoint público do próprio MCP (usado como `resource` no discovery OAuth 2.1).
const MCP_RESOURCE_URL = `${SUPABASE_URL}/functions/v1/assistant-mcp`;
// Supabase Auth serve o Authorization Server metadata em /auth/v1/.well-known/...
const OAUTH_AS_ISSUER = `${SUPABASE_URL}/auth/v1`;
// Proxy do /authorize hospedado nesta função. Higieniza `scope` para bloquear
// clientes (ex.: ChatGPT) que cachearam scopes antigos ("read"/"write") e continuam
// enviando-os apesar do metadata atual não anunciá-los. RFC 6749 §3.3 permite ao
// AS ignorar scopes desconhecidos; fazemos isso aqui antes de encaminhar ao Supabase.
const AUTHORIZE_PROXY_URL = `${MCP_RESOURCE_URL}/oauth/authorize`;
const SUPABASE_SUPPORTED_SCOPES = new Set(["openid", "profile", "email", "phone", "offline_access"]);
const WWW_AUTH_HEADER =
  `Bearer realm="Lunari MCP", ` +
  `resource_metadata="${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource", ` +
  `authorization_uri="${OAUTH_AS_ISSUER}"`;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: { ...mcpHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  const flowId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: mcpHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const httpStarted = Date.now();

  // Entrada HTTP — nunca loga corpo, token ou segredo; só forma e tamanho.
  flog(flowId, "http-in", {
    method: req.method,
    path,
    content_type: req.headers.get("content-type"),
    accept: req.headers.get("accept"),
    protocol_version: req.headers.get("mcp-protocol-version"),
    has_session: !!req.headers.get("mcp-session-id"),
    has_authorization: (req.headers.get("authorization") ?? "").length > 0,
    content_length: req.headers.get("content-length"),
    user_agent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
  });

  // === Proxy /oauth/authorize com scope sanitization ===
  // Corrige clientes MCP que cachearam scopes antigos (read/write) e não conseguem
  // completar OAuth porque o Supabase rejeita com "unsupported scope".
  if (req.method === "GET" && path.endsWith("/oauth/authorize")) {
    const incoming = new URLSearchParams(url.search);
    const rawScope = incoming.get("scope") ?? "";
    const requested = rawScope.split(/\s+/).filter(Boolean);
    const kept = requested.filter((s) => SUPABASE_SUPPORTED_SCOPES.has(s));
    const dropped = requested.filter((s) => !SUPABASE_SUPPORTED_SCOPES.has(s));
    // Garante openid — necessário para emissão de id_token no OIDC flow.
    if (kept.length === 0 || !kept.includes("openid")) kept.unshift("openid");
    flog(flowId, "oauth-authorize", {
      client_id: incoming.get("client_id"),
      redirect_uri: incoming.get("redirect_uri"),
      response_type: incoming.get("response_type"),
      // `state` nunca em texto puro: fingerprint permite comparar preservação.
      state_fp: await fingerprint(incoming.get("state")),
      state_len: (incoming.get("state") ?? "").length,
      code_challenge_method: incoming.get("code_challenge_method"),
      code_challenge_fp: await fingerprint(incoming.get("code_challenge")),
      resource: incoming.get("resource"),
      scope_in: rawScope,
      scope_out: kept.join(" "),
      dropped_scopes: dropped,
    });
    incoming.set("scope", Array.from(new Set(kept)).join(" "));
    const target = `${OAUTH_AS_ISSUER}/oauth/authorize?${incoming.toString()}`;
    flog(flowId, "oauth-authorize-redirect", { status: 302, latency_ms: Date.now() - httpStarted });
    return new Response(null, {
      status: 302,
      headers: { ...mcpHeaders, Location: target },
    });
  }

  // === RFC 9728 — Protected Resource Metadata ===
  // ChatGPT/Claude leem esse documento pra descobrir sozinhos o Authorization Server.
  // Anunciamos o próprio MCP como authorization server (RFC 8414 issuer) para que
  // o cliente leia o NOSSO metadata — que aponta o `authorization_endpoint` ao proxy
  // sanitizador. O issuer do Supabase segue anunciado como alternativa.
  if (req.method === "GET" && path.endsWith("/.well-known/oauth-protected-resource")) {
    flog(flowId, "discovery", { doc: "protected-resource", status: 200, latency_ms: Date.now() - httpStarted });
    return jsonResponse({
      resource: MCP_RESOURCE_URL,
      authorization_servers: [MCP_RESOURCE_URL, OAUTH_AS_ISSUER],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "email", "profile"],
      resource_documentation:
        "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
    });
  }


  // === RFC 8414 — Authorization Server Metadata ===
  // Servimos versão modificada do doc do Supabase apontando `authorization_endpoint`
  // para nosso proxy sanitizador. Assim scopes desconhecidos são descartados antes
  // de chegarem ao Supabase.
  if (req.method === "GET" && path.endsWith("/.well-known/oauth-authorization-server")) {
    const base = {
      // Este documento é servido a partir de MCP_RESOURCE_URL, então o issuer
      // precisa ser esta mesma origem/path para o cliente considerá-lo coerente
      // (RFC 8414 §3.3). Endpoints de token/registro seguem no Supabase.
      issuer: MCP_RESOURCE_URL,
      authorization_endpoint: AUTHORIZE_PROXY_URL,
      token_endpoint: `${OAUTH_AS_ISSUER}/oauth/token`,
      registration_endpoint: `${OAUTH_AS_ISSUER}/oauth/clients/register`,
      jwks_uri: `${OAUTH_AS_ISSUER}/.well-known/jwks.json`,
      userinfo_endpoint: `${OAUTH_AS_ISSUER}/oauth/userinfo`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      scopes_supported: ["openid", "email", "profile"],
    };
    try {
      const upstream = await fetch(`${OAUTH_AS_ISSUER}/.well-known/oauth-authorization-server`);
      const meta = await upstream.json();
      const merged = { ...meta, ...base };
      flog(flowId, "discovery", { doc: "authorization-server", upstream: upstream.status, status: 200, latency_ms: Date.now() - httpStarted });
      return jsonResponse(merged);
    } catch (err) {
      flog(flowId, "discovery", { doc: "authorization-server", upstream: "fetch_failed", error: String(err), status: 200 });
      return jsonResponse(base);
    }
  }

  if (req.method === "GET") {
    const accept = (req.headers.get("accept") ?? "").toLowerCase();
    // Spec Streamable HTTP: no GET, ou abrimos um stream SSE, ou respondemos 405.
    // Antes devolvíamos JSON 200 aqui, o que travava clientes (ChatGPT) que abrem
    // o canal de eventos logo após o OAuth.
    if (accept.includes("text/event-stream")) {
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(": lunari-mcp ready\n\n"));
          const iv = setInterval(() => {
            try { controller.enqueue(enc.encode(": ping\n\n")); } catch { clearInterval(iv); }
          }, 25_000);
          (req.signal as AbortSignal | undefined)?.addEventListener("abort", () => {
            clearInterval(iv);
            try { controller.close(); } catch { /* já fechado */ }
          });
        },
      });
      return new Response(stream, {
        headers: {
          ...mcpHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
    if (!accept.includes("application/json") && accept !== "" && !accept.includes("*/*")) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...mcpHeaders, Allow: "POST, GET, OPTIONS" },
      });
    }
    const bridged = Object.entries(BRIDGED_TOOLS).map(([name, t]) => ({
      name, scope: t.scope, requiresApproval: t.requiresApproval,
    }));
    return jsonResponse({
      server: SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      tools: catalog.tools.length,
      exposedTools: EXPOSED_TOOLS.length + META_TOOL_DEFS.length,
      bridgedTools: bridged,
      generatedAt: catalog.generatedAt,
      auth: {
        oauth2: {
          issuer: OAUTH_AS_ISSUER,
          protectedResourceMetadata: `${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource`,
          authorizationServerMetadata: `${OAUTH_AS_ISSUER}/.well-known/oauth-authorization-server`,
          note: "Clientes MCP (ChatGPT, Claude) descobrem o fluxo automaticamente.",
        },
        pat: {
          type: "bearer",
          header: "Authorization: Bearer lmcp_...",
          scopes: ["read", "write"],
          issue: "https://app.lunarihub.com/app/assistente/mcp",
        },
        approvalsUrl: "https://app.lunarihub.com/app/assistente/aprovacoes",
      },
      docs: "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
    });
  }

  if (req.method === "DELETE") {
    // Encerramento de sessão (spec): nada a limpar — servidor é stateless.
    return new Response(null, { status: 204, headers: mcpHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...mcpHeaders, Allow: "POST, GET, OPTIONS" },
    });
  }


  // Leitura tolerante do corpo. Antes, qualquer POST fora do formato virava 400
  // "Parse error" SEM registro de forma/tamanho — exatamente o 400 silencioso que
  // derrubava o handshake do ChatGPT sem deixar rastro.
  const rawBody = await req.text();
  const trimmed = rawBody.trim();

  // Corpo vazio (keep-alive / probe de alguns conectores): 202, não erro.
  if (trimmed.length === 0) {
    flog(flowId, "post-empty", { status: 202, bytes: 0, latency_ms: Date.now() - httpStarted });
    return new Response(null, {
      status: 202,
      headers: { ...mcpHeaders, "Mcp-Session-Id": req.headers.get("mcp-session-id") ?? crypto.randomUUID() },
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch (err) {
    flog(flowId, "post-parse-error", {
      status: 400,
      bytes: rawBody.length,
      content_type: req.headers.get("content-type"),
      // Prefixo curto e sem segredo: suficiente para identificar form-encoded, XML, etc.
      shape: trimmed.slice(0, 24),
      error: String(err),
    });
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { ...mcpHeaders, "Content-Type": "application/json" },
    });
  }


  const startedAt = Date.now();
  const auth = await resolveAuth(req);

  // Se veio Authorization: Bearer inválido, sinaliza fluxo OAuth (RFC 9728).
  const rawAuth = req.headers.get("authorization") ?? "";
  const hasAuthHeader = rawAuth.toLowerCase().startsWith("bearer ");
  const bearer = hasAuthHeader ? rawAuth.slice(7).trim() : "";
  if (hasAuthHeader) {
    const claims = bearer.startsWith("eyJ") ? decodeJwtPayload(bearer) : null;
    flog(flowId, "auth", {
      token_kind: bearer.startsWith("lmcp_") ? "pat" : bearer.startsWith("eyJ") ? "jwt" : "unknown",
      token_fp: await fingerprint(bearer),
      iss: claims?.iss ?? null,
      aud: claims?.aud ?? null,
      has_client_id: !!(claims?.client_id ?? claims?.azp),
      exp: claims?.exp ?? null,
      expired: typeof claims?.exp === "number" ? claims.exp * 1000 < Date.now() : null,
      accepted: !!auth.userId,
      auth_source: auth.authSource,
      rollout_allowed: auth.rolloutAllowed,
      scopes: auth.scopes,
    });
  }
  const responseHeaders: Record<string, string> = { ...mcpHeaders, "Content-Type": "application/json" };
  if (hasAuthHeader && !auth.userId) {
    responseHeaders["WWW-Authenticate"] = WWW_AUTH_HEADER;
  }
  // Sessão: ecoa a do cliente ou emite uma nova no initialize.
  const incomingSession = req.headers.get("mcp-session-id");
  const sessionId = incomingSession ?? crypto.randomUUID();
  responseHeaders["Mcp-Session-Id"] = sessionId;
  const protoHeader = req.headers.get("mcp-protocol-version");
  if (protoHeader) responseHeaders["Mcp-Protocol-Version"] = protoHeader;

  const requests = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];
  for (const r of requests) {
    if (!r || typeof r !== "object" || (r as JsonRpcRequest).jsonrpc !== "2.0") {
      flog(flowId, "invalid-request", {
        reason: !r || typeof r !== "object" ? "not_object" : "missing_jsonrpc_2_0",
        keys: r && typeof r === "object" ? Object.keys(r as object).slice(0, 8) : [],
      });
      responses.push(rpcError(null, -32600, "Invalid Request"));
      continue;
    }
    const rpc = r as JsonRpcRequest;
    const mStarted = Date.now();
    const res = await handleMethod(rpc, auth);
    flog(flowId, "rpc", {
      method: rpc.method,
      is_notification: rpc.id === undefined || rpc.id === null,
      responded: !!res,
      latency_ms: Date.now() - mStarted,
    });
    if (res) responses.push(res);
  }

  // Se o handler sinalizou desafio de auth (tools/call sem token), garante WWW-Authenticate.
  if ((auth as any).__challenge) {
    responseHeaders["WWW-Authenticate"] = WWW_AUTH_HEADER;
  }

  const logHandshake = (status: number, bytes: number) =>
    flog(flowId, "http-out", {
      methods: requests.map((r: any) => r?.method).filter(Boolean),
      status,
      bytes,
      session_id: sessionId,
      auth_source: auth.authSource,
      client_id: auth.clientId,
      has_user: !!auth.userId,
      challenge: !!responseHeaders["WWW-Authenticate"],
      rpc_latency_ms: Date.now() - startedAt,
      total_latency_ms: Date.now() - httpStarted,
    });


  if (responses.length === 0) {
    logHandshake(202, 0);
    return new Response(null, { status: 202, headers: { ...mcpHeaders, "Mcp-Session-Id": sessionId } });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  const serialized = JSON.stringify(payload);
  logHandshake(200, serialized.length);
  // Mantém 200 (JSON-RPC body carrega o erro); WWW-Authenticate no header já dispara o fluxo OAuth
  // em clientes MCP compatíveis com a spec 2025-06-18.
  return new Response(serialized, {
    status: 200,

    headers: responseHeaders,
  });
});
