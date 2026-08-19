
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, User, CreditCard, LifeBuoy, Plug, Package, Gift } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';


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
  "/app/integracoes": "Integrações",
  "/app/planos-e-creditos": "Planos e Créditos",
  // Módulo Gallery
  "/app/gallery": "Galerias",
  "/app/gallery/dashboard": "Painel da Galeria",
  "/app/gallery/list": "Minhas Galerias",
  "/app/gallery/new/select": "Nova Galeria de Seleção",
  "/app/gallery/new/transfer": "Nova Entrega",
  "/app/gallery/settings": "Configurações da Galeria",
  "/app/gallery/settings/defaults": "Padrões da Galeria",
  "/app/gallery/settings/customization": "Personalização",
};

const dynamicRoutePatterns: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/app\/clientes\/[^/]+$/, title: 'Clientes' },
  { pattern: /^\/app\/orcamentos\/[^/]+$/, title: 'Orçamentos' },
  { pattern: /^\/app\/galerias\/[^/]+$/, title: 'Galerias' },
  // Módulo Gallery rotas dinâmicas
  { pattern: /^\/app\/gallery\/select\/[^/]+\/edit$/, title: 'Editar Galeria' },
  { pattern: /^\/app\/gallery\/transfer\/[^/]+\/edit$/, title: 'Editar Entrega' },
  { pattern: /^\/app\/gallery\/select\/[^/]+$/, title: 'Galeria de Seleção' },
  { pattern: /^\/app\/gallery\/transfer\/[^/]+$/, title: 'Detalhes da Entrega' },
  { pattern: /^\/app\/gallery\/settings\/.*$/, title: 'Configurações da Galeria' },
  { pattern: /^\/app\/comercial\/construtor\/[^/]+$/, title: 'Editor de Proposta' },
  { pattern: /^\/app\/comercial\/compartilhamentos\/[^/]+$/, title: 'Análise de Compartilhamento' },
  { pattern: /^\/app\/comercial\/.*$/, title: 'Comercial' },
];

const getPageTitleFromPath = (pathname: string): string => {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const { pattern, title } of dynamicRoutePatterns) {
    if (pattern.test(pathname)) return title;
  }
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length >= 2) {
    const basePath = `/${pathSegments[0]}/${pathSegments[1]}`;
    if (pageTitles[basePath]) return pageTitles[basePath];
  }
  return "Dashboard";
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleTheme, currentTheme } = useTheme();
  const { signOut } = useAuth();
  
  const { getProfileOrDefault } = useUserProfile();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const currentProfile = getProfileOrDefault();
  const currentTitle = getPageTitleFromPath(location.pathname);

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const userInitials = getInitials(currentProfile.nome || currentProfile.empresa || 'Usuario');

  const handleSignOut = async (scope: 'local' | 'global' = 'local') => {
    try {
      await signOut(scope);
      navigate('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleSignOutAllDevices = async () => {
    const confirmed = window.confirm(
      'Isso vai encerrar sua sessão em todos os navegadores e dispositivos onde você está logado. Deseja continuar?'
    );
    if (!confirmed) return;
    await handleSignOut('global');
  };

  return (
    <>
      {/* Backdrop blur overlay when profile dropdown is open */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" />
      )}

      <header className="h-12 flex items-center justify-between px-4 backdrop-blur-xl bg-card/40 dark:bg-background/60 border-b border-border/30 relative z-30">
        <div>
          <h1 className="text-sm font-semibold text-foreground">{currentTitle}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <NotificationBell />

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-muted/50"
            onClick={toggleTheme}
          >
            {currentTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>

          <DropdownMenu onOpenChange={setIsProfileOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full hover:bg-muted/50" size="icon">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentProfile.logo_url || currentProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-sm text-foreground">
                {currentProfile.nome || currentProfile.empresa || 'Minha Conta'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem 
                className="text-sm cursor-pointer"
                onClick={() => navigate('/app/minha-conta')}
              >
                <User className="mr-2 h-4 w-4" />
                <span>Minha Conta</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-sm cursor-pointer"
                onClick={() => navigate('/minha-assinatura')}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Minha Assinatura</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-sm cursor-pointer"
                onClick={() => navigate('/app/suporte')}
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                <span>Suporte</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem
                className="text-sm cursor-pointer"
                onClick={() => navigate('/app/minha-conta?tab=integracoes')}
              >
                <Plug className="mr-2 h-4 w-4" />
                <span>Integrações e Pagamentos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-sm cursor-pointer"
                onClick={() => navigate('/app/minha-conta?tab=planos')}
              >
                <Package className="mr-2 h-4 w-4" />
                <span>Planos e Créditos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-sm cursor-pointer"
                onClick={() => navigate('/app/minha-conta?tab=indicacoes')}
              >
                <Gift className="mr-2 h-4 w-4" />
                <span>Indique e Ganhe</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem
                className="text-sm cursor-pointer"
                onClick={() => handleSignOut('local')}
              >
                Sair
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-sm cursor-pointer text-muted-foreground"
                onClick={handleSignOutAllDevices}
              >
                Sair de todos os dispositivos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}
