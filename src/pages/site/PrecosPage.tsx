import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  SectionShell,
  EyebrowTag,
  Reveal,
  PrimaryButton,
  GhostLink,
  GridLines,
  BreadcrumbTrail,
  FAQBlock,
  ComparisonTable,
  displayFont,
  uiFont,
  monoFont,
} from "@/components/site/primitives";
import { PLANS, formatBRL, PRICING_FAQ, type Cadence, type Plan } from "@/content/site/pricing";

function CadenceToggle({ value, onChange }: { value: Cadence; onChange: (c: Cadence) => void }) {
  return (
    <div
      className="inline-flex rounded-full border border-[rgba(10,10,10,0.12)] bg-white p-1"
      style={monoFont}
    >
      {(["monthly", "annual"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors ${
            value === c ? "bg-[#0A0A0A] text-[#FAFAF7]" : "text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
          }`}
        >
          {c === "monthly" ? "Mensal" : "Anual · -15%"}
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, cadence }: { plan: Plan; cadence: Cadence }) {
  const nav = useNavigate();
  const price = cadence === "monthly" ? plan.monthly : plan.annual / 12;
  const highlight = plan.highlight;
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[16px] border p-8"
      style={{
        borderColor: highlight ? "#0A0A0A" : "rgba(10,10,10,0.1)",
        background: highlight ? "#0A0A0A" : "#FFFFFF",
        color: highlight ? "#FAFAF7" : "#0A0A0A",
      }}
    >
      {highlight && (
        <span
          className="absolute right-6 top-6 rounded-full bg-[#FF5A1F] px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white"
          style={monoFont}
        >
          Mais popular
        </span>
      )}
      <EyebrowTag tone={highlight ? "dark" : "light"}>{plan.name}</EyebrowTag>
      <p
        className={`mt-4 text-[15px] leading-[1.5] ${
          highlight ? "text-white/65" : "text-[#0A0A0A]/60"
        }`}
        style={uiFont}
      >
        {plan.tagline}
      </p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-[44px] leading-none tracking-[-0.02em]" style={displayFont}>
          {formatBRL(price)}
        </span>
        <span className={`text-[13px] ${highlight ? "text-white/50" : "text-[#0A0A0A]/50"}`} style={uiFont}>
          /mês
        </span>
      </div>
      {cadence === "annual" && (
        <p
          className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${
            highlight ? "text-white/45" : "text-[#0A0A0A]/45"
          }`}
          style={monoFont}
        >
          Cobrado {formatBRL(plan.annual)} por ano
        </p>
      )}
      <ul className="mt-6 flex-1 space-y-2.5" style={uiFont}>
        {plan.features.map((f) => (
          <li
            key={f}
            className={`flex items-start gap-2.5 text-[13.5px] leading-[1.5] ${
              highlight ? "text-white/85" : "text-[#0A0A0A]/85"
            }`}
          >
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF5A1F]" strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <PrimaryButton onClick={() => nav("/auth")} tone={highlight ? "dark" : "light"}>
          Testar 30 dias grátis
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function PrecosPage() {
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const nav = useNavigate();

  const comparisonRows = useMemo(
    () => [
      { group: "Studio", feature: "Agenda + CRM", values: { starter: true, pro: true, gallery: false, bundle: true } },
      { group: "Studio", feature: "Workflow", values: { starter: true, pro: true, gallery: false, bundle: true } },
      { group: "Studio", feature: "Financeiro (PIX + gateways)", values: { starter: false, pro: true, gallery: false, bundle: true } },
      { group: "Studio", feature: "Leads e Tarefas", values: { starter: false, pro: true, gallery: false, bundle: true } },
      { group: "Studio", feature: "Análise de vendas + metas", values: { starter: false, pro: true, gallery: false, bundle: true } },
      { group: "Gallery", feature: "Gallery Select", values: { starter: false, pro: false, gallery: true, bundle: true } },
      { group: "Gallery", feature: "Gallery Transfer", values: { starter: false, pro: false, gallery: true, bundle: true } },
      { group: "Gallery", feature: "Storage Cloudflare R2", values: { starter: false, pro: false, gallery: true, bundle: true } },
      { group: "Gallery", feature: "Cobrança única (sessão + extras)", values: { starter: false, pro: false, gallery: false, bundle: true } },
      { group: "Suporte", feature: "WhatsApp business hours", values: { starter: true, pro: true, gallery: true, bundle: true } },
      { group: "Suporte", feature: "Suporte prioritário", values: { starter: false, pro: false, gallery: false, bundle: true } },
    ],
    [],
  );

  return (
    <>
      <SEOHead
        title="Preços · Lunari"
        description="Planos honestos, sem taxa por transação. Studio a partir de R$ 14,90/mês, Gallery integrada e combo com desconto. 30 dias grátis."
        canonical="https://lunarihub.com/precos"
        ogType="website"
      />

      <section className="relative overflow-hidden pt-36 pb-16 md:pt-44 md:pb-20">
        <GridLines />
        <div className="relative mx-auto max-w-[900px] px-6 text-center md:px-8">
          <BreadcrumbTrail items={[{ label: "Início", to: "/" }, { label: "Preços" }]} />
          <Reveal>
            <div className="mt-2 flex justify-center">
              <EyebrowTag>Preços</EyebrowTag>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1
              className="mt-6 text-[44px] leading-[1.02] tracking-[-0.03em] md:text-[76px]"
              style={displayFont}
            >
              Um preço que <span className="italic text-[#FF5A1F]">cabe.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="mx-auto mt-6 max-w-[560px] text-[17px] leading-[1.55] text-[#0A0A0A]/70 md:text-[19px]"
              style={uiFont}
            >
              Sem taxa por transação. Sem cobrar por foto. 30 dias grátis pra testar tudo.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-10 flex justify-center">
              <CadenceToggle value={cadence} onChange={setCadence} />
            </div>
          </Reveal>
        </div>
      </section>

      <SectionShell className="pt-4">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.05}>
              <PlanCard plan={p} cadence={cadence} />
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="border-t border-[rgba(10,10,10,0.08)]">
        <div className="mb-10">
          <Reveal>
            <EyebrowTag index="Comparar">Recursos por plano</EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mt-5 text-[32px] leading-[1.05] tracking-[-0.025em] md:text-[44px]"
              style={displayFont}
            >
              Tudo lado a lado.
            </h2>
          </Reveal>
        </div>
        <Reveal>
          <ComparisonTable
            plans={[
              { key: "starter", name: "Starter" },
              { key: "pro", name: "Studio Pro", highlight: true },
              { key: "gallery", name: "Gallery" },
              { key: "bundle", name: "Pro + Gallery" },
            ]}
            rows={comparisonRows}
          />
        </Reveal>
      </SectionShell>

      <FAQBlock items={PRICING_FAQ} />

      <SectionShell className="text-center">
        <Reveal>
          <h2
            className="text-[36px] leading-[1.05] tracking-[-0.025em] md:text-[52px]"
            style={displayFont}
          >
            Ainda em dúvida?
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p
            className="mx-auto mt-4 max-w-[480px] text-[16px] text-[#0A0A0A]/70"
            style={uiFont}
          >
            Fale com a gente. 15 minutos, sem enrolação, sem venda.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <PrimaryButton onClick={() => nav("/auth")}>Testar 30 dias grátis</PrimaryButton>
            <GhostLink onClick={() => nav("/contato")}>Falar com a Lunari →</GhostLink>
          </div>
        </Reveal>
      </SectionShell>
    </>
  );
}
