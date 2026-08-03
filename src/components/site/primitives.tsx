import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Check, Minus } from "lucide-react";
import {
  SectionShell,
  EyebrowTag,
  Reveal,
  PrimaryButton,
  GhostLink,
  GridLines,
  TechLabel,
  TOKENS,
  displayFont,
  uiFont,
  monoFont,
} from "@/components/landing/primitives";
import { SectionTitle } from "@/components/site/SectionTitle";

type Tone = "light" | "dark" | "navy";

// Cada seção pinta o próprio fundo — nunca "transparent", para que o tom do
// texto e o tom do fundo andem sempre juntos (evita texto escuro sobre dark).
const toneBg = (t: Tone) =>
  t === "navy" ? TOKENS.navy : t === "dark" ? TOKENS.deep : TOKENS.paper;
const toneText = (t: Tone) => (t === "light" ? TOKENS.ink : TOKENS.paper);
const toneMuted = (t: Tone) =>
  t === "light" ? "rgba(10,10,10,0.72)" : "rgba(255,255,255,0.72)";
const toneMutedSoft = (t: Tone) =>
  t === "light" ? "rgba(10,10,10,0.62)" : "rgba(255,255,255,0.55)";
const toneHair = (t: Tone) =>
  t === "light" ? "rgba(10,10,10,0.08)" : "rgba(255,255,255,0.08)";
const toneAccent = (t: Tone) => "#C9A87C";
const asTitleTone = (t: Tone): "light" | "dark" => (t === "light" ? "light" : "dark");

/* =========================================================
   Hero FX — camadas decorativas para dar respiro premium
   ========================================================= */
