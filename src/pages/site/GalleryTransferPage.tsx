import { SEOHead } from "@/components/seo/SEOHead";
import {
  ProductHero,
  FeatureRow,
  MetricsStrip,
  CTABlock,
  FAQBlock,
  BreadcrumbTrail,
} from "@/components/site/primitives";
import { GalleryTransferMock } from "@/components/site/mockups";

export default function GalleryTransferPage() {
  return (
    <>
      <SEOHead
        title="Gallery Transfer · Entrega final com marca, senha e prazo"
        description="A entrega que respeita seu trabalho: marca d'água, senha por galeria, expiração e download em ZIP quando o cliente quiser."
        canonical="https://lunarihub.com/gallery/transfer"
        ogType="website"
      />
      <BreadcrumbTrail
        items={[
          { label: "Início", to: "/" },
          { label: "Gallery", to: "/gallery" },
          { label: "Transfer" },
        ]}
      />
      <ProductHero
        eyebrow="Gallery Transfer"
        title="A entrega que respeita"
        emphasis="seu trabalho."
        description="Marca d'água, senha, expiração configurável e download em lote. Seu cliente baixa quando quiser, do jeito certo — sem WeTransfer que expira."
        mockup={<GalleryTransferMock />}
      />

      <MetricsStrip
        tone="dark"
        items={[
          { value: "ZIP", label: "Download completo com um clique" },
          { value: "Senha", label: "Configurável por galeria" },
          { value: "Marca", label: "Marca d'água opcional" },
          { value: "Analytics", label: "Você vê o que o cliente acessou" },
        ]}
      />

      <FeatureRow
        index="01"
        eyebrow="Proteção"
        title="Nada de link"
        emphasis="público."
        description="Cada galeria tem senha, prazo de expiração e — se você quiser — marca d'água na visualização."
        bullets={[
          "Senha por galeria (não por foto)",
          "Prazo de expiração customizável",
          "Marca d'água some após pagamento",
        ]}
        mockup={<GalleryTransferMock />}
      />

      <FeatureRow
        index="02"
        eyebrow="Storage"
        title="Cloudflare R2."
        emphasis="Sem custo extra."
        description="Suas fotos vivem em armazenamento redundante global. Sem taxa por GB, sem surpresa no fim do mês."
        bullets={[
          "R2 incluso em todos os planos com Gallery",
          "URLs assinadas — nada de scraping",
          "Sem limite arbitrário de fotos por sessão",
        ]}
        mockup={<GalleryTransferMock />}
        reversed
        tone="navy"
      />

      <CTABlock
        title="Entrega premium,"
        emphasis="sem fricção."
        description="Seu cliente não deveria depender de um link do WeTransfer que expira em 7 dias."
        secondaryLabel="Ver planos"
        secondaryTo="/precos"
        tone="dark"
      />

      <FAQBlock
        items={[
          { q: "Consigo enviar prévia com marca d'água?", a: "Sim. Você define quando a marca some (após pagamento, após aprovação ou nunca)." },
          { q: "Cliente pode baixar tudo de uma vez?", a: "Sim, em ZIP. Também pode baixar foto a foto." },
          { q: "E se o link expirar?", a: "Você renova em um clique — histórico e senha continuam." },
        ]}
      />
    </>
  );
}
