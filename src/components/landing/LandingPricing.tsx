import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Starter",
    monthlyPrice: "19,90",
    annualPrice: "214,92",
    description: "Ideal para começar",
    features: [
      "Agenda",
      "CRM", 
      "Workflow",
      "Tutoriais",
      "Suporte por WhatsApp"
    ],
    popular: false
  },
  {
    name: "Pro",
    monthlyPrice: "37,90",
    annualPrice: "409,32",
    description: "Funcionalidades completas",
    features: [
      "Tudo do Starter",
      "Gestão de Leads",
      "Gestão de tarefas",
      "Financeiro completo",
      "Precificação e metas",
      "Análise de vendas detalhada",
      "Feed Preview",
      "Exportação de relatórios financeiros",
      "Notificações de tarefas e produção"
    ],
    popular: true
  }
];

export default function LandingPricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section className="py-20 bg-white/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-8">
            Planos
          </h2>
          
          {/* Monthly/Annual Toggle */}
          <div className="inline-flex bg-white rounded-full p-1 shadow-lg mb-6">
            <button 
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual 
                  ? "bg-landing-brand text-white" 
                  : "text-landing-text/70 hover:text-landing-text"
              }`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual 
                  ? "bg-landing-brand text-white" 
                  : "text-landing-text/70 hover:text-landing-text"
              }`}
            >
              Anual
            </button>
          </div>
          
          <p className="text-landing-text/70">
            Sem compromisso • Cancele quando quiser
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-white rounded-2xl p-8 shadow-lg border transition-all hover:shadow-xl ${
                plan.popular 
                  ? "border-landing-brand/30 ring-2 ring-landing-brand/20" 
                  : "border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-landing-brand text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Mais Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-landing-text mb-2">
                  {plan.name}
                </h3>
                <p className="text-landing-text/70 mb-6">
                  {plan.description}
                </p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-landing-text">
                    R$ {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-landing-text/70 ml-1">
                    {isAnnual ? "/ano" : "/mês"}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-landing-text">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                className={`w-full py-3 rounded-xl text-base font-medium transition-all ${
                  plan.popular
                    ? "bg-landing-brand hover:bg-landing-brand/90 text-white"
                    : "bg-white border-2 border-landing-brand text-landing-brand hover:bg-landing-brand hover:text-white"
                }`}
              >
                Começar Teste Grátis
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mt-20">
          <h3 className="text-2xl font-bold text-landing-text text-center mb-8">
            Perguntas que você faria (ou já fez)
          </h3>
          
          <div className="space-y-4">
            {[
              "Preciso de cartão?",
              "Posso cancelar?", 
              "Meus dados ficam seguros?",
              "Integra com WhatsApp?"
            ].map((question, index) => (
              <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <button className="w-full text-left text-landing-text font-medium hover:text-landing-brand transition-colors">
                  {question}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}