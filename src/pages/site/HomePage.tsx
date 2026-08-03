import { LunariHero } from "@/components/landing/LunariHero";
import { RotinaSection } from "@/components/landing/rotina/RotinaSection";
import { FluxoSection } from "@/components/landing/fluxo/FluxoSection";
import { SEOHead } from "@/components/seo/SEOHead";


/**
 * HomePage — página inicial do site institucional (rota "/").
 * Vive dentro de <SiteLayout />, então NÃO renderiza LunariNav/LunariFooter.
 *
 * A Home está sendo reconstruída seção a seção. Hoje: Hero + Seção 01.
 */
export default function HomePage() {
  return (
    <>
      <SEOHead
        title="Lunari · O primeiro sistema que pensa como um fotógrafo"
        description="CRM, agenda, contratos, financeiro, galeria e IA operando como um só cérebro. Enquanto os outros vendem 6 ferramentas, a Lunari entrega um estúdio inteiro."
        canonical="https://lunarihub.com/"
        ogType="website"
      />
      <LunariHero />
      <RotinaSection />
    </>
  );
}
