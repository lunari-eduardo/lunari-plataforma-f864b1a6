import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingScrollCards from "@/components/landing/LandingScrollCards";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFAQ from "@/components/landing/LandingFAQ";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingGains from "@/components/landing/LandingGains";
import LandingOffer from "@/components/landing/LandingOffer";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import { SEOHead } from "@/components/seo/SEOHead";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-text">
      <SEOHead
        title="Lunari | Plataforma de Gestão para Fotógrafos"
        description="Simplifique sua vida como fotógrafo: gerencie clientes, agenda, financeiro e precificação em um só lugar. Experimente grátis por 7 dias."
        canonical="https://app.lunarihub.com/"
        ogType="website"
      />
      <LandingHero />
      <LandingGains />
      <LandingFeatures />
      <LandingScrollCards />
      <LandingOffer />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingFAQ />
      <LandingFooter />
    </div>
  );
}