
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPreferences } from '@/hooks/useUserProfile';

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/workflow": "Workflow",
  "/agenda": "Agenda",
  "/orcamentos": "Orçamentos",
  "/clientes": "Clientes",
  "/financas": "Finanças",
  "/precificacao": "Precificação",
  "/configuracoes": "Configurações",
  "/minha-conta": "Minha Conta",
  "/preferencias": "Preferências"
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationCount] = useState(2);
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const mode = preferences?.tema || getPreferencesOrDefault().tema;
  const nextMode: 'claro' | 'escuro' | 'sistema' = mode === 'claro' ? 'escuro' : mode === 'escuro' ? 'sistema' : 'claro';
  const ModeIcon = mode === 'claro' ? Sun : mode === 'escuro' ? Moon : Laptop;

  // Get current page title
  const currentTitle = pageTitles[location.pathname] || "Lunari";

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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-lunar-surface/50" size="icon">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="bg-lunar-accent text-lunar-text text-2xs font-medium">LP</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-lunar-bg shadow-lunar-md border border-lunar-border/50">
            <DropdownMenuLabel className="text-xs text-lunar-text">Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-lunar-border/30" />
            <DropdownMenuItem 
              className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
              onClick={() => navigate('/minha-conta')}
            >
              <User className="mr-2 h-3 w-3" />
              <span>Minha Conta</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
              onClick={() => navigate('/preferencias')}
            >
              Preferências
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded">Plano de Assinatura</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-lunar-border/30" />
            <DropdownMenuItem className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded">Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
