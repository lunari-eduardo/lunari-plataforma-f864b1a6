/**
 * Registry central de approvals + allowlist da superfície de IA (Onda D.1).
 *
 * Antes desta onda cada módulo mantinha seu próprio `REQUIRES_APPROVAL`, e o
 * `runCapabilityAsAssistant` precisava receber `needsApproval` explícito no
 * caller. Isso permitia que uma capability nova (ex.: `formularios.publishForm`)
 * fosse invocada sem gate humano se o caller esquecesse do parâmetro.
 *
 * Este arquivo unifica:
 *   - `needsHumanApproval(capabilityId)`: consulta agregada de todos os módulos.
 *   - `isCapabilityAllowedForAI(capabilityId)`: allowlist deny-based
 *     (default: permitida). Cada módulo pode registrar `deny` para excluir
 *     capabilities internas que nunca devem chegar à Lu.
 *
 * Cada módulo chama `registerModuleApprovals(...)` durante o import da
 * respectiva `ai/permissions.ts`, garantindo que o registro esteja pronto
 * antes de qualquer listagem de tools.
 */
type CapabilityId = string;

const REGISTRY: {
  approval: Set<CapabilityId>;
  deny: Set<CapabilityId>;
  perModule: Map<string, { approval: Set<string>; deny: Set<string> }>;
} = {
  approval: new Set(),
  deny: new Set(),
  perModule: new Map(),
};

export interface RegisterModuleApprovalsInput {
  module: string;
  requireApproval: Iterable<CapabilityId>;
  /** Capabilities do módulo NUNCA expostas à Lu (default: nenhuma). */
  deny?: Iterable<CapabilityId>;
}

export function registerModuleApprovals(input: RegisterModuleApprovalsInput): void {
  const approval = new Set(input.requireApproval);
  const deny = new Set(input.deny ?? []);
  REGISTRY.perModule.set(input.module, { approval, deny });
  approval.forEach((id) => REGISTRY.approval.add(id));
  deny.forEach((id) => REGISTRY.deny.add(id));
}

/** True se qualquer módulo declarou o id como sensível/destrutivo. */
export function needsHumanApproval(capabilityId: CapabilityId): boolean {
  return REGISTRY.approval.has(capabilityId);
}

/** False só quando algum módulo colocou o id em `deny`. */
export function isCapabilityAllowedForAI(capabilityId: CapabilityId): boolean {
  return !REGISTRY.deny.has(capabilityId);
}

export function listAllApprovalRequired(): string[] {
  return Array.from(REGISTRY.approval).sort();
}

export function listAllDenied(): string[] {
  return Array.from(REGISTRY.deny).sort();
}

export function listRegisteredModules(): string[] {
  return Array.from(REGISTRY.perModule.keys()).sort();
}

export function getModuleApprovals(module: string): {
  approval: string[];
  deny: string[];
} {
  const entry = REGISTRY.perModule.get(module);
  return {
    approval: entry ? Array.from(entry.approval).sort() : [],
    deny: entry ? Array.from(entry.deny).sort() : [],
  };
}

/** Uso em testes/CI. Não usar em runtime. */
export function __resetApprovalRegistryForTests(): void {
  REGISTRY.approval.clear();
  REGISTRY.deny.clear();
  REGISTRY.perModule.clear();
}
