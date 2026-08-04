import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import { WhatsAppWidget } from "./WhatsAppWidget";
import { cn } from "@/lib/utils";

/**
 * Layout público de lunarihub.com — envelopa toda rota institucional
 * (home, produtos, preços, sobre, contato) com nav global + footer.
 * Rotas do app autenticado (/app/*), checkout, formulário público e /auth
 * NÃO passam por aqui.
 */
export function SiteLayout() {
  const loc = useLocation();

  // Reset de scroll a cada troca de rota
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [loc.pathname]);

  return (
    <div
      className="site-scope min-h-screen bg-[#FAFAF7] text-[#0A0A0A] antialiased"
      style={{ fontFamily: '"Geist", "Inter Tight", sans-serif', letterSpacing: "-0.005em" }}
    >
      <SiteNav />
      <main className={cn(loc.pathname !== "/" && "pt-[68px] md:pt-[76px]")}>
        <Outlet />
      </main>
      <SiteFooter />
      <WhatsAppWidget />
    </div>
  );
}
