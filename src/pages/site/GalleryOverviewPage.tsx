import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  ProductHero,
  MetricsStrip,
  CTABlock,
  FAQBlock,
  BreadcrumbTrail,
  SectionShell,
  EyebrowTag,
  Reveal,
  displayFont,
  uiFont,
  PrimaryButton,
  GhostLink,
} from "@/components/site/primitives";
import { GallerySelectMock, GalleryTransferMock } from "@/components/site/mockups";
import { ArrowRight } from "lucide-react";

function ProductCard({
  eyebrow,
  title,
  description,
  bullets,
  to,
  mock,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  to: string;
  mock: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const nav = useNavigate();
  const dark = tone === "dark";
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border p-8 md:p-10"
      style={{
        background: dark ? "#0F0F10" : "#FFFFFF",
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)",
        color: dark ? "#FAFAF7" : "#0A0A0A",
      }}
    >
      <EyebrowTag tone={dark ? "dark" : "light"}>{eyebrow}</EyebrowTag>
      <h3
        className="mt-5 text-[28px] leading-[1.1] tracking-[-0.02em] md:text-[36px]"
        style={{
          fontFamily: '"Geist", "Inter Tight", sans-serif',
          color: dark ? "#FAFAF7" : "#0A0A0A",
          fontWeight: 600,
          letterSpacing: "-0.028em",
        }}>
        {title}
      </h3>
      <p
        className={`mt-4 max-w-[420px] text-[15px] leading-[1.6] ${
          dark ? "text-white/70" : "text-[#0A0A0A]/70"
        }`}
        style={uiFont}
      >
        {description}
      </p>
      <ul className="mt-6 space-y-2" style={uiFont}>
        {bullets.map((b) => (
          <li key={b} className={`text-[14px] ${dark ? "text-white/75" : "text-[#0A0A0A]/75"}`}>
            → {b}
          </li>
        ))}
      </ul>
      <div className="mt-8 mb-2">{mock}</div>
      <button
        onClick={() => nav(to)}
        className={`mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium ${
          dark ? "text-white" : "text-[#0A0A0A]"
        }`}
        style={uiFont}
      >
        Conhecer <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function GalleryOverviewPage() {
  return (
    <>
      <SEOHead
        title="Lunari Gallery · Select + Transfer com cérebro do Studio"
        description="Duas galerias que conversam com seu financeiro: Select cobra extras sozinha, Transfer entrega tudo com marca e senha. Extras viram cobrança automaticamente."
        canonical="https://lunarihub.com/gallery"
        ogType="website"
      />
      <BreadcrumbTrail items={[{ label: "Início", to: "/" }, { label: "Gallery" }]} />
      <ProductHero
        eyebrow="Lunari Gallery"
        title="Galerias que"
        emphasis="cobram sozinhas."
        description="Enquanto seu concorrente exporta ZIP, você entrega uma galeria conectada ao seu financeiro. Extras viram cobrança. Pagou, workflow avança."
        mockup={<GallerySelectMock />}
      />

      <MetricsStrip
        tone="dark"
        items={[
          { value: "R$ 0", label: "Perdido em extras cobrados no boca-a-boca" },
          { value: "1 link", label: "Sessão + extras num pagamento só" },
          { value: "R2", label: "Storage Cloudflare — sem custo extra" },
          { value: "24/7", label: "Cliente escolhe quando quiser" },
        ]}
      />

      <SectionShell>
        <Reveal>
          <div className="mb-10 max-w-[640px]">
            <EyebrowTag index="01">Dois produtos, uma alma</EyebrowTag>
            <h2
              className="mt-5 text-[36px] leading-[1.05] tracking-[-0.028em] md:text-[52px]"
              style={{
                fontFamily: '"Geist", "Inter Tight", sans-serif',
                color: "#0A0A0A",
                fontWeight: 600,
              }}
            >
              Escolha o momento{" "}
              <span className="italic" style={{ ...displayFont, color: "#b0632f", fontWeight: 400 }}>
                do cliente.
              </span>
            </h2>
            <p className="mt-5 text-[16px] leading-[1.6] text-[#0A0A0A]/70 md:text-[18px]" style={uiFont}>
              <b className="text-[#0A0A0A]">Select</b> é a hora da escolha — o cliente seleciona, você cobra
              extras. <b className="text-[#0A0A0A]">Transfer</b> é a entrega final — com senha, marca e prazo.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <ProductCard
              eyebrow="Gallery Select"
              title="A galeria que cobra extras."
              description="O cliente escolhe as fotos do pacote e paga extras sem você precisar mandar mensagem."
              bullets={[
                "Regras congeladas no momento da entrega",
                "Cobrança única (sessão + extras)",
                "Status espelhado no workflow",
              ]}
              to="/gallery/select"
              mock={<GallerySelectMock />}
            />
          </Reveal>
          <Reveal delay={0.1}>
            <ProductCard
              eyebrow="Gallery Transfer"
              title="A entrega que respeita seu trabalho."
              description="Marca d'água, senha, prazo de expiração e download em ZIP quando o cliente quiser."
              bullets={[
                "Senha e expiração por galeria",
                "Marca d'água configurável",
                "Analytics de acesso do cliente",
              ]}
              to="/gallery/transfer"
              mock={<GalleryTransferMock />}
              tone="dark"
            />
          </Reveal>
        </div>
      </SectionShell>

      <CTABlock
        title="Uma verdade só,"
        emphasis="do lead à entrega."
        description="Gallery é ainda mais forte quando conectada ao Studio Pro. Combo tem desconto."
        secondaryLabel="Ver combos"
        secondaryTo="/precos"
        tone="dark"
      />

      <FAQBlock
        title="Sobre o Gallery"
        items={[
          { q: "Preciso do Studio pra usar?", a: "Não. Funciona sozinho. Mas conectado ao Studio Pro, ganha cobrança única (sessão + extras) e sincronia de workflow." },
          { q: "Onde ficam as fotos?", a: "Cloudflare R2 (armazenamento redundante global). Você não paga storage separado." },
          { q: "Cliente precisa criar conta?", a: "Não. Acessa por link + senha. Zero fricção." },
        ]}
      />
    </>
  );
}
