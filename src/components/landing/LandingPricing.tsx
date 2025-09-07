import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "R$ 19,90",
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
    price: "R$ 37,90",
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
    price: "R$ 97,90",
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
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-8">
            Planos
          </h2>
          
          {/* Monthly/Annual Toggle */}
          <div className="inline-flex bg-white rounded-full p-1 shadow-lg mb-6">
            <button className="px-6 py-2 rounded-full bg-landing-brand text-white text-sm font-medium">
              Mensal
            </button>
            <button className="px-6 py-2 rounded-full text-landing-text/70 text-sm font-medium">
              Anual
            </button>
          </div>
          
          <p className="text-landing-text/70">
            Sem compromisso • Cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  );
}