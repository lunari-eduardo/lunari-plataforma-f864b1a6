import { SEOHead } from "@/components/seo/SEOHead";
import {
  ProductHero,
  FeatureRow,
  MetricsStrip,
  CTABlock,
  FAQBlock,
  BreadcrumbTrail,
} from "@/components/site/primitives";
import {
  StudioWorkflowMock,
  StudioAgendaMock,
  StudioFinanceMock,
} from "@/components/site/mockups";

export default function StudioPage() {
  return (
    <>
      <SEOHead
        title="Lunari Studio · O estúdio inteiro em um cérebro só"
        description="Agenda, CRM, workflow, financeiro e contratos operando como um sistema único. Substitua planilha, Trello, Google Agenda e um bolo de PIX por uma coisa só."
        canonical="https://lunarihub.com/studio"
        ogType="website"
      />
      <BreadcrumbTrail items={[{ label: "Início", to: "/" }, { label: "Studio" }]} />
      <ProductHero
        eyebrow="Lunari Studio"
        title="O estúdio inteiro em um"
        emphasis="cérebro só."
        description="Cliente chega no Instagram, vira sessão na agenda, aparece no workflow, gera cobrança, entrega galeria — sem sair do mesmo sistema. Todo mundo enxerga a mesma verdade."
        mockup={<StudioWorkflowMock />}
      />

      <MetricsStrip
        items={[
          { value: "1 verdade", label: "Cliente, sessão e financeiro no mesmo lugar" },
          { value: "≈ 6h", label: "Economizadas por semana em copia-e-cola" },
          { value: "0 planilha", label: "Nada mais fora do sistema" },
          { value: "100% BR", label: "PIX, Asaas, InfinitePay, MercadoPago" },
        ]}
      />

      <FeatureRow
        index="01"
        eyebrow="Workflow"
        title="Do lead ao pós-venda, sem trocar de aba."
        description="Cada card carrega o cliente, o valor, a próxima ação e o histórico. Nada se perde entre você e o cliente."
        bullets={[
          "Colunas configuráveis por tipo de trabalho",
          "Cobrança e checklist direto do card",
          "Realtime — dois dispositivos, mesma verdade",
        ]}
        mockup={<StudioWorkflowMock />}
      />

      <FeatureRow
        index="02"
        eyebrow="Agenda"
        title="Sua agenda entende que sessão é dinheiro."
        description="Cada evento carrega o cliente, o valor combinado e o status financeiro. Sincroniza com Google Calendar sem duplicar."
        bullets={[
          "Horários de trabalho e bloqueios inteligentes",
          "Notificação automática de clientes",
          "Confirmação por WhatsApp com um clique",
        ]}
        mockup={<StudioAgendaMock />}
        reversed
      />

      <FeatureRow
        index="03"
        eyebrow="Financeiro"
        title="Todos os PIX, todas as gateways, uma tela."
        description="PIX manual, Asaas, InfinitePay e MercadoPago conciliados automaticamente. Você vê recebido, pendente e a receber — de verdade."
        bullets={[
          "Baixa automática por webhook (sem cola de comprovante)",
          "Metas e análise de vendas",
          "Extras de galeria entram no mesmo relatório",
        ]}
        mockup={<StudioFinanceMock />}
      />

      <CTABlock
        title="Comece sem"
        emphasis="cartão."
        description="30 dias com tudo. Se não valer a pena, você sai e leva seus dados."
        secondaryLabel="Ver planos"
        secondaryTo="/precos"
      />
      <FAQBlock
        title="Sobre o Studio"
        items={[
          { q: "Preciso migrar meus dados manualmente?", a: "Não. Fazemos importação assistida de agenda, clientes e contratos. Em geral leva menos de 1h." },
          { q: "Funciona no celular?", a: "Sim, é web app responsivo. A maioria dos fotógrafos usa no desktop pra operar e no celular pra consultar." },
          { q: "E se eu já uso um financeiro?", a: "Você pode continuar. O Studio tem exportação e API de webhooks para conectar contadores e ERPs." },
        ]}
      />
    </>
  );
}
