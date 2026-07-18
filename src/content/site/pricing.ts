/**
 * Copy institucional dos planos (SEM valores — os valores vêm de `unified_plans`
 * via `useSitePricing`). Chave = `plan.code` da tabela `unified_plans`.
 *
 * Para adicionar/editar valores: painel admin em `/admin/planos`.
 */

export interface PlanCopy {
  tagline: string;
  features: string[];
  ctaLabel?: string;
  familyLabel?: string; // rótulo público (ex.: "Deliver" no lugar de "Transfer")
}

export const PLAN_COPY: Record<string, PlanCopy> = {
  studio_starter: {
    tagline: "Trocar planilha por sistema.",
    features: [
      "Agenda com sync Google Calendar",
      "CRM de clientes",
      "Workflow de produção",
      "Tutoriais e comunidade",
      "Suporte por WhatsApp",
    ],
  },
  studio_pro: {
    tagline: "O estúdio inteiro em um cérebro só.",
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
  transfer_5gb: {
    tagline: "5 GB de entrega com senha e marca.",
    features: [
      "Galerias com senha",
      "Marca do estúdio nas capas",
      "Prazo de expiração",
      "Downloads controlados",
    ],
    familyLabel: "Deliver",
  },
  transfer_20gb: {
    tagline: "20 GB de entrega com senha e marca.",
    features: [
      "Tudo do 5GB",
      "Volume ideal para book / newborn",
      "Múltiplas entregas simultâneas",
    ],
    familyLabel: "Deliver",
  },
  transfer_50gb: {
    tagline: "50 GB de entrega com senha e marca.",
    features: [
      "Tudo do 20GB",
      "Ideal para casamento e ensaios grandes",
      "Prioridade de banda em picos",
    ],
    familyLabel: "Deliver",
  },
  transfer_100gb: {
    tagline: "100 GB de entrega com senha e marca.",
    features: [
      "Tudo do 50GB",
      "Volume para estúdios que entregam muito",
      "Suporte prioritário",
    ],
    familyLabel: "Deliver",
  },
  combo_pro_select2k: {
    tagline: "Studio Pro + pacote de 2 mil galerias Select.",
    features: [
      "Tudo do Studio Pro",
      "2.000 galerias de seleção incluídas",
      "Cobrança unificada (sessão + extras)",
    ],
  },
  combo_completo: {
    tagline: "Studio Pro + Select + Transfer, tudo junto.",
    features: [
      "Tudo do Studio Pro",
      "Gallery Select incluída",
      "Gallery Deliver incluída",
      "Suporte prioritário",
    ],
  },
};

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
    q: "Como funciona o Gallery Select?",
    a: "Você paga por uso, não por assinatura. Compra um pacote de galerias, e cada galeria de seleção que você libera consome 1 uso. Quando acabar, você compra outro pacote — ou nem compra. Sem mensalidade, sem desperdício.",
  },
  {
    q: "E o Gallery Deliver? Como escolho o armazenamento?",
    a: "É assinatura mensal por faixa de GB (5, 20, 50 ou 100 GB). Você começa pelo menor e sobe conforme cresce. Pode trocar de faixa quando quiser.",
  },
  {
    q: "Vocês emitem nota fiscal?",
    a: "Sim. Emitimos NFS-e mensalmente para todos os planos pagos.",
  },
  {
    q: "E se eu cancelar?",
    a: "Sem multa, sem carência. Você mantém acesso até o fim do ciclo pago. Exportamos seus dados a qualquer momento.",
  },
];

/** Ordem sugerida de exibição na página de preços (por família). */
export const STUDIO_ORDER = ["studio_starter", "studio_pro"];
export const DELIVER_ORDER = ["transfer_5gb", "transfer_20gb", "transfer_50gb", "transfer_100gb"];
export const COMBO_ORDER = ["combo_pro_select2k", "combo_completo"];
