
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

const pageTitles: Record<string, string> = {
  "/app": "Dashboard",
  "/app/workflow": "Workflow",
  "/app/agenda": "Agenda",
  "/app/leads": "Leads",
  "/app/orcamentos": "Orçamentos",
  "/app/clientes": "Clientes",
  "/app/financas": "Finanças",
  "/app/nova-financas": "Nova Finanças",
  "/app/precificacao": "Precificação",
  "/app/configuracoes": "Configurações",
  "/app/tarefas": "Tarefas",
  "/app/analise-vendas": "Análise de Vendas",
  "/app/minha-conta": "Minha Conta",
  "/app/integracoes": "Integrações"
};

// Patterns for dynamic routes
const dynamicRoutePatterns: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/app\/clientes\/[^/]+$/, title: 'Clientes' },
  { pattern: /^\/app\/orcamentos\/[^/]+$/, title: 'Orçamentos' },
  { pattern: /^\/app\/galerias\/[^/]+$/, title: 'Galerias' },
];

const getPageTitleFromPath = (pathname: string): string => {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  
  // Check dynamic route patterns
  for (const { pattern, title } of dynamicRoutePatterns) {
    if (pattern.test(pathname)) {
      return title;
    }
  }
  
  // Handle dynamic routes like /app/clientes/:id - fallback using base path
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length >= 2) {
    const basePath = `/${pathSegments[0]}/${pathSegments[1]}`;
    if (pageTitles[basePath]) return pageTitles[basePath];
  }
  
  // Fallback
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
