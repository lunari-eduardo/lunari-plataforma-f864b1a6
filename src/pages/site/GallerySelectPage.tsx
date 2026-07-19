import { SEOHead } from "@/components/seo/SEOHead";
import {
  ProductHero,
  FeatureRow,
  MetricsStrip,
  CTABlock,
  FAQBlock,
  BreadcrumbTrail,
} from "@/components/site/primitives";
import { GallerySelectMock, StudioFinanceMock } from "@/components/site/mockups";

export default function GallerySelectPage() {
  return (
    <>
      <SEOHead
        title="Gallery Select · A galeria que cobra extras sozinha"
        description="Seu cliente escolhe fotos do pacote e paga extras num link só. Regras congeladas por sessão, workflow atualizado automaticamente."
        canonical="https://lunarihub.com/gallery/select"
        ogType="website"
      />
      <BreadcrumbTrail
        items={[
          { label: "Início", to: "/" },
          { label: "Gallery", to: "/gallery" },
          { label: "Select" },
        ]}
      />
      <ProductHero
        eyebrow="Gallery Select"
        title="A galeria que"
        emphasis="cobra sozinha."
        description="Cliente entra na galeria, escolhe do pacote, seleciona extras — a cobrança já sai. Sem WhatsApp de cobrança, sem PIX perdido no boca-a-boca."
        mockup={<GallerySelectMock />}
      />

      <MetricsStrip
        items={[
          { value: "R$ 4mi", label: "Em extras processados pelos usuários em 2025" },
          { value: "0 fricção", label: "Cliente não precisa criar conta" },
          { value: "1 link", label: "Sessão + extras num pagamento só" },
          { value: "Realtime", label: "Workflow avança sem você tocar" },
        ]}
      />

      <FeatureRow
        index="01"
        eyebrow="Regras congeladas"
        title="O preço vale o que valia"
        emphasis="no dia."
        description="Quando você entrega a galeria, o preço da foto extra fica congelado. Aumentou depois? Não afeta essa sessão."
        bullets={[
          "Preço unitário congelado por sessão",
          "Limite de escolhas do pacote respeitado",
          "Histórico completo de o que foi contratado",
        ]}
        mockup={<GallerySelectMock />}
      />

      <FeatureRow
        index="02"
        eyebrow="Cobrança automática"
        title="Extras viram cobrança"
        emphasis="na hora."
        description="Assim que o cliente finaliza a seleção, a Lunari calcula extras e gera o link de pagamento. Sessão ainda em aberto? Vira um link único."
        bullets={[
          "PIX, Asaas, InfinitePay ou MercadoPago",
          "Link único (sessão + extras) quando faz sentido",
          "Baixa por webhook — sem conferência manual",
        ]}
        mockup={<StudioFinanceMock />}
        reversed
        tone="navy"
      />

      <CTABlock
        title="Pare de cobrar"
        emphasis="no WhatsApp."
        description="Sua cliente não deveria receber PIX manual em 2026. Nem você deveria mandar."
        secondaryLabel="Comparar planos"
        secondaryTo="/precos"
        tone="dark"
      />

      <FAQBlock
        items={[
          { q: "E se o cliente escolher menos que o pacote?", a: "Você define a regra — pode liberar substituição, cobrar ajuste, ou manter o crédito." },
          { q: "Consigo enviar prévia?", a: "Sim, com marca d'água. E se o cliente pagar, a marca some automaticamente." },
          { q: "Aceita cartão parcelado?", a: "Sim, através de Asaas e InfinitePay." },
        ]}
      />
    </>
  );
}
