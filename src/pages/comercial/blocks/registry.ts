import { BlockData } from '@/hooks/useMaterialEditor';
import {
  Image as ImageIcon,
  AlignLeft,
  DollarSign,
  Briefcase,
  HelpCircle,
  MessageSquare,
  Type,
  Heading1,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================
// REGISTRY DECLARATIVO DE BLOCOS
// Fonte única de verdade para: menu "Adicionar Seção", formulário
// do painel de propriedades, factories de conteúdo default,
// edição inline e validação de payloads de IA.
// ============================================================

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'url'
  | 'price_cents'     // exibido em R$, armazenado em centavos
  | 'stringlist'      // lista de strings (1 por linha)
  | 'list'            // lista de objetos com itemFields
  | 'image'           // upload de imagem
  | 'select';

export interface BlockField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** kind 'select': opções disponíveis */
  options?: { value: string; label: string }[];
  /** kind 'image': quando true, grava em props[key].image_ref (slots como photo_a/photo_b) */
  slot?: boolean;
  /** kind 'list' */
  itemLabel?: string;
  itemFields?: BlockField[];
  itemFactory?: () => Record<string, any>;
}

export interface PropImageSlot {
  key: string;
  label: string;
}

export interface BlockDefinition {
  type: string;
  name: string;
  description: string;
  icon: LucideIcon;
  fields: BlockField[];
  /** Slots de imagem em props (ex.: EditorialBlock photo_a/photo_b) */
  propImageSlots?: PropImageSlot[];
  factory: () => { content: Record<string, any>; props?: Record<string, any> };
}

const detailItem = () => ({ id: crypto.randomUUID(), label: '', value: '' });
const packageItem = () => ({ id: crypto.randomUUID(), name: 'Novo Pacote', price: '', price_unit: 'sessão', badge: '', features: [] });
const testimonialItem = () => ({ id: crypto.randomUUID(), quote: '', author: '', service: '' });
const linkItem = () => ({ id: crypto.randomUUID(), label: '', href: '' });
const galleryItem = () => ({ id: crypto.randomUUID(), image_ref: '', span: 'normal' });

