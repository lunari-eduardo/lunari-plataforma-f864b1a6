import { HeroSection } from "./HeroSection";

export default function LandingHero() {
  return (
    <HeroSection
      badge={{
        text: "Gestão completa para fotógrafos",
        action: {
          text: "Saiba mais",
          href: "#features",
        },
      }}
      title="👉 Mais fotos, menos planilhas."
      description="Se você ainda esquece clientes, horários ou não sabe pra onde foi o dinheiro do mês… o Lunari resolve. Aqui a bagunça não entra."
      actions={[
        {
          text: "TESTE GRÁTIS POR 30 DIAS",
          variant: "default",
          onClick: () => {
            // Lógica para teste grátis
            console.log("Iniciar teste grátis");
          },
        },
        {
          text: "Ver Demo",
          variant: "outline",
          href: "#demo",
        },
      ]}
      image={{
        src: "/api/placeholder/800/600",
        alt: "Interface do Lunari - Agenda, Financeiro e Workflow para fotógrafos",
      }}
    />
  );
}