import { Calendar, DollarSign, Workflow, Users, CheckCircle } from "lucide-react";
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
export default function LandingFeatures() {
  return <section className="py-20 bg-landing-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-landing-text mb-6">
            Principais Funcionalidades
          </h2>
          
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {features.map((feature, index) => <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-landing-brand/10">
              <div>
                <h3 className="font-bold text-landing-text mb-2 text-xl">
                  {feature.title}
                </h3>
                <p className="text-landing-text/70 italic mb-6">
                  "{feature.subtitle}"
                </p>
                <ul className="space-y-3">
                  {feature.items.map((item, itemIndex) => <li key={itemIndex} className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-landing-accent mt-0.5 flex-shrink-0" />
                      <span className="text-landing-text/80">{item}</span>
                    </li>)}
                </ul>
              </div>
            </div>)}
        </div>

        {/* Recursos Extras */}
        <div className="mt-20 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-landing-text mb-8">
            E ainda tem mais coisa que você vai usar
          </h3>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto mb-8">
            {["Gestão de leads e vendas", "Precificação inteligente", "Análise de vendas avançada", "Tarefas e lembretes", "Totalmente responsivo", "Backup automático"].map((item, index) => <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-landing-brand/10">
                <CheckCircle className="w-6 h-6 text-landing-accent mx-auto mb-2" />
                <p className="text-sm text-landing-text/80 font-medium">{item}</p>
              </div>)}
          </div>

          <p className="text-landing-text/60 italic">
            "São mais de 50 funcionalidades. Mas relaxa, você não precisa aprender todas no primeiro dia."
          </p>
        </div>
      </div>
    </section>;
}