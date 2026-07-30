import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAssistantAccess } from "@/modules/assistant/runtime/useAssistantAccess";

/**
 * A6 — Guard de rota das telas da assistente Lu.
 *
 * Quem está fora do estágio de rollout vê uma tela explicativa com a opção de
 * pedir acesso, em vez de abrir a tela e falhar só ao criar token/aprovar.
 */
export function RequireAssistantAccess({ children }: { children: ReactNode }) {
  const { allowed, stage, isLoading } = useAssistantAccess();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);

  useEffect(() => {
    if (allowed || isLoading) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("assistant_access_requests")
        .select("id")
        .eq("status", "pending")
        .limit(1);
      if (active) setPending((data?.length ?? 0) > 0);
    })();
    return () => {
      active = false;
    };
  }, [allowed, isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  const requestAccess = async () => {
    setSending(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      setSending(false);
      return;
    }
    const { error } = await supabase.from("assistant_access_requests").insert({
      user_id: uid,
      message: message.trim() || null,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido agora.");
      return;
    }
    setPending(true);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold">A Lu ainda está em teste fechado</h1>
      <p className="text-sm text-muted-foreground">
        {stage === "admin"
          ? "No momento a assistente está liberada apenas para a equipe Lunari."
          : "A assistente está liberada para um grupo de fotógrafos convidados."}{" "}
        Peça acesso e avisamos assim que liberarmos para você.
      </p>

      {pending ? (
        <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Seu pedido já foi enviado e está na fila de análise.
        </p>
      ) : (
        <div className="w-full space-y-3">
          <Textarea
            placeholder="Conte rapidamente como pretende usar a Lu (opcional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
          <Button className="w-full" onClick={requestAccess} disabled={sending}>
            {sending ? "Enviando..." : "Solicitar acesso"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default RequireAssistantAccess;
