import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SiteH2, SiteEyebrow, SiteLead, SiteBody, SiteReveal } from "./typography";
import { NavLink } from "react-router-dom";

export function PrimaryButton({ 
  children, 
  to, 
  className,
  tone = "light" 
}: { 
  children: ReactNode; 
  to: string; 
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <NavLink 
      to={to} 
      className={cn(
        "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm transition-all hover:-translate-y-1",
        tone === "light" 
          ? "bg-site-gold text-site-graphite hover:bg-site-goldPale shadow-[0_10px_20px_-10px_rgba(201,168,124,0.3)]" 
          : "bg-site-on-dark text-site-graphite hover:bg-white",
        className
      )}
    >
      {children}
    </NavLink>
  );
}

export function GhostLink({ 
  children, 
  to, 
  className,
  tone = "light"
}: { 
  children: ReactNode; 
  to: string; 
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <NavLink 
      to={to} 
      className={cn(
        "inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-sm border transition-all",
        tone === "light"
          ? "border-site-line-light text-site-ink hover:border-site-gold"
          : "border-site-line-dark text-site-on-dark hover:border-site-on-dark",
        className
      )}
    >
      {children}
    </NavLink>
  );
}

// Re-exportando componentes novos via nomes antigos se necessário ou mantendo consistência
export { SiteReveal as Reveal, SiteEyebrow as EyebrowTag };
