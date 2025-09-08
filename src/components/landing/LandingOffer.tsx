import { Button } from "@/components/ui/button";
export default function LandingOffer() {
  return <section className="py-12 md:py-20 bg-gradient-to-br from-landing-brand/10 to-landing-accent/10">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-landing-text px-2">Um sistema sob medida</h2>
          
          <div className="text-lg sm:text-xl md:text-2xl text-landing-text/80 leading-relaxed space-y-2 px-4">
            <p>Se você ainda duvida...</p>
            <p>Te cadastra aí, é de graça por 30 dias.</p>
            <p>O máximo que pode acontecer é você se organizar.</p>
          </div>

          <div className="pt-6 md:pt-8">
            <Button size="lg" className="bg-landing-brand hover:bg-landing-brand/90 text-white px-6 sm:px-8 md:px-12 py-4 md:py-6 text-base sm:text-lg md:text-xl rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto">
              👉 TESTAR O LUNARI AGORA
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 pt-8 md:pt-12">
            <div className="flex items-center justify-center space-x-2 py-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full flex-shrink-0"></div>
              <span className="text-sm md:text-base text-landing-text/70">30 dias grátis</span>
            </div>
            <div className="flex items-center justify-center space-x-2 py-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full flex-shrink-0"></div>
              <span className="text-sm md:text-base text-landing-text/70">Sem cartão</span>
            </div>
            <div className="flex items-center justify-center space-x-2 py-2">
              <div className="w-3 h-3 bg-landing-accent rounded-full flex-shrink-0"></div>
              <span className="text-sm md:text-base text-landing-text/70">Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </div>
    </section>;
}