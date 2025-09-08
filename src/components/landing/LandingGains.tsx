import { Clock, Calendar, BarChart3 } from "lucide-react";

const gains = [{
  icon: Clock,
  title: "Tempo real",
  description: "Porque editar foto já ocupa tempo demais."
}, {
  icon: Calendar,
  title: "Organização",
  description: "Agenda clara e integrada com CRM e workflow."
}, {
  icon: BarChart3,
  title: "Controle de verdade",
  description: "Ver de onde veio e para onde foi o dinheiro, sem susto."
}];
export default function LandingGains() {
  return <section className="py-16 bg-white/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-landing-text mb-4 md:text-2xl">O que você ganha? (além de ter menos dor de cabeça)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
          {gains.map((gain, index) => (
            <div key={index} className="bg-white rounded-xl p-4 md:p-8 shadow-lg hover:shadow-xl transition-all border border-landing-brand/10">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-landing-brand/10 rounded-full flex items-center justify-center mb-4 md:mb-6">
                  <gain.icon className="w-6 h-6 md:w-8 md:h-8 text-landing-brand" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-landing-text mb-2 md:mb-3">
                  {gain.title}
                </h3>
                <p className="text-sm md:text-base text-landing-text/70 leading-relaxed">
                  {gain.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>;
}