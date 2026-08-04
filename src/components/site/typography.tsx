import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SITE_COLORS, SITE_THEME } from "./theme";
import { useReveal } from "@/hooks/use-reveal";

type Tone = "light" | "dark";

export function SiteReveal({ 
  children, 
  className, 
  delay = 0,
  as: Tag = "div"
}: { 
  children: ReactNode; 
  className?: string; 
  delay?: number;
  as?: any;
}) {
  const { ref, visible, armed } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={cn("site-reveal", className)}
      data-reveal-armed={armed}
      data-visible={visible}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

export function SiteEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("site-eyebrow mb-4", className)}>
      {children}
    </p>
  );
}

export function SiteH1({ 
  children, 
  className, 
  tone = "dark",
  emphasis 
}: { 
  children: ReactNode; 
  className?: string; 
  tone?: Tone;
  emphasis?: string;
}) {
  return (
    <h1 className={cn(
      "text-[44px] md:text-[76px] leading-[1.02] tracking-[-0.032em] font-semibold",
      tone === "dark" ? "text-site-on-dark" : "text-site-ink",
      className
    )} style={{ fontFamily: SITE_THEME.fonts.ui }}>
      {children}
      {emphasis && (
        <>
          <br />
          <span className="text-site-gold italic" style={{ fontFamily: SITE_THEME.fonts.display, fontWeight: 400 }}>
            {emphasis}
          </span>
        </>
      )}
    </h1>
  );
}

export function SiteH2({ children, className, tone = "dark" }: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <h2 className={cn(
      "text-[36px] md:text-[52px] leading-[1.06] tracking-[-0.028em] font-medium",
      tone === "dark" ? "text-site-on-dark" : "text-site-ink",
      className
    )} style={{ fontFamily: SITE_THEME.fonts.ui }}>
      {children}
    </h2>
  );
}

export function SiteLead({ children, className, tone = "dark" }: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <p className={cn(
      "text-[17px] md:text-[19px] leading-[1.55]",
      tone === "dark" ? "text-site-on-dark/70" : "text-site-ink/70",
      className
    )} style={{ fontFamily: SITE_THEME.fonts.ui }}>
      {children}
    </p>
  );
}

export function SiteBody({ children, className, tone = "dark" }: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <p className={cn(
      "text-[16px] md:text-[17px] leading-[1.6]",
      tone === "dark" ? "text-site-on-dark/85" : "text-site-ink/85",
      className
    )} style={{ fontFamily: SITE_THEME.fonts.ui }}>
      {children}
    </p>
  );
}
