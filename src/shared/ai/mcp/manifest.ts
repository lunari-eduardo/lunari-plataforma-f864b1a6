/**
 * Manifesto MCP do Lunari — descreve o servidor a ser publicado.
 *
 * Fase C — apenas metadados e helper de manifest. A publicação real
 * (edge function `mcp` via `@lovable.dev/mcp-js` ou runtime externo)
 * será feita na Fase F.
 */

import type { MCPTool } from "./contracts";

export interface MCPServerManifest {
  name: string;
  title: string;
  version: string;
  instructions: string;
  auth: {
    type: "oauth-supabase" | "public" | "bearer";
    issuer?: string;
    acceptedAudiences?: string;
  };
  tools: Array<{
    name: string;
    title: string;
    description: string;
    annotations: MCPTool["annotations"];
  }>;
}

export function buildMCPManifest(tools: MCPTool[], overrides?: Partial<MCPServerManifest>): MCPServerManifest {
  return {
    name: overrides?.name ?? "lunari-mcp",
    title: overrides?.title ?? "Lunari",
    version: overrides?.version ?? "0.1.0",
    instructions:
      overrides?.instructions ??
      "Ferramentas do Lunari para fotógrafos: agenda, workflow, financeiro, cobranças, clientes, galerias, formulários e contratos. Escritas destrutivas exigem aprovação humana explícita no app.",
    auth: overrides?.auth ?? { type: "oauth-supabase", acceptedAudiences: "authenticated" },
    tools: tools.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      annotations: t.annotations,
    })),
  };
}
