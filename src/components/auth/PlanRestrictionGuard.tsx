import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ArrowRight } from "lucide-react";

interface PlanRestrictionGuardProps {
  children: ReactNode;
  requiredPlan?: "pro" | "starter";
}

// Rotas permitidas para plano Starter
const STARTER_ALLOWED_ROUTES = [
  "/",
  "/agenda",
  "/clientes",
  "/workflow",
  "/configuracoes",
  "/minha-conta",
  "/minha-assinatura",
  "/escolher-plano",
  "/onboarding",
  "/preferencias",
];

export function PlanRestrictionGuard({ 
  children, 
  requiredPlan = "pro" 
}: PlanRestrictionGuardProps) {
  const { accessState, loading, hasPro } = useAccessControl();
  const navigate = useNavigate();

  // Se ainda está carregando, mostra loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Admin, VIP, Autorizado ou Pro sempre tem acesso total
  if (accessState?.isAdmin || accessState?.isVip || accessState?.isAuthorized || hasPro) {
    return <>{children}</>;
  }

  // Se não precisa de Pro, permite acesso
  if (requiredPlan !== "pro") {
    return <>{children}</>;
  }

  // Starter tentando acessar feature Pro
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Recurso exclusivo do plano Pro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Este recurso está disponível apenas para assinantes do plano Pro. 
            Faça upgrade para desbloquear todas as funcionalidades.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => navigate("/escolher-plano")}
              className="w-full"
            >
              <Crown className="mr-2 h-4 w-4" />
              Fazer upgrade para Pro
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="w-full"
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
