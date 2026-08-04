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
    "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm transition-all hover:-translate-y-1",
    tone === "light" 
      ? "bg-site-gold text-site-graphite hover:bg-site-goldPale shadow-[0_10px_20px_-10px_rgba(201,168,124,0.3)]" 
      : "bg-site-on-dark text-site-graphite hover:bg-white",
    className
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseCls}>
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
    "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm border transition-all",
    tone === "light"
      ? "border-site-line-light text-site-ink hover:border-site-gold"
      : "border-site-line-dark text-site-on-dark hover:border-site-on-dark",
    className
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseCls}>
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

export function SectionShell({
  children,
  className = "",
  id,
  tone,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: any; // flexível para tipos legados ("light" | "dark")
}) {
  const isDark = tone === "dark";
  const toneCls = isDark
      ? "bg-site-graphite text-site-on-dark"
      : "bg-site-warmwhite text-site-ink";
  return (
    <section id={id} className={cn("relative w-full py-24 md:py-32", toneCls, className)}>
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">{children}</div>
    </section>
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
export function EyebrowTag({ children, className, index, tone }: { children: ReactNode; className?: string; index?: string; tone?: any }) {
  return <SiteEyebrow className={className}>{children}</SiteEyebrow>;
}
export function Reveal({ children, className, delay, y, tone }: { children: ReactNode; className?: string; delay?: number; y?: number; tone?: any }) {
  return <SiteReveal className={className} delay={delay}>{children}</SiteReveal>;
}

export const displayFont = { fontFamily: '"Instrument Serif", serif' };
export const uiFont = { fontFamily: '"Geist", sans-serif' };
export const monoFont = { fontFamily: '"Geist Mono", monospace' };

// Shims para tipos/componentes ausentes que as páginas pedem
export const BreadcrumbTrail = ({ items }: { items: any[] }) => null;
export const ProductHero = (props: any) => null;
export const FeatureRow = (props: any) => null;
export const MetricsStrip = (props: any) => null;
export const CTABlock = (props: any) => null;
export const FAQBlock = (props: any) => null;
