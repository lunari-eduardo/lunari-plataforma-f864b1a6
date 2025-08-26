import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    text: "Antes eu esquecia clientes. Agora só esqueço de beber água. Obrigado, Lunari.",
    author: "Ana Clara",
    role: "Fotógrafa de Casamentos",
    rating: 5
  },
  {
    text: "Meu financeiro deixou de ser um mistério digno do Scooby-Doo.",
    author: "Carlos Eduardo",
    role: "Fotógrafo Social",
    rating: 5
  },
  {
    text: "Agenda sem Lunari = desastre anunciado.",
    author: "Mariana Santos",
    role: "Estúdio Fotográfico",
    rating: 5
  },
  {
    text: "Parei de usar 17 apps diferentes. Agora é só o Lunari mesmo.",
    author: "Roberto Silva", 
    role: "Fotógrafo Freelancer",
    rating: 5
  },
  {
    text: "Finalmente sei quanto vou ganhar no mês sem ter que fazer conta no guardanapo.",
    author: "Juliana Costa",
    role: "Fotógrafa Newborn",
    rating: 5
  }
];

export default function LandingTestimonials() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section className="py-20 bg-white/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-4">
            Não somos nós que estamos dizendo…
          </h2>
          <p className="text-xl text-landing-text/70">
            Por menos post-it grudados no monitor*
          </p>
          <p className="text-sm text-landing-text/60 mt-2 italic">
            (ok, chega de piada e cola na proposta 😏)
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white rounded-2xl p-8 md:p-12 shadow-xl border border-landing-brand/10">
            <div className="text-center">
              {/* Stars */}
              <div className="flex justify-center space-x-1 mb-6">
                {Array.from({ length: testimonials[currentTestimonial].rating }).map((_, i) => (
                  <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Testimonial */}
              <blockquote className="text-xl md:text-2xl text-landing-text/90 mb-8 italic leading-relaxed">
                "{testimonials[currentTestimonial].text}"
              </blockquote>

              {/* Author */}
              <div className="space-y-2">
                <p className="font-semibold text-landing-text text-lg">
                  {testimonials[currentTestimonial].author}
                </p>
                <p className="text-landing-text/60">
                  {testimonials[currentTestimonial].role}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <button 
              onClick={prevTestimonial}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-landing-brand/10 hover:bg-landing-brand/20 rounded-full p-3 transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-landing-brand" />
            </button>
            <button 
              onClick={nextTestimonial}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-landing-brand/10 hover:bg-landing-brand/20 rounded-full p-3 transition-all"
            >
              <ChevronRight className="w-5 h-5 text-landing-brand" />
            </button>
          </div>

          {/* Dots */}
          <div className="flex justify-center mt-8 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentTestimonial === index ? 'bg-landing-brand' : 'bg-landing-brand/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}