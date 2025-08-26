import { Button } from "@/components/ui/button";
export default function LandingOffer() {
  return <section className="py-20 bg-gradient-to-br from-landing-brand/10 to-landing-accent/10">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-landing-text">Por menos post-it grudados no monitor</h2>
          
          <p className="text-xl md:text-2xl text-landing-text/80 leading-relaxed">
            Comece hoje com 30 dias grátis. Não pedimos cartão, não mandamos spam, 
            não tem contrato escondido. Só gestão que funciona.
          </p>

          <div className="pt-8">
            <Button size="lg" className="bg-landing-brand hover:bg-landing-brand/90 text-white px-12 py-6 text-xl rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105">
              👉 TESTAR O LUNARI AGORA
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-12">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full"></div>
              <span className="text-landing-text/70">30 dias grátis</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full"></div>
              <span className="text-landing-text/70">Sem cartão</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full"></div>
              <span className="text-landing-text/70">Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </div>
    </section>;
}