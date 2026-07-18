/**
 * Catálogo unificado de planos Lunari (fonte única para /precos e cards).
 *
 * NOTA: Valores do Gallery e do combo estão marcados como TODO —
 * confirmar com marketing/financeiro antes de publicar.
 */

export type Cadence = "monthly" | "annual";

export type Plan = {
  key: string;
  product: "studio" | "gallery" | "bundle";
  name: string;
  tagline: string;
  monthly: number;
  annual: number; // preço total do ano (mostrado como /ano)
  highlight?: boolean;
  ctaLabel?: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    key: "studio-starter",
    product: "studio",
    name: "Studio Starter",
    tagline: "Trocar planilha por sistema.",
    monthly: 14.9,
    annual: 151.98,
    features: [
      "Agenda com sync Google Calendar",
      "CRM de clientes",
      "Workflow de produção",
      "Tutoriais e comunidade",
      "Suporte por WhatsApp",
    ],
  },
  {
    key: "studio-pro",
    product: "studio",
    name: "Studio Pro",
    tagline: "O estúdio inteiro em um cérebro só.",
    monthly: 35.9,
    annual: 366.18,
    highlight: true,
    features: [
      "Tudo do Starter",
      "Gestão de Leads e Tarefas",
      "Financeiro completo (PIX, Asaas, InfinitePay, MercadoPago)",
      "Precificação e metas",
      "Análise de vendas detalhada",
      "Feed Preview e relatórios",
      "Notificações avançadas",
    ],
  },
  {
    key: "gallery",
    product: "gallery",
    name: "Lunari Gallery",
    tagline: "Select + Transfer com cérebro do Studio.",
    monthly: 29.9, // TODO(prices): confirmar valores oficiais do Gallery
    annual: 305.0,
    features: [
      "Gallery Select (seleção com cobrança de extras)",
      "Gallery Transfer (entrega com senha e marca)",
      "Regras congeladas por sessão",
      "Cobrança automática de extras (link único)",
      "Espelha status no workflow do Studio",
      "Storage Cloudflare R2 incluso",
    ],
  },
  {
    key: "bundle-pro-gallery",
    product: "bundle",
    name: "Studio Pro + Gallery",
    tagline: "Combo com desconto.",
    monthly: 54.9, // TODO(prices): confirmar
    annual: 559.98,
    features: [
      "Tudo do Studio Pro",
      "Tudo do Lunari Gallery",
      "Cobrança unificada (sessão + extras num link só)",
      "Suporte prioritário",
    ],
  },
];

export function getPrice(plan: Plan, cadence: Cadence) {
  return cadence === "monthly" ? plan.monthly : plan.annual;
}

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type SitePricingFAQ = { q: string; a: string };

export const PRICING_FAQ: SitePricingFAQ[] = [
  {
    q: "Como funciona o teste grátis?",
    a: "30 dias com todas as funcionalidades do plano escolhido, sem exigir cartão de crédito. Ao final, você decide se assina — nada é cobrado automaticamente.",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim. Você pode subir ou descer de plano quando quiser dentro de Minha assinatura, com cobrança proporcional.",
  },
  {
    q: "Vocês emitem nota fiscal?",
    a: "Sim. Emitimos NFS-e mensalmente para todos os planos pagos.",
  },
  {
    q: "O que muda no Gallery em relação a outras galerias do mercado?",
    a: "Ela conversa com o Studio: valor do pacote, preço de foto extra e status de pagamento são sempre a mesma verdade. Extras viram cobrança automaticamente.",
  },
  {
    q: "E se eu cancelar?",
    a: "Sem multa, sem carência. Você mantém acesso até o fim do ciclo pago. Exportamos seus dados a qualquer momento.",
  },
  {
    q: "Preciso do Studio para usar o Gallery?",
    a: "Não obrigatoriamente — o Gallery funciona sozinho. Mas o valor real dele aparece quando conectado ao Studio (cobrança única, workflow que avança automaticamente).",
  },
];
