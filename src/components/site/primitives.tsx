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
  displayFont,
  uiFont,
  monoFont,
} from "@/components/landing/primitives";

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
}: {
  eyebrow: string;
  title: string;
  emphasis?: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  mockup?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <section className="relative overflow-hidden pt-36 pb-16 md:pt-44 md:pb-24">
      <GridLines />
      <div className="relative mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <Reveal>
              <EyebrowTag>{eyebrow}</EyebrowTag>
            </Reveal>
            <Reveal delay={0.05}>
              <h1
                className="mt-6 text-[44px] leading-[1.02] tracking-[-0.03em] text-[#0A0A0A] md:text-[76px]"
                style={displayFont}
              >
                {title}
                {emphasis && (
                  <>
                    {" "}
                    <span className="italic text-[#FF5A1F]">{emphasis}</span>
                  </>
                )}
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                className="mt-6 max-w-[520px] text-[17px] leading-[1.55] text-[#0A0A0A]/70 md:text-[19px]"
                style={uiFont}
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
          </div>

          <Reveal delay={0.2}>
            <div className="relative">{mockup}</div>
          </Reveal>
        </div>
      </div>
    </section>
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
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <section
      className="relative border-y"
      style={{
        borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)",
        background: dark ? "#0F0F10" : "transparent",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-2 divide-x md:grid-cols-4"
          style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)" }}
        >
          {items.map((m, i) => (
            <div
              key={i}
              className="px-4 py-10 md:py-14"
              style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)" }}
            >
              <div
                className="text-[36px] leading-none tracking-[-0.02em] md:text-[52px]"
                style={{ ...displayFont, color: dark ? "#FAFAF7" : "#0A0A0A" }}
              >
                {m.value}
              </div>
              <div
                className="mt-3 text-[11px] uppercase tracking-[0.2em]"
                style={{ ...monoFont, color: dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,10,0.5)" }}
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
  description,
  bullets,
  mockup,
  reversed = false,
  tone = "light",
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  mockup: ReactNode;
  reversed?: boolean;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <SectionShell className={dark ? "bg-[#0F0F10] text-[#FAFAF7]" : ""}>
      <div
        className={`grid gap-12 md:grid-cols-2 md:items-center ${
          reversed ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div>
          <Reveal>
            <EyebrowTag index={index} tone={dark ? "dark" : "light"}>
              {eyebrow}
            </EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mt-6 text-[32px] leading-[1.05] tracking-[-0.025em] md:text-[48px]"
              style={displayFont}
            >
              {title}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className={`mt-5 max-w-[460px] text-[16px] leading-[1.6] md:text-[17px] ${
                dark ? "text-[rgba(255,255,255,0.7)]" : "text-[#0A0A0A]/70"
              }`}
              style={uiFont}
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
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF5A1F]"
                      strokeWidth={2.5}
                    />
                    <span className={dark ? "text-[rgba(255,255,255,0.8)]" : "text-[#0A0A0A]/80"}>
                      {b}
                    </span>
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
  tone?: "light" | "dark";
}) {
  const nav = useNavigate();
  const dark = tone === "dark";
  return (
    <SectionShell className={dark ? "bg-[#0F0F10] text-[#FAFAF7]" : ""}>
      <div className="mx-auto max-w-[780px] text-center">
        <Reveal>
          <h2
            className="text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[64px]"
            style={displayFont}
          >
            {title}
            {emphasis && (
              <>
                {" "}
                <span className="italic text-[#FF5A1F]">{emphasis}</span>
              </>
            )}
          </h2>
        </Reveal>
        {description && (
          <Reveal delay={0.05}>
            <p
              className={`mx-auto mt-6 max-w-[520px] text-[16px] leading-[1.6] md:text-[18px] ${
                dark ? "text-[rgba(255,255,255,0.7)]" : "text-[#0A0A0A]/70"
              }`}
              style={uiFont}
            >
              {description}
            </p>
          </Reveal>
        )}
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <PrimaryButton onClick={() => nav("/auth")} tone={dark ? "dark" : "light"}>
              {primaryLabel}
            </PrimaryButton>
            {secondaryLabel && secondaryTo && (
              <GhostLink onClick={() => nav(secondaryTo)} tone={dark ? "dark" : "light"}>
                {secondaryLabel} →
              </GhostLink>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <p
            className={`mt-6 text-[12px] ${
              dark ? "text-[rgba(255,255,255,0.45)]" : "text-[#0A0A0A]/45"
            }`}
            style={uiFont}
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
}: {
  items: { q: string; a: string }[];
  title?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SectionShell>
      <div className="grid gap-12 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-24">
        <div>
          <Reveal>
            <EyebrowTag>FAQ</EyebrowTag>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mt-6 text-[32px] leading-[1.05] tracking-[-0.025em] md:text-[44px]"
              style={displayFont}
            >
              {title}
            </h2>
          </Reveal>
        </div>
        <div>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-[rgba(10,10,10,0.08)]">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className="text-[16px] font-medium text-[#0A0A0A] md:text-[18px]"
                    style={uiFont}
                  >
                    {it.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-[#0A0A0A]/50 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p
                    className="pb-6 text-[15px] leading-[1.65] text-[#0A0A0A]/70"
                    style={uiFont}
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
                  p.highlight ? "text-[#FF5A1F]" : "text-[#0A0A0A]"
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
                          <Check className="h-4 w-4 text-[#FF5A1F]" strokeWidth={2.5} />
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
export { SectionShell, EyebrowTag, Reveal, PrimaryButton, GhostLink, GridLines, TechLabel };
export { displayFont, uiFont, monoFont };
