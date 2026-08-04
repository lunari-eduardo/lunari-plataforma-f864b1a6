import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SiteH2, SiteEyebrow, SiteLead, SiteBody, SiteReveal } from "./typography";
import { NavLink } from "react-router-dom";
import { TOKENS as LANDING_TOKENS } from "@/components/landing/primitives";
import { SectionTitle } from "./SectionTitle";

export const TOKENS = LANDING_TOKENS;

export function PrimaryButton({ 
  children, 
  to, 
  className,
  tone = "light",
  onClick 
}: { 
  children: ReactNode; 
  to?: string; 
  className?: string;
  tone?: "light" | "dark";
  onClick?: () => void;
}) {
  const baseCls = cn(
    "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm transition-all hover:-translate-y-1 cursor-pointer",
    tone === "light" 
      ? "bg-site-gold text-site-graphite hover:bg-site-goldPale shadow-[0_10px_20px_-10px_rgba(201,168,124,0.3)]" 
      : "bg-site-on-dark text-site-graphite hover:bg-white",
    className
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseCls} type="button">
        {children}
      </button>
    );
  }

  return (
    <NavLink to={to || "#"} className={baseCls}>
      {children}
    </NavLink>
  );
}

export function GhostLink({ 
  children, 
  to, 
  className,
  tone = "light",
  onClick
}: { 
  children: ReactNode; 
  to?: string; 
  className?: string;
  tone?: "light" | "dark";
  onClick?: () => void;
}) {
  const baseCls = cn(
    "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm border transition-all cursor-pointer",
    tone === "light"
      ? "border-site-line-light text-site-ink hover:border-site-gold"
      : "border-site-line-dark text-site-on-dark hover:border-site-on-dark",
    className
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseCls} type="button">
        {children}
      </button>
    );
  }

  return (
    <NavLink to={to || "#"} className={baseCls}>
      {children}
    </NavLink>
  );
}

export type SiteTone = "dark" | "light";

/**
 * Contrato único de seção do site.
 * O tom define fundo + cor de texto + cor de borda. Nenhuma seção
 * deve declarar fundo solto — assim a alternância claro/escuro nunca
 * gera texto ilegível.
 */
