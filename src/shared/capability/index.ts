export { defineCommand, defineQuery } from "./define";
export { getCapability, listCapabilities, registerCapability, clearRegistry } from "./registry";
export { authorize } from "./policies";
export { capabilityToAITool, type AICapabilityTool } from "./ai-adapter";
export type {
  Capability,
  CapabilityContext,
  CapabilityKind,
  CapabilityExample,
  CostHint,
  AuditMode,
  SideEffect,
  DefineCapabilityOptions,
} from "./types";
