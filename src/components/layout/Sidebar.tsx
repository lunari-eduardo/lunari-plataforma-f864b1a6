import { useState, useRef, useCallback, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { CalendarClock, UserCheck, Settings, Filter, Wallet, Menu, X, Tag, GitBranch, PieChart, LayoutGrid, CheckSquare, FlaskConical, Crown, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccessControl } from '@/hooks/useAccessControl';
import { cn } from '@/lib/utils';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import logoIconWhite from '@/assets/branding/lunari-icon-white.png';
import logoIconBlack from '@/assets/branding/lunari-icon-black.png';
import logoFullWhite from '@/assets/branding/lunari-full-white.png';
import logoFullBlack from '@/assets/branding/lunari-full-black.png';

// Crown badge component for PRO features
const ProCrown = ({ className }: { className?: string }) => (
  <Crown size={8} className={cn("text-primary fill-primary", className)} />
);

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isPro?: boolean;
  showProBadge?: boolean;
  end?: boolean;
}

// Mobile/drawer variant — always shows label
const DrawerNavItem = ({ to, icon, label, isPro, showProBadge, end }: NavItemProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cn(
        "nav-item-lunar mb-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
        isActive && "active bg-lunar-surface text-lunar-accent"
      )
    }
  >
    <span className="text-sm flex-shrink-0 relative">
      {icon}
      {isPro && showProBadge && (
        <span className="absolute -top-1 -right-1">
          <ProCrown />
        </span>
      )}
    </span>
    <span className="text-xs font-medium whitespace-nowrap">{label}</span>
  </NavLink>
);

// Desktop variant — icon always visible, label fades in when expanded
const DesktopNavItem = ({
  to,
  icon,
  label,
  isPro,
  showProBadge,
  end,
  expanded,
}: NavItemProps & { expanded: boolean }) => {
  const link = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "nav-item-lunar mb-1 flex items-center h-10 rounded-lg transition-colors duration-200 overflow-hidden",
          isActive && "active bg-lunar-surface text-lunar-accent"
        )
      }
    >
      <span className="flex items-center justify-center w-12 h-10 flex-shrink-0 relative">
        {icon}
        {isPro && showProBadge && (
          <span className="absolute top-1.5 right-1.5">
            <ProCrown />
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-xs font-medium whitespace-nowrap transition-opacity duration-150 ease-out",
          expanded ? "opacity-100 delay-[60ms]" : "opacity-0 pointer-events-none"
        )}
      >
        {label}
      </span>
    </NavLink>
  );

  if (expanded) return link;

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
};

export default function Sidebar() {
  const isMobile = useIsMobile();
  const { accessState } = useAccessControl();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (enterTimer.current) { window.clearTimeout(enterTimer.current); enterTimer.current = null; }
    if (leaveTimer.current) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { window.clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (isHovered) return;
    enterTimer.current = window.setTimeout(() => setIsHovered(true), 60);
  }, [isHovered]);

  const handleLeave = useCallback(() => {
    if (enterTimer.current) { window.clearTimeout(enterTimer.current); enterTimer.current = null; }
    leaveTimer.current = window.setTimeout(() => setIsHovered(false), 120);
  }, []);

  const navItems = [
    { to: "/app", icon: <LayoutGrid size={14} />, label: "Início", end: true },
    { to: "/app/agenda", icon: <CalendarClock size={14} />, label: "Agenda" },
    { to: "/app/leads", icon: <Filter size={14} />, label: "Leads", isPro: true },
    { to: "/app/workflow", icon: <GitBranch size={14} />, label: "Workflow" },
    { to: "/app/tarefas", icon: <CheckSquare size={14} />, label: "Tarefas", isPro: true },
    { to: "/app/financas", icon: <Wallet size={14} />, label: "Finanças", isPro: true },
    { to: "/app/clientes", icon: <UserCheck size={14} />, label: "Clientes" },
    { to: "/app/precificacao", icon: <Tag size={14} />, label: "Precificação", isPro: true },
    { to: "/app/analise-vendas", icon: <PieChart size={14} />, label: "Análise de Vendas", isPro: true },
    { to: "/app/feed-test", icon: <FlaskConical size={14} />, label: "Feed Test", isPro: true },
    { to: "/app/configuracoes", icon: <Settings size={14} />, label: "Configurações" },
    { to: "/app/integracoes", icon: <Plug size={14} />, label: "Integrações" },
    
  ];

  const isStarterPlan = accessState.planCode?.startsWith('starter') &&
    !accessState.isAdmin && !accessState.isVip && !accessState.isAuthorized;

  const toggleSidebar = () => setIsOpen(!isOpen);

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
          <div className={cn("absolute right-0 top-0 bottom-0 w-64 bg-background shadow-lunar-md transition-transform transform duration-200", isOpen ? "translate-x-0" : "translate-x-full")} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-border/50">
              <div className="flex items-center">
                <span className="font-semibold text-sm text-foreground">Lunari</span>
                <span className="ml-2 text-2xs text-muted-foreground">
                  Seu negócio em perfeita órbita
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
                <X size={14} />
              </Button>
            </div>
            <div className="p-3 space-y-1">
              {navItems.map(item => <DrawerNavItem key={item.to} {...item} showProBadge={isStarterPlan} />)}
            </div>
          </div>
        </div>
      </>;
  }

  // Desktop: fixed spacer (w-16) + absolutely-positioned sidebar that expands on hover.
  // The spacer reserves layout space so main content never shifts.
  const expandDuration = isHovered ? 200 : 240;
  const isDark = useIsDarkMode();

  return (
    <TooltipProvider delayDuration={400}>
      <div className="w-16 shrink-0 h-screen relative z-20">
        <aside
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onFocusCapture={handleEnter}
          onBlurCapture={handleLeave}
          aria-expanded={isHovered}
          style={{
            width: isHovered ? '12rem' : '4rem',
            transitionDuration: `${expandDuration}ms`,
            transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
            transitionProperty: 'width, box-shadow',
            willChange: 'width',
          }}
          className={cn(
            "absolute inset-y-0 left-0 flex flex-col p-2 bg-background border-r border-border/50 overflow-hidden",
            isHovered && "shadow-lunar-md"
          )}
        >
          {/* Logo */}
          <div className="h-10 flex items-center px-2 mb-2 overflow-hidden relative">
            <img
              src={isDark ? logoIconWhite : logoIconBlack}
              alt="Lunari"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 object-contain transition-opacity duration-150 ease-out",
                isHovered ? "opacity-0" : "opacity-100 delay-[60ms]"
              )}
            />
            <img
              src={isDark ? logoFullWhite : logoFullBlack}
              alt="Lunari"
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-6 object-contain object-left transition-opacity duration-150 ease-out",
                isHovered ? "opacity-100 delay-[60ms]" : "opacity-0"
              )}
            />
          </div>

          <div className="flex-1 pt-2">
            <div className="space-y-1">
              {navItems.map(item => (
                <DesktopNavItem
                  key={item.to}
                  {...item}
                  showProBadge={isStarterPlan}
                  expanded={isHovered}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
