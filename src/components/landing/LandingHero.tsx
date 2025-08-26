import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Workflow, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

const slides = [
  {
    image: "/api/placeholder/600/400",
    title: "Agenda",
    subtitle: "Agora você sabe onde enfiou a terça-feira."
  },
  {
    image: "/api/placeholder/600/400", 
    title: "Financeiro",
    subtitle: "Descubra por que seu dinheiro some mais rápido que cartão SD."
  },
  {
    image: "/api/placeholder/600/400",
    title: "Workflow", 
    subtitle: "Do clique à entrega, sem dramas de WhatsApp."
  }
];

export default function LandingHero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Conteúdo */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-landing-text">
              👉 Mais fotos, menos planilhas.
            </h1>
            <h2 className="text-xl md:text-2xl text-landing-text/80 leading-relaxed">
              Se você ainda esquece clientes, horários ou não sabe pra onde foi o dinheiro do mês… o Lunari resolve. 
              Aqui a bagunça não entra.
            </h2>
          </div>

          <div className="space-y-4">
            <Button 
              size="lg" 
              className="bg-landing-brand hover:bg-landing-brand/90 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              TESTE GRÁTIS POR 30 DIAS
            </Button>
            <p className="text-sm text-landing-text/60">
              (sem cartão, sem pegadinha)
            </p>
          </div>
        </div>

        {/* Carrossel */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl shadow-2xl">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={index} className="min-w-full">
                  <div className="aspect-video bg-gradient-to-br from-landing-brand/20 to-landing-accent/20 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-landing-brand/20 rounded-full flex items-center justify-center">
                        {slide.title === 'Agenda' && <Calendar className="w-8 h-8 text-landing-brand" />}
                        {slide.title === 'Financeiro' && <DollarSign className="w-8 h-8 text-landing-brand" />}
                        {slide.title === 'Workflow' && <Workflow className="w-8 h-8 text-landing-brand" />}
                      </div>
                      <h3 className="text-2xl font-bold text-landing-text">{slide.title}</h3>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-center bg-white/90 backdrop-blur rounded-lg p-4">
                    <p className="text-landing-text font-medium italic">"{slide.subtitle}"</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Controles */}
            <button 
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-landing-text" />
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
            >
              <ChevronRight className="w-5 h-5 text-landing-text" />
            </button>
          </div>

          {/* Indicadores */}
          <div className="flex justify-center mt-6 space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentSlide === index ? 'bg-landing-brand' : 'bg-landing-brand/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}