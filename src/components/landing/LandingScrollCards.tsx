import { CardsParallax, type iCardItem } from "@/components/ui/scroll-cards";

const cardItems: iCardItem[] = [
  {
    title: "Agenda",
    description: "nunca mais perca um cliente por esquecimento",
    tag: "organização",
    src: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?q=80&w=2939&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    link: "#",
    color: "hsl(280, 65%, 60%)",
    textColor: "white",
  },
  {
    title: "Financeiro",
    description: "saiba exatamente quanto vai ganhar no mês",
    tag: "controle",
    src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    link: "#",
    color: "hsl(200, 70%, 50%)",
    textColor: "white",
  },
  {
    title: "Workflow",
    description: "da sessão à entrega, tudo organizado",
    tag: "produção",
    src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    link: "#",
    color: "hsl(160, 60%, 45%)",
    textColor: "white",
  },
  {
    title: "CRM",
    description: "clientes felizes, negócios recorrentes",
    tag: "relacionamento",
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    link: "#",
    color: "hsl(30, 80%, 55%)",
    textColor: "white",
  },
];

export default function LandingScrollCards() {
  return (
    <section className="bg-landing-bg">
      <div className="text-center py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-landing-text mb-6">
          Tudo que você precisa, em um só lugar
        </h2>
        <p className="text-landing-text/70 text-lg">
          Cada funcionalidade pensada para facilitar sua vida profissional
        </p>
      </div>
      <CardsParallax items={cardItems} />
    </section>
  );
}