export const BLOCK_REGISTRY: Record<string, BlockDefinition> = {
  CoverBlock: {
    type: 'CoverBlock',
    name: 'Capa',
    description: 'Seção de abertura com imagem',
    icon: ImageIcon,
    fields: [
      { key: 'eyebrow', label: 'Rótulo Superior (Eyebrow)', kind: 'text', placeholder: 'Proposta personalizada' },
      { key: 'title', label: 'Título Principal', kind: 'textarea', placeholder: 'Seu momento merece ser vivido' },
      { key: 'title_italic', label: 'Título em Itálico', kind: 'text', placeholder: 'e lembrado para sempre.' },
      { key: 'subtitle', label: 'Subtítulo', kind: 'textarea', placeholder: 'Fotografias que eternizam...' },
      { key: 'photographer_name', label: 'Assinatura (Fotógrafo)', kind: 'text', placeholder: 'Camila Ramos · Fotografias' },
      { key: 'btnText', label: 'Texto do Botão', kind: 'text', placeholder: 'Quero viver essa experiência' },
      { key: 'btnLink', label: 'Link do Botão', kind: 'url', placeholder: 'https://wa.me/5511999999999' },
      { key: 'image_url', label: 'Imagem de Capa', kind: 'image' },
    ],
    factory: () => ({
      content: { eyebrow: '', title: '', title_italic: '', subtitle: '', photographer_name: '', btnText: '', btnLink: '', image_url: '' },
    }),
  },

  EditorialBlock: {
    type: 'EditorialBlock',
    name: 'Editorial',
    description: 'Bloco de conteúdo com imagens',
    icon: AlignLeft,
    fields: [
      { key: 'eyebrow', label: 'Rótulo Superior (Eyebrow)', kind: 'text', placeholder: 'Como funciona' },
      { key: 'title', label: 'Título Principal', kind: 'text', placeholder: 'Uma tarde' },
      { key: 'title_italic', label: 'Título em Itálico', kind: 'text', placeholder: 'só sua.' },
      { key: 'body', label: 'Texto (Corpo)', kind: 'textarea', placeholder: 'Cada sessão começa com uma conversa...' },
      { key: 'vertical_label', label: 'Assinatura Vertical', kind: 'text', placeholder: 'Camila Ramos · Fotografias' },
      {
        key: 'details',
        label: 'Detalhes',
        kind: 'list',
        itemLabel: 'Detalhe',
        itemFields: [
          { key: 'label', label: 'Rótulo', kind: 'text', placeholder: 'Duração' },
          { key: 'value', label: 'Valor', kind: 'text', placeholder: '2 a 8 horas' },
        ],
        itemFactory: detailItem,
      },
    ],
    propImageSlots: [
      { key: 'photo_a', label: 'Foto Principal (Plano de fundo)' },
      { key: 'photo_b', label: 'Foto Sobreposta (Blend)' },
    ],
    factory: () => ({
      content: { eyebrow: '', title: '', title_italic: '', body: '', vertical_label: '', details: [] },
      props: {
        background: 'dark',
        photo_a: { width_pct: 72, height_pct: 80, image_ref: null },
        photo_b: { width_pct: 62, height_pct: 66, image_ref: null },
      },
    }),
  },

  PricingTable: {
    type: 'PricingTable',
    name: 'Tabela de Preços',
    description: 'Pacotes e valores',
    icon: DollarSign,
    fields: [
      { key: 'eyebrow', label: 'Rótulo Superior (Eyebrow)', kind: 'text', placeholder: 'Investimento' },
      { key: 'title', label: 'Título', kind: 'text', placeholder: 'Pacotes' },
      {
        key: 'packages',
        label: 'Pacotes',
        kind: 'list',
        itemLabel: 'Pacote',
        itemFields: [
          { key: 'name', label: 'Nome', kind: 'text', placeholder: 'Essencial' },
          { key: 'price', label: 'Preço (texto livre)', kind: 'text', placeholder: 'R$ 1.200' },
          { key: 'price_unit', label: 'Unidade', kind: 'text', placeholder: 'sessão' },
          { key: 'badge', label: 'Selo (ex: Mais escolhido)', kind: 'text', placeholder: 'Mais escolhido' },
          { key: 'features', label: 'Itens inclusos (1 por linha)', kind: 'stringlist', placeholder: '1h de ensaio\n10 fotos digitais' },
        ],
        itemFactory: packageItem,
      },
    ],
    factory: () => ({
      content: { eyebrow: '', title: 'Pacotes', packages: [] },
    }),
  },

  Gallery: {
    type: 'Gallery',
    name: 'Galeria',
    description: 'Mostre seus resultados',
    icon: Briefcase,
    fields: [
      { key: 'eyebrow', label: 'Rótulo Superior (Eyebrow)', kind: 'text', placeholder: 'Portfólio' },
      { key: 'title', label: 'Título', kind: 'text', placeholder: 'Portfólio' },
      { key: 'caption', label: 'Legenda', kind: 'text', placeholder: 'Alguns momentos recentes' },
      {
        key: 'images',
        label: 'Imagens',
        kind: 'list',
        itemLabel: 'Imagem',
        itemFields: [
          { key: 'image_ref', label: 'Imagem', kind: 'image' },
          {
            key: 'span', label: 'Tamanho na grade', kind: 'select',
            options: [
              { value: 'normal', label: 'Normal' },
              { value: 'tall_2rows', label: 'Alta (2 linhas)' },
              { value: 'wide_2cols', label: 'Larga (2 colunas)' },
            ],
          },
        ],
        itemFactory: galleryItem,
      },
    ],
    factory: () => ({
      content: { eyebrow: '', title: 'Portfólio', caption: '', images: [] },
    }),
  },

  TestimonialBlock: {
    type: 'TestimonialBlock',
    name: 'Depoimentos',
    description: 'O que dizem sobre você',
    icon: HelpCircle,
    fields: [
      { key: 'eyebrow', label: 'Rótulo Superior (Eyebrow)', kind: 'text', placeholder: 'Depoimentos' },
      { key: 'title', label: 'Título', kind: 'text', placeholder: 'Depoimentos' },
      {
        key: 'items',
        label: 'Depoimentos',
        kind: 'list',
        itemLabel: 'Depoimento',
        itemFields: [
          { key: 'quote', label: 'Texto', kind: 'textarea', placeholder: 'Foi uma experiência incrível...' },
          { key: 'author', label: 'Autor', kind: 'text', placeholder: 'Maria S.' },
          { key: 'service', label: 'Serviço', kind: 'text', placeholder: 'Newborn' },
        ],
        itemFactory: testimonialItem,
      },
    ],
    factory: () => ({
      content: { eyebrow: '', title: 'Depoimentos', items: [] },
    }),
  },

  CTABlock: {
    type: 'CTABlock',
    name: 'Chamada para ação',
    description: 'Botão de contato e links',
    icon: MessageSquare,
    fields: [
      { key: 'cta_text', label: 'Título da Chamada', kind: 'textarea', placeholder: 'Vamos conversar?' },
      {
        key: 'links',
        label: 'Links',
        kind: 'list',
        itemLabel: 'Link',
        itemFields: [
          { key: 'label', label: 'Rótulo', kind: 'text', placeholder: 'Instagram' },
          { key: 'href', label: 'Endereço', kind: 'url', placeholder: 'https://instagram.com/seuperfil' },
        ],
        itemFactory: linkItem,
      },
    ],
    factory: () => ({
      content: { cta_text: 'Vamos conversar?', links: [] },
    }),
  },

  FooterTerms: {
    type: 'FooterTerms',
    name: 'Rodapé',
    description: 'Direitos autorais e termos',
    icon: Scale,
    fields: [
      { key: 'copyright', label: 'Texto de Direitos', kind: 'text', placeholder: '© 2026 Seu Estúdio — Todos os direitos reservados' },
    ],
    factory: () => ({
      content: { copyright: '© Todos os direitos reservados' },
    }),
  },

  text: {
    type: 'text',
    name: 'Texto Livre',
    description: 'Conteúdo customizado',
    icon: Type,
    fields: [
      { key: 'title', label: 'Título', kind: 'text', placeholder: 'Sobre o processo' },
      { key: 'body', label: 'Conteúdo', kind: 'textarea', placeholder: 'Escreva aqui...' },
    ],
    factory: () => ({
      content: { title: '', body: '' },
    }),
  },
};

