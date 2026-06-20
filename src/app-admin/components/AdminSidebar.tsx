import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  LifeBuoy,
  FileText,
  HardDrive,
  Cog,
  ScrollText,
  Settings2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { APP_URL } from "@/lib/appContext";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const operacao: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
];

const catalogo: Item[] = [
  { title: "Planos", url: "/planos", icon: Package },
  { title: "Conteúdos", url: "/conteudos", icon: FileText },
];

const infra: Item[] = [
  { title: "Storage", url: "/storage", icon: HardDrive },
  { title: "Sistema", url: "/sistema", icon: Cog },
  { title: "Logs", url: "/logs", icon: ScrollText },
];

const config: Item[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings2 },
];

function Group({ label, items, pathname, collapsed }: { label: string; items: Item[]; pathname: string; collapsed: boolean }) {
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <NavLink to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none">Lunari Admin</span>
              <span className="text-[10px] text-muted-foreground">Console interno</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Group label="Operação" items={operacao} pathname={pathname} collapsed={collapsed} />
        <Group label="Catálogo" items={catalogo} pathname={pathname} collapsed={collapsed} />
        <Group label="Infraestrutura" items={infra} pathname={pathname} collapsed={collapsed} />
        <Group label="Configurações" items={config} pathname={pathname} collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ir para o app do fotógrafo">
              <a href={APP_URL} className="flex items-center gap-2 text-xs">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span>Ir para app</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
