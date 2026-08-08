import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { BookOpen, PenTool, Target, Send, BarChart } from 'lucide-react';

export default function ComercialOverviewPage() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Biblioteca",
      description: "Seus materiais e recursos comerciais",
      icon: <BookOpen className="w-8 h-8 mb-4 text-primary" />,
      path: "/app/comercial/biblioteca"
    },
    {
      title: "Construtor",
      description: "Crie e edite propostas e documentos",
      icon: <PenTool className="w-8 h-8 mb-4 text-primary" />,
      path: "/app/comercial/construtor"
    },
    {
      title: "Estratégia / Estilo",
      description: "Defina identidade, comunicação e diretrizes comerciais",
      icon: <Target className="w-8 h-8 mb-4 text-primary" />,
      path: "/app/comercial/estrategia"
    },
    {
      title: "Compartilhamentos",
      description: "Acompanhe materiais enviados aos clientes",
      icon: <Send className="w-8 h-8 mb-4 text-primary" />,
      path: "/app/comercial/compartilhamentos"
    },
    {
      title: "Relatórios",
      description: "Entenda o desempenho comercial dos seus materiais",
      icon: <BarChart className="w-8 h-8 mb-4 text-primary" />,
      path: "/app/comercial/relatorios"
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="Comercial" 
        description="Crie, organize, compartilhe e acompanhe seus materiais comerciais." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {cards.map((card, idx) => (
          <div 
            key={idx}
            onClick={() => navigate(card.path)}
            className="p-6 bg-card border border-border rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="text-muted-foreground group-hover:text-primary transition-colors">
              {card.icon}
            </div>
            <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Resumo Contextual</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-sm text-muted-foreground mb-1">Propostas Criadas</div>
            <div className="text-2xl font-bold">12</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-sm text-muted-foreground mb-1">Taxa de Aprovação</div>
            <div className="text-2xl font-bold text-green-600">68%</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-sm text-muted-foreground mb-1">Último Envio</div>
            <div className="text-lg font-semibold mt-1">Hoje, 14:30</div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