// Tipos V1 legados mapeados na normalização
const V1_COVER = 'cover';
const V1_ABOUT = 'about';
const V1_PACKAGE = 'package';
const V1_PORTFOLIO = 'portfolio';
const V1_FAQ = 'faq';
const V1_CTA = 'cta';

export function getBlockDef(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY[type];
}

export function getBlockName(type: string): string {
  return BLOCK_REGISTRY[type]?.name ?? 'Seção';
}

export const ADDABLE_BLOCK_TYPES = Object.keys(BLOCK_REGISTRY);

export function createBlock(type: string): BlockData {
  const def = BLOCK_REGISTRY[type];
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  if (!def) {
    return { type, id, content: {} };
  }
  const { content, props } = def.factory();
  return { type, id, content: JSON.parse(JSON.stringify(content)), props: JSON.parse(JSON.stringify(props ?? {})) };
}

// ============================================================
// NORMALIZAÇÃO V1 → V2
// Converte documentos antigos (tudo em block.data) para o modelo
// unificado (content/props). Roda na carga do editor; o próximo
// save persiste o formato normalizado.
// ============================================================

function withId(block: Partial<BlockData>): BlockData {
  return {
    id: block.id || `${block.type}-${crypto.randomUUID().slice(0, 8)}`,
    type: block.type!,
    content: block.content ?? {},
    props: block.props,
  } as BlockData;
}

function normalizeBlock(raw: any): BlockData | null {
  if (!raw || typeof raw !== 'object') return null;
  const type: string = raw.type;

  // V2 nativo: garante id e content
  if (BLOCK_REGISTRY[type]) {
    return withId(raw);
  }

  const d: Record<string, any> = raw.data ?? {};

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
          background: 'cream',
          photo_a: { width_pct: 72, height_pct: 80, image_ref: d.photo_url || null },
          photo_b: { width_pct: 62, height_pct: 66, image_ref: null },
        },
      });

    case V1_PACKAGE: {
      const price = typeof d.price_cents === 'number' && d.price_cents > 0
        ? `R$ ${(d.price_cents / 100).toLocaleString('pt-BR')}`
        : '';
      const features = typeof d.description === 'string'
        ? d.description.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(d.items) ? d.items : [];
      return withId({
        type: 'PricingTable',
        content: {
          eyebrow: '',
          title: 'Investimento',
          packages: [{
            id: crypto.randomUUID(),
            name: d.title || d.name || 'Pacote',
            price,
            price_unit: 'sessão',
            badge: d.highlight ? 'Mais escolhido' : '',
            features,
          }],
        },
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
                span: typeof img === 'object' ? (img?.span || 'normal') : 'normal',
              }))
            : [],
        },
      });

    case V1_FAQ:
      return withId({
        type: 'text',
        content: {
          title: 'Perguntas Frequentes',
          body: Array.isArray(d.items)
            ? d.items.map((i: any) => `${i.question}\n${i.answer}`).join('\n\n')
            : '',
        },
      });

    case V1_CTA:
      return withId({
        type: 'CTABlock',
        content: {
          cta_text: d.title || d.text || 'Vamos conversar?',
          links: [
            ...(d.whatsapp ? [{ id: crypto.randomUUID(), label: 'WhatsApp', href: d.whatsapp.startsWith('http') ? d.whatsapp : `https://wa.me/${d.whatsapp}` }] : []),
            ...(d.instagram ? [{ id: crypto.randomUUID(), label: 'Instagram', href: d.instagram.startsWith('http') ? d.instagram : `https://instagram.com/${d.instagram}` }] : []),
            ...(d.email ? [{ id: crypto.randomUUID(), label: 'E-mail', href: `mailto:${d.email}` }] : []),
          ],
        },
      });

    case 'text':
      return withId({ type: 'text', content: { title: d.title || '', body: d.body || '' } });

    default:
      // Tipo desconhecido: preserva como bloco de texto livre para não perder conteúdo
      return withId({
        type: 'text',
        content: { title: BLOCK_UNKNOWN_FALLBACK_TITLE, body: JSON.stringify(d ?? {}, null, 2) },
      });
  }
}

export const BLOCK_UNKNOWN_FALLBACK_TITLE = 'Conteúdo (formato antigo)';

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

// Icone default para tipos fora do registry (não deveria ocorrer pós-normalização)
export const DEFAULT_BLOCK_ICON: LucideIcon = Heading1;
