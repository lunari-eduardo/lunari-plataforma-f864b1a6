import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
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
  displayFont,
  uiFont,
  monoFont,
} from "@/components/site/primitives";
import { SectionTitle, SectionKicker } from "@/components/site/SectionTitle";
import { PromoBadge, PromoPriceLabel } from "@/components/site/promo/PromoParts";
import {
  PLAN_COPY,
  PRICING_FAQ,
  STUDIO_ORDER,
  DELIVER_ORDER,
  COMBO_ORDER,
} from "@/content/site/pricing";
import {
  useSitePricing,
  fmtBRL,
  type SiteUnifiedPlan,
  type SiteCreditPackage,
} from "@/hooks/site/useSitePricing";
import { usePromotions, applyPromoToCents } from "@/hooks/site/usePromotions";
import { TOKENS } from "@/components/landing/primitives";

type Cadence = "monthly" | "annual";

/* ─────────────────────────────────────────────────────────────
   Toggle mensal/anual (por camada)
   ───────────────────────────────────────────────────────────── */
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
            value === c ? "bg-[#061720] text-[#FAFAF7]" : "text-[#0A0A0A]/55 hover:text-[#0A0A0A]"
          }`}
        >
          {c === "monthly" ? "Mensal" : "Anual · -15%"}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Card de plano (usado em Studio, Deliver, Combos)
   ───────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  cadence,
  highlight,
}: {
  plan: SiteUnifiedPlan;
  cadence: Cadence;
  highlight?: boolean;
}) {
  const nav = useNavigate();
  const copy = PLAN_COPY[plan.code];
  const { byPlanCode } = usePromotions();
  const promo = byPlanCode(plan.code);

  const baseCents =
    cadence === "monthly" ? plan.monthly_price_cents : Math.round(plan.yearly_price_cents / 12);
  const { finalCents, originalCents } = applyPromoToCents(baseCents, promo);

  const isDark = !!highlight;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[16px] border p-8"
      style={{
        borderColor: isDark ? "#061720" : "rgba(10,10,10,0.1)",
        background: isDark ? TOKENS.navy : "#FFFFFF",
        color: isDark ? "#FAFAF7" : "#0A0A0A",
      }}
    >
      <div className="absolute right-6 top-6 flex gap-2">
        {promo?.badge_label ? (
          <PromoBadge label={promo.badge_label} tone={isDark ? "dark" : "light"} />
        ) : highlight ? (
          <PromoBadge label="Mais popular" tone="dark" />
        ) : null}
      </div>

      <EyebrowTag tone={isDark ? "dark" : "light"}>{plan.name}</EyebrowTag>

      <p
        className={`mt-4 text-[15px] leading-[1.5] ${
          isDark ? "text-white/65" : "text-[#0A0A0A]/60"
        }`}
        style={uiFont}
      >
        {copy?.tagline || plan.description || ""}
      </p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-[44px] leading-none tracking-[-0.02em]" style={displayFont}>
          {fmtBRL(finalCents)}
        </span>
        <span
          className={`text-[13px] ${isDark ? "text-white/50" : "text-[#0A0A0A]/50"}`}
          style={uiFont}
        >
          /mês
        </span>
      </div>

      <PromoPriceLabel
        originalCents={originalCents}
        finalCents={finalCents}
        tone={isDark ? "dark" : "light"}
      />

      {cadence === "annual" && (
        <p
          className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${
            isDark ? "text-white/45" : "text-[#0A0A0A]/45"
          }`}
          style={monoFont}
        >
          Cobrado {fmtBRL(plan.yearly_price_cents)} por ano
        </p>
      )}

      <ul className="mt-6 flex-1 space-y-2.5" style={uiFont}>
        {(copy?.features || []).map((f) => (
          <li
            key={f}
            className={`flex items-start gap-2.5 text-[13.5px] leading-[1.5] ${
              isDark ? "text-white/85" : "text-[#0A0A0A]/85"
            }`}
          >
            <Check
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: isDark ? TOKENS.emberOnDark : TOKENS.ember }}
              strokeWidth={2.5}
            />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <PrimaryButton
          onClick={() =>
            nav(`/auth?plan=${plan.code}&period=${cadence === "annual" ? "annual" : "monthly"}`)
          }
          tone={isDark ? "dark" : "light"}
        >
          Testar 30 dias grátis
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Card conceitual Gallery Select (pagamento por uso)
   ───────────────────────────────────────────────────────────── */
function GallerySelectCard({
  packages,
  fromCents,
}: {
  packages: SiteCreditPackage[];
  fromCents: number | null;
}) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[16px] border border-[rgba(10,10,10,0.1)] bg-white p-8"
      style={{ color: "#0A0A0A" }}
    >
      <EyebrowTag>Lunari Gallery Select</EyebrowTag>

      <p className="mt-4 text-[15px] leading-[1.5] text-[#0A0A0A]/60" style={uiFont}>
        Pagamento apenas por uso. Sem mensalidade. Sem desperdício.
      </p>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-[15px] uppercase tracking-[0.16em] text-[#0A0A0A]/50" style={monoFont}>
          A partir de
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[44px] leading-none tracking-[-0.02em]" style={displayFont}>
          {fromCents != null ? fmtBRL(fromCents) : "R$ 19,90"}
        </span>
        <span className="text-[13px] text-[#0A0A0A]/50" style={uiFont}>
          / pacote
        </span>
      </div>

      <ul className="mt-6 space-y-2.5" style={uiFont}>
        {[
          "Você compra um pacote quando precisa",
          "Cada galeria de seleção liberada consome 1 uso",
          "Sem limite de clientes",
          "Cobrança automática de extras (link único)",
        ].map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-[#0A0A0A]/85">
            <Check
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: TOKENS.ember }}
              strokeWidth={2.5}
            />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-6 flex w-full items-center justify-between rounded-md border border-[rgba(10,10,10,0.1)] bg-[rgba(10,10,10,0.02)] px-4 py-3 text-left transition-colors hover:bg-[rgba(10,10,10,0.04)]"
        style={uiFont}
      >
        <span className="text-[13px] font-medium">Ver todas as faixas de pacote</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 overflow-hidden rounded-md border border-[rgba(10,10,10,0.08)]">
          <table className="w-full text-left" style={uiFont}>
            <thead>
              <tr
                className="border-b border-[rgba(10,10,10,0.06)] bg-[rgba(10,10,10,0.02)]"
                style={monoFont}
              >
                <th className="px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]/55">
                  Pacote
                </th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]/55">
                  Galerias
                </th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-[0.16em] text-[#0A0A0A]/55">
                  Preço
                </th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-b border-[rgba(10,10,10,0.04)] last:border-0">
                  <td className="px-4 py-2.5 text-[13px]">{p.name}</td>
                  <td className="px-4 py-2.5 text-right text-[13px] tabular-nums">
                    {p.credits.toLocaleString("pt-BR")}
                  </td>
                  <td
                    className="px-4 py-2.5 text-right text-[13px] font-medium tabular-nums"
                    style={{ color: TOKENS.ember }}
                  >
                    {fmtBRL(p.price_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <PrimaryButton onClick={() => nav("/auth?product=gallery_select")}>
          Começar sem mensalidade
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Wrapper de camada (Studio / Select / Deliver / Combos)
   ───────────────────────────────────────────────────────────── */
function PricingLayer({
  index,
  kicker,
  title,
  emphasis,
  description,
  children,
  action,
}: {
  index: string;
  kicker: string;
  title: string;
  emphasis?: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <SectionShell className="border-t border-[rgba(10,10,10,0.06)]">
      <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-16">
        <div>
          <Reveal>
            <EyebrowTag index={index}>{kicker}</EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <SectionTitle emphasis={emphasis} size="md" className="mt-5">
              {title}
            </SectionTitle>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[15px] leading-[1.6] text-[#0A0A0A]/70" style={uiFont}>
              {description}
            </p>
          </Reveal>
          {action && (
            <Reveal delay={0.15}>
              <div className="mt-6">{action}</div>
            </Reveal>
          )}
        </div>
        <div>
          <Reveal delay={0.1}>{children}</Reveal>
        </div>
      </div>
    </SectionShell>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
   ───────────────────────────────────────────────────────────── */
export default function PrecosPage() {
  const nav = useNavigate();
  const [studioCadence, setStudioCadence] = useState<Cadence>("monthly");
  const [deliverCadence, setDeliverCadence] = useState<Cadence>("monthly");
  const [comboOpen, setComboOpen] = useState(false);

  const { studioPlans, transferPlans, comboPlans, selectPackages, selectFromCents, isLoading } =
    useSitePricing();

  const orderedStudio = useMemo(
    () =>
      STUDIO_ORDER.map((code) => studioPlans.find((p) => p.code === code)).filter(
        (p): p is SiteUnifiedPlan => !!p,
      ),
    [studioPlans],
  );

  const orderedDeliver = useMemo(
    () =>
      DELIVER_ORDER.map((code) => transferPlans.find((p) => p.code === code)).filter(
        (p): p is SiteUnifiedPlan => !!p,
      ),
    [transferPlans],
  );

  const orderedCombos = useMemo(
    () =>
      COMBO_ORDER.map((code) => comboPlans.find((p) => p.code === code)).filter(
        (p): p is SiteUnifiedPlan => !!p,
      ),
    [comboPlans],
  );

  return (
    <>
      <SEOHead
        title="Preços · Lunari"
        description="Studio a partir de R$ 14,90/mês. Gallery Select paga só quando usar. Gallery Deliver por faixa de armazenamento. 30 dias grátis."
        canonical="https://lunarihub.com/precos"
        ogType="website"
      />

      {/* Hero */}
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
              className="mt-6 text-[44px] leading-[1.02] tracking-[-0.03em] text-[#0A0A0A] md:text-[76px]"
              style={{ ...displayFont }}
            >
              Um preço que{" "}
              <span className="italic" style={{ color: TOKENS.ember }}>
                cabe.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="mx-auto mt-6 max-w-[600px] text-[17px] leading-[1.55] text-[#0A0A0A]/70 md:text-[19px]"
              style={uiFont}
            >
              Comece pelo Studio. Só adicione Select ou Deliver{" "}
              <em style={{ ...displayFont, color: TOKENS.ember }}>se precisar</em>. Sem taxa por
              transação. Sem cobrar por foto.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Camada 1 — STUDIO */}
      <PricingLayer
        index="01"
        kicker="Studio"
        title="Comece por aqui."
        emphasis="É o cérebro."
        description="Agenda, CRM, workflow, financeiro e contratos. O estúdio inteiro operando como uma coisa só. Tem plano pra quem tá saindo da planilha e pra quem já roda estúdio pesado."
        action={<CadenceToggle value={studioCadence} onChange={setStudioCadence} />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          {isLoading && orderedStudio.length === 0
            ? [1, 2].map((i) => <SkeletonCard key={i} />)
            : orderedStudio.map((p, i) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  cadence={studioCadence}
                  highlight={p.code === "studio_pro"}
                />
              ))}
        </div>
      </PricingLayer>

      {/* Separador: se você entrega seleção */}
      <SectionSeparator text="Se você entrega seleção..." />

      {/* Camada 2 — GALLERY SELECT (pago por uso) */}
      <PricingLayer
        index="02"
        kicker="Gallery Select"
        title="Pague apenas"
        emphasis="quando usar."
        description="Você utiliza somente quando entrega galerias de seleção. Compra um pacote de uso, cada galeria libera consome 1 uso. Quando acabar, você compra outro — ou nem compra. Sem mensalidade. Sem limite de clientes."
      >
        <GallerySelectCard packages={selectPackages} fromCents={selectFromCents} />
      </PricingLayer>

      {/* Separador: se você entrega galerias finais */}
      <SectionSeparator text="Se você entrega galerias finais..." />

      {/* Camada 3 — GALLERY DELIVER */}
      <PricingLayer
        index="03"
        kicker="Gallery Deliver"
        title="Escolha o armazenamento"
        emphasis="que precisa."
        description="Entrega final para o cliente — com senha, marca do estúdio e prazo de expiração. Assinatura por faixa de GB. Você começa pelo menor e sobe conforme cresce."
        action={<CadenceToggle value={deliverCadence} onChange={setDeliverCadence} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && orderedDeliver.length === 0
            ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} compact />)
            : orderedDeliver.map((p) => <DeliverCard key={p.id} plan={p} cadence={deliverCadence} />)}
        </div>
      </PricingLayer>

      {/* Combos — colapsado por padrão */}
      {orderedCombos.length > 0 && (
        <SectionShell className="border-t border-[rgba(10,10,10,0.06)]">
          <div className="mx-auto max-w-[900px] text-center">
            <button
              onClick={() => setComboOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(10,10,10,0.12)] px-5 py-2.5 text-[13px] text-[#0A0A0A] transition-colors hover:bg-[rgba(10,10,10,0.03)]"
              style={uiFont}
            >
              <span>Prefere um combo com desconto?</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${comboOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {comboOpen && (
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {orderedCombos.map((p) => (
                <PlanCard key={p.id} plan={p} cadence="monthly" />
              ))}
            </div>
          )}
        </SectionShell>
      )}

      {/* FAQ */}
      <FAQBlock items={PRICING_FAQ} />

      {/* CTA final */}
      <SectionShell className="text-center">
        <Reveal>
          <SectionTitle emphasis="dúvida?" size="lg" as="h2">
            Ainda em
          </SectionTitle>
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

/* ─────────────────────────────────────────────────────────────
   Separator entre camadas — frase-âncora
   ───────────────────────────────────────────────────────────── */
function SectionSeparator({ text }: { text: string }) {
  return (
    <div className="relative py-6 md:py-10">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="flex items-center justify-center gap-4">
          <span
            className="h-px flex-1"
            style={{ background: "linear-gradient(to right, transparent, rgba(10,10,10,0.14), transparent)" }}
          />
          <span
            className="text-[15px] italic md:text-[17px]"
            style={{ ...displayFont, color: TOKENS.ember }}
          >
            {text}
          </span>
          <span
            className="h-px flex-1"
            style={{ background: "linear-gradient(to right, transparent, rgba(10,10,10,0.14), transparent)" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Card compacto para Gallery Deliver
   ───────────────────────────────────────────────────────────── */
function DeliverCard({ plan, cadence }: { plan: SiteUnifiedPlan; cadence: Cadence }) {
  const nav = useNavigate();
  const { byPlanCode } = usePromotions();
  const promo = byPlanCode(plan.code);
  const baseCents =
    cadence === "monthly" ? plan.monthly_price_cents : Math.round(plan.yearly_price_cents / 12);
  const { finalCents, originalCents } = applyPromoToCents(baseCents, promo);

  const gb = plan.transfer_storage_bytes / (1024 * 1024 * 1024);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[14px] border border-[rgba(10,10,10,0.1)] bg-white p-5">
      {promo?.badge_label && (
        <div className="absolute right-4 top-4">
          <PromoBadge label={promo.badge_label} />
        </div>
      )}
      <div
        className="text-[10px] uppercase tracking-[0.18em] text-[#0A0A0A]/55"
        style={monoFont}
      >
        {gb ? `${Math.round(gb)} GB` : plan.code.replace("transfer_", "").toUpperCase()}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[32px] leading-none tracking-[-0.02em]" style={displayFont}>
          {fmtBRL(finalCents)}
        </span>
        <span className="text-[12px] text-[#0A0A0A]/50" style={uiFont}>
          /mês
        </span>
      </div>
      <PromoPriceLabel originalCents={originalCents} finalCents={finalCents} />
      {cadence === "annual" && (
        <p
          className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#0A0A0A]/45"
          style={monoFont}
        >
          {fmtBRL(plan.yearly_price_cents)}/ano
        </p>
      )}
      <p className="mt-3 text-[13px] leading-[1.5] text-[#0A0A0A]/70" style={uiFont}>
        {PLAN_COPY[plan.code]?.tagline || `${Math.round(gb)} GB de armazenamento.`}
      </p>
      <button
        onClick={() =>
          nav(`/auth?plan=${plan.code}&period=${cadence === "annual" ? "annual" : "monthly"}`)
        }
        className="mt-5 rounded-md border border-[rgba(10,10,10,0.12)] px-4 py-2 text-[12px] font-medium text-[#0A0A0A] transition-colors hover:bg-[rgba(10,10,10,0.03)]"
        style={uiFont}
      >
        Assinar →
      </button>
    </div>
  );
}

/* Skeleton simples pra loading */
function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-[16px] border border-[rgba(10,10,10,0.08)] bg-white ${
        compact ? "p-5" : "p-8"
      }`}
    >
      <div className="h-3 w-24 rounded bg-[rgba(10,10,10,0.06)]" />
      <div className={`mt-4 h-8 w-40 rounded bg-[rgba(10,10,10,0.06)] ${compact ? "h-6 w-24" : ""}`} />
      <div className="mt-6 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 w-full rounded bg-[rgba(10,10,10,0.05)]" />
        ))}
      </div>
    </div>
  );
}
