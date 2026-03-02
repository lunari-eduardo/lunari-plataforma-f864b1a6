import { useNavigate } from "react-router-dom";
import { useAsaasSubscription, AsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Loader2, CreditCard, CalendarDays, AlertTriangle,
  ArrowRight, ArrowDown, X, RotateCcw, Sparkles, CheckCircle, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPlanDisplayName } from "@/lib/planConfig";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Ativa", variant: "default" },
  PENDING: { label: "Pendente", variant: "secondary" },
  OVERDUE: { label: "Vencida", variant: "destructive" },
  CANCELLED: { label: "Cancelada", variant: "outline" },
};

export default function MinhaAssinatura() {
  const navigate = useNavigate();
  const { accessState, loading: accessLoading } = useAccessControl();
  const {
    subscriptions,
    isLoading,
    cancelSubscription,
    isCancelling,
    cancelDowngrade,
    isCancellingDowngrade,
    reactivateSubscription,
    isReactivating,
  } = useAsaasSubscription();

  if (accessLoading || isLoading) {
    return (
      <div className="container max-w-2xl py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  // Special access (admin, vip, authorized)
  const isSpecialAccess = accessState.isAdmin || accessState.isVip || accessState.isAuthorized;

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/minha-conta")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-lg font-semibold">Minha Assinatura</h1>
      </div>

      {/* Special access notice */}
      {isSpecialAccess && (
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {accessState.isAdmin ? "Administrador" : accessState.isVip ? "VIP" : "Conta Autorizada"}
              </p>
              <p className="text-sm text-muted-foreground">
                Você tem acesso completo ao sistema.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial card */}
      {accessState.isTrial && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Teste Grátis — Lunari Studio</p>
                <p className="text-sm text-muted-foreground">
                  {accessState.daysRemaining && accessState.daysRemaining > 0
                    ? `Restam ${accessState.daysRemaining} dias do seu período de teste.`
                    : "Seu período de teste expirou."}
                </p>
                {accessState.trialEndsAt && (
                  <p className="text-xs text-muted-foreground">
                    {accessState.daysRemaining && accessState.daysRemaining > 0 ? "Expira em " : "Expirou em "}
                    {format(new Date(accessState.trialEndsAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={accessState.daysRemaining && accessState.daysRemaining > 0 ? "default" : "destructive"}>
              {accessState.daysRemaining && accessState.daysRemaining > 0 ? "Teste Grátis" : "Expirado"}
            </Badge>
          </div>
          <Button onClick={() => navigate("/escolher-plano")} size="sm" className="gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" />
            Assinar um plano
          </Button>
        </div>
      )}

      {/* Subscriptions list */}
      {subscriptions.length === 0 && !isSpecialAccess ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Nenhum plano ativo</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {accessState.isTrial
                ? `Seu teste grátis ${accessState.daysRemaining && accessState.daysRemaining > 0
                    ? `termina em ${accessState.daysRemaining} dias`
                    : "expirou"
                  }. Assine para manter o acesso.`
                : "Ative um plano para acessar todas as funcionalidades."}
            </p>
          </div>
          <Button onClick={() => navigate("/escolher-plano")} className="gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Ver planos
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onCancel={cancelSubscription}
              isCancelling={isCancelling}
              onCancelDowngrade={cancelDowngrade}
              isCancellingDowngrade={isCancellingDowngrade}
              onReactivate={reactivateSubscription}
              isReactivating={isReactivating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Subscription Card ─── */

function SubscriptionCard({
  subscription,
  onCancel,
  isCancelling,
  onCancelDowngrade,
  isCancellingDowngrade,
  onReactivate,
  isReactivating,
}: {
  subscription: AsaasSubscription;
  onCancel: (id: string) => Promise<any>;
  isCancelling: boolean;
  onCancelDowngrade: (id: string) => Promise<any>;
  isCancellingDowngrade: boolean;
  onReactivate: (id: string) => Promise<any>;
  isReactivating: boolean;
}) {
  const navigate = useNavigate();
  const isCancelled = subscription.status === "CANCELLED";
  const nextDueDate = subscription.next_due_date ? new Date(subscription.next_due_date) : null;
  const isStillActive = isCancelled && nextDueDate && nextDueDate > new Date();
  const statusInfo = STATUS_MAP[subscription.status] || { label: subscription.status || "—", variant: "outline" as const };

  return (
    <div className="space-y-4">
      {/* Cancelled but still active notice */}
      {isStillActive && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-foreground">Assinatura cancelada</p>
              <p className="text-sm text-muted-foreground">
                Seu plano permanece ativo até{" "}
                <span className="font-semibold text-foreground">
                  {format(nextDueDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                . Após essa data, você perderá o acesso.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isReactivating}
            onClick={async () => { try { await onReactivate(subscription.id); } catch {} }}
          >
            {isReactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Desfazer cancelamento
          </Button>
        </div>
      )}

      {/* Plan details */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <p className="text-xl font-bold text-foreground capitalize">
              {getPlanDisplayName(subscription.plan_type)}
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription.billing_cycle === "YEARLY" ? "Plano anual (~15% off)" : "Plano mensal"}
            </p>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DetailItem
            icon={CreditCard}
            label="Valor"
            value={`${(subscription.value_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
            sub={subscription.billing_cycle === "MONTHLY" ? "/mês" : "/ano"}
          />
          <DetailItem
            icon={CalendarDays}
            label={isCancelled ? "Acesso até" : "Próxima cobrança"}
            value={
              subscription.next_due_date
                ? format(new Date(subscription.next_due_date), "dd 'de' MMMM, yyyy", { locale: ptBR })
                : "—"
            }
          />
          <DetailItem
            icon={CalendarDays}
            label="Assinante desde"
            value={format(new Date(subscription.created_at), "dd MMM yyyy", { locale: ptBR })}
          />
        </div>
      </div>

      {/* Pending downgrade */}
      {!isCancelled && subscription.pending_downgrade_plan && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <ArrowDown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-foreground">Downgrade agendado</p>
              <p className="text-sm text-muted-foreground">
                Seu plano será alterado para{" "}
                <span className="font-semibold text-foreground">
                  {getPlanDisplayName(subscription.pending_downgrade_plan)}
                </span>{" "}
                na próxima renovação.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-500/10"
              disabled={isCancellingDowngrade}
              onClick={async () => { try { await onCancelDowngrade(subscription.id); } catch {} }}
            >
              {isCancellingDowngrade ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancelar downgrade
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isCancelled && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Ações</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/escolher-plano")}
              className="gap-1.5"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Upgrade / Downgrade
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Cancelar assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura de{" "}
                    <span className="font-semibold">{getPlanDisplayName(subscription.plan_type)}</span>?
                    Você manterá o acesso até o final do período vigente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => { try { await onCancel(subscription.id); } catch {} }}
                    disabled={isCancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCancelling ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</>
                    ) : (
                      "Confirmar cancelamento"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações de plano são ajustadas proporcionalmente ao período atual.
          </p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">
          {value}
          {sub && <span className="text-xs text-muted-foreground ml-0.5">{sub}</span>}
        </p>
      </div>
    </div>
  );
}
