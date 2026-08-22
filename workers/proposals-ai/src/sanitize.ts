// Sanitização da saída da IA contra o registry de blocos V2 do construtor
// (espelha src/pages/comercial/blocks/registry.ts do frontend).

export const BLOCK_TYPES = [
  'CoverBlock',
  'EditorialBlock',
  'PricingTable',
  'Gallery',
  'TestimonialBlock',
  'CTABlock',
  'FooterTerms',
  'text',
] as const;

const STRING_FIELDS: Record<string, string[]> = {
  CoverBlock: ['eyebrow', 'title', 'title_italic', 'subtitle', 'photographer_name', 'btnText', 'btnLink', 'image_url'],
  EditorialBlock: ['eyebrow', 'title', 'title_italic', 'body', 'vertical_label'],
  PricingTable: ['eyebrow', 'title'],
  Gallery: ['eyebrow', 'title', 'caption'],
  TestimonialBlock: ['eyebrow', 'title'],
  CTABlock: ['cta_text'],
  FooterTerms: ['copyright'],
  text: ['title', 'body'],
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
        price_unit: String(p.price_unit ?? 'sessão'),
        badge: String(p.badge ?? ''),
        features: Array.isArray(p.features) ? p.features.map((f: any) => String(f)).slice(0, 12) : [],
      }));
  }

  if (type === 'TestimonialBlock' && Array.isArray(raw.content?.items)) {
    content.items = raw.content.items
      .filter((t: any) => t && typeof t === 'object')
      .map((t: any, i: number) => ({
        id: typeof t.id === 'string' ? t.id : `t-${index}-${i}`,
        quote: String(t.quote ?? ''),
        author: String(t.author ?? ''),
        service: String(t.service ?? ''),
      }));
  }

  if (type === 'CTABlock' && Array.isArray(raw.content?.links)) {
    content.links = raw.content.links
      .filter((l: any) => l && typeof l === 'object' && typeof l.href === 'string')
      .map((l: any, i: number) => ({
        id: typeof l.id === 'string' ? l.id : `l-${index}-${i}`,
        label: String(l.label ?? ''),
        href: String(l.href ?? ''),
      }));
  }

  if (type === 'Gallery' && Array.isArray(raw.content?.images)) {
    content.images = raw.content.images.map((g: any, i: number) => ({
      id: typeof g?.id === 'string' ? g.id : `gi-${index}-${i}`,
      image_ref: typeof g?.image_ref === 'string' ? g.image_ref : '',
      span: ['normal', 'tall_2rows', 'wide_2cols'].includes(g?.span) ? g.span : 'normal',
    }));
  }

  const block: Block = { type, content };
  if (typeof raw.id === 'string' && raw.id) block.id = raw.id;
  if (raw.props && typeof raw.props === 'object') block.props = raw.props;
  return block;
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
