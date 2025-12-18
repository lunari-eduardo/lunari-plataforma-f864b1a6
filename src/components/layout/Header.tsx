
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/workflow": "Workflow",
  "/agenda": "Agenda",
  "/leads": "Leads",
  "/orcamentos": "Orçamentos",
  "/clientes": "Clientes",
  "/financas": "Finanças",
  "/nova-financas": "Nova Finanças",
  "/precificacao": "Precificação",
  "/configuracoes": "Configurações",
  "/tarefas": "Tarefas",
  "/analise-vendas": "Análise de Vendas",
  "/minha-conta": "Minha Conta",
  "/preferencias": "Preferências",
  "/integracoes": "Integrações e Conexões"
};

const getPageTitleFromPath = (pathname: string): string => {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  
  // Handle dynamic routes like /clientes/:id
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 1) {
    const basePath = `/${pathSegments[0]}`;
    if (pageTitles[basePath]) return pageTitles[basePath];
  }
  
  // Fallback: capitalize first segment
  if (pathSegments.length > 0) {
    const segment = pathSegments[0];
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }
  
  return "Dashboard";
};

export default function Header() {
  const location = useLocation();
  const [notificationCount] = useState(2);
  const { toggleTheme, currentTheme } = useTheme();

  // Get current page title
  const currentTitle = getPageTitleFromPath(location.pathname);

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-lunar-bg/80 backdrop-blur-sm border-b border-lunar-border/50">
      <div>
        <h1 className="text-sm font-semibold text-lunar-text">{currentTitle}</h1>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-lunar-surface/50"
          onClick={toggleTheme}
        >
          {currentTheme === 'dark' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 hover:bg-lunar-surface/50">
          <Bell className="h-3.5 w-3.5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-lunar-error text-primary-foreground text-2xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
              {notificationCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
