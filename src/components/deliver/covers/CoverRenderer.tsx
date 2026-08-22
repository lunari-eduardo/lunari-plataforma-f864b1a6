import { COVER_REGISTRY, DEFAULT_COVER_ID } from './registry';
import type { CoverVariantProps } from './types';

interface Props extends CoverVariantProps {
  coverId?: string | null;
}

export function CoverRenderer({ coverId, ...props }: Props) {
  const variant = COVER_REGISTRY[coverId ?? DEFAULT_COVER_ID] ?? COVER_REGISTRY[DEFAULT_COVER_ID];
  const Comp = variant.Component;
  return <Comp {...props} />;
}
