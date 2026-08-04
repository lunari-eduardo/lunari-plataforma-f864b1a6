import { Hero } from "@/components/home/Hero";
import { Modules } from "@/components/home/Modules";
import { Tour } from "@/components/home/Tour";
import { LuSection } from "@/components/home/LuSection";
import { Pricing } from "@/components/home/Pricing";
import { Switching } from "@/components/home/Switching";
import { SEOHead } from "@/components/seo/SEOHead";

export default function HomePage() {
  return (
    <>
      <SEOHead
        title="Lunari · O primeiro ecossistema que pensa como um fotógrafo"
        description="CRM, agenda, contratos, financeiro, galeria e IA operando como um só cérebro. Enquanto os outros vendem 6 ferramentas, a Lunari entrega um estúdio inteiro."
        canonical="https://lunarihub.com/"
        ogType="website"
      />
      <div className="bg-site-graphite">
        <Hero />
        <Modules />
        <Tour />
        <LuSection />
        <Pricing />
        <Switching />
      </div>
    </>
  );
}
