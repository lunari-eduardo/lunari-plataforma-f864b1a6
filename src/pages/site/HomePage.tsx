import { Hero } from "@/components/home/Hero";
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
        {/* Próximas seções (Modules, Tour, Lu, etc.) virão na sequência */}
        <section className="py-40 flex items-center justify-center text-site-on-dark/20 uppercase tracking-widest font-mono text-xs">
          Portando seções do Remix...
        </section>
      </div>
    </>
  );
}
