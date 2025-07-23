
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar, Users, Settings, Calculator, DollarSign, Menu, X, User, BarChart3, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  }) => cn("nav-item-lunar mb-1 flex items-center justify-center", iconOnly ? "w-12 h-12 rounded-lg" : "gap-3 px-3 py-2", isActive && "active bg-lunar-surface text-lunar-accent")} title={iconOnly ? label : undefined}>
      <span className="text-sm">{icon}</span>
      {!iconOnly && !isMobile && <span className="text-xs font-medium">{label}</span>}
    </NavLink>;
};

export default function Sidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const navItems = [{
    to: "/agenda",
    icon: <Calendar size={14} />,
    label: "Agenda"
  }, {
    to: "/clientes",
    icon: <Users size={14} />,
    label: "Clientes"
  }, {
    to: "/orcamentos",
    icon: <Calculator size={14} />,
    label: "Orçamentos"
  }, {
    to: "/financas",
    icon: <DollarSign size={14} />,
    label: "Finanças"
  }, {
    to: "/precificacao",
    icon: <BarChart3 size={14} />,
    label: "Precificação"
  }, {
    to: "/workflow",
    icon: <Workflow size={14} />,
    label: "Workflow"
  }, {
    to: "/configuracoes",
    icon: <Settings size={14} />,
    label: "Configurações"
  }];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Mobile bottom navigation
  if (isMobile) {
    return <>
        <div className="fixed bottom-0 left-0 right-0 backdrop-blur-sm shadow-lunar-md z-10 p-2 border-t border-lunar-border/50 bg-lunar-border">
          <div className="grid grid-cols-5 h-12 gap-1">
            {navItems.slice(0, 4).map(item => <NavLink key={item.to} to={item.to} className={({
            isActive
          }) => cn("flex flex-col items-center justify-center py-1 rounded-md text-lunar-text transition-all duration-150 text-center", isActive ? "text-lunar-accent bg-lunar-surface shadow-sm" : "hover:bg-lunar-surface/30 hover:shadow-lunar-sm hover:translate-y-[-1px]")}>
                <div className="mb-0.5">{item.icon}</div>
                <span className="text-2xs font-medium leading-tight">{item.label}</span>
              </NavLink>)}

            <button className="flex flex-col items-center justify-center text-lunar-text py-1 rounded-md hover:bg-lunar-surface/30 hover:shadow-lunar-sm hover:translate-y-[-1px] transition-all duration-150" onClick={toggleSidebar}>
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
                <User className="h-4 w-4 text-lunar-accent" />
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

        {/* Content padding to avoid overlap with bottom nav */}
        <div className="pb-16"></div>
      </>;
  }

  // Desktop sidebar - apenas ícones
  return <div className="flex flex-col w-16 h-screen p-2 bg-lunar-bg border-r border-lunar-border/50">
      <div className="flex-1">
        <div className="space-y-2 my-8 py-4">
          {navItems.map(item => <NavItem key={item.to} {...item} iconOnly={true} />)}
        </div>
      </div>
    </div>;
}
