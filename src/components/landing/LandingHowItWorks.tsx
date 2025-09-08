import { UserPlus, Settings, Camera } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Cadastre-se",
    description: "(grátis, sem cartão)",
    number: 1
  },
  {
    icon: Settings,
    title: "Configure",
    description: "Fácil e intuitivo",
    number: 2
  },
  {
    icon: Camera,
    title: "Esqueça a bagunça, siga fotografando",
    description: "Deixa o resto por nossa conta",
    number: 3
  }
];

export default function LandingHowItWorks() {
  return (
    <section className="py-20 bg-landing-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-6">
            Do zero à organização em 3 passos
          </h2>
          <p className="text-xl text-landing-text/70">
            (Sem maratonar tutorial de 3 horas no YouTube)
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {steps.map((step, index) => (
              <div key={index} className="text-center h-full">
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-landing-brand/10 hover:shadow-xl transition-all h-full flex flex-col min-h-[320px]">
                  {/* Number */}
                  <div className="w-12 h-12 bg-landing-brand text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-6">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 bg-landing-brand/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-8 h-8 text-landing-brand" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-landing-text mb-2">
                      {step.title}
                    </h3>
                    <p className="text-landing-text/70">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}