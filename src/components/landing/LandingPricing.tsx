import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "R$ 47",
    period: "/mês",
    description: "Perfeito para começar",
    features: [
      "Agenda completa",
      "Controle financeiro básico",
      "CRM de clientes",
      "Suporte por email",
      "Backup automático"
    ],
    popular: false
  },
  {
    name: "Pro",
    price: "R$ 97",
    period: "/mês", 
    description: "Para fotógrafos sérios",
    features: [
      "Tudo do Starter",
      "Workflow completo",
      "Análise de vendas avançada",
      "Automações inteligentes",
      "Suporte prioritário",
      "Integração WhatsApp",
      "Relatórios personalizados"
    ],
    popular: true
  },
  {
    name: "Estúdio",
    price: "R$ 197",
    period: "/mês",
    description: "Para equipes e estúdios",
    features: [
      "Tudo do Pro",
      "Usuários ilimitados",
      "Gestão de equipe",
      "API personalizada",
      "Suporte dedicado",
      "Treinamento online",
      "Customizações"
    ],
    popular: false
  }
];

export default function LandingPricing() {
  return (
    <section className="py-20 bg-white/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-4">
            Planos
          </h2>
          <p className="text-xl text-landing-text/70 mb-6">
            Todos começam com 30 dias grátis
          </p>
          <div className="inline-block bg-landing-accent/10 text-landing-accent px-4 py-2 rounded-full text-sm font-medium">
            ⭐ Sem compromisso • Cancele quando quiser
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-white rounded-2xl p-8 shadow-lg border transition-all hover:shadow-xl ${
                plan.popular 
                  ? 'border-landing-brand ring-2 ring-landing-brand/20 transform scale-105' 
                  : 'border-landing-brand/10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-landing-brand text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Mais Popular</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-landing-text mb-2">
                  {plan.name}
                </h3>
                <p className="text-landing-text/60 mb-4">
                  {plan.description}
                </p>
                <div className="flex items-end justify-center space-x-1">
                  <span className="text-4xl font-bold text-landing-text">
                    {plan.price}
                  </span>
                  <span className="text-landing-text/60 pb-1">
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-landing-accent mt-0.5 flex-shrink-0" />
                    <span className="text-landing-text/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full rounded-full ${
                  plan.popular
                    ? 'bg-landing-brand hover:bg-landing-brand/90 text-white' 
                    : 'bg-landing-brand/10 hover:bg-landing-brand/20 text-landing-brand border border-landing-brand/20'
                }`}
                size="lg"
              >
                Começar Teste Grátis
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}