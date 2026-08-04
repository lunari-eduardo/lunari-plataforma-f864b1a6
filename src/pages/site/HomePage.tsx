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
        title="Lunari: O sistema de gestão completo para fotógrafos"
        description="Lunari é uma plataforma SaaS de gestão que une CRM, agenda, contratos, financeiro, galeria e IA em um só lugar. Feito exclusivamente para fotógrafos profissionais."
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
