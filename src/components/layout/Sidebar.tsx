import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { CalendarClock, UserCheck, Settings, Filter, Wallet, Menu, X, User, Tag, GitBranch, ChevronRight, ChevronLeft, PieChart, LayoutGrid, CheckSquare, FlaskConical, CreditCard, Shield, Crown, FileText, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { cn } from '@/lib/utils';

// Crown badge component for PRO features
const ProCrown = ({ className }: { className?: string }) => (
  <Crown size={8} className={cn("text-lunar-accent fill-lunar-accent", className)} />
);

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  iconOnly?: boolean;
  isPro?: boolean;
  showProBadge?: boolean;
}

const NavItem = ({
  to,
  icon,
  label,
  iconOnly = false,
  isPro = false,
  showProBadge = false
}: NavItemProps) => {
  return <NavLink to={to} className={({
    isActive
  }) => cn("nav-item-lunar mb-1 flex items-center transition-all duration-200", iconOnly ? "w-12 h-12 rounded-lg justify-center" : "gap-3 px-3 py-2 justify-start", isActive && "active bg-lunar-surface text-lunar-accent")} title={iconOnly ? label : undefined}>
      <span className="text-sm flex-shrink-0 relative">
        {icon}
        {isPro && showProBadge && (
          <span className="absolute -top-1 -right-1">
            <ProCrown />
          </span>
        )}
      </span>
      {!iconOnly && <span className="text-xs font-medium whitespace-nowrap">{label}</span>}
    </NavLink>;
};
export default function Sidebar() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { accessState } = useAccessControl();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const { profile, getProfileOrDefault } = useUserProfile();
  
  const currentProfile = getProfileOrDefault();
  
  // Get user initials for fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const userInitials = getInitials(currentProfile.nome || currentProfile.empresa || 'Usuario');
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };
  
  const UserAvatar = ({ className }: { className?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("rounded-full hover:bg-lunar-surface/50", className)} size="icon">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentProfile.logo_url || currentProfile.avatar_url || undefined} />
            <AvatarFallback className="bg-lunar-accent text-lunar-text text-sm font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-lunar-bg shadow-lunar-md border border-lunar-border/50">
        <DropdownMenuLabel className="text-xs text-lunar-text">
          {currentProfile.nome || currentProfile.empresa || 'Minha Conta'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-lunar-border/30" />
        <DropdownMenuItem 
          className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
          onClick={() => navigate('/app/minha-conta')}
        >
          <User className="mr-2 h-3 w-3" />
          <span>Minha Conta</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
          onClick={() => navigate('/minha-assinatura')}
        >
          <CreditCard className="mr-2 h-3 w-3" />
          <span>Minha Assinatura</span>
        </DropdownMenuItem>
        {accessState.isAdmin && (
          <>
            <DropdownMenuItem 
              className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
              onClick={() => navigate('/app/admin/usuarios')}
            >
              <Shield className="mr-2 h-3 w-3" />
              <span>Painel Admin</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
              onClick={() => navigate('/app/admin/conteudos')}
            >
              <FileText className="mr-2 h-3 w-3" />
              <span>Conteúdos</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-lunar-border/30" />
        <DropdownMenuItem 
          className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded cursor-pointer"
          onClick={handleSignOut}
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Rotas agora são relativas ao /app (sem barra inicial = relativo)
  const navItems = [{
    to: "/app",
    icon: <LayoutGrid size={14} />,
    label: "Início"
  }, {
    to: "/app/agenda",
    icon: <CalendarClock size={14} />,
    label: "Agenda"
  }, {
    to: "/app/leads",
    icon: <Filter size={14} />,
    label: "Leads",
    isPro: true
  }, {
    to: "/app/workflow",
    icon: <GitBranch size={14} />,
    label: "Workflow"
  }, {
    to: "/app/tarefas",
    icon: <CheckSquare size={14} />,
    label: "Tarefas",
    isPro: true
  }, {
    to: "/app/financas",
    icon: <Wallet size={14} />,
    label: "Finanças",
    isPro: true
  }, {
    to: "/app/clientes",
    icon: <UserCheck size={14} />,
    label: "Clientes"
  }, {
    to: "/app/precificacao",
    icon: <Tag size={14} />,
    label: "Precificação",
    isPro: true
  }, {
    to: "/app/analise-vendas",
    icon: <PieChart size={14} />,
    label: "Análise de Vendas",
    isPro: true
  }, {
    to: "/app/feed-test",
    icon: <FlaskConical size={14} />,
    label: "Feed Test",
    isPro: true
  }, {
    to: "/app/configuracoes",
    icon: <Settings size={14} />,
    label: "Configurações"
  }, {
    to: "/app/integracoes",
    icon: <Plug size={14} />,
    label: "Integrações"
  }];

  // Determine if user should see PRO badges (Starter plan without special access)
  const isStarterPlan = accessState.planCode?.startsWith('starter') && 
    !accessState.isAdmin && 
    !accessState.isVip && 
    !accessState.isAuthorized;

  const toggleDesktopSidebar = () => {
    setIsDesktopExpanded(!isDesktopExpanded);
  };
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Mobile bottom navigation
  if (isMobile) {
    return <>
        <div className="fixed bottom-0 left-0 right-0 backdrop-blur-sm shadow-lunar-md z-40 p-2 border-t border-border bg-background/80">
          <div className="grid grid-cols-5 h-12 gap-1">
            {navItems.slice(0, 4).map(item => <NavLink key={item.to} to={item.to} className={({
            isActive
          }) => cn("flex flex-col items-center justify-center py-1 rounded-md text-lunar-text transition-all duration-150 text-center", isActive ? "text-lunar-accent bg-lunar-surface shadow-sm" : "hover:bg-lunar-surface/30 hover:shadow-lunar-sm hover:translate-y-[-1px]")}>
                <div className="mb-0.5 relative">
                  {item.icon}
                  {item.isPro && isStarterPlan && (
                    <span className="absolute -top-1 -right-1">
                      <ProCrown />
                    </span>
                  )}
                </div>
                <span className="text-2xs font-medium leading-tight">{item.label}</span>
              </NavLink>)}

            <button onClick={toggleSidebar} className="flex flex-col items-center justify-center text-lunar-text py-1 rounded-md hover:shadow-lunar-sm hover:translate-y-[-1px] transition-all duration-150 bg-muted hover:bg-muted/80">
              <Menu size={14} className="mb-0.5" />
              <span className="text-2xs font-medium">Mais</span>
            </button>
          </div>
        </div>

        {/* Mobile side menu */}
        <div className={cn("fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity duration-200", isOpen ? "opacity-100" : "opacity-0 pointer-events-none")} onClick={toggleSidebar}>
          <div className={cn("absolute right-0 top-0 bottom-0 w-64 bg-lunar-bg shadow-lunar-md transition-transform transform duration-200", isOpen ? "translate-x-0" : "translate-x-full")} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-lunar-border/50">
              <div className="flex items-center">
                <UserAvatar />
                <div className="ml-2">
                  <span className="font-semibold text-sm text-lunar-text">Lunari</span>
                  <div className="text-2xs text-lunar-textSecondary">
                    Seu negócio em perfeita órbita
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
                <X size={14} />
              </Button>
            </div>
            <div className="p-3 space-y-1">
              {navItems.map(item => <NavItem key={item.to} {...item} showProBadge={isStarterPlan} />)}
            </div>
          </div>
        </div>

      </>;
  }

  // Desktop sidebar - colapsável
  return <div className={cn("flex flex-col h-screen p-2 bg-lunar-bg border-r border-lunar-border/50 transition-all duration-300", isDesktopExpanded ? "w-48" : "w-16")}>
      
      {/* Avatar do usuário no topo do desktop */}
      <div className="pt-4 pb-2 border-b border-lunar-border/50 mb-4">
        <div className={cn("flex items-center transition-all duration-200", isDesktopExpanded ? "gap-3 px-3 py-2" : "w-12 h-12 rounded-lg justify-center")}>
          <UserAvatar className="flex-shrink-0" />
          {isDesktopExpanded && <div>
              <span className="font-semibold text-sm text-lunar-text">
                {currentProfile.nome || currentProfile.empresa || 'Minha Conta'}
              </span>
              <div className="text-2xs text-lunar-textSecondary">
                Lunari
              </div>
            </div>}
        </div>
      </div>

      <div className="flex-1">
        <div className="space-y-2">
          {navItems.map(item => <NavItem key={item.to} {...item} iconOnly={!isDesktopExpanded} showProBadge={isStarterPlan} />)}
        </div>
      </div>
      
      {/* Toggle button at bottom */}
      <div className="flex justify-center pb-2">
        <Button variant="ghost" size="icon" onClick={toggleDesktopSidebar} className="h-8 w-8 text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-surface/50" title={isDesktopExpanded ? "Recolher menu" : "Expandir menu"}>
          {isDesktopExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </Button>
      </div>
    </div>;
}
