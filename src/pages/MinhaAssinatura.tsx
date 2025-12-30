import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MinhaAssinatura() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { accessState, loading: accessLoading } = useAccessControl();

  const handleManageSubscription = async (action: "portal" | "cancel" | "resume") => {
    setLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-manage-subscription", {
        body: { action },
      });

      if (error) throw error;

      if (action === "portal" && data?.url) {
        window.open(data.url, "_blank");
      } else if (data?.success) {
        toast({
          title: action === "cancel" ? "Assinatura cancelada" : "Assinatura reativada",
          description: action === "cancel" 
            ? "Sua assinatura continuará ativa até o fim do período atual"
            : "Sua assinatura foi reativada com sucesso",
        });
        // Refresh page to update status
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error managing subscription:", error);
      toast({
        title: "Erro",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getPlanDisplayName = () => {
    if (accessState.isAdmin) return "Admin (Acesso Total)";
    if (accessState.isAuthorized) return "Conta Autorizada";
    if (accessState.isVip) return "VIP (Acesso Total)";
    if (accessState.planName) return accessState.planName;
    if (accessState.planCode?.includes("pro_galery")) return "Pro + Galery";
    if (accessState.planCode?.includes("pro")) return "Pro";
    if (accessState.planCode?.includes("starter")) return "Starter";
    if (accessState.isTrial) return "Período de Teste (Pro)";
    return "Sem plano";
  };

  const getStatusBadge = () => {
    if (accessState.isAdmin) {
      return <Badge className="bg-purple-500">Administrador</Badge>;
    }
    if (accessState.isAuthorized) {
      return <Badge className="bg-emerald-500">Conta Autorizada</Badge>;
    }
    if (accessState.isVip) {
      return <Badge className="bg-purple-500">VIP</Badge>;
    }
    if (accessState.status === "ok" && !accessState.isTrial) {
      return <Badge className="bg-green-500">Ativo</Badge>;
    }
    if (accessState.isTrial && accessState.daysRemaining && accessState.daysRemaining > 0) {
      return <Badge className="bg-blue-500">Teste Grátis</Badge>;
    }
    if (accessState.status === "trial_expired") {
      return <Badge variant="destructive">Teste Expirado</Badge>;
    }
    if (accessState.cancelAtPeriodEnd) {
      return <Badge variant="outline" className="text-orange-500 border-orange-500">Cancelamento Agendado</Badge>;
    }
    return <Badge variant="destructive">Inativo</Badge>;
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Minha Assinatura</h1>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {getPlanDisplayName()}
            </CardTitle>
            {getStatusBadge()}
          </div>
          <CardDescription>
            {accessState.isTrial && accessState.daysRemaining !== undefined && (
              <span className="flex items-center gap-2 text-blue-600">
                <Calendar className="w-4 h-4" />
                {accessState.daysRemaining > 0 
                  ? `${accessState.daysRemaining} dias restantes no teste grátis`
                  : "Seu teste grátis expirou"}
              </span>
            )}
            {accessState.currentPeriodEnd && !accessState.isTrial && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Próxima cobrança: {format(new Date(accessState.currentPeriodEnd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authorized users message */}
          {accessState.isAuthorized && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-300">Acesso autorizado pelo administrador</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Você tem acesso completo e gratuito ao sistema. Nenhuma cobrança será realizada.
                </p>
              </div>
            </div>
          )}

          {accessState.cancelAtPeriodEnd && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-300">Cancelamento agendado</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Sua assinatura será encerrada em {accessState.currentPeriodEnd && format(new Date(accessState.currentPeriodEnd), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          )}

          {/* Actions - hide for authorized users */}
          {!accessState.isAuthorized && !accessState.isAdmin && !accessState.isVip && (
          <div className="flex flex-wrap gap-3 pt-4">
            {/* Trial users - show upgrade button */}
            {(accessState.isTrial || accessState.status === "trial_expired" || accessState.status === "no_subscription") && (
              <Button onClick={() => navigate("/escolher-plano")} className="flex-1 min-w-[150px]">
                <CheckCircle className="w-4 h-4 mr-2" />
                Assinar Agora
              </Button>
            )}

            {/* Active subscribers - show management options */}
            {accessState.subscriptionId && !accessState.isTrial && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleManageSubscription("portal")}
                  disabled={loading !== null}
                >
                  {loading === "portal" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Gerenciar Pagamento
                </Button>

                {accessState.cancelAtPeriodEnd ? (
                  <Button
                    variant="default"
                    onClick={() => handleManageSubscription("resume")}
                    disabled={loading !== null}
                  >
                    {loading === "resume" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Reativar Assinatura
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => handleManageSubscription("cancel")}
                    disabled={loading !== null}
                  >
                    {loading === "cancel" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Cancelar Assinatura
                  </Button>
                )}

                <Button variant="ghost" onClick={() => navigate("/escolher-plano")}>
                  Trocar Plano
                </Button>
              </>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={() => navigate("/app/minha-conta")}>
        ← Voltar para Minha Conta
      </Button>
    </div>
  );
}
