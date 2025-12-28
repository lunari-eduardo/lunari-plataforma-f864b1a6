import { HeroSection } from "./HeroSection";
import { useNavigate } from "react-router-dom";

export default function LandingHero() {
  const navigate = useNavigate();
  
  return (
    <HeroSection
      title="CHEGA DE PLANILHAS!"
      subtitle="Seu segundo emprego não é o excel!"
      description="Se você não aguenta mais planilhas, sistemas confusos e desorganizados... Seja bem vindo(a) ao Lunari, o sistema de gestão para fotógrafos que vai colocar o seu negócio em perfeita órbita."
      actions={[
        {
          text: "TESTE GRÁTIS POR 30 DIAS",
          variant: "default",
          onClick: () => {
            navigate('/auth');
          },
        },
      ]}
      image={{
        src: "/api/placeholder/800/600",
        alt: "Interface do Lunari - Agenda, Financeiro e Workflow para fotógrafos",
      }}
    />
  );
}
