import { Calendar, DollarSign, Workflow, Users, CheckCircle, UserCheck, Calculator, TrendingUp, CheckSquare, Smartphone, Shield } from "lucide-react";

const features = [{
  icon: Calendar,
  title: "Agenda Inteligente",
  subtitle: "Sua memória não precisa de upgrade, só de uma agenda decente.",
  items: ["4 visualizações (diária, semanal, mensal, anual)", "Resolução automática de conflitos", "Compartilhamento via WhatsApp"]
}, {
  icon: DollarSign,
  title: "Financeiro Sem Drama",
  subtitle: "Dinheiro contado não some. Simples assim.",
  items: ["Dashboard em tempo real", "Receitas vs despesas", "Gestão de parcelamentos e cartões", "Metas de faturamento mensais"]
}, {
  icon: Workflow,
  title: "Workflow & Produção",
  subtitle: "Do agendamento à entrega, sem correria de última hora.",
  items: ["Gerencie etapas do projeto", "Controle de pagamentos", "Produtos inclusos, fotos extras", "Lembretes de produção"]
}, {
  icon: Users,
  title: "CRM sem enrolação",
  subtitle: "Se os clientes não lembrarem de você no aniversário... Agora o Lunari lembra deles pra você.",
  items: ["Histórico completo de sessões e pagamentos", "Controle de aniversários", "Notas rápidas e observações"]
}];

const extraFeatures = [
  { icon: UserCheck, title: "Gestão de leads e vendas" },
  { icon: Calculator, title: "Precificação inteligente" },
  { icon: TrendingUp, title: "Análise de vendas avançada" },
  { icon: CheckSquare, title: "Tarefas e lembretes" },
  { icon: Smartphone, title: "Totalmente responsivo" },
  { icon: Shield, title: "Backup automático" }
];
export default function LandingFeatures() {
  return (
    <section className="py-20 bg-landing-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-6">
            Principais Funcionalidades
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-20">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-landing-brand/10">
              <div>
                <h3 className="font-bold text-landing-text mb-3 text-xl">
                  {feature.title}
                </h3>
                <p className="text-landing-text/70 italic mb-6 leading-relaxed">
                  {feature.subtitle}
                </p>
                <ul className="space-y-3">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-landing-accent mt-0.5 flex-shrink-0" />
                      <span className="text-landing-text/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* E ainda tem mais */}
        <div className="text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-landing-text mb-12">
            E ainda tem mais...
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-5xl mx-auto">
            {extraFeatures.map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-landing-brand/10 text-center">
                <div className="mx-auto w-12 h-12 bg-landing-brand/10 rounded-full flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-landing-brand" />
                </div>
                <p className="text-sm text-landing-text/80 font-medium leading-tight">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}