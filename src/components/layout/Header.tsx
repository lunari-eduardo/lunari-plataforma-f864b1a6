
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  const { resolvedTheme, setTheme } = useTheme();
  // Get current page title
  const currentTitle = pageTitles[location.pathname] || "Lunari";

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-lunar-bg/80 backdrop-blur-sm border-b border-lunar-border/50">
      <div>
        <h1 className="text-sm font-semibold text-lunar-text">{currentTitle}</h1>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" className="relative h-8 w-8 hover:bg-lunar-surface/50">
          <Bell className="h-3.5 w-3.5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-lunar-error text-white text-2xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
              {notificationCount}
            </span>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-lunar-surface/50"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
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
          <DropdownMenuContent align="end" className="w-48 bg-popover text-popover-foreground shadow-lunar-md border">
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