function GradientHalo({ tone = "light" }: { tone?: Tone }) {
  const color = tone === "light" ? "176,99,47" : "196,122,63";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(640px 420px at 88% 18%, rgba(${color},0.12), transparent 62%), radial-gradient(520px 360px at 8% 92%, rgba(${color},0.06), transparent 60%)`,
      }}
    />
  );
}

function NoiseLayer() {
  // SVG noise inline (baixo custo, sem asset externo)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 mix-blend-multiply"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
        opacity: 0.035,
      }}
    />
  );
}

function MockPlate({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 md:-inset-8 rounded-[28px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)",
          border: `1px solid ${TOKENS.hair}`,
          boxShadow:
            "0 40px 80px -40px rgba(10,10,10,0.22), 0 2px 0 rgba(255,255,255,0.6) inset",
          backdropFilter: "blur(20px)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function ScrollHint({ index = "01", total = "06" }: { index?: string; total?: string }) {
  return (
    <div
      className="mt-16 flex items-center gap-3 text-[10px] uppercase tracking-[0.24em]"
      style={{ ...monoFont, color: "rgba(10,10,10,0.4)" }}
    >
      <span className="tabular-nums">
        {index} / {total}
      </span>
      <span className="h-px w-10 bg-[rgba(10,10,10,0.15)]" />
      <span>role para explorar</span>
    </div>
  );
}

/* =========================================================
   ProductHero — hero de página de produto (asymmetric grid)
   ========================================================= */
export function ProductHero({
  eyebrow,
  title,
  emphasis,
  description,
  primaryLabel = "Testar 30 dias grátis",
  secondaryLabel = "Ver planos",
  secondaryTo = "/precos",
  mockup,
  scrollIndex = "01",
  scrollTotal = "06",
}: {
  eyebrow: string;
  title: string;
  emphasis?: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  mockup?: ReactNode;
  scrollIndex?: string;
  scrollTotal?: string;
}) {
  const nav = useNavigate();
  return (
    <section
      className="relative overflow-hidden pt-36 pb-20 md:pt-44 md:pb-28"
      style={{ background: TOKENS.paper, color: TOKENS.ink }}
    >
      <GradientHalo />
      <GridLines />
      <NoiseLayer />
      <div className="relative mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <Reveal>
              <EyebrowTag>{eyebrow}</EyebrowTag>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                className="mt-6 text-[44px] leading-[1.02] md:text-[76px]"
                style={{ ...uiFont, color: TOKENS.ink, fontWeight: 600, letterSpacing: "-0.032em" }}
              >
                {title}
                {emphasis && (
                  <>
                    {" "}
                    <span
                      className="italic"
                      style={{ ...displayFont, color: "#C9A87C", fontWeight: 400 }}
                    >
                      {emphasis}
                    </span>
                  </>
                )}
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                className="mt-6 max-w-[520px] text-[17px] leading-[1.55] md:text-[19px]"
                style={{ ...uiFont, color: "rgba(10,10,10,0.72)" }}
              >
                {description}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <PrimaryButton onClick={() => nav("/auth")}>{primaryLabel}</PrimaryButton>
                <GhostLink onClick={() => nav(secondaryTo)}>{secondaryLabel} →</GhostLink>
              </div>
            </Reveal>
            <Reveal delay={0.22}>
              <ScrollHint index={scrollIndex} total={scrollTotal} />
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <MockPlate>{mockup}</MockPlate>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   HairlineDivider — separador editorial entre seções claras
   ========================================================= */
export function HairlineDivider() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 md:px-8">
      <div className="h-px w-full" style={{ background: TOKENS.hair }} />
    </div>
  );
}

/* =========================================================
   MetricsStrip — faixa horizontal de 3-4 métricas
   ========================================================= */
export function MetricsStrip({
  items,
  tone = "light",
}: {
  items: { value: string; label: string }[];
  tone?: Tone;
}) {
  return (
    <section
      className="relative border-y"
      style={{
        borderColor: toneHair(tone),
        background: toneBg(tone),
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div
          className="grid grid-cols-2 divide-x md:grid-cols-4"
          style={{ borderColor: toneHair(tone) }}
        >
          {items.map((m, i) => (
            <div
              key={i}
              className="px-4 py-10 md:py-14"
              style={{ borderColor: toneHair(tone) }}
            >
              <div
                className="text-[36px] leading-none tracking-[-0.02em] md:text-[52px]"
                style={{ ...uiFont, color: toneText(tone), fontWeight: 600, letterSpacing: "-0.028em" }}
              >
                {m.value}
              </div>
              <div
                className="mt-3 text-[11px] uppercase tracking-[0.2em]"
                style={{ ...monoFont, color: toneMutedSoft(tone) }}
              >
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   FeatureRow — zigzag texto/mock (alterna direção)
   ========================================================= */
export function FeatureRow({
  index,
  eyebrow,
  title,
  emphasis,
  description,
  bullets,
  mockup,
  reversed = false,
  tone = "light",
}: {
  index: string;
  eyebrow: string;
  title: string;
  emphasis?: string;
  description: string;
  bullets?: string[];
  mockup: ReactNode;
  reversed?: boolean;
  tone?: Tone;
}) {
  const isLight = tone === "light";
  return (
    <SectionShell
      className="relative isolate overflow-hidden"
    >
      {/* Background por tone */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: toneBg(tone), zIndex: 0 }}
      />
      {!isLight && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            zIndex: 0,
            background: `radial-gradient(700px 400px at 20% 10%, rgba(196,122,63,0.10), transparent 60%), radial-gradient(600px 400px at 90% 90%, rgba(6,23,32,0.6), transparent 60%)`,
          }}
        />
      )}
      <div
        className={`relative grid gap-12 md:grid-cols-2 md:items-center ${
          reversed ? "md:[&>*:first-child]:order-2" : ""
        }`}
        style={{ zIndex: 1 }}
      >
        <div>
          <Reveal>
            <EyebrowTag index={index} tone={asTitleTone(tone)}>
              {eyebrow}
            </EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <SectionTitle
              as="h2"
              size="md"
              tone={asTitleTone(tone)}
              emphasis={emphasis}
              className="mt-6"
            >
              {title}
            </SectionTitle>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="mt-5 max-w-[460px] text-[16px] leading-[1.6] md:text-[17px]"
              style={{ ...uiFont, color: toneMuted(tone) }}
            >
              {description}
            </p>
          </Reveal>
          {bullets && (
            <Reveal delay={0.15}>
              <ul className="mt-8 space-y-3" style={uiFont}>
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px]">
                    <Check
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                      strokeWidth={2.5}
                      style={{ color: toneAccent(tone) }}
                    />
                    <span style={{ color: toneMuted(tone) }}>{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
        <Reveal delay={0.2}>
          <div className="relative">{mockup}</div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* =========================================================
   CTABlock — CTA reutilizável
   ========================================================= */
export function CTABlock({
  title,
  emphasis,
  description,
  primaryLabel = "Testar 30 dias grátis",
  secondaryLabel,
  secondaryTo,
  tone = "light",
}: {
  title: string;
  emphasis?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  tone?: Tone;
}) {
  const nav = useNavigate();
  const isLight = tone === "light";
  return (
    <SectionShell className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: toneBg(tone), zIndex: 0 }}
      />
      {!isLight && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            zIndex: 0,
            background: `radial-gradient(800px 500px at 50% 0%, rgba(196,122,63,0.14), transparent 65%)`,
          }}
        />
      )}
      <div className="relative mx-auto max-w-[780px] text-center" style={{ zIndex: 1 }}>
        <Reveal>
          <SectionTitle
            as="h2"
            size="lg"
            tone={asTitleTone(tone)}
            emphasis={emphasis}
          >
            {title}
          </SectionTitle>
        </Reveal>
        {description && (
          <Reveal delay={0.05}>
            <p
              className="mx-auto mt-6 max-w-[520px] text-[16px] leading-[1.6] md:text-[18px]"
              style={{ ...uiFont, color: toneMuted(tone) }}
            >
              {description}
            </p>
          </Reveal>
        )}
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <PrimaryButton
              onClick={() => nav("/auth")}
              tone={isLight ? "light" : "dark"}
            >
              {primaryLabel}
            </PrimaryButton>
            {secondaryLabel && secondaryTo && (
              <GhostLink
                onClick={() => nav(secondaryTo)}
                tone={isLight ? "light" : "dark"}
              >
                {secondaryLabel} →
              </GhostLink>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <p
            className="mt-6 text-[12px]"
            style={{ ...uiFont, color: toneMutedSoft(tone) }}
          >
            Sem cartão de crédito · Cancele quando quiser
          </p>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* =========================================================
   FAQBlock — acordeão minimalista
   ========================================================= */
export function FAQBlock({
  items,
  title = "Perguntas frequentes",
  tone = "light",
}: {
  items: { q: string; a: string }[];
  title?: string;
  tone?: Tone;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const isLight = tone === "light";
  return (
    <SectionShell className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: toneBg(tone), zIndex: 0 }}
      />
      <div className="relative grid gap-12 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-24" style={{ zIndex: 1 }}>
        <div>
          <Reveal>
            <EyebrowTag tone={asTitleTone(tone)}>FAQ</EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <SectionTitle as="h2" size="sm" tone={asTitleTone(tone)} className="mt-6">
              {title}
            </SectionTitle>
          </Reveal>
        </div>
        <div>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b" style={{ borderColor: toneHair(tone) }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className="text-[16px] md:text-[18px]"
                    style={{
                      ...uiFont,
                      color: toneText(tone),
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {it.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    style={{ color: toneMutedSoft(tone) }}
                  />
                </button>
                {isOpen && (
                  <p
                    className="pb-6 text-[15px] leading-[1.65]"
                    style={{ ...uiFont, color: toneMuted(tone) }}
                  >
                    {it.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

/* =========================================================
   BreadcrumbTrail
   ========================================================= */
export function BreadcrumbTrail({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-28 md:px-8" style={monoFont}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A]/45">
        {items.map((it, i) => (
          <span key={i} className="flex items-center gap-2">
            {it.to ? (
              <NavLink to={it.to} className="hover:text-[#0A0A0A]">
                {it.label}
              </NavLink>
            ) : (
              <span className="text-[#0A0A0A]/70">{it.label}</span>
            )}
            {i < items.length - 1 && <span>/</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ComparisonTable — planos × features
   ========================================================= */
export type ComparisonPlan = { key: string; name: string; highlight?: boolean };
export type ComparisonRow = { group?: string; feature: string; values: Record<string, boolean | string> };

export function ComparisonTable({
  plans,
  rows,
}: {
  plans: ComparisonPlan[];
  rows: ComparisonRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left" style={uiFont}>
        <thead>
          <tr className="border-b border-[rgba(10,10,10,0.12)]">
            <th className="py-5 pr-6 text-[11px] uppercase tracking-[0.18em] text-[#0A0A0A]/50" style={monoFont}>
              Recurso
            </th>
            {plans.map((p) => (
              <th
                key={p.key}
                className={`py-5 px-4 text-[13px] ${
                  p.highlight ? "text-[#b0632f]" : "text-[#0A0A0A]"
                }`}
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isGroupHeader = !!r.group && (i === 0 || rows[i - 1].group !== r.group);
            return (
              <>
                {isGroupHeader && (
                  <tr key={`g-${i}`}>
                    <td
                      colSpan={plans.length + 1}
                      className="pt-8 pb-2 text-[10px] uppercase tracking-[0.22em] text-[#0A0A0A]/45"
                      style={monoFont}
                    >
                      {r.group}
                    </td>
                  </tr>
                )}
                <tr key={i} className="border-b border-[rgba(10,10,10,0.06)]">
                  <td className="py-4 pr-6 text-[14px] text-[#0A0A0A]/85">{r.feature}</td>
                  {plans.map((p) => {
                    const v = r.values[p.key];
                    return (
                      <td key={p.key} className="py-4 px-4 text-[13px] text-[#0A0A0A]/80">
                        {v === true ? (
                          <Check className="h-4 w-4 text-[#b0632f]" strokeWidth={2.5} />
                        ) : v === false || v === undefined ? (
                          <Minus className="h-4 w-4 text-[#0A0A0A]/25" />
                        ) : (
                          <span>{v}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Re-export primitivos consumidos por páginas */
export { SectionShell, EyebrowTag, Reveal, PrimaryButton, GhostLink, GridLines, TechLabel, SectionTitle };
export { displayFont, uiFont, monoFont };
