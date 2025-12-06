import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar, Users, Settings, FileText, DollarSign, Menu, X, User, TrendingUp, Workflow, ChevronRight, ChevronLeft, BarChart3, Home, CheckSquare, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  iconOnly?: boolean;
}
const NavItem = ({
  to,
  icon,
  label,
  iconOnly = false
}: NavItemProps) => {
  const isMobile = useIsMobile();
  return <NavLink to={to} className={({
    isActive
  }) => cn("nav-item-lunar mb-1 flex items-center transition-all duration-200", iconOnly ? "w-12 h-12 rounded-lg justify-center" : "gap-3 px-3 py-2 justify-start", isActive && "active bg-lunar-surface text-lunar-accent")} title={iconOnly ? label : undefined}>
      <span className="text-sm flex-shrink-0">{icon}</span>
      {!iconOnly && <span className="text-xs font-medium whitespace-nowrap">{label}</span>}
    </NavLink>;
};
export default function Sidebar() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const { profile, getProfileOrDefault } = useUserProfile();
  const { branding, getBrandingOrDefault } = useUserBranding();
  
  const currentProfile = getProfileOrDefault();
  const currentBranding = getBrandingOrDefault();
  
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
          <Avatar className="h-8 w-8">
            <AvatarImage src={currentBranding.logoUrl} />
            <AvatarFallback className="bg-lunar-accent text-lunar-text text-xs font-medium">
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
        <DropdownMenuItem className="text-xs text-lunar-text hover:bg-lunar-surface/50 rounded">
          Plano de Assinatura
        </DropdownMenuItem>
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
  const navItems = [{
    to: "/",
    icon: <Home size={14} />,
    label: "Início"
  }, {
    to: "/agenda",
    icon: <Calendar size={14} />,
    label: "Agenda"
  }, {
    to: "/leads",
    icon: <FileText size={14} />,
    label: "Leads"
  }, /* {
    to: "/orcamentos",
    icon: <FileText size={14} />,
    label: "Orçamentos"
  }, */ {
    to: "/workflow",
    icon: <Workflow size={14} />,
    label: "Workflow"
  }, {
    to: "/tarefas",
    icon: <CheckSquare size={14} />,
    label: "Tarefas"
  }, {
    to: "/financas",
    icon: <DollarSign size={14} />,
    label: "Finanças"
  }, {
    to: "/clientes",
    icon: <Users size={14} />,
    label: "Clientes"
  }, {
    to: "/precificacao",
    icon: <TrendingUp size={14} />,
    label: "Precificação"
  }, {
    to: "/analise-vendas",
    icon: <BarChart3 size={14} />,
    label: "Análise de Vendas"
  }, {
    to: "/feed-test",
    icon: <ImageIcon size={14} />,
    label: "Feed Test"
  }, {
    to: "/configuracoes",
    icon: <Settings size={14} />,
    label: "Configurações"
  }];
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
                <div className="mb-0.5">{item.icon}</div>
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
              {navItems.map(item => <NavItem key={item.to} {...item} />)}
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
          {navItems.map(item => <NavItem key={item.to} {...item} iconOnly={!isDesktopExpanded} />)}
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