
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPreferences } from '@/hooks/useUserProfile';

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
  "/preferencias": "Preferências"
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
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const mode = preferences?.tema || getPreferencesOrDefault().tema;
  const nextMode: 'claro' | 'escuro' | 'sistema' = mode === 'claro' ? 'escuro' : mode === 'escuro' ? 'sistema' : 'claro';
  const ModeIcon = mode === 'claro' ? Sun : mode === 'escuro' ? Moon : Laptop;

  // Get current page title
  const currentTitle = getPageTitleFromPath(location.pathname);

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-lunar-bg/80 backdrop-blur-sm border-b border-lunar-border/50">
      <div>
        <h1 className="text-sm font-semibold text-lunar-text">{currentTitle}</h1>
      </div>
      
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 hover:bg-lunar-surface/50"
              aria-label={`Alternar tema: ${nextMode}`}
              onClick={() => {
                savePreferences({ tema: nextMode });
                const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
                const isDark = nextMode === 'escuro' || (nextMode === 'sistema' && !!mql?.matches);
                document.documentElement.classList.toggle('dark', isDark);
              }}
            >
              <ModeIcon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Alternar tema: {nextMode}</TooltipContent>
        </Tooltip>

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
