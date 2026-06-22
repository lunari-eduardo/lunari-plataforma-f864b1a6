import type { Capability } from "./types";

const registry = new Map<string, Capability>();

export function registerCapability(cap: Capability): void {
  if (registry.has(cap.id)) {
    // Em dev, HMR pode re-registrar; sobrescrever silenciosamente.
    if (import.meta.env?.DEV) {
      registry.set(cap.id, cap);
      return;
    }
    throw new Error(`[capability] já registrada: ${cap.id}`);
  }
  registry.set(cap.id, cap);
}

export function getCapability(id: string): Capability | undefined {
  return registry.get(id);
}

export function listCapabilities(filter?: {
  module?: string;
  kind?: "command" | "query";
}): Capability[] {
  let arr = Array.from(registry.values());
  if (filter?.module) arr = arr.filter((c) => c.id.startsWith(`${filter.module}.`));
  if (filter?.kind) arr = arr.filter((c) => c.kind === filter.kind);
  return arr.sort((a, b) => a.id.localeCompare(b.id));
}

export function clearRegistry(): void {
  registry.clear();
}
