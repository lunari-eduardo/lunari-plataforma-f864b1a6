import { BlockData } from '@/hooks/useMaterialEditor';
import { Heading1 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BLOCK_REGISTRY, BlockDefinition } from './registryDefinitions';

export * from './registryDefinitions';
export { normalizeBlocks, BLOCK_UNKNOWN_FALLBACK_TITLE, normalizeBlock } from './normalization';

export function getBlockDef(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY[type];
}

export function getBlockName(type: string): string {
  return BLOCK_REGISTRY[type]?.name ?? 'Seção';
}

export const ADDABLE_BLOCK_TYPES = Object.keys(BLOCK_REGISTRY).filter((t) => t !== 'text');

export function createBlock(type: string): BlockData {
  const def = BLOCK_REGISTRY[type];
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  if (!def) {
    return { type, id, content: {} };
  }
  const { content, props } = def.factory();
  return {
    type,
    id,
    content: JSON.parse(JSON.stringify(content)),
    props: JSON.parse(JSON.stringify(props ?? {})),
  };
}

// Icone default para tipos fora do registry
export const DEFAULT_BLOCK_ICON: LucideIcon = Heading1;
