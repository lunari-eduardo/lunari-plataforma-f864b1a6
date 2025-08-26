import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "Preciso de cartão?",
    answer: "Não, a gente não é Netflix. Você testa 30 dias completamente grátis, sem precisar cadastrar cartão nem nada."
  },
  {
    question: "Posso cancelar?", 
    answer: "Sim, e sem formulário escondido. É só um clique e pronto. Sem multa, sem burocracia, sem drama."
  },
  {
    question: "Meus dados ficam seguros?",
    answer: "Mais do que no seu HD externo, pode apostar. Usamos criptografia de ponta e backup automático diário."
  },
  {
    question: "Integra com WhatsApp?",
    answer: "Sim, seus leads vêm direto de lá. E você pode compartilhar sua agenda e confirmações por WhatsApp também."
  },
  {
    question: "E suporte?",
    answer: "Especializado para fotógrafos, sem robô mandando FAQ. Gente de verdade que entende do seu negócio."
  },
  {
    question: "Posso migrar depois?",
    answer: "Só se achar uma plataforma melhor (boa sorte com isso 😄). Mas sim, seus dados são seus e você pode exportar tudo."
  },
  {
    question: "Funciona no celular?",
    answer: "Claro! O Lunari é 100% responsivo. Você pode gerenciar tudo pelo celular, tablet ou computador."
  },
  {
    question: "Tem limite de clientes?",
    answer: "Nos planos Pro e Estúdio, não. No Starter, são até 100 clientes (que já é bastante coisa)."
  }
];

export default function LandingFAQ() {
  return (
    <section className="py-20 bg-landing-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-4">
            Perguntas que você faria (ou já fez)
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-white rounded-xl border border-landing-brand/10 px-6 shadow-sm"
              >
                <AccordionTrigger className="text-left text-landing-text font-medium hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-landing-text/70 pt-2">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}