// deno-lint-ignore-file no-explicit-any
import catalog from "./catalog.json" with { type: "json" };
import { isBridged, runBridged, getBridged, BRIDGE_SCHEMAS } from "./executor.ts";
import { tierOf, tierSatisfiedBy, TIER_LABEL, type ScopeTier } from "../_shared/mcp-scopes.ts";
import { EXPOSED_TOOLS, META_TOOL_DEFS, META_SEARCH, META_DESCRIBE, META_INVOKE, isExposed } from "./exposed.ts";
import { toPublicName, publicInputSchema } from "./compat.ts";
import { dispatchCapability, type CatalogTool, type DispatchResult } from "../_shared/capability-dispatch.ts";
import {
  admin,
  audit,
  inAppFallback,
  needsAuthResponse,
  rolloutBlockedResponse,
  type AuthContext,
} from "./mcpAuth.ts";
import { handleMetaSearch, handleMetaDescribe, trimDescription } from "./mcpMetaTools.ts";

export type JsonRpcId = string | number | null;
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: { code, message, data } };
}

export function dispatchableTool(name: string, auth: AuthContext, catalogByName: Map<string, CatalogTool>): CatalogTool | null {
  if (!auth.userJwt) return null;
  const tool = catalogByName.get(name);
  if (!tool?.transport?.name) return null;
  return tool;
}

export function dispatchToMcpResult(tool: CatalogTool, r: DispatchResult) {
  if (r.ok) {
    const structured =
      r.value && typeof r.value === "object" && !Array.isArray(r.value)
        ? (r.value as Record<string, unknown>)
        : { value: r.value };
    return { content: [{ type: "text", text: r.summary }], structuredContent: structured };
  }
  return { isError: true, content: [{ type: "text", text: r.message }] };
}

export interface HandleMethodOptions {
  serverInfo: unknown;
  instructions: string;
  protocolVersion: string;
  supportedProtocolVersions: string[];
  catalogByName: Map<string, CatalogTool>;
  resolveToolName: (name: string) => string;
}

export async function handleMethod(
  req: JsonRpcRequest,
  auth: AuthContext,
  opts: HandleMethodOptions,
) {
  const id = req.id ?? null;
  switch (req.method) {
    case "initialize": {
      const asked = (req.params?.protocolVersion as string | undefined) ?? "";
      const negotiated = opts.supportedProtocolVersions.includes(asked) ? asked : opts.protocolVersion;
      return rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: { tools: { listChanged: false } },
        serverInfo: opts.serverInfo,
        instructions: opts.instructions,
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/roots/list_changed":
      return null;
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
      const exposed = catalog.tools
        .filter((t: any) => isExposed(t.name))
        .map((t: any) => ({
          name: toPublicName(t.name),
          title: t.title,
          description: trimDescription(t.description),
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
    case "server/discover":
    case "server/info":
      return rpcResult(id, {
        protocolVersion: opts.protocolVersion,
        serverInfo: opts.serverInfo,
        capabilities: { tools: { listChanged: false } },
        instructions: opts.instructions,
      });

    case "tools/call": {
      let name = opts.resolveToolName((req.params?.name as string) ?? "unknown");
      let args = ((req.params?.arguments as Record<string, unknown>) ?? {}) as Record<string, any>;

      if (name === META_SEARCH) {
        return handleMetaSearch(id, args);
      }

      if (name === META_DESCRIBE) {
        return handleMetaDescribe(id, args, opts.resolveToolName);
      }

      if (name === META_INVOKE) {
        const target = opts.resolveToolName(String(args.name ?? "").trim());
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
      const actx = {
        authSource: auth.authSource,
        clientId: auth.clientId,
        grantedTiers: auth.scopes,
        requestId,
      };

      if (!auth.userId) {
        await audit({ ...actx, userId: null, toolName: name, status: "blocked_no_token", latencyMs: Date.now() - started });
        (auth as any).__challenge = true;
        return rpcResult(id, needsAuthResponse(name));
      }
      if (!auth.rolloutAllowed) {
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "blocked_by_rollout", latencyMs: Date.now() - started });
        return rpcResult(id, rolloutBlockedResponse());
      }

      const dispatchTool = dispatchableTool(name, auth, opts.catalogByName);
      const bridged = getBridged(name);
      if (!dispatchTool && !bridged) {
        await audit({ ...actx, userId: auth.userId, toolName: name, status: "bridge_unsupported", latencyMs: Date.now() - started });
        return rpcResult(id, inAppFallback(name));
      }

      const requiresApproval =
        bridged?.requiresApproval ??
        dispatchTool?.needsApproval ??
        (dispatchTool?.scopeTier === "destructive" ? true : dispatchTool ? false : true);
      const toolScope: "read" | "write" =
        bridged?.scope ?? (dispatchTool?.scope ?? (dispatchTool?.kind === "query" ? "read" : "write"));

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

      if (requiresApproval) {
        const approvalToken = typeof args.approval_token === "string" ? (args.approval_token as string) : "";
        if (approvalToken) {
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