export function SiteSection({
  children,
  className = "",
  innerClassName = "",
  id,
  tone = "light",
  bleed = false,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  id?: string;
  tone?: SiteTone;
  bleed?: boolean;
}) {
  const toneCls =
    tone === "dark"
      ? "bg-site-graphite text-site-on-dark"
      : "bg-site-warmwhite text-site-ink";

  return (
    <section
      id={id}
      data-tone={tone}
      className={cn("relative w-full overflow-hidden py-16 md:py-32", toneCls, className)}
    >
      {bleed ? (
        children
      ) : (
        <div className={cn("relative mx-auto w-full max-w-[1200px] px-6 md:px-10", innerClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}

export function SectionShell({
  children,
  className = "",
  id,
  tone,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: any;
}) {
  return (
    <SiteSection id={id} tone={tone === "dark" ? "dark" : "light"} className={className}>
      {children}
    </SiteSection>
  );
}

export function GridLines({
  tone = "light",
  className = "",
}: {
  tone?: any;
  className?: string;
}) {
  const color = tone === "dark" ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.04)";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px)`,
        backgroundSize: "96px 100%",
        maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
      }}
    />
  );
}

// Re-exports/shims para compatibilidade legada
export { SectionTitle };
export function EyebrowTag({ 
  children, 
  className, 
  index, 
  tone 
}: { 
  children: ReactNode; 
  className?: string; 
  index?: string; 
  tone?: any; 
}) {
  return <SiteEyebrow className={className}>{children}</SiteEyebrow>;
}
export function Reveal({ 
  children, 
  className, 
  delay, 
  y, 
  tone 
}: { 
  children: ReactNode; 
  className?: string; 
  delay?: number; 
  y?: any; 
  tone?: any; 
}) {
  return <SiteReveal className={className} delay={delay}>{children}</SiteReveal>;
}

export const displayFont = { fontFamily: '"Instrument Serif", serif' };
export const uiFont = { fontFamily: '"Geist", sans-serif' };
export const monoFont = { fontFamily: '"Geist Mono", monospace' };

/* -------------------------------------------------------------------------
 * Blocos de página de produto
 * ---------------------------------------------------------------------- */

export function BreadcrumbTrail({ items = [] }: { items: { label: string; to?: string }[] }) {
  return (
    <nav
      aria-label="Trilha de navegação"
      className="pt-28 md:pt-32"
    >
      <ol className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-inherit opacity-60 md:px-10">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.to ? (
              <NavLink to={item.to} className="transition-colors hover:text-site-gold">
                {item.label}
              </NavLink>
            ) : (
              <span className="text-site-gold">{item.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ProductHero({
  eyebrow,
  title,
  emphasis,
  description,
  mockup,
  primaryLabel = "TESTAR GRÁTIS",
  primaryTo = "/auth",
}: {
  eyebrow?: string;
  title: ReactNode;
  emphasis?: string;
  description?: string;
  mockup?: ReactNode;
  primaryLabel?: string;
  primaryTo?: string;
}) {
  return (
    <section data-tone="dark" className="relative overflow-hidden bg-site-graphite pb-20 pt-10 md:pb-28 md:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-[520px] w-[720px] translate-x-1/3 -translate-y-1/3 rounded-full bg-site-gold/10 blur-[120px]"
      />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-10">
        <div>
          {eyebrow && <SiteEyebrow>{eyebrow}</SiteEyebrow>}
          <SiteReveal>
            <SiteH2 tone="dark" emphasis={emphasis}>
              {title}
            </SiteH2>
          </SiteReveal>
          {description && (
            <SiteReveal delay={120}>
              <SiteLead tone="dark" className="mt-6 max-w-xl">
                {description}
              </SiteLead>
            </SiteReveal>
          )}
          <SiteReveal delay={200}>
            <div className="mt-9 flex flex-wrap gap-4">
              <PrimaryButton to={primaryTo}>{primaryLabel}</PrimaryButton>
              <GhostLink to="/precos" tone="dark">
                Ver planos
              </GhostLink>
            </div>
          </SiteReveal>
        </div>
        {mockup && (
          <SiteReveal delay={260} className="min-w-0">
            {mockup}
          </SiteReveal>
        )}
      </div>
    </section>
  );
}

export function MetricsStrip({ items = [], tone = "dark" }: { items: { value: string; label: string }[]; tone?: any }) {
  const dark = tone !== "light";
  return (
    <section data-tone={dark ? "dark" : "light"} className={cn("py-12 md:py-16 border-y", dark ? "border-site-line-dark bg-site-graphiteSoft" : "border-site-line-light bg-site-offwhite")}>
      <div className="mx-auto grid max-w-[1200px] gap-8 px-6 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
        {items.map((m) => (
          <div key={m.label}>
            <p className="text-2xl font-semibold text-site-gold md:text-3xl">{m.value}</p>
            <p className={cn("mt-2 text-sm leading-relaxed", dark ? "text-site-on-dark-muted" : "text-site-ink-muted")}>{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeatureRow({
  index,
  eyebrow,
  title,
  emphasis,
  description,
  bullets = [],
  mockup,
  reversed = false,
  tone,
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  emphasis?: string;
  description?: string;
  bullets?: string[];
  mockup?: ReactNode;
  reversed?: boolean;
  tone?: any;
}) {
  const dark = tone === "dark" || tone === "navy";
  return (
    <section
      data-tone={dark ? "dark" : "light"}
      className={cn(
        "overflow-hidden py-16 md:py-28",
        dark ? "bg-site-graphite text-site-on-dark" : "bg-site-warmwhite text-site-ink"
      )}
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-10">
        <div className={cn("min-w-0", reversed && "md:order-2")}>
          <SiteEyebrow>
            {index ? `${index} · ${eyebrow ?? ""}` : eyebrow}
          </SiteEyebrow>
          <SiteReveal>
            <SiteH2 tone={dark ? "dark" : "light"} emphasis={emphasis}>
              {title}
            </SiteH2>
          </SiteReveal>
          {description && (
            <SiteReveal delay={100}>
              <SiteBody tone={dark ? "dark" : "light"} className="mt-5 max-w-xl">
                {description}
              </SiteBody>
            </SiteReveal>
          )}
          {bullets.length > 0 && (
            <SiteReveal delay={180}>
              <ul className="mt-7 space-y-3">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-site-gold" />
                    <span className={dark ? "text-site-on-dark-muted" : "text-site-ink-muted"}>{b}</span>
                  </li>
                ))}
              </ul>
            </SiteReveal>
          )}
        </div>
        {mockup && (
          <SiteReveal delay={220} className={cn("min-w-0", reversed && "md:order-1")}>
            {mockup}
          </SiteReveal>
        )}
      </div>
    </section>
  );
}

export function CTABlock({
  title,
  emphasis,
  description,
  primaryLabel = "TESTAR GRÁTIS",
  primaryTo = "/auth",
  secondaryLabel,
  secondaryTo,
  tone = "dark",
}: {
  title: ReactNode;
  emphasis?: string;
  description?: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  tone?: any;
}) {
  const dark = tone !== "light";
  return (
    <section
      data-tone={dark ? "dark" : "light"}
      className={cn(
        "relative overflow-hidden py-20 md:py-28",
        dark ? "bg-site-graphite text-site-on-dark" : "bg-site-offwhite text-site-ink"
      )}
    >
      <div className="relative mx-auto max-w-[820px] px-6 text-center md:px-10">
        <SiteReveal>
          <SiteH2 tone={dark ? "dark" : "light"} emphasis={emphasis}>
            {title}
          </SiteH2>
        </SiteReveal>
        {description && (
          <SiteReveal delay={100}>
            <SiteLead tone={dark ? "dark" : "light"} className="mx-auto mt-6 max-w-xl">
              {description}
            </SiteLead>
          </SiteReveal>
        )}
        <SiteReveal delay={180}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <PrimaryButton to={primaryTo}>{primaryLabel}</PrimaryButton>
            {secondaryLabel && (
              <GhostLink to={secondaryTo} tone={dark ? "dark" : "light"}>
                {secondaryLabel}
              </GhostLink>
            )}
          </div>
        </SiteReveal>
      </div>
    </section>
  );
}

export function FAQBlock({
  title = "Perguntas frequentes",
  items = [],
}: {
  title?: string;
  items: { q: string; a: string }[];
}) {
  return (
    <section data-tone="light" className="bg-site-warmwhite py-16 md:py-28">
      <div className="mx-auto max-w-[820px] px-6 md:px-10">
        <SiteReveal>
          <SiteH2 tone="light">{title}</SiteH2>
        </SiteReveal>
        <dl className="mt-10 divide-y divide-site-line-light border-t border-site-line-light">
          {items.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="text-base font-semibold text-site-ink">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-site-ink-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
