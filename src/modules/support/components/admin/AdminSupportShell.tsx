import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, MessagesSquare, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_ROUTES } from "../../config";

const TABS = [
  { to: SUPPORT_ROUTES.admin.dashboard, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: SUPPORT_ROUTES.admin.tickets, label: "Chamados", icon: MessagesSquare },
  { to: SUPPORT_ROUTES.admin.faq, label: "FAQ", icon: BookOpen },
];

export default function AdminSupportShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/40 bg-background sticky top-0 z-20">
        <div className="flex items-center gap-1 px-4 md:px-6 overflow-x-auto">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.exact}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </NavLink>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
