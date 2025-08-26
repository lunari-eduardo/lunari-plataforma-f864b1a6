import { Clock, Smile, BarChart } from "lucide-react";

const gains = [
  {
    icon: Clock,
    title: "⏱️ Tempo real",
    description: "porque editar foto já ocupa tempo demais."
  },
  {
    icon: Smile,
    title: "😌 Cabeça leve", 
    description: "lembretes automáticos > post-its colados no monitor."
  },
  {
    icon: BarChart,
    title: "📊 Controle de verdade",
    description: "ver onde o dinheiro foi, sem susto no fim do mês."
  }
];

export default function LandingGains() {
  return (
    <section className="py-16 bg-white/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-4">
            O que você ganha (além de parar de se estressar com Excel)
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {gains.map((gain, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-landing-brand/10">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-landing-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <gain.icon className="w-6 h-6 text-landing-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-landing-text mb-2">
                    {gain.title}
                  </h3>
                  <p className="text-landing-text/70">
                    {gain.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}