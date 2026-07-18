import { LunariHero } from "@/components/landing/LunariHero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { UnifiedFlowSection } from "@/components/landing/UnifiedFlowSection";
import { GallerySection } from "@/components/landing/GallerySection";
import { AISection } from "@/components/landing/AISection";
import { WhatsAppSection } from "@/components/landing/WhatsAppSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { SEOHead } from "@/components/seo/SEOHead";

/**
 * HomePage — página inicial do site institucional (rota "/").
 * Vive dentro de <SiteLayout />, então NÃO renderiza LunariNav/LunariFooter.
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
      <ProblemSection />
      <UnifiedFlowSection />
      <GallerySection />
      <AISection />
      <WhatsAppSection />
      <ProofSection />
      <PricingSection />
      <ClosingSection />
    </>
  );
}
