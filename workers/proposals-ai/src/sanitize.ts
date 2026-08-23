// Sanitização da saída da IA contra o registry de blocos V2 do construtor
// (espelha src/pages/comercial/blocks/registry.ts do frontend).

export const BLOCK_TYPES = [
  'CoverBlock',
  'EditorialBlock',
  'EditorialComposition',
  'PricingTable',
  'Gallery',
  'DividerBlock',
  'text',
] as const;

const STRING_FIELDS: Record<string, string[]> = {
  CoverBlock: ['eyebrow', 'title', 'title_italic', 'subtitle', 'photographer_name', 'btnText', 'btnLink', 'image_url'],
  EditorialBlock: ['eyebrow', 'title', 'title_italic', 'body', 'vertical_label'],
  EditorialComposition: ['eyebrow', 'title', 'title_italic', 'body', 'side_label', 'image_url'],
  PricingTable: ['eyebrow', 'title'],
  Gallery: ['eyebrow', 'title', 'caption'],
  DividerBlock: ['label'],
  text: ['title', 'body'],
};

const GALLERY_RATIOS = ['auto', '1/1', '4/5', '4/3', '16/9'];

const VALID_VARIANTS: Record<string, string[]> = {
  CoverBlock: ['split', 'full', 'centered'],
  EditorialBlock: ['text-only', 'with-details'],
  EditorialComposition: ['split-left', 'split-right', 'floating', 'masonry'],
  PricingTable: ['grid', 'cards', 'minimal'],
  Gallery: ['grid', 'masonry'],
  DividerBlock: ['line', 'icon'],
  text: ['default']
};

export type Block = {
  id?: string;
  type: string;
  content: Record<string, any>;
  props?: Record<string, any>;
};

export function sanitizeBlock(raw: any, index: number): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = (BLOCK_TYPES as readonly string[]).find((t) => t === raw.type);
  if (!type) return null;

  const content: Record<string, any> = {};
  for (const f of STRING_FIELDS[type] ?? []) {
    if (typeof raw.content?.[f] === 'string') content[f] = raw.content[f];
  }

  if (type === 'EditorialBlock' && Array.isArray(raw.content?.details)) {
    content.details = raw.content.details
      .filter((d: any) => d && typeof d === 'object')
      .map((d: any, i: number) => ({
        id: typeof d.id === 'string' ? d.id : `d-${index}-${i}`,
        label: String(d.label ?? ''),
        value: String(d.value ?? ''),
      }));
  }

  if (type === 'PricingTable' && Array.isArray(raw.content?.packages)) {
    content.packages = raw.content.packages
      .filter((p: any) => p && typeof p === 'object')
      .map((p: any, i: number) => ({
        id: typeof p.id === 'string' ? p.id : `pkg-${index}-${i}`,
        name: String(p.name ?? `Pacote ${i + 1}`),
        price: String(p.price ?? ''),
        price_cash: String(p.price_cash ?? ''),
        price_installments: String(p.price_installments ?? ''),
        price_unit: String(p.price_unit ?? 'sessão'),
        badge: String(p.badge ?? ''),
        image_ref: typeof p.image_ref === 'string' ? p.image_ref : '',
        features: Array.isArray(p.features) ? p.features.map((f: any) => String(f)).slice(0, 12) : [],
      }));
  }

  if (type === 'Gallery' && Array.isArray(raw.content?.images)) {
    content.images = raw.content.images.map((g: any, i: number) => ({
      id: typeof g?.id === 'string' ? g.id : `gi-${index}-${i}`,
      image_ref: typeof g?.image_ref === 'string' ? g.image_ref : '',
      span: ['normal', 'tall_2rows', 'wide_2cols'].includes(g?.span) ? g.span : 'normal',
      ratio: GALLERY_RATIOS.includes(g?.ratio) ? g.ratio : 'auto',
    }));
  }

  const block: Block = { type, content };
  if (typeof raw.id === 'string' && raw.id) block.id = raw.id;
  
  if (raw.props && typeof raw.props === 'object') {
    block.props = { ...raw.props };
  } else {
    block.props = {};
  }
  
  const allowedVariants = VALID_VARIANTS[type] || ['default'];
  if (!allowedVariants.includes(block.props.variant)) {
    block.props.variant = allowedVariants[0];
  }
  
  return block;
}

/**
 * A IA às vezes devolve vários blocos PricingTable (um por pacote), gerando
 * seções "Investimento" duplicadas. Mescla todos em um único bloco.
 */
export function mergePricingTables(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let merged: Block | null = null;
  for (const b of blocks) {
    if (b.type !== 'PricingTable') {
      out.push(b);
      continue;
    }
    if (!merged) {
      merged = b;
      out.push(b);
      continue;
    }
    const extra = Array.isArray(b.content?.packages) ? b.content.packages : [];
    merged.content.packages = [...(merged.content.packages ?? []), ...extra].slice(0, 6);
  }
  return out;
}

export function sanitizeDesignTokens(raw: any) {
  if (!raw || typeof raw !== 'object') return undefined;
  const colors: Record<string, string> = {};
  for (const k of ['cream', 'linen', 'stone', 'taupe', 'accent', 'ink', 'white']) {
    if (typeof raw.colors?.[k] === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.colors[k])) {
      colors[k] = raw.colors[k];
    }
  }
  const typography: Record<string, string> = {};
  for (const k of ['display', 'body']) {
    if (typeof raw.typography?.[k] === 'string') typography[k] = raw.typography[k].slice(0, 60);
  }
  if (Object.keys(colors).length === 0 && Object.keys(typography).length === 0) return undefined;
  const tokens: Record<string, any> = {};
  if (Object.keys(colors).length) tokens.colors = colors;
  if (Object.keys(typography).length) tokens.typography = typography;
  return tokens;
}
