import { describe, expect, it } from "vitest";
import { listCapabilities } from "@/shared/capability";
import { MCP_BLOCKED_CAPABILITIES, MCP_BLOCKED_MODULES, moduleOf } from "@/shared/capability/audience";
import "@/shared/ai/registry";

describe("audiência de capabilities (A1)", () => {
  const caps = listCapabilities();
  const mcp = listCapabilities({ audience: "mcp" });

  it("expõe exatamente 150 capabilities ao MCP", () => {
    expect(caps.length).toBe(177);
    expect(mcp.length).toBe(150);
  });

  it("toda capability é visível para o app", () => {
    for (const c of caps) expect(c.audience).toContain("app");
  });

  it("nenhum anel interno vaza para o MCP", () => {
    const leaked = mcp.filter((c) => MCP_BLOCKED_MODULES.has(moduleOf(c.id)));
    expect(leaked.map((c) => c.id)).toEqual([]);
  });

  it("bloqueios individuais permanecem fora do MCP", () => {
    for (const id of MCP_BLOCKED_CAPABILITIES) {
      expect(mcp.find((c) => c.id === id)).toBeUndefined();
    }
  });

  it("leituras de Gallery seguem expostas", () => {
    const ids = mcp.map((c) => c.id);
    expect(ids).toContain("gallery.checkAccess");
    expect(ids).toContain("gallery.listExpiring");
    expect(ids).toContain("gallery.listInSelection");
  });
});
