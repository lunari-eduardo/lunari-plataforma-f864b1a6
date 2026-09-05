import { BlockData } from '@/hooks/useMaterialEditor';
import { BLOCK_REGISTRY } from './registryDefinitions';

// Tipos V1 legados mapeados na normalização
const V1_COVER = 'cover';
const V1_ABOUT = 'about';
const V1_PACKAGE = 'package';
const V1_PORTFOLIO = 'portfolio';

export const BLOCK_UNKNOWN_FALLBACK_TITLE = 'Conteúdo (formato antigo)';

function withId(block: Partial<BlockData>): BlockData {
  return {
    id: block.id || `${block.type}-${crypto.randomUUID().slice(0, 8)}`,
    type: block.type!,
    content: block.content ?? {},
    props: block.props,
  } as BlockData;
}

export function normalizeBlock(raw: any): BlockData | null {
  if (!raw || typeof raw !== 'object') return null;
  const type: string = raw.type;

  // V2 nativo: garante id e content
  if (BLOCK_REGISTRY[type]) {
    const def = BLOCK_REGISTRY[type];
    const normalized = withId({
      ...raw,
      content: raw.content ?? raw.data ?? {},
    });
    // Garantir variant default para blocos sem variant definida
    if (def.defaultVariant && !normalized.props?.variant) {
      normalized.props = { ...normalized.props, variant: def.defaultVariant };
    }
    return normalized;
  }

  // Prevenção de erro em documentos corrompidos ou V1 incompleto
  const d: Record<string, any> = raw.data || {};

  switch (type) {
    case V1_COVER:
      return withId({
        type: 'CoverBlock',
        content: {
          eyebrow: '',
          title: d.title || '',
          title_italic: '',
          subtitle: d.subtitle || '',
          photographer_name: '',
          btnText: d.btnText || '',
          btnLink: d.btnLink || '',
          image_url: d.image_url || '',
        },
        props: { align: 'left' },
      });

    case V1_ABOUT:
      return withId({
        type: 'EditorialBlock',
        content: {
          eyebrow: '',
          title: d.title || 'Sobre o Estúdio',
          title_italic: '',
          body: d.text || '',
          vertical_label: '',
          details: [],
        },
        props: {
          align: 'left',
          background: 'cream',
          photo_a: { width_pct: 72, height_pct: 80, image_ref: d.photo_url || null },
          photo_b: { width_pct: 62, height_pct: 66, image_ref: null },
        },
      });

    case V1_PACKAGE: {
      const price =
        typeof d.price_cents === 'number' && d.price_cents > 0
          ? `R$ ${(d.price_cents / 100).toLocaleString('pt-BR')}`
          : '';
      const features =
        typeof d.description === 'string'
          ? d.description.split('\n').map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(d.items)
          ? d.items
          : [];
      return withId({
        type: 'PricingTable',
        content: {
          eyebrow: '',
          title: 'Investimento',
          packages: [
            {
              id: crypto.randomUUID(),
              name: d.title || d.name || 'Pacote',
              price,
              price_unit: 'sessão',
              badge: d.highlight ? 'Mais escolhido' : '',
              features,
            },
          ],
        },
        props: { align: 'center', background: 'white' },
      });
    }

    case V1_PORTFOLIO:
      return withId({
        type: 'Gallery',
        content: {
          eyebrow: '',
          title: d.title || 'Portfólio',
          caption: '',
          images: Array.isArray(d.images)
            ? d.images.map((img: any) => ({
                id: crypto.randomUUID(),
                image_ref: typeof img === 'string' ? img : img?.image_ref || '',
                span: typeof img === 'object' ? img?.span || 'normal' : 'normal',
                ratio: typeof img === 'object' ? img?.ratio || 'auto' : 'auto',
              }))
            : [],
        },
        props: { align: 'center', background: 'dark', layout: 'masonry' },
      });

    case 'text':
      return withId({
        type: 'text',
        content: { title: d.title || '', body: d.body || '' },
        props: { align: 'center', background: 'white' },
      });

    default:
      console.warn(`Tipo de bloco desconhecido na normalização: ${type}`, raw);
      // Tipo desconhecido: preserva como bloco de texto livre para não perder conteúdo
      return withId({
        type: 'text',
        content: { title: BLOCK_UNKNOWN_FALLBACK_TITLE, body: JSON.stringify(raw ?? {}, null, 2) },
        props: { align: 'center', background: 'white' },
      });
  }
}

export function normalizeBlocks(raw: any[] | null | undefined): BlockData[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockData[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'global_settings') continue; // tratado à parte pelo editor
    const n = normalizeBlock(b);
    if (n) out.push(n);
  }
  return out;
}
