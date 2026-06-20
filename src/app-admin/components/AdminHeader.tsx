import { useNavigate, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User as UserIcon, ExternalLink } from "lucide-react";
import { APP_URL } from "@/lib/appContext";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/usuarios": "Usuários",
  "/assinaturas": "Assinaturas",
  "/planos": "Planos",
  "/conteudos": "Conteúdos",
  "/suporte": "Suporte",
  "/storage": "Storage",
  "/sistema": "Sistema",
  "/logs": "Logs",
  "/configuracoes": "Configurações",
};

function currentLabel(pathname: string) {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return "Dashboard";
  const root = `/${segs[0]}`;
  return ROUTE_LABELS[root] || segs[0];
}

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSignOut = async (scope: 'local' | 'global' = 'local') => {
    await signOut(scope);
    navigate("/auth", { replace: true });
  };

  const handleSignOutAllDevices = async () => {
    const confirmed = window.confirm(
      'Isso vai encerrar sua sessão em todos os navegadores e dispositivos onde você está logado. Deseja continuar?'
    );
    if (!confirmed) return;
    await handleSignOut('global');
  };

  const email = user?.email || "";
  const initials = (email[0] || "A").toUpperCase();

  return (
    <header className="h-12 border-b border-border/40 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 flex items-center gap-2 px-3 sticky top-0 z-30">
      <SidebarTrigger className="h-8 w-8" />

      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase tracking-wider">
          Admin
        </Badge>
        <h1 className="text-sm font-medium text-foreground truncate">
          {currentLabel(pathname)}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 hidden sm:flex"
          onClick={() => window.open(APP_URL, "_self")}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Ir para app
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                {initials}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              <div className="flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5" />
                <span className="truncate">{email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={() => window.open(APP_URL, "_self")}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Ir para app.lunarihub.com
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => handleSignOut('local')}>
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-muted-foreground" onClick={handleSignOutAllDevices}>
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair de todos os dispositivos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
