import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, ExternalLink, LogOut } from "lucide-react";
import { APP_URL } from "@/lib/appContext";

interface Props {
  children: React.ReactNode;
}

/**
 * Gate único para o subdomínio admin:
 *  - sem sessão            → /auth
 *  - sem role 'admin'      → tela "Acesso restrito"
 *  - admin                 → libera children
 */
export function AdminAuthGate({ children }: Props) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { accessState, loading } = useAccessControl();
  const location = useLocation();

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!accessState.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-xl border border-border/50 bg-card/40 backdrop-blur">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="text-sm text-muted-foreground">
              Este subdomínio é exclusivo para administradores da Lunari.
              Sua conta ({user.email}) não tem permissão de admin.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.open(APP_URL, "_self")} className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir para app.lunarihub.com
            </Button>
            <Button variant="ghost" onClick={() => signOut()} className="w-full text-xs">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
