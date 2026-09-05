// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BridgedTool, McpContent, McpToolResult } from "./types.ts";
import { fail, ok } from "./types.ts";
import { READ_AGENDA_AND_CLIENTS_TOOLS } from "./tools/readAgendaAndClients.ts";
import { READ_WORKFLOW_TOOLS } from "./tools/readWorkflow.ts";
import { READ_PRICING_TOOLS } from "./tools/readPricing.ts";
import { WRITE_AGENDA_AND_CLIENTS_TOOLS } from "./tools/writeAgendaAndClients.ts";
import { WRITE_PRICING_TOOLS } from "./tools/writePricing.ts";
import { WRITE_FINANCE_AND_WORKFLOW_TOOLS } from "./tools/writeFinanceAndWorkflow.ts";

export type { McpContent, McpToolResult, BridgedTool };
export { BRIDGE_SCHEMAS } from "./schemas.ts";

const READ_TOOLS = {
  ...READ_AGENDA_AND_CLIENTS_TOOLS,
  ...READ_WORKFLOW_TOOLS,
  ...READ_PRICING_TOOLS,
};

const WRITE_HANDLERS = {
  ...WRITE_AGENDA_AND_CLIENTS_TOOLS,
  ...WRITE_PRICING_TOOLS,
  ...WRITE_FINANCE_AND_WORKFLOW_TOOLS,
};

export const BRIDGED_TOOLS: Record<string, BridgedTool> = {};

for (const [name, handler] of Object.entries(READ_TOOLS)) {
  BRIDGED_TOOLS[name] = { handler, scope: "read", requiresApproval: false };
}
for (const [name, cfg] of Object.entries(WRITE_HANDLERS)) {
  BRIDGED_TOOLS[name] = {
    handler: cfg.handler,
    scope: "write",
    requiresApproval: cfg.requiresApproval,
    summarize: cfg.summarize,
  };
}

/** Kept for backwards compatibility with existing GET metadata response. */
export const READ_ONLY_BRIDGE = READ_TOOLS;

export function isBridged(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRIDGED_TOOLS, toolName);
}

export function getBridged(toolName: string): BridgedTool | null {
  return BRIDGED_TOOLS[toolName] ?? null;
}

export async function runBridged(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, any>,
): Promise<McpToolResult> {
  const tool = BRIDGED_TOOLS[toolName];
  if (!tool) return fail(`Tool "${toolName}" não está disponível para execução remota.`);
  try {
    return await tool.handler(supabase, userId, args ?? {});
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

export { fail as bridgeFail, ok as bridgeOk };
