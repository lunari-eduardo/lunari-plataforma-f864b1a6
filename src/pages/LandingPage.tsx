import { LunariNav } from "@/components/landing/LunariNav";
import { LunariHero } from "@/components/landing/LunariHero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { UnifiedFlowSection } from "@/components/landing/UnifiedFlowSection";
import { GallerySection } from "@/components/landing/GallerySection";
import { AISection } from "@/components/landing/AISection";
import { WhatsAppSection } from "@/components/landing/WhatsAppSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { LunariFooter } from "@/components/landing/LunariFooter";
import { SEOHead } from "@/components/seo/SEOHead";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#F5F1EA] text-[#0B1B2B] antialiased"
      style={{ fontFamily: '"Inter Tight", sans-serif' }}
    >
      <SEOHead
        title="Lunari · O primeiro sistema que pensa como um fotógrafo"
        description="CRM, agenda, contratos, financeiro, galeria e IA operando como um só cérebro. Enquanto os outros vendem 6 ferramentas, a Lunari entrega um estúdio inteiro."
        canonical="https://app.lunarihub.com/"
        ogType="website"
      />
      <LunariNav />
      <main>
        <LunariHero />
        <ProblemSection />
        <UnifiedFlowSection />
        <GallerySection />
        <AISection />
        <WhatsAppSection />
        <ProofSection />
        <PricingSection />
        <ClosingSection />
      </main>
      <LunariFooter />
    </div>
  );
}
